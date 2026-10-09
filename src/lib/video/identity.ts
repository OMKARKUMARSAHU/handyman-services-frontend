/**
 * Stable identities for Video Showcase cards and clips.
 *
 * Every layer (admin draft, save payload, backend, public reader, public
 * player) keys cards and clips by `id`, never by array position. That only
 * works if ids are present and unique, so anything that reads stored data
 * repairs a missing or duplicate id here -- DETERMINISTICALLY. The earlier
 * repair minted a fresh random UUID on every call, and because the admin
 * re-derives its "server value" on every render, a card with a missing or
 * duplicate id produced a different value on every render. That kept
 * re-seeding the draft (and remounting the card, dropping input focus) in a
 * loop. The same input must always give the same ids.
 */

/** Returns `candidate` if it is a usable, unused id; otherwise a deterministic replacement derived from `fallbackBase`. The chosen id is added to `seen`. */
export function makeUniqueId(candidate: unknown, fallbackBase: string, seen: Set<string>): string {
  const raw = candidate === null || candidate === undefined ? "" : String(candidate).trim();
  let id = raw && raw !== "null" && raw !== "undefined" ? raw : fallbackBase;
  if (seen.has(id)) {
    const base = id;
    let n = 2;
    while (seen.has(`${base}-dup${n}`)) n++;
    id = `${base}-dup${n}`;
  }
  seen.add(id);
  return id;
}
