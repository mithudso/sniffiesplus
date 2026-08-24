// Per-file Vitest setup: install the browser/Tampermonkey globals jsdom lacks, freeze time, then
// boot the userscript IIFE once into this file's jsdom global so tests can read its internals.
import { webcrypto } from "node:crypto";
import { vi } from "vitest";
import { buildTestableSource } from "./harness.mjs";

// jsdom emits a harmless "Not implemented: navigation" jsdomError when the smoke test exercises
// openGlobalChatViaHotkey() (its location.assign fallback, which the function self-catches). It is forwarded
// to stderr via jsdom's VirtualConsole, so filter that one message at the source while re-dispatching every
// other jsdomError unchanged; no test relies on real navigation.
try {
  const vc = typeof window !== "undefined" && window._virtualConsole;
  if (vc && typeof vc.on === "function" && typeof vc.removeAllListeners === "function") {
    const prior = (typeof vc.listeners === "function" ? vc.listeners("jsdomError") : []).slice();
    vc.removeAllListeners("jsdomError");
    vc.on("jsdomError", (err) => {
      if (err && typeof err.message === "string" && err.message.includes("Not implemented: navigation")) return;
      for (const l of prior) { try { l(err); } catch (e) {} }
    });
  }
} catch (e) {}

// --- 1. Globals jsdom doesn't provide ---------------------------------------------------------
if (!globalThis.crypto || !globalThis.crypto.subtle) {
  try { Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true }); } catch (e) {}
}

// Tampermonkey GM_* storage (in-memory; exposed as __GM_STORE for assertions).
const __gm = new Map();
globalThis.__GM_STORE = __gm;
globalThis.GM_getValue = (k, d) => (__gm.has(k) ? __gm.get(k) : d);
globalThis.GM_setValue = (k, v) => { __gm.set(k, v); };
globalThis.GM_deleteValue = (k) => { __gm.delete(k); };
globalThis.GM_openInTab = () => ({ closed: false, close() { this.closed = true; } });

// localStorage is flaky here (Node 22's experimental localStorage shadows jsdom's and needs a
// file flag). Install a clean in-memory Storage; expose it as __LS so tests can clear it.
function __makeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem: (k, v) => { m.set(String(k), String(v)); },
    removeItem: (k) => { m.delete(String(k)); },
    clear: () => { m.clear(); },
    key: (i) => { const ks = [...m.keys()]; return i < ks.length ? ks[i] : null; },
    get length() { return m.size; },
  };
}
const __ls = __makeStorage();
globalThis.__LS = __ls;
try { Object.defineProperty(globalThis, "localStorage", { value: __ls, configurable: true }); } catch (e) {}
try { if (typeof window !== "undefined") Object.defineProperty(window, "localStorage", { value: __ls, configurable: true }); } catch (e) {}

// jsdom has no fetch; give a benign default so installChatCapture() can patch it at boot.
// Individual tests can override globalThis.fetch to assert network behavior.
if (typeof globalThis.fetch !== "function") {
  globalThis.fetch = () => Promise.resolve({
    ok: true, status: 200, url: "",
    headers: { get: () => "application/json" },
    clone() { return this; },
    json: () => Promise.resolve({}),
    text: () => Promise.resolve("{}"),
  });
}

// jsdom throws "Not implemented" for these dialog/navigation APIs; the smoke test calls UI
// functions that use them. Stub to no-ops so output stays clean (no test relies on them).
for (const w of [globalThis, typeof window !== "undefined" ? window : null].filter(Boolean)) {
  w.alert = () => {};
  w.confirm = () => false;
  w.prompt = () => null;
  try { w.open = () => ({ closed: false, close() { this.closed = true; }, focus() {} }); } catch (e) {}
}

// The script installs a MutationObserver at boot; under jsdom+eval its async callback can fire on
// DOM churn and reference `window` from a torn-down scope (harmless noise, not a real-browser bug).
// Stub it to a no-op so tests stay quiet; no test relies on observer behaviour.
globalThis.MutationObserver = class { observe() {} disconnect() {} takeRecords() { return []; } };

// --- 2. Deterministic clock; fake timers so the boot setInterval()s never fire ----------------
vi.useFakeTimers();
vi.setSystemTime(new Date("2026-06-14T22:00:00.000Z"));

// --- 3. Boot the userscript once -------------------------------------------------------------
const { code } = buildTestableSource();
try {
  // Indirect eval runs in the global scope, where window/document/localStorage live.
  (0, eval)(code);
} catch (e) {
  globalThis.__SNIFFIES_INTERNALS_ERR = String((e && e.stack) || e);
}
