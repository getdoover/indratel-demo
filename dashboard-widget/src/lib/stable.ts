import {useRef} from "react";

/**
 * Shallow value equality, for the flat objects `sources.ts` builds.
 *
 * They are deliberately kept flat (no nested objects or arrays) so this stays a
 * cheap key-by-key comparison.
 */
function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;

  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;

  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  return ka.every((k) => Object.is(ra[k], rb[k]));
}

/**
 * Return the previous object while none of its fields have changed.
 *
 * The builders run on every render and hand back a fresh object each time, which
 * would defeat `memo()` on the panels. Holding the previous object when it is
 * value-identical means a panel only re-renders when something it displays has
 * actually moved.
 */
export function useStable<T>(value: T): T {
  const held = useRef(value);
  if (!shallowEqual(held.current, value)) held.current = value;
  return held.current;
}
