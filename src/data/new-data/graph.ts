// ─────────────────────────────────────────────────────────────────────────────
// graph.ts — the SEED of the Atlante knowledge universe.
//
// The seed is intentionally tiny: one node per civilization. Everything else is
// discovered live from the internet (Wikidata/Wikipedia) at runtime and merged
// into these same mutable structures by liveStore.ts. Because NODE_MAP,
// ADJACENCY and EDGES are plain mutable objects/arrays, every existing helper
// below (neighborsOf, pathBetween, edgeBetween, …) transparently sees the graph
// grow as the user explores.
// ─────────────────────────────────────────────────────────────────────────────

import type { KnowledgeNode, KnowledgeEdge, CivilizationPeriod } from '../types';
import { CIVILIZATIONS } from './civilizations';
import { formatYear } from './timeline';

/** A civilization's full lifespan as a readable era string. */
function eraOf(periods: CivilizationPeriod[]): string | undefined {
    if (!periods.length) return undefined;
    const start = Math.min(...periods.map((p) => p.start));
    const end = Math.max(...periods.map((p) => p.end));
    return `${formatYear(start)} – ${formatYear(end)}`;
}

/** The seed nodes — one civilization each. */
export const NODES: KnowledgeNode[] = CIVILIZATIONS.map((c) => ({
    id: c.rootNodeId,
    label: c.name,
    type: 'civilization',
    civilizationId: c.id,
    summary: c.blurb,
    details: { era: eraOf(c.periods) },
}));

/** All edges. Starts empty; liveStore pushes discovered edges here. */
export const EDGES: KnowledgeEdge[] = [];

/** Fast lookup from node id to node. Mutated in place by liveStore. */
export const NODE_MAP: Record<string, KnowledgeNode> = Object.fromEntries(
    NODES.map((node) => [node.id, node]),
);

/** Undirected adjacency list. Starts with empty lists per seed node. */
export const ADJACENCY: Record<string, string[]> = Object.fromEntries(
    NODES.map((node) => [node.id, []]),
);

/** All edges touching a node. */
export function edgesOf(id: string): KnowledgeEdge[] {
    return EDGES.filter((edge) => edge.source === id || edge.target === id);
}

/** The edge directly connecting two nodes (either direction), or null. */
export function edgeBetween(a: string, b: string): KnowledgeEdge | null {
    return (
        EDGES.find(
            (edge) =>
                (edge.source === a && edge.target === b) ||
                (edge.source === b && edge.target === a),
        ) ?? null
    );
}

/**
 * Shortest path (fewest hops) between two nodes as an ordered list of node ids,
 * inclusive of both ends, or null if unreachable within `maxHops`.
 */
export function pathBetween(a: string, b: string, maxHops = 4): string[] | null {
    if (a === b) return [a];
    if (!NODE_MAP[a] || !NODE_MAP[b]) return null;
    const prev = new Map<string, string>();
    const visited = new Set<string>([a]);
    let frontier = [a];
    let hops = 0;
    while (frontier.length > 0 && hops < maxHops) {
        hops++;
        const next: string[] = [];
        for (const id of frontier) {
            for (const nb of neighborsOf(id)) {
                if (visited.has(nb)) continue;
                visited.add(nb);
                prev.set(nb, id);
                if (nb === b) {
                    const path = [b];
                    let cur = b;
                    while (cur !== a) {
                        cur = prev.get(cur)!;
                        path.push(cur);
                    }
                    return path.reverse();
                }
                next.push(nb);
            }
        }
        frontier = next;
    }
    return null;
}

/** Neighbor node ids of a node. */
export function neighborsOf(id: string): string[] {
    return ADJACENCY[id] ?? [];
}

/** Resolve a list of node ids to full nodes, skipping any unknown ids. */
export function resolveNodes(ids: string[]): KnowledgeNode[] {
    return ids.map((id) => NODE_MAP[id]).filter(Boolean) as KnowledgeNode[];
}
