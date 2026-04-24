/**
 * Compute a two-character avatar fallback from a display name.
 *
 * - Two+ word names use the leading initial of the first two words.
 * - Single-word names take the first two characters.
 * - Empty / nullish input returns "?" so the avatar slot never collapses.
 *
 * Kept here (not in `@cheddr/api-types`) because it's purely a UI
 * concern — the server has no opinion about how a name renders.
 */
export function initialsFrom(name: string | null | undefined): string {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
