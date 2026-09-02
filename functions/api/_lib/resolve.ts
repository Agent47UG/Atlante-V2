// resolve.ts — the one place that turns a Q-id into a node + neighbours using
// Turso as the persistent cache, falling back to a live Wikidata fetch.

import { db, ensureSchema, readNode, writeNode } from './db';
import { fetchWikidataNode } from './wikidata';
import type { Env, NodeResponse } from './types';

export async function resolveNode(
  env: Env,
  id: string,
  waitUntil?: (p: Promise<unknown>) => void,
): Promise<NodeResponse> {
  const client = db(env);
  await ensureSchema(client);

  const stored = await readNode(client, id);
  if (stored) return { ...stored, source: 'db' };

  const fetched = await fetchWikidataNode(id);
  const payload: NodeResponse = { ...fetched, source: 'wikidata' };
  const write = writeNode(client, fetched).catch(() => {});
  waitUntil ? waitUntil(write) : await write;
  return payload;
}
