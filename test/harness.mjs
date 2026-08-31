// Test harness: turns the single-IIFE userscript into something testable WITHOUT modifying it.
//
// The userscript is one big IIFE with no exports. We read the canonical .txt, derive the list of
// top-level function names, and inject — just before the IIFE closes — an assignment that exposes
// every top-level function (plus key module state) onto `window.__SNIFFIES_INTERNALS`. The harness
// then boots that source once in a jsdom + WebCrypto + mocked-GM/fetch sandbox (see setup.mjs) and
// hands tests the internals. The .txt on disk is never touched.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// The userscript is a single canonical file (git history covers versioning, so the version is no
// longer carried in the filename). SNIFFIES_SRC_FILE overrides it — e.g. to boot an older exported
// variant against the same suite.
const ROOT = path.resolve(HERE, "..");
const SRC_NAME = process.env.SNIFFIES_SRC_FILE || "sniffiesplus.js";
export const SRC_PATH = path.join(ROOT, SRC_NAME);

// Module-state handles worth exposing for tests (live references to the in-memory maps/objects).
const STATE_HANDLES = [
  "state", "chatActivity", "profileLastActive", "blocked", "tempBlockExpiresAt", "bookmarks", "notes", "appointments",
  "attitudeCache", "idToMarker", "manualAttitudes", "howdySentAt", "iconRules", "profileRatings",
  "profileFilterCache", "profileTextCache", "includeMatches", "selfProfileIds",
  "chatDeletionStats", "includeDismissed", "profileWidgetOverlayTimers",
];

// Derive top-level function names directly from the source (2-space indent == direct IIFE child).
export function topLevelFunctionNames(src) {
  const re = /^ {2}(?:async )?function ([A-Za-z0-9_]+)\(/;
  const out = [];
  for (const line of src.split("\n")) {
    const m = line.match(re);
    if (m) out.push(m[1]);
  }
  return [...new Set(out)];
}

export function buildTestableSource() {
  const src = readFileSync(SRC_PATH, "utf8");
  const fns = topLevelFunctionNames(src);
  const idx = src.lastIndexOf("})();");
  if (idx < 0) throw new Error("Could not locate the IIFE close `})();`");
  // __state entries are getters, not a value snapshot: several of these bindings (blocked,
  // tempBlockExpiresAt's sibling blockedAt, etc.) get REASSIGNED by their save*() helper (e.g.
  // `blocked = new Set(...)` in saveBlockedSet) rather than mutated in place. A plain shorthand
  // snapshot froze at whatever object existed at inject-time, so after the first reassigning call
  // in a test file every later `__state.blocked` read silently went stale (see the historical
  // workaround comment in global-chat.test.mjs). Getters always read the CURRENT closure variable.
  const inject =
    "\n;try{(typeof window!==\"undefined\"?window:globalThis).__SNIFFIES_INTERNALS={" +
    fns.join(",") +
    // Defensive getters: a STATE_HANDLES name absent from an older source variant (e.g.
    // tempBlockExpiresAt before v0.12.0) degrades to undefined instead of throwing a
    // ReferenceError at inject-time and killing the whole boot.
    ",__state:{" + STATE_HANDLES.map((n) => `get ${n}(){try{return ${n};}catch(e){return undefined;}}`).join(",") + "}" +
    "};}catch(e){(typeof window!==\"undefined\"?window:globalThis).__SNIFFIES_INTERNALS_ERR=String((e&&e.stack)||e);}\n";
  return { code: src.slice(0, idx) + inject + src.slice(idx), functionNames: fns };
}

// Read the internals the booted script exposed; throws a useful error if boot failed.
export function getInternals() {
  const g = globalThis;
  if (g.__SNIFFIES_INTERNALS) return g.__SNIFFIES_INTERNALS;
  if (g.__SNIFFIES_INTERNALS_ERR) throw new Error("Userscript boot failed:\n" + g.__SNIFFIES_INTERNALS_ERR);
  throw new Error("Userscript was not booted (setup.mjs did not run, or boot threw before injection).");
}
