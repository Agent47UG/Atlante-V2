// Wire types shared between the Cloudflare Pages Functions (server) and the
// browser client. Kept intentionally small: a click transfers one full node
// plus lightweight neighbour stubs.

export type NodeType =
  | 'civilization'
  | 'person'
  | 'concept'
  | 'technology'
  | 'place'
  | 'artwork';

/** A neighbour as first seen from another node: enough to draw its dot. */
export interface WireNeighbor {
  id: string;
  label: string;
  type: NodeType;
  lat?: number;
  lon?: number;
  year?: number;
  /** Relationship verb, e.g. "influenced by". */
  rel: string;
  /** "out" = focus → neighbour, "in" = neighbour → focus. */
  dir: 'in' | 'out';
}

/** A fully-resolved node (the one that was clicked). */
export interface WireNode {
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

export interface FetchedNode {
  node: WireNode;
  neighbors: WireNeighbor[];
}

export interface NodeResponse extends FetchedNode {
  /** Where the payload came from (handy for debugging / cache headers). */
  source: 'core' | 'db' | 'wikidata';
}

/** Cloudflare Pages Functions environment bindings. */
export interface Env {
  TURSO_URL: string;
  TURSO_TOKEN: string;
  GEMINI_KEY: string;
  GEMINI_MODEL?: string;
  ATLANTE_KV?: KVNamespace;
}

// Minimal KV typing so we don't need @cloudflare/workers-types at author time.
export interface KVNamespace {
  get(key: string, type?: 'text'): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
}
