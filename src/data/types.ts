// ─────────────────────────────────────────────────────────────────────────────
// Shared data types for the Atlante knowledge universe (new-data model).
//
// These back the four datasets under `new-data/`:
//   • graph.ts          — NODES / EDGES (the knowledge graph)
//   • civilizations.ts  — CIVILIZATIONS (globe glow + timeline lifespans)
//   • stories.ts        — STORIES (guided node-sequence paths)
//   • timeline.ts       — TIMELINE (year markers)
// ─────────────────────────────────────────────────────────────────────────────

export type NodeType =
    | 'civilization'
    | 'person'
    | 'concept'
    | 'technology'
    | 'place'
    | 'artwork';

export interface NodeDetails {
    /** A single decorative glyph shown with the node. */
    glyph?: string;
    /** Free-form era string, e.g. "3500–539 BC". */
    era?: string;
    born?: string;
    died?: string;
    contributions?: string[];
    relatedPeople?: string[];
    relatedInventions?: string[];
}

export interface KnowledgeNode {
    id: string;
    label: string;
    type: NodeType;
    /** The civilization this node belongs to (undefined for a few bridges). */
    civilizationId?: string;
    summary: string;
    details?: NodeDetails;
}

export interface KnowledgeEdge {
    source: string;
    target: string;
    /** Optional relationship verb, e.g. "invented", "inspired". */
    label?: string;
}

export interface CivilizationPeriod {
    /** Years: negative = BC, positive = AD. */
    start: number;
    end: number;
}

export interface Civilization {
    id: string;
    name: string;
    epithet: string;
    lat: number;
    lon: number;
    /** Glow colour on the globe. */
    color: string;
    periods: CivilizationPeriod[];
    /** Node the exploration starts from when this civilization is opened. */
    rootNodeId: string;
    blurb: string;
    /**
     * Pinned Wikidata entity (Q-id) for this civilization. Used to bridge the
     * seed node into the live graph deterministically, instead of a fuzzy
     * label search that can land on outline/stub pages.
     */
    wikidataId?: string;
}

export interface StoryStep {
    nodeId: string;
    caption: string;
}

export interface Story {
    id: string;
    question: string;
    civilizationId: string;
    steps: StoryStep[];
}
