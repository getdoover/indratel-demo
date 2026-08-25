/**
 * Join class names, dropping falsey entries.
 *
 * Deliberately not `clsx` + `tailwind-merge`: this widget ships as a single
 * federated bundle and keeps its dependency graph to React alone. Nothing here
 * passes conflicting utilities down through a `className` prop, so plain
 * concatenation is all that's needed.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
