// GET /api/path?from=Q..&to=Q.. — the ordered id path between two nodes.
import { findPath } from './_lib/pathfind';
import { CORS, errorJson, json, type Ctx } from './_lib/http';

export const onRequestOptions = () =>
  new Response(null, { status: 204, headers: CORS });

export async function onRequestGet(ctx: Ctx): Promise<Response> {
  const url = new URL(ctx.request.url);
  const from = url.searchParams.get('from')?.toUpperCase();
  const to = url.searchParams.get('to')?.toUpperCase();
  if (!from || !to || !/^Q\d+$/.test(from) || !/^Q\d+$/.test(to)) {
    return errorJson('Expected ?from=Q..&to=Q..', 400);
  }
  try {
    const path = await findPath(ctx.env, from, to);
    if (!path) return errorJson('No path found within budget', 404);
    return json({ path });
  } catch (err: any) {
    return errorJson(`Pathfinding failed: ${err?.message ?? err}`, 502);
  }
}
