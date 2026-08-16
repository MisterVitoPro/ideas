import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const STRATEGY_SUFFIXES = new Map([
  ["javascript-esm-mjs", ".mjs"],
  ["javascript-commonjs-cjs", ".cjs"],
  ["typescript-esm-ts", ".ts"],
  ["python-module-py", ".py"],
]);

const VERIFIED = "syntactically-verified";
const DECLARATIVE = "declarative-unverified";

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

function validateEntry(entry, index) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) fail(`entry ${index} must be an object`);
  const normalizedPath = normalizeRepositoryPath(entry.path, `entry ${index} path`);
  if (typeof entry.content !== "string") fail(`entry ${normalizedPath} content must be a string`);
  if (!Array.isArray(entry.connections)) fail(`entry ${normalizedPath} connections must be an array`);

  if (entry.strategyId === null) {
    if (entry.content !== "") fail(`opaque entry ${normalizedPath} must use a zero-byte placeholder`);
  } else {
    const suffix = STRATEGY_SUFFIXES.get(entry.strategyId);
    if (!suffix) fail(`entry ${normalizedPath} names an unknown syntax strategy`);
    if (!normalizedPath.endsWith(suffix)) {
      fail(`entry ${normalizedPath} does not match syntax strategy ${entry.strategyId}`);
    }
  }

  return { ...entry, path: normalizedPath };
}

function validateRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) fail("request must be an object");
  if (request.schemaVersion !== 1) fail("schemaVersion must be 1");
  if (typeof request.plan !== "string" || request.plan.length === 0) fail("plan must be a non-empty string");
  if (typeof request.repositoryRoot !== "string" || !path.isAbsolute(request.repositoryRoot)) {
    fail("repositoryRoot must be an absolute path");
  }
  if (!Array.isArray(request.entries)) fail("entries must be an array");
  if (!request.graph || typeof request.graph !== "object" || Array.isArray(request.graph)) fail("graph must be an object");
  if (request.graph.schemaVersion !== 1 || request.graph.plan !== request.plan) {
    fail("graph identity and schemaVersion must match the request");
  }
  if (!Array.isArray(request.graph.nodes) || !Array.isArray(request.graph.edges)) {
    fail("graph nodes and edges must be arrays");
  }

  const entries = request.entries.map(validateEntry);
  const manifestPath = normalizeRepositoryPath(request.manifestPath, "manifestPath");
  const graphPath = normalizeRepositoryPath(request.graphPath, "graphPath");
  const allPaths = [...entries.map((entry) => entry.path), manifestPath, graphPath];
  if (new Set(allPaths).size !== allPaths.length) fail("source and sidecar paths must be unique");

  const sorted = [...allPaths].sort();
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].startsWith(`${sorted[index - 1]}/`)) {
      fail(`planned paths overlap as a file and directory: ${sorted[index - 1]}`);
    }
  }
  return { ...request, entries, manifestPath, graphPath };
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
  for (const entry of request.entries) {
    const target = await resolveSafeTarget(root, realRoot, entry.path);
    const stat = await lstatOrNull(target);
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

  const manifest = {
    schemaVersion: 1,
    plan: request.plan,
    entries: request.entries.map((entry) => manifestEntryFor(entry, classifications.get(entry.path))),
  };
  const manifestTarget = await resolveSafeTarget(root, realRoot, request.manifestPath);
  const graphTarget = await resolveSafeTarget(root, realRoot, request.graphPath);
  const manifestSidecar = await inspectSidecar(
    manifestTarget,
    request.manifestPath,
    manifest,
    (candidate) => reusableManifest(candidate, request, classifications),
  );
  const graphSidecar = await inspectSidecar(
    graphTarget,
    request.graphPath,
    request.graph,
    (candidate) => structurallyEqual(candidate, request.graph),
  );
  for (const sidecar of [manifestSidecar, graphSidecar]) {
    if (sidecar.conflict) conflicts.push(sidecar.relativePath);
  }

  return {
    request,
    root,
    realRoot,
    resolvedEntries,
    classifications,
    conflicts,
    manifest,
    manifestSidecar,
    graphSidecar,
  };
}

function publicReport(state) {
  return {
    schemaVersion: 1,
    plan: state.request.plan,
    entries: state.resolvedEntries.map(({ entry, classification }) => ({
      path: entry.path,
      classification,
      assurance: assuranceFor(entry),
    })),
    conflicts: [...state.conflicts],
  };
}

/**
 * Preflight and optionally materialize a fully local skeleton bundle.
 *
 * The returned rollback function removes only paths created by this invocation.
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
  for (const sidecar of [state.manifestSidecar, state.graphSidecar]) {
    if (!sidecar.exists) pending.push(sidecar);
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
