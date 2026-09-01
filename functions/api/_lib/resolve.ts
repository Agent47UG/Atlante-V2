// resolve.ts — the one place that turns a Q-id into a node + neighbours using
// the full layered cache (KV → Turso → Wikidata). Shared by every endpoint.

import { db, ensureSchema, readNode, writeNode } from './db';
import { fetchWikidataNode } from './wikidata';
import type { Env, NodeResponse } from './types';

const KV_TTL = 60 * 60 * 24 * 7; // 7 days

export async function resolveNode(
  env: Env,
  id: string,
  waitUntil?: (p: Promise<unknown>) => void,
): Promise<NodeResponse> {
  const kv = env.ATLANTE_KV;
  const kvKey = `node:${id}`;

  if (kv) {
    const hit = await kv.get(kvKey);
    if (hit) return JSON.parse(hit) as NodeResponse;
  }

  const client = db(env);
  await ensureSchema(client);

  const stored = await readNode(client, id);
  if (stored) {
    const payload: NodeResponse = { ...stored, source: 'db' };
    if (kv) {
      const put = kv.put(kvKey, JSON.stringify(payload), { expirationTtl: KV_TTL });
      waitUntil ? waitUntil(put) : await put;
    }
    return payload;
  }

  const fetched = await fetchWikidataNode(id);
  const payload: NodeResponse = { ...fetched, source: 'wikidata' };
  const write = writeNode(client, fetched).catch(() => {});
  waitUntil ? waitUntil(write) : await write;
  if (kv) {
    const put = kv.put(kvKey, JSON.stringify(payload), { expirationTtl: KV_TTL });
    waitUntil ? waitUntil(put) : await put;
  }
  return payload;
}
