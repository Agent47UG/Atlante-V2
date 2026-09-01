// ─────────────────────────────────────────────────────────────────────────────
// storyBuilder — turn free-typed text into a playable Story on the fly.
//
// A Story is just an ordered path of real graph nodes with a caption per step
// (see stories.ts). To build one from arbitrary text we:
//   1. match the words against the 237 node labels (longest phrase wins),
//   2. connect the matched concepts through the graph:
//        • 2+ concepts  → shortest path chained through each in turn,
//        • 1 concept    → an outward journey to its farthest notable relative,
//   3. narrate each hop from the edge verb + the node's own summary.
//
// Everything resolves to ids that exist in the graph, so the result plays back
// exactly like a hand-authored story (lighting up the real nodes).
// ─────────────────────────────────────────────────────────────────────────────

import type { Story, StoryStep } from '../types';
import {
    NODES,
    NODE_MAP,
    edgeBetween,
    neighborsOf,
    pathBetween,
} from './graph';
import { CIVILIZATIONS, CIVILIZATION_MAP } from './civilizations';

const ARTICLES = ['the', 'ancient', 'a', 'an'];

/** Lowercase, strip punctuation, collapse whitespace. */
function norm(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** The phrases that should match a node: its label, and the label without a
 *  leading article ("The Compass" → also "compass"). */
function phrasesForNode(label: string): string[] {
    const out = new Set<string>();
    const n = norm(label);
    if (n) out.add(n);
    const words = n.split(' ');
    if (words.length > 1 && ARTICLES.includes(words[0])) {
        out.add(words.slice(1).join(' '));
    }
    return [...out];
}

/** Node ids named in the text, in the order they appear (deduped). Longer
 *  phrases win over shorter overlapping ones ("printing press" beats "printing"). */
function matchNodes(text: string): string[] {
    const nt = ' ' + norm(text) + ' ';
    if (nt.trim() === '') return [];

    const phrases: { id: string; p: string }[] = [];
    for (const node of NODES) {
        for (const p of phrasesForNode(node.label)) {
            if (p.length >= 2) phrases.push({ id: node.id, p });
        }
    }
    phrases.sort((a, b) => b.p.length - a.p.length);

    const claimed = new Array(nt.length).fill(false);
    const found: { id: string; idx: number }[] = [];
    const seen = new Set<string>();

    for (const { id, p } of phrases) {
        if (seen.has(id)) continue;
        const needle = ' ' + p + ' ';
        let from = 0;
        for (;;) {
            const idx = nt.indexOf(needle, from);
            if (idx < 0) break;
            const end = idx + needle.length;
            let ok = true;
            // Only the inner characters must be free; the boundary spaces may be
            // shared with an adjacent match ("zero computer").
            for (let k = idx + 1; k < end - 1; k++) {
                if (claimed[k]) {
                    ok = false;
                    break;
                }
            }
            if (ok) {
                for (let k = idx + 1; k < end - 1; k++) claimed[k] = true;
                found.push({ id, idx: idx + 1 });
                seen.add(id);
                break;
            }
            from = idx + 1;
        }
    }

    found.sort((a, b) => a.idx - b.idx);
    return found.map((f) => f.id);
}

/** Chain the shortest paths through each matched concept in turn. */
function chainThrough(ids: string[]): string[] {
    let full = [ids[0]];
    for (let i = 1; i < ids.length; i++) {
        const seg = pathBetween(ids[i - 1], ids[i], 6);
        if (seg && seg.length > 1) {
            for (let k = 1; k < seg.length; k++) full.push(seg[k]);
        } else if (full[full.length - 1] !== ids[i]) {
            full.push(ids[i]);
        }
    }
    // Drop any accidental immediate repeats.
    return full.filter((id, i) => i === 0 || id !== full[i - 1]);
}

/** A journey from a single concept out to its farthest notable relative. */
function outwardJourney(start: string, maxHops = 5): string[] {
    const prev = new Map<string, string>();
    const depth = new Map<string, number>([[start, 0]]);
    const queue = [start];
    let far = start;

    for (let h = 0; h < queue.length; h++) {
        const id = queue[h];
        const d = depth.get(id)!;
        if (d >= maxHops) continue;
        for (const nb of neighborsOf(id)) {
            if (depth.has(nb)) continue;
            depth.set(nb, d + 1);
            prev.set(nb, id);
            queue.push(nb);
            const dn = d + 1;
            const df = depth.get(far)!;
            // Prefer the deepest node; break ties toward the better-connected
            // (more "notable") one so the journey ends somewhere meaningful.
            if (dn > df || (dn === df && neighborsOf(nb).length > neighborsOf(far).length)) {
                far = nb;
            }
        }
    }

    if (far === start) return [start];
    const path = [far];
    let cur = far;
    while (cur !== start) {
        cur = prev.get(cur)!;
        path.push(cur);
    }
    return path.reverse();
}

function firstSentence(summary: string, maxLen = 150): string {
    const m = summary.match(/^(.*?[.!?])(\s|$)/);
    let out = m ? m[1] : summary;
    if (out.length > maxLen) out = out.slice(0, maxLen - 1).trimEnd() + '…';
    return out;
}

function capitalize(s: string): string {
    return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** A short clause describing how we move from one node to the next. */
function connectorClause(prevId: string, curId: string): string {
    const prev = NODE_MAP[prevId]?.label ?? prevId;
    const cur = NODE_MAP[curId]?.label ?? curId;
    const edge = edgeBetween(prevId, curId);
    if (edge?.label) {
        return edge.source === prevId
            ? `${prev} ${edge.label} ${cur}`
            : `${cur} ${edge.label} ${prev}`;
    }
    return `${prev} connects to ${cur}`;
}

function captionFor(path: string[], i: number): string {
    const node = NODE_MAP[path[i]];
    if (!node) return '';
    if (i === 0) return firstSentence(node.summary, 160);
    return `${capitalize(connectorClause(path[i - 1], path[i]))}. ${firstSentence(node.summary, 96)}`.trim();
}

/** Choose a real civilization to frame the story on (start node's civ wins). */
function pickCivilization(path: string[]): string {
    const first = NODE_MAP[path[0]]?.civilizationId;
    if (first && CIVILIZATION_MAP[first]) return first;
    const counts: Record<string, number> = {};
    for (const id of path) {
        const c = NODE_MAP[id]?.civilizationId;
        if (c && CIVILIZATION_MAP[c]) counts[c] = (counts[c] ?? 0) + 1;
    }
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return best ? best[0] : CIVILIZATIONS[0].id;
}

/** Build a playable Story from free text, or null if nothing was recognised. */
export function buildStoryFromText(text: string): Story | null {
    const ids = matchNodes(text);
    if (ids.length === 0) return null;

    const path = ids.length === 1 ? outwardJourney(ids[0]) : chainThrough(ids);
    if (!path || path.length === 0) return null;

    const steps: StoryStep[] = path.map((id, i) => ({
        nodeId: id,
        caption: captionFor(path, i),
    }));

    return {
        id: `dynamic-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        question: text.trim(),
        civilizationId: pickCivilization(path),
        steps,
    };
}

/** Example prompts shown under the input to hint the free-text capability. */
export const STORY_PROMPT_EXAMPLES = [
    'How did zero become the computer?',
    'gunpowder to the internet',
    'silk road',
    'democracy to the modern world',
];
