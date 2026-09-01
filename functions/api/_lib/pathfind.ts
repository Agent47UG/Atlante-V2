// pathfind.ts — connect two live nodes by walking the graph, fetching neighbours
// on demand. Bidirectional BFS keeps the number of network fetches small.

import { resolveNode } from './resolve';
import type { Env, WireNeighbor } from './types';

const MAX_EXPANSIONS = 24; // total node fetches before giving up
const MAX_DEPTH = 6;

interface Frontier {
  queue: string[];
  parent: Map<string, string | null>;
  depth: Map<string, number>;
}

function mk(start: string): Frontier {
  return {
    queue: [start],
    parent: new Map([[start, null]]),
    depth: new Map([[start, 0]]),
  };
}

function rebuild(
  meet: string,
  a: Map<string, string | null>,
  b: Map<string, string | null>,
): string[] {
  const left: string[] = [];
  let cur: string | null | undefined = meet;
  while (cur != null) {
    left.push(cur);
    cur = a.get(cur) ?? null;
  }
  left.reverse();
  const right: string[] = [];
  cur = b.get(meet) ?? null;
  while (cur != null) {
    right.push(cur);
    cur = b.get(cur) ?? null;
  }
  return [...left, ...right];
}

/** Ordered id path from `from` to `to`, or null if not found within budget. */
export async function findPath(
  env: Env,
  from: string,
  to: string,
): Promise<string[] | null> {
  if (from === to) return [from];
  const fwd = mk(from);
  const bwd = mk(to);
  let expansions = 0;

  const neighborsCache = new Map<string, WireNeighbor[]>();
  const getNeighbors = async (id: string): Promise<WireNeighbor[]> => {
    if (neighborsCache.has(id)) return neighborsCache.get(id)!;
    const res = await resolveNode(env, id);
    neighborsCache.set(id, res.neighbors);
    return res.neighbors;
  };

  while (
    (fwd.queue.length || bwd.queue.length) &&
    expansions < MAX_EXPANSIONS
  ) {
    // Expand the smaller frontier.
    const side = fwd.queue.length <= bwd.queue.length ? fwd : bwd;
    const other = side === fwd ? bwd : fwd;
    const id = side.queue.shift();
    if (!id) continue;
    if ((side.depth.get(id) ?? 0) >= MAX_DEPTH) continue;

    expansions++;
    const neighbors = await getNeighbors(id);
    for (const nb of neighbors) {
      if (side.parent.has(nb.id)) continue;
      side.parent.set(nb.id, id);
      side.depth.set(nb.id, (side.depth.get(id) ?? 0) + 1);
      if (other.parent.has(nb.id)) {
        return side === fwd
          ? rebuild(nb.id, fwd.parent, bwd.parent)
          : rebuild(nb.id, fwd.parent, bwd.parent);
      }
      side.queue.push(nb.id);
    }
  }
  return null;
}
