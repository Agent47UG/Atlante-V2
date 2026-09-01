// ─────────────────────────────────────────────────────────────────────────────
// db.ts — the shared Turso (libSQL) store: one growing source of truth.
//
// Two tables (nodes, edges) keyed by Wikidata Q-id so the same concept reached
// from any direction resolves to a single row (no duplicates). The seeded
// "core" is marked pinned=1 and protected from being overwritten by frontier
// discoveries.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, type Client } from '@libsql/client';
import type { Env, FetchedNode, WireNeighbor, WireNode } from './types';

let cached: Client | null = null;

export function db(env: Env): Client {
  if (!cached) {
    cached = createClient({ url: env.TURSO_URL, authToken: env.TURSO_TOKEN });
  }
  return cached;
}

/** Create tables if they don't exist. Safe to call on every request. */
export async function ensureSchema(client: Client): Promise<void> {
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS nodes (
        id       TEXT PRIMARY KEY,
        label    TEXT NOT NULL,
        type     TEXT NOT NULL,
        summary  TEXT,
        lat      REAL,
        lon      REAL,
        year     INTEGER,
        image    TEXT,
        glyph    TEXT,
        pinned   INTEGER NOT NULL DEFAULT 0,
        expanded INTEGER NOT NULL DEFAULT 0,
        created  INTEGER NOT NULL DEFAULT (unixepoch())
      )`,
      `CREATE TABLE IF NOT EXISTS edges (
        source TEXT NOT NULL,
        target TEXT NOT NULL,
        label  TEXT,
        PRIMARY KEY (source, target)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source)`,
      `CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target)`,
    ],
    'write',
  );
}

function rowToNode(row: any): WireNode {
  return {
    id: row.id,
    label: row.label,
    type: row.type,
    summary: row.summary ?? '',
    lat: row.lat ?? undefined,
    lon: row.lon ?? undefined,
    year: row.year ?? undefined,
    image: row.image ?? undefined,
    glyph: row.glyph ?? undefined,
  };
}

/**
 * Read a fully-expanded node (node + its neighbours) from the DB.
 * Returns null if the node isn't stored yet or hasn't been expanded, so the
 * caller knows to fall back to a live Wikidata fetch.
 */
export async function readNode(
  client: Client,
  id: string,
): Promise<FetchedNode | null> {
  const nodeRes = await client.execute({
    sql: 'SELECT * FROM nodes WHERE id = ?',
    args: [id],
  });
  const row = nodeRes.rows[0] as any;
  if (!row || !row.expanded) return null;

  const edgeRes = await client.execute({
    sql: `SELECT e.label AS rel, n.*
          FROM edges e JOIN nodes n ON n.id = e.target
          WHERE e.source = ?`,
    args: [id],
  });
  const neighbors: WireNeighbor[] = edgeRes.rows.map((r: any) => ({
    id: r.id,
    label: r.label,
    type: r.type,
    lat: r.lat ?? undefined,
    lon: r.lon ?? undefined,
    year: r.year ?? undefined,
    rel: r.rel ?? 'related to',
    dir: 'out',
  }));
  return { node: rowToNode(row), neighbors };
}

/**
 * Persist a freshly-fetched node + neighbours. Neighbours are upserted as stubs
 * (unexpanded) so clicking them later triggers their own expansion. Pinned rows
 * are never overwritten.
 */
export async function writeNode(
  client: Client,
  data: FetchedNode,
): Promise<void> {
  const stmts: { sql: string; args: any[] }[] = [];

  // The focus node — mark expanded. ON CONFLICT keeps pinned rows' curated
  // content but flips expanded on.
  const n = data.node;
  stmts.push({
    sql: `INSERT INTO nodes (id,label,type,summary,lat,lon,year,image,glyph,expanded)
          VALUES (?,?,?,?,?,?,?,?,?,1)
          ON CONFLICT(id) DO UPDATE SET
            label=CASE WHEN nodes.pinned=1 THEN nodes.label ELSE excluded.label END,
            type=CASE WHEN nodes.pinned=1 THEN nodes.type ELSE excluded.type END,
            summary=CASE WHEN nodes.pinned=1 THEN nodes.summary ELSE excluded.summary END,
            lat=COALESCE(excluded.lat, nodes.lat),
            lon=COALESCE(excluded.lon, nodes.lon),
            year=COALESCE(excluded.year, nodes.year),
            image=COALESCE(excluded.image, nodes.image),
            expanded=1`,
    args: [
      n.id, n.label, n.type, n.summary ?? null,
      n.lat ?? null, n.lon ?? null, n.year ?? null,
      n.image ?? null, n.glyph ?? null,
    ],
  });

  for (const nb of data.neighbors) {
    // Neighbour stub (don't clobber an already-expanded/pinned neighbour).
    stmts.push({
      sql: `INSERT INTO nodes (id,label,type,lat,lon,year,expanded)
            VALUES (?,?,?,?,?,?,0)
            ON CONFLICT(id) DO UPDATE SET
              lat=COALESCE(nodes.lat, excluded.lat),
              lon=COALESCE(nodes.lon, excluded.lon),
              year=COALESCE(nodes.year, excluded.year)`,
      args: [nb.id, nb.label, nb.type, nb.lat ?? null, nb.lon ?? null, nb.year ?? null],
    });
    // Directed edge with its verb, both ways so adjacency is undirected.
    stmts.push({
      sql: `INSERT INTO edges (source,target,label) VALUES (?,?,?)
            ON CONFLICT(source,target) DO UPDATE SET label=excluded.label`,
      args: [n.id, nb.id, nb.rel],
    });
    stmts.push({
      sql: `INSERT INTO edges (source,target,label) VALUES (?,?,?)
            ON CONFLICT(source,target) DO NOTHING`,
      args: [nb.id, n.id, nb.rel],
    });
  }

  await client.batch(stmts, 'write');
}

/** Neighbour ids of a node straight from the edges table (for pathfinding). */
export async function neighborIds(
  client: Client,
  id: string,
): Promise<string[]> {
  const res = await client.execute({
    sql: 'SELECT target FROM edges WHERE source = ?',
    args: [id],
  });
  return res.rows.map((r: any) => r.target as string);
}
