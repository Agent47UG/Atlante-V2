// ─────────────────────────────────────────────────────────────────────────────
// wikidata.ts — turn a Wikidata Q-id into an Atlante node + neighbours.
//
// Strategy (validated for speed + reliability on the public endpoints):
//   1. Special:EntityData/<id>.json  → the node's own claims (fast, CDN-cached).
//        • gives us its whitelisted outgoing relationships (the "neighbours"),
//          its coordinates (P625), its date (P571/P569), and its types (P31).
//   2. One batched SPARQL over just those neighbour ids → label, notability
//        (sitelinks), coordinates, date, and a type for each. (A bidirectional
//        query is too heavy for the public endpoint and 502s — this stays light.)
//   3. Wikipedia REST summary for the focus node → summary text + thumbnail.
//
// Everything is defensive: any missing piece degrades gracefully.
// ─────────────────────────────────────────────────────────────────────────────

import type { NodeType, WireNeighbor, WireNode } from './types';

const UA = 'AtlanteBot/0.1 (https://github.com/Agent47UG/Atlante-V2)';
const MAX_NEIGHBORS = 8;
const MIN_SITELINKS = 8; // notability floor — skips obscure entities.

/** Relationship predicates worth showing, mapped to a human verb. */
const WHITELIST: Record<string, string> = {
  P737: 'influenced by',
  P941: 'inspired by',
  P800: 'notable work',
  P61: 'discoverer/inventor',
  P170: 'creator',
  P101: 'field of work',
  P1066: 'student of',
  P184: 'advisor',
  P279: 'subclass of',
  P361: 'part of',
  P527: 'has part',
  P155: 'follows',
  P156: 'followed by',
  P138: 'named after',
  P144: 'based on',
  P2283: 'uses',
  P366: 'has use',
  P463: 'member of',
  P276: 'location',
  P19: 'born in',
  P20: 'died in',
};

// Q-id sets for typing. Kept small; `concept` is the safe default.
const PERSON = new Set(['Q5']);
const ARTWORK = new Set([
  'Q7725634', 'Q3305213', 'Q571', 'Q47461344', 'Q2431196', 'Q11424',
  'Q838948', 'Q7889', 'Q482994', 'Q134556', 'Q207628', 'Q87167',
]);
const TECH = new Set([
  'Q11019', 'Q1183543', 'Q2424752', 'Q1639378', 'Q811909', 'Q1668024',
  'Q29048322', 'Q210729', 'Q11660', 'Q205663', 'Q17008256',
]);
const PLACE = new Set([
  'Q515', 'Q6256', 'Q3624078', 'Q532', 'Q486972', 'Q82794', 'Q23442',
  'Q34442', 'Q5107', 'Q8502', 'Q4022', 'Q23397', 'Q1549591', 'Q515',
]);
const CIVILIZATION = new Set(['Q28171280', 'Q11772', 'Q28575', 'Q17167']);

function mapType(instanceOf: string[], hasCoord: boolean): NodeType {
  if (instanceOf.some((q) => PERSON.has(q))) return 'person';
  if (instanceOf.some((q) => CIVILIZATION.has(q))) return 'civilization';
  if (instanceOf.some((q) => ARTWORK.has(q))) return 'artwork';
  if (instanceOf.some((q) => TECH.has(q))) return 'technology';
  if (instanceOf.some((q) => PLACE.has(q)) || hasCoord) return 'place';
  return 'concept';
}

/** Parse a Wikidata time string ("+1643-01-04T00:00:00Z") to a signed year. */
function parseYear(time: string | undefined): number | undefined {
  if (!time) return undefined;
  const m = /^([+-])(\d+)-/.exec(time);
  if (!m) return undefined;
  const year = parseInt(m[2], 10);
  if (!Number.isFinite(year) || year === 0) return undefined;
  return m[1] === '-' ? -year : year;
}

async function getJSON(url: string): Promise<any> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  return res.json();
}

interface RawNeighbor {
  id: string;
  rel: string;
  dir: 'in' | 'out';
}

/** Pull whitelisted outgoing neighbour ids from an entity's claims. */
function extractNeighbors(entity: any): RawNeighbor[] {
  const out: RawNeighbor[] = [];
  const claims = entity?.claims ?? {};
  for (const [pid, rel] of Object.entries(WHITELIST)) {
    const list = claims[pid];
    if (!Array.isArray(list)) continue;
    for (const c of list) {
      const dv = c?.mainsnak?.datavalue;
      if (dv?.type === 'wikibase-entityid' && dv.value?.id) {
        out.push({ id: dv.value.id, rel, dir: 'out' });
      }
    }
  }
  return out;
}

/** Instance-of (P31) q-ids of an entity. */
function instanceOfIds(entity: any): string[] {
  const list = entity?.claims?.P31;
  if (!Array.isArray(list)) return [];
  return list
    .map((c: any) => c?.mainsnak?.datavalue?.value?.id)
    .filter(Boolean) as string[];
}

/** Coordinate (P625) of an entity, if any. */
function coordOf(entity: any): { lat?: number; lon?: number } {
  const c = entity?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
  if (c && typeof c.latitude === 'number') {
    return { lat: c.latitude, lon: c.longitude };
  }
  return {};
}

/** Best date year of an entity: inception, else birth, else start time. */
function yearOf(entity: any): number | undefined {
  const claims = entity?.claims ?? {};
  for (const pid of ['P571', 'P569', 'P580', 'P585']) {
    const t = claims[pid]?.[0]?.mainsnak?.datavalue?.value?.time;
    const y = parseYear(t);
    if (y !== undefined) return y;
  }
  return undefined;
}

/** Wikipedia summary + thumbnail for an entity's enwiki page. */
async function wikipediaSummary(
  title: string | undefined,
): Promise<{ summary?: string; image?: string }> {
  if (!title) return {};
  try {
    const data = await getJSON(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    );
    return { summary: data.extract, image: data.thumbnail?.source };
  } catch {
    return {};
  }
}

/** Enrich neighbour ids with label, notability, coord, date and type. */
async function enrichNeighbors(
  raw: RawNeighbor[],
): Promise<WireNeighbor[]> {
  if (raw.length === 0) return [];
  const relOf = new Map<string, string>();
  for (const r of raw) if (!relOf.has(r.id)) relOf.set(r.id, r.rel);
  const ids = [...relOf.keys()].slice(0, 40);
  const values = ids.map((id) => `wd:${id}`).join(' ');
  const query = `SELECT ?o ?oLabel ?sl ?coord ?date ?t WHERE {
    VALUES ?o { ${values} }
    ?o wikibase:sitelinks ?sl . FILTER(?sl >= ${MIN_SITELINKS})
    ?o rdfs:label ?oLabel . FILTER(LANG(?oLabel)="en")
    OPTIONAL { ?o wdt:P625 ?coord }
    OPTIONAL { ?o wdt:P571 ?date }
    OPTIONAL { ?o wdt:P31 ?t }
  } ORDER BY DESC(?sl)`;
  const url =
    'https://query.wikidata.org/sparql?format=json&query=' +
    encodeURIComponent(query);
  const data = await getJSON(url);

  const seen = new Set<string>();
  const result: WireNeighbor[] = [];
  for (const b of data.results?.bindings ?? []) {
    const id = b.o.value.split('/').pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const typeQ = b.t?.value?.split('/').pop();
    let lat: number | undefined;
    let lon: number | undefined;
    const cm = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.coord?.value ?? '');
    if (cm) {
      lon = parseFloat(cm[1]);
      lat = parseFloat(cm[2]);
    }
    result.push({
      id,
      label: b.oLabel.value,
      type: mapType(typeQ ? [typeQ] : [], lat !== undefined),
      lat,
      lon,
      year: parseYear(b.date?.value),
      rel: relOf.get(id) ?? 'related to',
      dir: 'out',
    });
    if (result.length >= MAX_NEIGHBORS) break;
  }
  return result;
}

export interface FetchedNode {
  node: WireNode;
  neighbors: WireNeighbor[];
}

/** Fetch and assemble a full Atlante node from Wikidata + Wikipedia. */
export async function fetchWikidataNode(qid: string): Promise<FetchedNode> {
  const data = await getJSON(
    `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`,
  );
  const entity = data.entities?.[qid];
  if (!entity) throw new Error(`entity ${qid} not found`);

  const label: string =
    entity.labels?.en?.value ?? entity.labels?.mul?.value ?? qid;
  const enTitle: string | undefined = entity.sitelinks?.enwiki?.title;
  const { lat, lon } = coordOf(entity);
  const year = yearOf(entity);
  const type = mapType(instanceOfIds(entity), lat !== undefined);

  const [wp, neighbors] = await Promise.all([
    wikipediaSummary(enTitle),
    enrichNeighbors(extractNeighbors(entity)),
  ]);

  const summary =
    wp.summary ?? entity.descriptions?.en?.value ?? 'No description available.';

  const node: WireNode = {
    id: qid,
    label,
    type,
    summary,
    lat,
    lon,
    year,
    image: wp.image,
  };
  return { node, neighbors };
}

/** Resolve a free-text label to a Q-id via the Wikidata search API. */
export async function searchWikidata(term: string): Promise<string | null> {
  const url =
    'https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json' +
    `&language=en&limit=1&search=${encodeURIComponent(term)}`;
  try {
    const data = await getJSON(url);
    return data.search?.[0]?.id ?? null;
  } catch {
    return null;
  }
}
