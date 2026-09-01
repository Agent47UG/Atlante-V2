// ─────────────────────────────────────────────────────────────────────────────
// View helpers for the progressive knowledge-graph explorer.
//
// The explorer never shows the whole graph. It shows a single FOCUS node plus
// its direct neighbours (capped). Clicking a neighbour re-centres the view on
// that node. This module computes the visible set + a layout for both the
// free-exploration (radial star) view and the guided-story (path) view.
// ─────────────────────────────────────────────────────────────────────────────

import { NODE_MAP, neighborsOf, edgesOf } from '../data/new-data/graph';
import { nodeOrder } from '../data/new-data/liveStore';
import type { KnowledgeNode, NodeType } from '../data/types';

/** Deterministic pseudo-random value in [0,1) from a string + salt. */
export function hashUnit(str: string, salt = 0): number {
    let h = (2166136261 ^ salt) >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 100000) / 100000;
}

export const VIEW_W = 1000;
export const VIEW_H = 640;
/** How many nodes (besides the focus) we always try to show. */
export const TARGET_NODES = 9;

export interface Pt {
    x: number;
    y: number;
}

export interface PlacedNode {
    node: KnowledgeNode;
    x: number;
    y: number;
    isFocus: boolean;
}

export interface ViewEdge {
    source: string;
    target: string;
    a: Pt;
    b: Pt;
    label?: string;
}

export interface FocusView {
    nodes: PlacedNode[];
    edges: ViewEdge[];
    hiddenCount: number;
}

/** Dot radius by node type. */
export function nodeRadius(type: NodeType, isFocus: boolean): number {
    const base =
        type === 'civilization' ? 7 : type === 'person' ? 5 : type === 'place' ? 6 : 6;
    return isFocus ? base + 4 : base;
}

/**
 * Priority-based view. We always try to show TARGET_NODES nodes around the
 * focus, chosen by graph distance: all immediate neighbours first, and — if
 * there aren't enough — nodes one hop further out, clustered around whichever
 * neighbour connects them. Clicking any node re-centres the view on it.
 */
export function buildFocusView(focusId: string, w = VIEW_W, h = VIEW_H): FocusView {
    const focus = NODE_MAP[focusId];
    if (!focus) return { nodes: [], edges: [], hiddenCount: 0 };

    const cx = w / 2;
    const cy = h * 0.46;
    const typeRank = (nd: KnowledgeNode) => (nd.type === 'civilization' ? 0 : 1);

    // ── Priority BFS: fill up to TARGET_NODES, nearest first. ──────────────
    interface Picked {
        node: KnowledgeNode;
        parentId: string;
        depth: number;
    }
    const picked: Picked[] = [];
    const visited = new Set<string>([focusId]);
    let frontier: string[] = [focusId];
    let depth = 0;
    const directCount = neighborsOf(focusId).length;

    while (picked.length < TARGET_NODES && frontier.length > 0) {
        depth++;
        // Candidates at this depth, each tagged with the parent that reached
        // it first (so distance-2 nodes cluster under a single connector).
        const seen = new Set<string>();
        const candidates: { node: KnowledgeNode; parentId: string }[] = [];
        for (const pid of frontier) {
            for (const nid of neighborsOf(pid)) {
                if (visited.has(nid) || seen.has(nid)) continue;
                const node = NODE_MAP[nid];
                if (!node) continue;
                seen.add(nid);
                candidates.push({ node, parentId: pid });
            }
        }
        // Civilizations anchor the view; after that, freshly-discovered live
        // nodes (higher discovery rank) come before the older curated core so
        // the internet frontier surfaces instead of hiding in "+N more".
        candidates.sort(
            (a, b) =>
                typeRank(a.node) - typeRank(b.node) ||
                nodeOrder(b.node.id) - nodeOrder(a.node.id),
        );

        const nextFrontier: string[] = [];
        for (const c of candidates) {
            if (picked.length >= TARGET_NODES) break;
            visited.add(c.node.id);
            picked.push({ node: c.node, parentId: c.parentId, depth });
            nextFrontier.push(c.node.id);
        }
        frontier = nextFrontier;
    }

    const shownDepth1 = picked.filter((p) => p.depth === 1).length;
    const hiddenCount = Math.max(0, directCount - shownDepth1);

    // ── Layout: focus centre, depth-1 on a ring, deeper nodes fanned around
    //    their parent. ─────────────────────────────────────────────────────
    const posById = new Map<string, Pt>();
    const angleById = new Map<string, number>();
    posById.set(focusId, { x: cx, y: cy });

    const d1 = picked.filter((p) => p.depth === 1);
    const n1 = d1.length;
    const r1x = Math.min(w * 0.34, 150 + n1 * 10);
    const r1y = Math.min(h * 0.32, 110 + n1 * 8);
    const start = -Math.PI / 2 + (n1 > 1 ? Math.PI / n1 : 0);
    d1.forEach((p, i) => {
        // Organic scatter so the ring reads as a constellation, not a dial.
        const jA = (hashUnit(p.node.id, 1) - 0.5) * 0.42;
        const jx = 0.8 + hashUnit(p.node.id, 2) * 0.45;
        const jy = 0.8 + hashUnit(p.node.id, 3) * 0.45;
        const a = start + (i / Math.max(1, n1)) * Math.PI * 2 + jA;
        posById.set(p.node.id, { x: cx + Math.cos(a) * r1x * jx, y: cy + Math.sin(a) * r1y * jy });
        angleById.set(p.node.id, a);
    });

    const childrenByParent = new Map<string, Picked[]>();
    for (const p of picked) {
        if (p.depth < 2) continue;
        const arr = childrenByParent.get(p.parentId) ?? [];
        arr.push(p);
        childrenByParent.set(p.parentId, arr);
    }
    const FAN = 0.55;
    const placeChildren = (parentId: string) => {
        const kids = childrenByParent.get(parentId);
        if (!kids) return;
        const pPos = posById.get(parentId)!;
        const pAngle = angleById.get(parentId) ?? Math.atan2(pPos.y - cy, pPos.x - cx);
        const m = kids.length;
        kids.forEach((kid, j) => {
            const a =
                pAngle +
                (j - (m - 1) / 2) * FAN +
                (hashUnit(kid.node.id, 4) - 0.5) * 0.32;
            const dist = 76 + hashUnit(kid.node.id, 5) * 48;
            const kx = pPos.x + Math.cos(a) * dist;
            const ky = pPos.y + Math.sin(a) * dist * 0.9;
            posById.set(kid.node.id, { x: kx, y: ky });
            angleById.set(kid.node.id, Math.atan2(ky - cy, kx - cx));
            placeChildren(kid.node.id);
        });
    };
    d1.forEach((p) => placeChildren(p.node.id));

    // ── Relaxation: push apart any nodes that sit too close so labels/dots
    //    stop overlapping and clustering in one corner. Focus stays put (its
    //    neighbours are shoved away instead). Extra horizontal room is demanded
    //    because labels sit under each dot and read wider than they are tall.
    {
        const ids = Array.from(posById.keys());
        const MIN_SEP = 150; // minimum centre-to-centre distance
        const Y_WEIGHT = 1.5; // count vertical gaps as larger → spread more in X
        for (let iter = 0; iter < 90; iter++) {
            for (let i = 0; i < ids.length; i++) {
                for (let j = i + 1; j < ids.length; j++) {
                    const a = posById.get(ids[i])!;
                    const b = posById.get(ids[j])!;
                    const dx = b.x - a.x;
                    const dy = (b.y - a.y) * Y_WEIGHT;
                    const dist = Math.hypot(dx, dy) || 0.01;
                    if (dist >= MIN_SEP) continue;
                    const overlap = MIN_SEP - dist;
                    const ux = dx / dist;
                    const uy = (dy / dist) / Y_WEIGHT;
                    const aFocus = ids[i] === focusId;
                    const bFocus = ids[j] === focusId;
                    if (aFocus) {
                        b.x += ux * overlap;
                        b.y += uy * overlap;
                    } else if (bFocus) {
                        a.x -= ux * overlap;
                        a.y -= uy * overlap;
                    } else {
                        a.x -= ux * overlap * 0.5;
                        a.y -= uy * overlap * 0.5;
                        b.x += ux * overlap * 0.5;
                        b.y += uy * overlap * 0.5;
                    }
                }
            }
        }
    }

    // ── Fit the whole constellation into a padded viewBox so nothing ever
    //    leaves the sky band (top clipping / overlapping the globe). ─────────
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of posById.values()) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }
    const PAD_X = w * 0.09;
    const PAD_TOP = h * 0.09;
    const PAD_BOTTOM = h * 0.15; // extra room for the label under each dot
    const availW = w - PAD_X * 2;
    const availH = h - PAD_TOP - PAD_BOTTOM;
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;
    // Uniform scale (preserve the constellation's shape), capped so tiny graphs
    // don't balloon.
    const scale = Math.min(availW / spanX, availH / spanY, 1.35);
    const offX = PAD_X + (availW - spanX * scale) / 2 - minX * scale;
    const offY = PAD_TOP + (availH - spanY * scale) / 2 - minY * scale;
    for (const p of posById.values()) {
        p.x = offX + p.x * scale;
        p.y = offY + p.y * scale;
    }

    // ── Assemble nodes + tree edges ───────────────────────────────────────
    const focusPos = posById.get(focusId)!;
    const nodes: PlacedNode[] = [
        { node: focus, x: focusPos.x, y: focusPos.y, isFocus: true },
    ];
    for (const p of picked) {
        const pos = posById.get(p.node.id)!;
        nodes.push({ node: p.node, x: pos.x, y: pos.y, isFocus: false });
    }

    const labelBetween = (aId: string, bId: string): string | undefined => {
        const edge = edgesOf(aId).find(
            (ed) =>
                (ed.source === aId && ed.target === bId) ||
                (ed.target === aId && ed.source === bId),
        );
        return edge?.label;
    };

    const edges: ViewEdge[] = picked.map((p) => {
        const a = posById.get(p.parentId)!;
        const b = posById.get(p.node.id)!;
        return {
            source: p.parentId,
            target: p.node.id,
            a: { x: a.x, y: a.y },
            b: { x: b.x, y: b.y },
            label: labelBetween(p.parentId, p.node.id),
        };
    });

    return { nodes, edges, hiddenCount };
}

/**
 * A story's node sequence laid out as a gently arcing left-to-right path.
 */
export function buildPathView(
    nodeIds: string[],
    w = VIEW_W,
    h = VIEW_H,
): { nodes: PlacedNode[]; edges: ViewEdge[] } {
    const resolved = nodeIds.map((id) => NODE_MAP[id]).filter(Boolean) as KnowledgeNode[];
    const n = resolved.length;
    if (n === 0) return { nodes: [], edges: [] };

    const padX = w * 0.1;
    const usableW = w - padX * 2;
    const midY = h * 0.5;
    const amp = Math.min(h * 0.34, h * 0.26 + 30);

    const nodes: PlacedNode[] = resolved.map((node, i) => {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const x = padX + t * usableW;
        // Gentle sine arc so the thread reads as a single sweep.
        const y = midY - Math.sin(t * Math.PI) * amp * 0.5 + (i % 2 === 0 ? -amp * 0.18 : amp * 0.18);
        return { node, x, y, isFocus: false };
    });

    const edges: ViewEdge[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
        edges.push({
            source: nodes[i].node.id,
            target: nodes[i + 1].node.id,
            a: { x: nodes[i].x, y: nodes[i].y },
            b: { x: nodes[i + 1].x, y: nodes[i + 1].y },
        });
    }
    return { nodes, edges };
}
