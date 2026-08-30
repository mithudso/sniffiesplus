// Vitest globalSetup: warm the OS file cache for node_modules before any worker
// spins up its jsdom environment.
//
// Why: on a cold cache (fresh `npm install`, or after the OS evicts it) the
// first open of each node_modules file on this managed Mac hits an on-access
// security scanner, costing ~1-2s per file. jsdom -> css-tree pulls in dozens
// of files, so the worker's environment import can take ~50s+ and blow past
// vitest's worker-start handshake ("Timeout waiting for worker to respond"),
// which is a hardcoded constant in vitest 4.x and not configurable.
//
// globalSetup runs once in vitest's MAIN process (no worker-start timeout
// applies) before any test file is assigned to a worker. Reading the files in
// parallel here primes the cache, so each worker's jsdom import is fast. A cold
// run degrades to "slow once" instead of failing; a warm run is a few seconds.
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { join } from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

const CONCURRENCY = 32;
const WARMABLE = /\.(c?js|mjs|json|node)$/;

// After warming, surface INDEX.md drift by running the generator's own --check
// gate (`regen-index.mjs --check`, exit 1 = stale). This catches a stale INDEX.md
// the moment you run the suite, but stays NON-FATAL: test success is not coupled
// to doc freshness, so a stale index only warns. Flip the `console.warn` to a
// `throw` if you'd rather hard-fail the suite on drift.
// regen-index.mjs is intentionally NOT vendored into this repo — it's shared tooling that lives at
// ~/.claude/skill-consolidation/regen-index.mjs across the owner's other projects (see CLAUDE.md).
// On a checkout without it, execFileP below throws ENOENT and this warns instead of failing the suite.
async function checkIndexFreshness() {
  // Same path the pre-commit hook and `npm run check` use — the old repo-root resolution pointed at
  // a file that never existed there, so every run spawned a doomed child and printed a
  // MODULE_NOT_FOUND stack. Silently skip when the shared tooling isn't installed on this machine.
  const script = join(os.homedir(), ".claude/skill-consolidation/regen-index.mjs");
  if (!existsSync(script)) return;
  try {
    await execFileP(process.execPath, [script, "--check"]);
  } catch (err) {
    const msg = String(err.stderr || err.message || err).trim();
    console.warn(`[global-setup] INDEX.md drift check — ${msg}`);
  }
}

export default async function warmNodeModulesCache() {
  const root = fileURLToPath(new URL("../node_modules/", import.meta.url));

  let entries;
  try {
    entries = await readdir(root, { recursive: true, withFileTypes: true });
  } catch {
    return; // node_modules missing (e.g. CI before install) — nothing to warm
  }

  const paths = [];
  for (const d of entries) {
    if (d.isFile() && WARMABLE.test(d.name)) {
      paths.push(join(d.parentPath ?? d.path ?? root, d.name));
    }
  }

  let next = 0;
  async function worker() {
    while (next < paths.length) {
      const p = paths[next++];
      try {
        await readFile(p); // read + discard: the point is the cache, not the bytes
      } catch {
        // ignore unreadable/transient files; warming is best-effort
      }
    }
  }

  const started = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const ms = Date.now() - started;
  // Only surface this when it was actually slow, so warm runs stay quiet.
  if (ms > 3000) {
    console.log(`[global-setup] warmed ${paths.length} node_modules files in ${ms}ms`);
  }

  await checkIndexFreshness();
}
