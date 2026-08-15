# Built-in syntax strategies

This document is the complete offline support claim for skeleton materialization. A path has a
verified built-in strategy only when its language and normalized repository-relative path match
one row below. Matching is case-sensitive, is performed independently for every path, and does not
consult a project generator, a target-repository plugin, or the network. Anything not listed uses
the opaque fallback; implementations must not infer support from a similar extension.

## Verified-support matrix

Each row has exactly one canonical fixture in
`test-fixtures/skeleton-strategies.json`. The fixture ID is part of the row contract; mixed-repository
fixtures may reuse a strategy to test per-path selection, but do not add another support row.

### `javascript-esm-mjs`

- Language: `JavaScript ESM`
- File pattern: `**/*.mjs`
- Safe placeholder: Create UTF-8 text `export {};` followed by one LF.
- Import rule: Emit only static side-effect `import "<specifier>";` declarations for graph imports whose literal relative specifier is explicit in the normalized plan; never synthesize packages, bindings, or extensions.
- Export rule: Use `export {};` for an empty module and emit named exports only when every exported name is explicit in a planned public contract.
- Compatibility rule: Existing `.mjs` content is compatible only when the built-in ESM parser verifies the planned file node and every required literal import and explicit export connection.
- Non-replacement rule: Verify compatible existing content byte-for-byte in place; preserve incompatible content, classify it opaque, and report a conflict instead of rewriting it.
- Fixture: `supported-javascript-esm-mjs`

### `javascript-commonjs-cjs`

- Language: `JavaScript CommonJS`
- File pattern: `**/*.cjs`
- Safe placeholder: Create UTF-8 text `'use strict';` then a blank line then `module.exports = {};`, with one final LF.
- Import rule: Emit only `require("<specifier>");` statements for graph imports whose literal relative specifier is explicit in the normalized plan; never synthesize packages, bindings, or extensions.
- Export rule: Use `module.exports = {};` for an empty module and add object properties only when every exported name is explicit in a planned public contract.
- Compatibility rule: Existing `.cjs` content is compatible only when the built-in CommonJS parser verifies the planned file node and every required literal require and module export connection.
- Non-replacement rule: Verify compatible existing content byte-for-byte in place; preserve incompatible content, classify it opaque, and report a conflict instead of rewriting it.
- Fixture: `supported-javascript-commonjs-cjs`

### `typescript-esm-ts`

- Language: `TypeScript ESM`
- File pattern: `**/*.ts`
- Safe placeholder: Create UTF-8 text `export {};` followed by one LF; this row does not cover `.tsx`, `.mts`, or `.cts`.
- Import rule: Emit only static side-effect `import "<specifier>";` declarations for graph imports whose literal relative specifier is explicit in the normalized plan; never invent values, types, packages, or extensions.
- Export rule: Use `export {};` for an empty module and emit named or type exports only when their names and kind are explicit in a planned public contract.
- Compatibility rule: Existing `.ts` content is compatible only when the built-in TypeScript parser verifies the planned file node and every required literal import and explicit value-or-type export connection.
- Non-replacement rule: Verify compatible existing content byte-for-byte in place; preserve incompatible content, classify it opaque, and report a conflict instead of rewriting it.
- Fixture: `supported-typescript-esm-ts`

### `python-module-py`

- Language: `Python module`
- File pattern: `**/*.py`
- Safe placeholder: Create UTF-8 text `__all__ = []` followed by one LF.
- Import rule: Emit only `import <module>` statements for graph imports whose dotted module identifier is explicit in the normalized plan and consists solely of valid Python identifier segments.
- Export rule: Use `__all__ = []` for an empty module and add quoted names only when every exported name is explicit in a planned public contract.
- Compatibility rule: Existing `.py` content is compatible only when the built-in Python parser verifies the planned file node and every required explicit import and `__all__` export connection.
- Non-replacement rule: Verify compatible existing content byte-for-byte in place; preserve incompatible content, classify it opaque, and report a conflict instead of rewriting it.
- Fixture: `supported-python-module-py`

## Strategy contract

For a missing path that selects a row, materialization starts with that row's safe placeholder and
adds only connections allowed by its import and export rules. The result may be reported as
`created`; its connection assurance is `syntactically-verified` only after the built-in parser has
verified the planned node and every required connection. A parseable placeholder is a structural
artifact, not a promise that the repository builds, resolves modules, or type-checks.

For an existing path, compatibility is affirmative rather than inferred. The selected parser must
verify the planned file node and all required connections under the exact row rules. Success yields
`verified-compatible` and leaves the content byte-for-byte unchanged. A parse error, missing or
ambiguous connection, dynamic import, invented name, or rule mismatch prevents compatibility; the
content is preserved as `opaque-preserved`, affected connections are
`declarative-unverified`, and materialization reports the conflict without replacing the file.

## Opaque fallback

The fallback applies to every language/file combination absent from the matrix, including `.js`
whose module mode depends on external package configuration. It never guesses syntax.

- Missing path: create a zero-byte placeholder only. Do not add comments, imports, exports, or
  language markers; perform no semantic validation; classify every connection
  `declarative-unverified`. Structural generation may still succeed as `created` when the graph and
  skeleton schemas are valid and assurance is reported honestly.
- Existing path: do not edit, format, parse, or semantically validate it. Preserve the bytes,
  classify it `opaque-preserved`, and classify every declared connection
  `declarative-unverified`.

The fallback does not upgrade assurance because a file happens to parse under a locally available
tool. Verified support is bounded by this checked-in matrix.

## Mixed-language repositories

Select independently for each normalized path. A single repository may therefore contain created
or verified-compatible paths using different rows alongside opaque-preserved paths using the
fallback. No repository-wide language decision may promote an unlisted path, and one opaque path
does not prevent schema-valid structural generation for the other paths.
