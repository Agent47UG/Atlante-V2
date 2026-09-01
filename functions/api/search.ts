// GET /api/search?q=text — resolve free text to a Wikidata id (for stories/search).
import { searchWikidata } from './_lib/wikidata';
import { CORS, errorJson, json, type Ctx } from './_lib/http';

export const onRequestOptions = () =>
  new Response(null, { status: 204, headers: CORS });

export async function onRequestGet(ctx: Ctx): Promise<Response> {
  const url = new URL(ctx.request.url);
  const term = url.searchParams.get('q')?.trim();
  if (!term) return errorJson('Missing ?q', 400);
  try {
    const id = await searchWikidata(term);
    return json({ id, term });
  } catch (err: any) {
    return errorJson(`Search failed: ${err?.message ?? err}`, 502);
  }
}
