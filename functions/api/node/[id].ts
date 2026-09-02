// GET /api/node/:id — resolve one node + its neighbours.
// Layered cache: KV → Turso DB → live Wikidata/Wikipedia fetch (then persisted).

import { resolveNode } from '../_lib/resolve';
import { CORS, errorJson, json, type Ctx } from '../_lib/http';

export const onRequestOptions = () =>
  new Response(null, { status: 204, headers: CORS });

export async function onRequestGet(ctx: Ctx): Promise<Response> {
  const raw = ctx.params.id;
  const id = (Array.isArray(raw) ? raw[0] : raw)?.toUpperCase();
  if (!id || !/^Q\d+$/.test(id)) {
    return errorJson('Expected a Wikidata id like Q935', 400);
  }
  try {
    const payload = await resolveNode(ctx.env, id, ctx.waitUntil);
    // Cache rich results hard (they rarely change and offload the worker), but
    // only briefly cache thin/empty ones — otherwise a transiently empty node
    // gets pinned at the browser/CDN edge for a day and never self-heals.
    const rich = (payload.neighbors?.length ?? 0) >= 3;
    return json(payload, {
      headers: {
        'Cache-Control': rich
          ? 'public, max-age=86400'
          : 'public, max-age=120',
      },
    });
  } catch (err: any) {
    return errorJson(`Failed to resolve ${id}: ${err?.message ?? err}`, 502);
  }
}
