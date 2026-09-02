// ─────────────────────────────────────────────────────────────────────────────
// liveStore — grows the knowledge graph on demand from the /api backend.
//
// The seeded graph (graph.ts) is the built-in "core": its nodes use slug ids
// (e.g. "zero", "mesopotamia") and are always present. Everything discovered
// live from Wikidata uses Q-ids (e.g. "Q935"). Clicking a Q-id node fetches its
// neighbours from the backend, merges them into the SAME mutable NODE_MAP /
// ADJACENCY / EDGES the rest of the app already reads, and notifies React to
// re-render. Because those helpers stay synchronous, the whole UI is unchanged —
// it just has more nodes than before.
//
// Layers: in-memory (this session) → IndexedDB (this browser) → /api (shared).
// ─────────────────────────────────────────────────────────────────────────────

import type { KnowledgeNode, KnowledgeEdge, NodeType, Story } from '../types';
import { NODE_MAP, ADJACENCY, EDGES } from './graph';
import { formatYear } from './timeline';
import { CIVILIZATIONS, CIVILIZATION_MAP } from './civilizations';

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE?.replace(/\/$/, '') ?? '/api';

/** How many neighbours to warm in the background after a node loads. */
const PREFETCH_COUNT = 2;

export interface NodeGeo {
  lat?: number;
  lon?: number;
  year?: number;
  image?: string;
}

/** Geo/time/image sidecar for any node (core nodes fill this from civ data). */
export const NODE_GEO: Record<string, NodeGeo> = {};

interface WireNeighbor {
  id: string;
  label: string;
  type: NodeType;
  lat?: number;
  lon?: number;
  year?: number;
  rel: string;
  dir: 'in' | 'out';
  desc?: string;
}
interface WireNode {
  id: string;
  label: string;
  type: NodeType;
  summary: string;
  lat?: number;
  lon?: number;
  year?: number;
  image?: string;
  glyph?: string;
}
interface NodeResponse {
  node: WireNode;
  neighbors: WireNeighbor[];
  source: string;
}

const expanded = new Set<string>(); // ids whose neighbours are loaded
const loadingSet = new Set<string>();
const failed = new Map<string, string>();
const listeners = new Set<() => void>();

// Insertion order for nodes discovered live, so the explorer can surface the
// freshest frontier first instead of burying it under the curated core.
const orderById = new Map<string, number>();
let orderSeq = 0;
/** Discovery rank: 0 for the curated core, higher = more recently fetched. */
export const nodeOrder = (id: string): number => orderById.get(id) ?? 0;

/** A node id is "live" (fetched from Wikidata) iff it's a Q-id. */
export const isLiveId = (id: string): boolean => /^Q\d+$/.test(id);

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function emit(): void {
  for (const cb of listeners) cb();
}

export const isLoading = (id: string): boolean => loadingSet.has(id);
export const loadError = (id: string): string | undefined => failed.get(id);
export const isExpanded = (id: string): boolean =>
  expanded.has(id) || !isLiveId(id); // core nodes are always "expanded"

// ── merge helpers ────────────────────────────────────────────────────────
function addNode(w: WireNode | WireNeighbor, full: boolean): void {
  const existing = NODE_MAP[w.id];
  const era = w.year !== undefined ? formatYear(w.year) : undefined;
  const summary = (w as WireNode).summary ?? '';
  const desc = (w as WireNeighbor).desc ?? '';
  const image = (w as WireNode).image;
  // A neighbour stub carries a one-line description; a full node carries a rich
  // summary. Either is enough to make the info panel read richly on first sight.
  const initialText = full ? summary || desc : desc;
  if (!existing) {
    const node: KnowledgeNode = {
      id: w.id,
      label: w.label,
      type: w.type,
      summary: initialText,
      details: era || (w as WireNode).glyph
        ? { era, glyph: (w as WireNode).glyph }
        : undefined,
    };
    NODE_MAP[w.id] = node;
    if (!ADJACENCY[w.id]) ADJACENCY[w.id] = [];
    if (isLiveId(w.id)) orderById.set(w.id, ++orderSeq);
  } else {
    // Upgrade a thin summary when a richer one (or any at all) arrives.
    if (full && summary && existing.summary !== summary) existing.summary = summary;
    else if (!existing.summary && initialText) existing.summary = initialText;
    if (era && !existing.details?.era) {
      existing.details = { ...existing.details, era };
    }
  }
  const geo = (NODE_GEO[w.id] ??= {});
  if (w.lat !== undefined) geo.lat = w.lat;
  if (w.lon !== undefined) geo.lon = w.lon;
  if (w.year !== undefined) geo.year = w.year;
  if (image) geo.image = image;
}

function addEdge(a: string, b: string, label: string): void {
  if (!ADJACENCY[a]) ADJACENCY[a] = [];
  if (!ADJACENCY[b]) ADJACENCY[b] = [];
  if (!ADJACENCY[a].includes(b)) ADJACENCY[a].push(b);
  if (!ADJACENCY[b].includes(a)) ADJACENCY[b].push(a);
  const exists = EDGES.some(
    (e) =>
      (e.source === a && e.target === b) || (e.source === b && e.target === a),
  );
  if (!exists) {
    const edge: KnowledgeEdge = { source: a, target: b, label };
    EDGES.push(edge);
  }
}

function merge(data: NodeResponse): void {
  addNode(data.node, true);
  for (const nb of data.neighbors) {
    addNode(nb, false);
    addEdge(data.node.id, nb.id, nb.rel);
  }
}

// ── IndexedDB (raw, no dependency) ─────────────────────────────────────────
const DB_NAME = 'atlante';
const STORE = 'nodes';
// Bump when the node/neighbour shape or backend logic changes so stale client
// caches are dropped on next load — otherwise a node cached empty/failed under
// old code keeps being served from the browser and never re-fetches.
const DB_VERSION = 2;
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Drop any prior cache so an upgraded client always starts clean.
      if (db.objectStoreNames.contains(STORE)) db.deleteObjectStore(STORE);
      db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  return dbPromise;
}

async function idbGet(id: string): Promise<NodeResponse | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as NodeResponse) ?? null);
    req.onerror = () => resolve(null);
  });
}

async function idbPut(id: string, data: NodeResponse): Promise<void> {
  const db = await openDB();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(data, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

// ── the public API ─────────────────────────────────────────────────────────
async function fetchNode(id: string): Promise<NodeResponse> {
  // Bypass the browser HTTP cache: IndexedDB is already our client-side cache,
  // and Turso is the shared server cache. Letting the browser also cache the
  // /api response (Cache-Control: max-age) pinned stale/empty nodes for a day.
  const res = await fetch(`${API_BASE}/node/${id}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * Ensure a node's neighbours are loaded. No-op for core nodes and already-
 * expanded nodes. Fetches from IndexedDB first, then the backend, merges the
 * result, then quietly prefetches a couple of neighbours for the next click.
 */
export async function ensureNode(id: string, cascade = true): Promise<void> {
  if (isExpanded(id) || loadingSet.has(id)) return;
  loadingSet.add(id);
  failed.delete(id);
  emit();
  try {
    let data = await idbGet(id);
    if (!data) {
      data = await fetchNode(id);
      void idbPut(id, data);
    }
    merge(data);
    expanded.add(id);
    emit();
    if (cascade) prefetch(data);
  } catch (err: any) {
    failed.set(id, err?.message ?? 'Failed to load');
    emit();
  } finally {
    loadingSet.delete(id);
    emit();
  }
}

function prefetch(data: NodeResponse): void {
  const targets = data.neighbors
    .filter((n) => isLiveId(n.id) && !isExpanded(n.id))
    .slice(0, PREFETCH_COUNT);
  for (const n of targets) {
    // Warm one hop only — prefetched neighbours must NOT cascade, or a single
    // click/prewarm fans out into hundreds of /api/node fetches (crawling the
    // whole neighbourhood), overwhelming the worker and rate-limiting Wikidata.
    window.setTimeout(() => void ensureNode(n.id, false).catch(() => {}), 400);
  }
}

// ── bridging the curated core into the live Wikidata frontier ───────────────
const bridged = new Set<string>();

/** Resolve free text to a Wikidata Q-id via the backend search endpoint. */
export async function resolveTerm(term: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(term)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Graft the live Wikidata neighbours of `term` directly around a curated core
 * node, so opening a civilization's root also opens a door into the infinite
 * graph. Idempotent per core id.
 */
export async function bridgeCore(coreId: string, term: string, pinnedQid?: string): Promise<void> {
  if (bridged.has(coreId) || loadingSet.has(coreId)) return;
  bridged.add(coreId);
  loadingSet.add(coreId);
  emit();
  try {
    const qid = pinnedQid ?? (await resolveTerm(term));
    if (!qid) return;
    let data = await idbGet(qid);
    if (!data) {
      data = await fetchNode(qid);
      void idbPut(qid, data);
    }
    merge(data);
    expanded.add(qid);
    // Attach the entity's neighbours to the curated root node.
    for (const nb of data.neighbors) addEdge(coreId, nb.id, nb.rel);
    emit();
    prefetch(data);
  } catch (err: any) {
    failed.set(coreId, err?.message ?? 'Failed to load');
    bridged.delete(coreId); // allow a retry
    emit();
  } finally {
    loadingSet.delete(coreId);
    emit();
  }
}

/**
 * Expand ANY node's neighbours on demand. Live (Q-id) nodes fetch directly;
 * curated seed nodes (civilizations, slug ids) resolve their label to a
 * Wikidata entity and graft its frontier on. This is what makes every click —
 * not just opening a civilization — grow the graph.
 */
export async function expand(id: string): Promise<void> {
  if (isLiveId(id)) return ensureNode(id);
  const node = NODE_MAP[id];
  if (node) {
    const civ = node.civilizationId ? CIVILIZATION_MAP[node.civilizationId] : undefined;
    await bridgeCore(id, node.label, civ?.wikidataId);
  }
}

/**
 * Warm every civilization's live neighbours in the background so the first
 * time you open one it's already there. Gentle concurrency + a startup delay
 * so we don't hammer the backend on load; everything is cached after first run.
 */
export async function prewarmCivilizations(delayMs = 1500): Promise<void> {
  await new Promise((r) => setTimeout(r, delayMs));
  const roots = CIVILIZATIONS.map((c) => ({ id: c.rootNodeId, name: c.name, qid: c.wikidataId }));
  const CONCURRENCY = 3;
  let i = 0;
  async function worker(): Promise<void> {
    while (i < roots.length) {
      const r = roots[i++];
      await bridgeCore(r.id, r.name, r.qid).catch(() => {});
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}
interface StoryResponse {
  id: string;
  question: string;
  steps: { nodeId: string; caption: string }[];
  nodes: WireNode[];
}

/**
 * Strip question scaffolding and filler so a phrase like "How did zero" or
 * "the modern world" reduces to the concept a Wikidata search can actually
 * resolve ("zero", "modern world").
 */
function cleanConcept(s: string): string {
  let t = s.trim().replace(/[?.!]+$/, '').trim();
  const FILLER = /^(how|why|what|when|where|who|which|did|do|does|was|were|is|are|has|have|the|a|an|of|about)\s+/i;
  let prev: string;
  do {
    prev = t;
    t = t.replace(FILLER, '').trim();
  } while (t !== prev && t.length > 0);
  return t || s.trim();
}

/** Split "gunpowder to the internet" into its two endpoint concepts. */
function splitConcepts(text: string): [string, string] | null {
  const parts = text
    .split(/\s*(?:->|→|\bbec[ao]mes?\b|\bto\b|\bthen\b|\binto\b|\bfrom\b|\band\b|,)\s*/i)
    .map((s) => cleanConcept(s))
    .filter(Boolean);
  if (parts.length < 2) return null;
  return [parts[0], parts[parts.length - 1]];
}

function haversine(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * Math.asin(Math.sqrt(s));
}

/** Nearest curated civilization to a coordinate — the story's "ground". */
function nearestCiv(lat?: number, lon?: number): string {
  if (lat === undefined || lon === undefined) return CIVILIZATIONS[0].id;
  let best = CIVILIZATIONS[0];
  let bestD = Infinity;
  for (const c of CIVILIZATIONS) {
    const d = haversine(lat, lon, c.lat, c.lon);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best.id;
}

/**
 * Build a guided story between two internet concepts: resolve both endpoints,
 * ask the backend for a Gemini-narrated path, merge its nodes into the graph,
 * and ground it on the civilization nearest the starting concept.
 */
export async function buildLiveStory(text: string): Promise<Story | null> {
  const pair = splitConcepts(text);
  let from: string | null;
  let to: string | null;
  if (pair) {
    [from, to] = await Promise.all([resolveTerm(pair[0]), resolveTerm(pair[1])]);
  } else {
    // Single concept: anchor on it, then journey to its most notable neighbour.
    from = await resolveTerm(cleanConcept(text));
    to = null;
    if (from) {
      const node = await fetchNode(from).catch(() => null);
      to = node?.neighbors?.find((n) => n.id !== from)?.id ?? null;
    }
  }
  if (!from || !to || from === to) return null;

  let data: StoryResponse;
  try {
    const res = await fetch(`${API_BASE}/story`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ from, to, question: text.trim() }),
    });
    if (!res.ok) return null;
    data = await res.json();
  } catch {
    return null;
  }
  if (!data.steps?.length) return null;

  for (const w of data.nodes) addNode(w, true);
  for (let i = 0; i < data.steps.length - 1; i++) {
    addEdge(data.steps[i].nodeId, data.steps[i + 1].nodeId, 'leads to');
  }
  emit();

  const fromNode = data.nodes.find((n) => n.id === from);
  return {
    id: data.id || `live-${Date.now().toString(36)}`,
    question: data.question || text.trim(),
    civilizationId: nearestCiv(fromNode?.lat, fromNode?.lon),
    steps: data.steps,
  };
}
