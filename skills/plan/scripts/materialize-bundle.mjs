import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VERIFIED = "syntactically-verified";
const DECLARATIVE = "declarative-unverified";

// The bounded built-in strategy matrix (references/syntax-strategies.md). Placeholder bytes are
// the checked-in safe content for a missing path; an existing path is compatible only when its
// bytes equal that placeholder exactly.
const STRATEGIES = new Map([
  ["javascript-esm-mjs", { suffix: ".mjs", placeholder: "export {};\n" }],
  ["javascript-commonjs-cjs", { suffix: ".cjs", placeholder: "'use strict';\n\nmodule.exports = {};\n" }],
  ["typescript-esm-ts", { suffix: ".ts", placeholder: "export {};\n" }],
  ["python-module-py", { suffix: ".py", placeholder: "__all__ = []\n" }],
]);

const NODE_TYPES = new Set(["task", "file", "module", "public-contract"]);
const NODE_KEYS = new Set(["id", "type", "label", "taskId", "path", "contract"]);
const EDGE_TYPES = new Set(["owns", "depends-on", "imports", "exports", "produces", "consumes"]);
const ASSURED_EDGE_TYPES = new Set(["imports", "exports", "produces", "consumes"]);
const EDGE_KEYS = new Set(["id", "type", "source", "target", "assurance"]);
const ASSURANCES = new Set([VERIFIED, DECLARATIVE]);
const PLAN_FILENAME = /^(\d{4}-\d{2}-\d{2})-(.+)\.plan\.md$/u;
const PLACEHOLDER_TOKEN = "<...>";

function fail(message) {
  throw new Error(`Invalid materialization bundle: ${message}`);
}

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function normalizeRepositoryPath(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    fail(`${label} must be a non-empty repository-relative path`);
  }

  const portable = value.replaceAll("\\", "/");
  if (portable.startsWith("/") || portable.startsWith("//") || /^[A-Za-z]:\//u.test(portable)) {
    fail(`${label} must not be an absolute path: ${value}`);
  }

  const segments = portable.split("/");
  if (segments.some((segment) => segment === "..")) {
    fail(`${label} contains path traversal: ${value}`);
  }
  const normalized = segments.filter((segment) => segment !== "" && segment !== ".").join("/");
  if (!normalized) fail(`${label} does not identify a file`);
  return normalized;
}

function inferStrategy(normalizedPath) {
  for (const [id, { suffix }] of STRATEGIES) {
    if (normalizedPath.endsWith(suffix)) return id;
  }
  return null;
}

function placeholderFor(strategyId) {
  return strategyId === null ? "" : STRATEGIES.get(strategyId).placeholder;
}

function nonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) fail(`${label} must be a non-empty string`);
  if (value.includes(PLACEHOLDER_TOKEN)) fail(`${label} still contains the unfilled placeholder token ${PLACEHOLDER_TOKEN}`);
  return value.trim();
}

function stringList(value, label, { allowEmpty = false } = {}) {
  if (value === undefined && allowEmpty) return [];
  if (!Array.isArray(value)) fail(`${label} must be an array of strings`);
  if (!allowEmpty && value.length === 0) fail(`${label} must not be empty`);
  return value.map((item, index) => nonEmptyString(item, `${label}[${index}]`));
}

async function lstatOrNull(target) {
  try {
    return await fs.lstat(target);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function resolveSafeTarget(root, realRoot, relativePath) {
  const target = path.resolve(root, ...relativePath.split("/"));
  if (!isWithin(root, target) || target === root) {
    fail(`path resolves outside the repository: ${relativePath}`);
  }

  let ancestor = target;
  let ancestorStat = await lstatOrNull(ancestor);
  while (!ancestorStat) {
    const parent = path.dirname(ancestor);
    if (parent === ancestor || !isWithin(root, parent)) {
      fail(`could not resolve a safe repository parent for ${relativePath}`);
    }
    ancestor = parent;
    ancestorStat = await lstatOrNull(ancestor);
  }

  const realAncestor = await fs.realpath(ancestor);
  if (!isWithin(realRoot, realAncestor)) {
    fail(`path escapes the repository through a symbolic link: ${relativePath}`);
  }
  if (ancestor !== target && !ancestorStat.isDirectory()) {
    fail(`path has a non-directory parent: ${relativePath}`);
  }
  if (ancestor === target) {
    const followed = await fs.stat(target);
    if (!followed.isFile()) fail(`path is not a regular file: ${relativePath}`);
  }
  return target;
}

// An entry with no `strategyId` is resolved at preflight ("auto"): a missing path receives the
// placeholder of the strategy its extension selects (or a zero-byte opaque placeholder), while an
// existing path is verified only when its bytes equal that placeholder and is otherwise preserved
// as opaque. An explicit `strategyId` keeps strict behavior and reports mismatches as conflicts.
function validateEntry(entry, index) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) fail(`entry ${index} must be an object`);
  const normalizedPath = normalizeRepositoryPath(entry.path, `entry ${index} path`);
  const connections = entry.connections === undefined ? [] : entry.connections;
  if (!Array.isArray(connections)) fail(`entry ${normalizedPath} connections must be an array`);

  if (entry.strategyId === undefined) {
    if (entry.content !== undefined) fail(`entry ${normalizedPath} must name a strategyId when it supplies content`);
    return { path: normalizedPath, strategyId: undefined, content: undefined, connections, auto: true };
  }

  let content = entry.content;
  if (entry.strategyId === null) {
    if (content === undefined) content = "";
    if (content !== "") fail(`opaque entry ${normalizedPath} must use a zero-byte placeholder`);
  } else {
    const strategy = STRATEGIES.get(entry.strategyId);
    if (!strategy) fail(`entry ${normalizedPath} names an unknown syntax strategy`);
    if (!normalizedPath.endsWith(strategy.suffix)) {
      fail(`entry ${normalizedPath} does not match syntax strategy ${entry.strategyId}`);
    }
    if (content === undefined) content = strategy.placeholder;
  }
  if (typeof content !== "string") fail(`entry ${normalizedPath} content must be a string`);
  return { path: normalizedPath, strategyId: entry.strategyId, content, connections, auto: false };
}

function validateDocument(document, planPath, entries) {
  if (!document || typeof document !== "object" || Array.isArray(document)) fail("document must be an object");
  const filename = path.posix.basename(planPath);
  const match = PLAN_FILENAME.exec(filename);
  if (!match) fail(`planPath must be named YYYY-MM-DD-<slug>.plan.md: ${planPath}`);
  const slug = match[2];
  const taskIdPattern = new RegExp(`^${slug.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}-t\\d{2,}$`, "u");

  const title = nonEmptyString(document.title, "document.title");
  const goal = nonEmptyString(document.goal, "document.goal");
  const sourceSpec = nonEmptyString(document.sourceSpec, "document.sourceSpec");
  const flaggedConstraints = stringList(document.flaggedConstraints, "document.flaggedConstraints", { allowEmpty: true });
  if (!Array.isArray(document.tasks) || document.tasks.length === 0) fail("document.tasks must be a non-empty array");

  const taskIds = new Set();
  const ownedBy = new Map();
  const tasks = document.tasks.map((task, index) => {
    const label = `document.tasks[${index}]`;
    if (!task || typeof task !== "object" || Array.isArray(task)) fail(`${label} must be an object`);
    const taskId = nonEmptyString(task.taskId, `${label}.taskId`);
    if (!taskIdPattern.test(taskId)) fail(`task ${taskId} does not follow the ${slug}-t<NN> scheme`);
    if (taskIds.has(taskId)) fail(`duplicate task ID ${taskId}`);
    taskIds.add(taskId);

    const ownedFiles = [...new Set(stringList(task.ownedFiles, `task ${taskId} ownedFiles`)
      .map((file, fileIndex) => normalizeRepositoryPath(file, `task ${taskId} ownedFiles[${fileIndex}]`)))];
    for (const file of ownedFiles) {
      if (ownedBy.has(file)) fail(`task ${taskId} and task ${ownedBy.get(file)} both own ${file}; owned files must be disjoint`);
      ownedBy.set(file, taskId);
    }

    const acceptanceCriteria = stringList(task.acceptanceCriteria, `task ${taskId} acceptanceCriteria`);
    acceptanceCriteria.forEach((criterion, criterionIndex) => {
      if (!/^(?:WHEN|IF)\b/u.test(criterion) || !/\bSHALL\b/u.test(criterion)) {
        fail(`task ${taskId} acceptance criterion ${criterionIndex + 1} is reference-only; every criterion needs a WHEN/IF ... SHALL sentence`);
      }
    });

    return {
      number: index + 1,
      title: nonEmptyString(task.title, `${label}.title`),
      taskId,
      ownedFiles,
      interfaces: nonEmptyString(task.interfaces, `task ${taskId} interfaces`),
      acceptanceCriteria,
      verification: nonEmptyString(task.verification, `task ${taskId} verification`),
      nonGoals: stringList(task.nonGoals, `task ${taskId} nonGoals`),
      blockedBy: [...new Set(stringList(task.blockedBy, `task ${taskId} blockedBy`, { allowEmpty: true }))],
      constraints: nonEmptyString(task.constraints, `task ${taskId} constraints`),
    };
  });

  for (const [index, task] of tasks.entries()) {
    for (const blocker of task.blockedBy) {
      if (!taskIds.has(blocker)) fail(`task ${task.taskId} is blocked by unknown task ID ${blocker}`);
      if (blocker === task.taskId) fail(`task ${task.taskId} is blocked by itself`);
    }
    if (tasks.length >= 2 && index > 0 && task.blockedBy.length === 0) {
      fail(`task ${task.taskId} needs at least one blocked-by edge; only Task 1 (the walking skeleton) may have none`);
    }
  }
  const byId = new Map(tasks.map((task) => [task.taskId, task]));
  const state = new Map();
  const visit = (taskId, trail) => {
    if (state.get(taskId) === "done") return;
    if (state.get(taskId) === "active") fail(`blocked-by edges form a cycle: ${[...trail, taskId].join(" -> ")}`);
    state.set(taskId, "active");
    for (const blocker of byId.get(taskId).blockedBy) visit(blocker, [...trail, taskId]);
    state.set(taskId, "done");
  };
  for (const task of tasks) visit(task.taskId, []);

  // Every owned file is a planned path. Files the model did not describe as entries become auto
  // entries so the skeleton, manifest, and graph stay complete without extra model output.
  const known = new Set(entries.map((entry) => entry.path));
  const extraEntries = [...ownedBy.keys()]
    .filter((file) => !known.has(file))
    .map((file) => ({ path: file, strategyId: undefined, content: undefined, connections: [], auto: true }));

  return { slug, title, goal, sourceSpec, flaggedConstraints, tasks, ownedBy, extraEntries };
}

function edgeId(edge) {
  return `edge:${edge.type}:${edge.source}->${edge.target}`;
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortNodes(nodes) {
  return [...nodes].sort((a, b) => compareStrings(a.type, b.type) || compareStrings(a.id, b.id));
}

function sortEdges(edges) {
  return [...edges].sort((a, b) => compareStrings(a.type, b.type) || compareStrings(a.source, b.source)
    || compareStrings(a.target, b.target) || compareStrings(a.id, b.id));
}

// Structural validation equivalent to graph-schema.json plus the identity checks in
// references/graph-projection.md. Derived task/file nodes and owns/depends-on edges are merged in
// first so the model only has to declare module/contract nodes and connection edges.
function validateGraph(rawGraph, plan, derived, plannedPaths) {
  const graph = rawGraph === undefined ? {} : rawGraph;
  if (!graph || typeof graph !== "object" || Array.isArray(graph)) fail("graph must be an object");
  if (graph.schemaVersion !== undefined && graph.schemaVersion !== 1) fail("graph schemaVersion must be 1");
  if (graph.plan !== undefined && graph.plan !== plan) fail("graph identity and schemaVersion must match the request");
  const rawNodes = graph.nodes === undefined ? [] : graph.nodes;
  const rawEdges = graph.edges === undefined ? [] : graph.edges;
  if (!Array.isArray(rawNodes) || !Array.isArray(rawEdges)) fail("graph nodes and edges must be arrays");

  const nodes = new Map();
  const addNode = (node, index, source) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) fail(`graph node ${index} must be an object`);
    for (const key of Object.keys(node)) {
      if (!NODE_KEYS.has(key)) fail(`graph node ${node.id ?? index} has unsupported property ${key}`);
    }
    if (typeof node.id !== "string" || node.id.length === 0) fail(`graph node ${index} must have a non-empty id`);
    if (!NODE_TYPES.has(node.type)) fail(`graph node ${node.id} has invalid type ${node.type}`);
    if (!node.id.startsWith(`${node.type}:`)) fail(`graph node ${node.id} must be prefixed by its type ${node.type}:`);
    if (node.type === "task" && node.taskId !== undefined && node.taskId !== node.id.slice("task:".length)) {
      fail(`graph node ${node.id} taskId ${node.taskId} does not match its node ID`);
    }
    for (const key of ["label", "taskId", "path", "contract"]) {
      if (node[key] !== undefined && (typeof node[key] !== "string" || node[key].length === 0)) {
        fail(`graph node ${node.id} ${key} must be a non-empty string`);
      }
    }
    const existing = nodes.get(node.id);
    if (existing) {
      if (source === "derived" || existing.type !== node.type) fail(`duplicate node ID ${node.id}`);
      nodes.set(node.id, { ...node, ...existing });
      return;
    }
    nodes.set(node.id, { ...node });
  };
  derived.nodes.forEach((node, index) => addNode(node, index, "derived"));
  rawNodes.forEach((node, index) => addNode(node, index, "model"));

  const edges = new Map();
  const addEdge = (edge, index, source) => {
    if (!edge || typeof edge !== "object" || Array.isArray(edge)) fail(`graph edge ${index} must be an object`);
    for (const key of Object.keys(edge)) {
      if (!EDGE_KEYS.has(key)) fail(`graph edge ${edge.id ?? index} has unsupported property ${key}`);
    }
    if (!EDGE_TYPES.has(edge.type)) fail(`graph edge ${edge.id ?? index} has invalid type ${edge.type}`);
    for (const end of ["source", "target"]) {
      if (typeof edge[end] !== "string" || edge[end].length === 0) fail(`graph edge ${edge.id ?? index} must have a ${end}`);
    }
    const id = edgeId(edge);
    if (edge.id !== undefined && edge.id !== id) fail(`edge ID ${edge.id} does not match its type and endpoints (${id})`);
    for (const end of ["source", "target"]) {
      if (!nodes.has(edge[end])) fail(`edge ${id} references missing ${end} node ${edge[end]}`);
    }
    const normalized = { id, type: edge.type, source: edge.source, target: edge.target };
    if (ASSURED_EDGE_TYPES.has(edge.type)) {
      const assurance = edge.assurance === undefined ? DECLARATIVE : edge.assurance;
      if (!ASSURANCES.has(assurance)) fail(`edge ${id} has invalid assurance ${edge.assurance}`);
      normalized.assurance = assurance;
    } else if (edge.assurance !== undefined) {
      if (!ASSURANCES.has(edge.assurance)) fail(`edge ${id} has invalid assurance ${edge.assurance}`);
      normalized.assurance = edge.assurance;
    }
    if (edges.has(id)) {
      if (source === "derived") fail(`duplicate edge ID ${id}`);
      return;
    }
    edges.set(id, normalized);
  };
  derived.edges.forEach((edge, index) => addEdge(edge, index, "derived"));
  rawEdges.forEach((edge, index) => addEdge(edge, index, "model"));

  if (derived.enforceOwnership) {
    const owned = new Set([...edges.values()].filter((edge) => edge.type === "owns").map((edge) => edge.target));
    for (const planned of plannedPaths) {
      if (!owned.has(`file:${planned}`)) fail(`unowned planned file file:${planned}: no task owns it`);
    }
  }

  return {
    schemaVersion: 1,
    plan,
    nodes: sortNodes(nodes.values()),
    edges: sortEdges(edges.values()),
  };
}

function deriveGraph(document, entryPaths) {
  const nodes = [];
  const edges = [];
  for (const task of document.tasks) {
    nodes.push({ id: `task:${task.taskId}`, type: "task", label: task.title, taskId: task.taskId });
  }
  for (const planned of entryPaths) nodes.push({ id: `file:${planned}`, type: "file", path: planned });
  for (const task of document.tasks) {
    for (const file of task.ownedFiles) {
      edges.push({ type: "owns", source: `task:${task.taskId}`, target: `file:${file}` });
    }
    for (const blocker of task.blockedBy) {
      edges.push({ type: "depends-on", source: `task:${task.taskId}`, target: `task:${blocker}` });
    }
  }
  return { nodes, edges, enforceOwnership: true };
}

// Deterministic per-task projection (references/graph-projection.md).
function projectSlice(taskId, graph) {
  const taskNode = `task:${taskId}`;
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const selected = new Map();
  const owned = new Set();
  const consumed = new Set();
  const produced = new Set();
  for (const edge of graph.edges) {
    if (edge.source !== taskNode) continue;
    if (edge.type === "owns") owned.add(edge.target);
    else if (edge.type === "consumes") consumed.add(edge.target);
    else if (edge.type === "produces") produced.add(edge.target);
    else if (edge.type !== "depends-on") continue;
    selected.set(edge.id, edge);
  }
  const touched = new Set([...owned, ...consumed, ...produced]);
  for (const edge of graph.edges) {
    if ((edge.type === "imports" || edge.type === "exports") && (touched.has(edge.source) || touched.has(edge.target))) {
      selected.set(edge.id, edge);
    }
  }
  const nodeIds = new Set([taskNode]);
  for (const edge of selected.values()) {
    nodeIds.add(edge.source);
    nodeIds.add(edge.target);
  }
  const nodes = sortNodes([...nodeIds].map((id) => nodesById.get(id))).map(({ id, type }) => ({ id, type }));
  const edges = sortEdges(selected.values()).map((edge) => {
    const rendered = { id: edge.id, type: edge.type, source: edge.source, target: edge.target };
    if (edge.assurance !== undefined) rendered.assurance = edge.assurance;
    return rendered;
  });
  return JSON.stringify({
    task: taskId,
    owned: [...owned].sort(compareStrings),
    consumed: [...consumed].sort(compareStrings),
    produced: [...produced].sort(compareStrings),
    nodes,
    edges,
  });
}

function renderPlan(document, graph, manifestPath, graphPath) {
  const lines = [
    `# ${document.title} - implementation plan`,
    `Goal: ${document.goal}`,
    `Source spec: ${document.sourceSpec}`,
    `Flagged constraints (unconfirmed): ${document.flaggedConstraints.length ? document.flaggedConstraints.join("; ") : "None"}`,
    `Skeleton manifest: ${manifestPath}`,
    `Dependency graph: ${graphPath}`,
  ];
  for (const task of document.tasks) {
    lines.push("", `### Task ${task.number}: ${task.title}`);
    lines.push(`Task ID: ${task.taskId}`);
    lines.push(`Owned files: ${task.ownedFiles.join(", ")}`);
    lines.push(`Interfaces: ${task.interfaces}`);
    lines.push(`Graph context: ${projectSlice(task.taskId, graph)}`);
    lines.push("Acceptance criteria:");
    for (const criterion of task.acceptanceCriteria) lines.push(`- ${criterion}`);
    lines.push(`Verification: ${task.verification}`);
    lines.push("Non-goals:");
    for (const nonGoal of task.nonGoals) lines.push(`- ${nonGoal}`);
    lines.push(`Blocked by: ${task.blockedBy.length ? task.blockedBy.join(", ") : "none"}`);
    lines.push(`Constraints: ${task.constraints}`);
  }
  return `${lines.join("\n")}\n`;
}

function validateRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) fail("request must be an object");
  if (request.schemaVersion !== 1) fail("schemaVersion must be 1");
  if (typeof request.repositoryRoot !== "string" || !path.isAbsolute(request.repositoryRoot)) {
    fail("repositoryRoot must be an absolute path");
  }
  const entriesInput = request.entries === undefined ? [] : request.entries;
  if (!Array.isArray(entriesInput)) fail("entries must be an array");

  const planPath = request.planPath === undefined ? undefined : normalizeRepositoryPath(request.planPath, "planPath");
  let plan = request.plan;
  if (plan === undefined) plan = planPath;
  if (typeof plan !== "string" || plan.length === 0) fail("plan must be a non-empty string");
  if (planPath !== undefined && plan !== planPath) fail(`plan identity ${plan} must equal the normalized planPath ${planPath}`);

  let manifestPath;
  let graphPath;
  if (planPath !== undefined) {
    if (!PLAN_FILENAME.test(path.posix.basename(planPath))) {
      fail(`planPath must be named YYYY-MM-DD-<slug>.plan.md: ${planPath}`);
    }
    const stem = planPath.slice(0, -".plan.md".length);
    manifestPath = request.manifestPath === undefined ? `${stem}.skeleton.json`
      : normalizeRepositoryPath(request.manifestPath, "manifestPath");
    graphPath = request.graphPath === undefined ? `${stem}.graph.json`
      : normalizeRepositoryPath(request.graphPath, "graphPath");
    if (manifestPath !== `${stem}.skeleton.json` || graphPath !== `${stem}.graph.json`) {
      fail("manifestPath and graphPath must be the sidecars adjacent to planPath");
    }
  } else {
    manifestPath = normalizeRepositoryPath(request.manifestPath, "manifestPath");
    graphPath = normalizeRepositoryPath(request.graphPath, "graphPath");
  }

  let entries = entriesInput.map(validateEntry);
  let document;
  let derived = { nodes: [], edges: [], enforceOwnership: false };
  if (request.document !== undefined) {
    if (planPath === undefined) fail("planPath is required when a document is supplied");
    document = validateDocument(request.document, planPath, entries);
    entries = [...entries, ...document.extraEntries];
    derived = deriveGraph(document, entries.map((entry) => entry.path));
  }

  const allPaths = [...entries.map((entry) => entry.path), manifestPath, graphPath, ...(planPath ? [planPath] : [])];
  if (new Set(allPaths).size !== allPaths.length) fail("source and sidecar paths must be unique");
  const sorted = [...allPaths].sort();
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].startsWith(`${sorted[index - 1]}/`)) {
      fail(`planned paths overlap as a file and directory: ${sorted[index - 1]}`);
    }
  }

  const graph = validateGraph(request.graph, plan, derived, entries.map((entry) => entry.path));
  return { ...request, plan, planPath, document, entries, manifestPath, graphPath, graph };
}

function assuranceFor(entry) {
  return entry.strategyId === null ? DECLARATIVE : VERIFIED;
}

function manifestEntryFor(entry, classification) {
  return {
    path: entry.path,
    classification: classification === "missing" ? "created" : classification,
    assurance: assuranceFor(entry),
  };
}

function reusableManifest(candidate, request, classifications) {
  if (!candidate || candidate.schemaVersion !== 1 || candidate.plan !== request.plan || !Array.isArray(candidate.entries)) {
    return false;
  }
  if (candidate.entries.length !== request.entries.length) return false;
  const byPath = new Map(candidate.entries.map((entry) => [entry?.path, entry]));
  if (byPath.size !== candidate.entries.length) return false;

  return request.entries.every((entry) => {
    const oldEntry = byPath.get(entry.path);
    const current = classifications.get(entry.path);
    if (!oldEntry || oldEntry.assurance !== assuranceFor(entry)) return false;
    if (current === "verified-compatible") {
      return oldEntry.classification === "created" || oldEntry.classification === "verified-compatible";
    }
    if (current === "opaque-preserved") {
      return oldEntry.classification === "created" || oldEntry.classification === "opaque-preserved";
    }
    return oldEntry.classification === "created";
  });
}

function structurallyEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function inspectSidecar(target, relativePath, desired, reuse) {
  const stat = await lstatOrNull(target);
  const desiredBytes = Buffer.from(`${JSON.stringify(desired, null, 2)}\n`);
  if (!stat) return { relativePath, target, exists: false, bytes: desiredBytes, value: desired };

  let bytes;
  let value;
  try {
    bytes = await fs.readFile(target);
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    return { relativePath, target, exists: true, conflict: true };
  }
  if (!reuse(value) && !structurallyEqual(value, desired)) {
    return { relativePath, target, exists: true, conflict: true };
  }
  return { relativePath, target, exists: true, bytes, value };
}

async function inspectPlan(target, relativePath, desiredText) {
  const stat = await lstatOrNull(target);
  const bytes = Buffer.from(desiredText);
  if (!stat) return { relativePath, target, exists: false, bytes };
  const existing = await fs.readFile(target);
  if (!existing.equals(bytes)) return { relativePath, target, exists: true, conflict: true };
  return { relativePath, target, exists: true, bytes: existing };
}

async function ensureParentDirectories(root, realRoot, target, createdDirectories) {
  const relativeParent = path.relative(root, path.dirname(target));
  if (!relativeParent) return;
  let current = root;
  for (const segment of relativeParent.split(path.sep)) {
    current = path.join(current, segment);
    const stat = await lstatOrNull(current);
    if (!stat) {
      try {
        await fs.mkdir(current);
        createdDirectories.add(current);
        continue;
      } catch (error) {
        if (error?.code !== "EEXIST") throw error;
      }
    }
    const realCurrent = await fs.realpath(current);
    const followed = await fs.stat(current);
    if (!followed.isDirectory() || !isWithin(realRoot, realCurrent)) {
      throw new Error(`Unsafe materialization parent: ${current}`);
    }
  }
}

async function removeApplied(createdTargets, createdDirectories, root, realRoot) {
  for (const target of [...createdTargets].reverse()) {
    try {
      const parentReal = await fs.realpath(path.dirname(target));
      if (!isWithin(realRoot, parentReal) || !isWithin(root, target)) {
        throw new Error(`Refusing to roll back an unsafe path: ${target}`);
      }
      await fs.unlink(target);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  const directories = [...createdDirectories].sort((left, right) => right.length - left.length);
  for (const directory of directories) {
    try {
      await fs.rmdir(directory);
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTEMPTY") throw error;
    }
  }
}

async function preflight(bundlePath) {
  const requestBytes = await fs.readFile(bundlePath);
  let parsed;
  try {
    parsed = JSON.parse(requestBytes.toString("utf8"));
  } catch (error) {
    throw new Error(`Invalid materialization bundle JSON: ${error.message}`, { cause: error });
  }
  const request = validateRequest(parsed);
  const root = path.resolve(request.repositoryRoot);
  const rootStat = await fs.stat(root);
  if (!rootStat.isDirectory()) fail("repositoryRoot must identify a directory");
  const realRoot = await fs.realpath(root);

  const classifications = new Map();
  const resolvedEntries = [];
  const conflicts = [];
  for (const candidate of request.entries) {
    const target = await resolveSafeTarget(root, realRoot, candidate.path);
    const stat = await lstatOrNull(target);
    let entry = candidate;
    if (candidate.auto) {
      const inferred = inferStrategy(candidate.path);
      const placeholder = placeholderFor(inferred);
      let strategyId = inferred;
      if (stat && (inferred === null || !(await fs.readFile(target)).equals(Buffer.from(placeholder)))) {
        strategyId = null;
      }
      entry = { ...candidate, strategyId, content: placeholderFor(strategyId), auto: false };
    }
    let classification;
    if (!stat) {
      classification = "missing";
    } else if (entry.strategyId === null) {
      classification = "opaque-preserved";
    } else {
      const actual = await fs.readFile(target);
      classification = actual.equals(Buffer.from(entry.content)) ? "verified-compatible" : "conflicting";
      if (classification === "conflicting") conflicts.push(entry.path);
    }
    classifications.set(entry.path, classification);
    resolvedEntries.push({ entry, target, classification });
  }
  const entries = resolvedEntries.map(({ entry }) => entry);
  const resolvedRequest = { ...request, entries };

  const manifest = {
    schemaVersion: 1,
    plan: request.plan,
    entries: entries.map((entry) => manifestEntryFor(entry, classifications.get(entry.path))),
  };
  const manifestTarget = await resolveSafeTarget(root, realRoot, request.manifestPath);
  const graphTarget = await resolveSafeTarget(root, realRoot, request.graphPath);
  const manifestSidecar = await inspectSidecar(
    manifestTarget,
    request.manifestPath,
    manifest,
    (candidate) => reusableManifest(candidate, resolvedRequest, classifications),
  );
  const graphSidecar = await inspectSidecar(
    graphTarget,
    request.graphPath,
    request.graph,
    (candidate) => structurallyEqual(candidate, request.graph),
  );
  let planFile;
  if (request.document) {
    const planTarget = await resolveSafeTarget(root, realRoot, request.planPath);
    const rendered = renderPlan(request.document, request.graph, request.manifestPath, request.graphPath);
    planFile = await inspectPlan(planTarget, request.planPath, rendered);
  }
  for (const sidecar of [planFile, manifestSidecar, graphSidecar]) {
    if (sidecar?.conflict) conflicts.push(sidecar.relativePath);
  }

  return {
    request: resolvedRequest,
    root,
    realRoot,
    resolvedEntries,
    classifications,
    conflicts,
    manifest,
    manifestSidecar,
    graphSidecar,
    planFile,
  };
}

function publicReport(state) {
  const report = {
    schemaVersion: 1,
    plan: state.request.plan,
    entries: state.resolvedEntries.map(({ entry, classification }) => ({
      path: entry.path,
      classification,
      assurance: assuranceFor(entry),
    })),
    conflicts: [...state.conflicts],
  };
  if (state.request.planPath) report.planPath = state.request.planPath;
  return report;
}

/**
 * Preflight and optionally materialize a fully local skeleton bundle.
 *
 * With a `document`, the canonical plan is rendered from the same request and written in the
 * same transaction as the skeleton and sidecars. The returned rollback function removes only
 * paths created by this invocation.
 */
export async function materializeBundle(bundlePath, options = {}) {
  if (typeof bundlePath !== "string" && !(bundlePath instanceof URL)) {
    throw new TypeError("bundlePath must be a local path or file URL");
  }
  const state = await preflight(bundlePath);
  const report = publicReport(state);
  if (options.preflightOnly === true) return report;

  if (state.conflicts.length > 0) {
    const error = new Error(`Materialization conflicts: ${state.conflicts.join(", ")}`);
    error.conflicts = [...state.conflicts];
    error.report = report;
    throw error;
  }

  const injectAfter = options.injectFailureAfterWrites;
  if (injectAfter !== undefined && (!Number.isInteger(injectAfter) || injectAfter < 0)) {
    throw new TypeError("injectFailureAfterWrites must be a non-negative integer");
  }

  const pending = state.resolvedEntries
    .filter(({ classification }) => classification === "missing")
    .map(({ entry, target }) => ({ relativePath: entry.path, target, bytes: Buffer.from(entry.content) }));
  for (const sidecar of [state.planFile, state.manifestSidecar, state.graphSidecar]) {
    if (sidecar && !sidecar.exists) pending.push(sidecar);
  }

  const createdTargets = [];
  const createdDirectories = new Set();
  let stagingDirectory;
  let writes = 0;
  try {
    stagingDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "ideas-materialization-"));
    for (let index = 0; index < pending.length; index += 1) {
      await fs.writeFile(path.join(stagingDirectory, `${index}.stage`), pending[index].bytes, { flag: "wx" });
    }
    if (injectAfter === 0) throw new Error("Injected materialization apply failure before writes");

    for (let index = 0; index < pending.length; index += 1) {
      const item = pending[index];
      await ensureParentDirectories(state.root, state.realRoot, item.target, createdDirectories);
      await fs.copyFile(path.join(stagingDirectory, `${index}.stage`), item.target, fsConstants.COPYFILE_EXCL);
      createdTargets.push(item.target);
      writes += 1;
      if (injectAfter !== undefined && writes >= injectAfter) {
        throw new Error(`Injected materialization apply failure after ${writes} writes`);
      }
    }
    await fs.rm(stagingDirectory, { recursive: true, force: true });
    stagingDirectory = undefined;
  } catch (error) {
    const failures = [error];
    try {
      await removeApplied(createdTargets, createdDirectories, state.root, state.realRoot);
    } catch (rollbackError) {
      failures.push(rollbackError);
    }
    if (stagingDirectory) {
      try {
        await fs.rm(stagingDirectory, { recursive: true, force: true });
      } catch (cleanupError) {
        failures.push(cleanupError);
      }
    }
    if (failures.length > 1) {
      throw new AggregateError(failures, "Materialization apply, rollback, or staging cleanup failed");
    }
    throw new Error(`Materialization apply failed: ${error.message}`, { cause: error });
  }

  let rolledBack = false;
  const rollback = async () => {
    if (rolledBack) return;
    await removeApplied(createdTargets, createdDirectories, state.root, state.realRoot);
    rolledBack = true;
  };

  return {
    ...report,
    entries: state.manifestSidecar.exists ? state.manifestSidecar.value.entries : state.manifest.entries,
    manifest: state.manifestSidecar.exists ? state.manifestSidecar.value : state.manifest,
    graph: state.request.graph,
    createdPaths: pending.map((item) => item.relativePath),
    rollback,
  };
}

// CLI: node materialize-bundle.mjs <request.json> [--preflight]
// Prints one JSON object to stdout; exit code 1 on refusal, conflict, or failure.
function isMainModule() {
  try {
    return process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  const args = process.argv.slice(2);
  const preflightOnly = args.includes("--preflight");
  const requestPath = args.find((arg) => !arg.startsWith("--"));
  const print = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  if (!requestPath) {
    print({ ok: false, error: "usage: node materialize-bundle.mjs <request.json> [--preflight]" });
    process.exitCode = 1;
  } else {
    try {
      const result = await materializeBundle(requestPath, { preflightOnly });
      const { rollback, manifest, graph, ...summary } = result;
      const ok = summary.conflicts.length === 0;
      print({ ok, mode: preflightOnly ? "preflight" : "apply", ...summary });
      if (!ok) process.exitCode = 1;
    } catch (error) {
      print({ ok: false, error: error.message, conflicts: error.conflicts ?? [] });
      process.exitCode = 1;
    }
  }
}
