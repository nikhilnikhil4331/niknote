#!/usr/bin/env bash
# SSR smoke test for the Niknote Habit screens (run from repo root).
set -e
cd "$(dirname "$0")/.."
npx esbuild scripts/smoke-habit.tsx --bundle --platform=node --format=cjs --jsx=automatic \
  --alias:@=./src --define:import.meta.env='{}' --outfile=/tmp/smoke-habit.cjs --log-level=warning
node -e "
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => void store.set(k, String(v)),
  removeItem: k => void store.delete(k),
  clear: () => store.clear(),
};
globalThis.matchMedia = globalThis.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
import('/tmp/smoke-habit.cjs');
"
