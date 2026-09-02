// POST /api/story  { from, to, question? }
// Builds a real graph path, then narrates it with Gemini (falling back to each
// node's own summary). Returns a playable story + the nodes it touches.

import { resolveNode } from './_lib/resolve';
import { narratePath } from './_lib/gemini';
import { CORS, errorJson, json, type Ctx } from './_lib/http';
import type { NodeResponse, WireNode } from './_lib/types';

export const onRequestOptions = () =>
  new Response(null, { status: 204, headers: CORS });

function firstSentence(text: string, max = 150): string {
  const m = text.match(/^(.*?[.!?])(\s|$)/);
  let out = m ? m[1] : text;
  if (out.length > max) out = out.slice(0, max - 1).trimEnd() + '…';
  return out;
}

export async function onRequestPost(ctx: Ctx): Promise<Response> {
  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return errorJson('Expected JSON body', 400);
  }
  const from = String(body.from ?? '').toUpperCase();
  const to = String(body.to ?? '').toUpperCase();
  const question = String(body.question ?? '').trim() || 'A journey through ideas';
  if (!/^Q\d+$/.test(from) || !/^Q\d+$/.test(to)) {
    return errorJson('Expected { from: "Q..", to: "Q.." }', 400);
  }

  try {
    // Build a grounded path WITHOUT a deep graph walk. Resolving each node
    // triggers several Wikidata + Turso subrequests, and Cloudflare caps those
    // per invocation — a bidirectional BFS here reliably tripped "Too many
    // subrequests". So we bridge the two endpoints with a *bounded* search
    // (≤3 extra node fetches) that still surfaces one or two real in-between
    // stops. Every stop is a real Wikidata entity, so the story stays
    // fact-anchored; Gemini narrates the connective tissue.
    const [nf, nt] = await Promise.all([
      resolveNode(ctx.env, from),
      resolveNode(ctx.env, to),
    ]);
    const resolvedById = new Map<string, NodeResponse>([
      [from, nf],
      [to, nt],
    ]);
    const isQ = (id: string) => /^Q\d+$/.test(id);
    const get = async (id: string): Promise<NodeResponse> => {
      let r = resolvedById.get(id);
      if (!r) {
        r = await resolveNode(ctx.env, id);
        resolvedById.set(id, r);
      }
      return r;
    };

    // Entities reachable one hop from `to` (plus `to` itself) — used to detect
    // where a path from `from`'s side lands.
    const toSide = new Set<string>([to, ...nt.neighbors.map((n) => n.id)]);
    const fromSet = new Set(nf.neighbors.map((n) => n.id));

    let path: string[] | null = null;

    // 1. Direct link.
    if (fromSet.has(to)) path = [from, to];

    // 2. A single node that both endpoints touch (one intermediate).
    if (!path) {
      const shared = nf.neighbors.find((n) => n.id !== to && toSide.has(n.id));
      if (shared) path = [from, shared.id, to];
    }

    // 3. Bounded expansion: walk a few of `from`'s most notable neighbours one
    //    hop further, looking for a link into `to`'s side (one or two stops).
    if (!path) {
      const candidates = nf.neighbors
        .filter((n) => isQ(n.id) && n.id !== to)
        .slice(0, 3);
      for (const fn of candidates) {
        const r = await get(fn.id);
        if (r.neighbors.some((n) => n.id === to)) {
          path = [from, fn.id, to];
          break;
        }
        const mid = r.neighbors.find(
          (n) => n.id !== from && n.id !== to && n.id !== fn.id && toSide.has(n.id),
        );
        if (mid) {
          path = mid.id === to ? [from, fn.id, to] : [from, fn.id, mid.id, to];
          break;
        }
      }
    }

    // 4. Nothing connected — start from the bare leap and let the top-up below
    //    fill in real stops.
    if (!path) path = [from, to];

    // Drop any accidental repeats while preserving order.
    path = path.filter((id, i) => path!.indexOf(id) === i);

    // 5. Guarantee a minimum of MIN_STOPS nodes so a story is never a short
    //    two- or three-node leap. We pad with real, notable neighbours of the
    //    stops already on the path (from→stop edges stay real; Gemini narrates
    //    the rest). Filler is inserted just before `to`.
    const MIN_STOPS = 4;
    if (path.length < MIN_STOPS) {
      const inPath = new Set(path);
      // Pull filler from the from-side first, then anything already resolved,
      // then the to-side — all real Wikidata entities.
      const pool: string[] = [];
      const push = (ids: string[]) => {
        for (const id of ids) {
          if (isQ(id) && !inPath.has(id) && !pool.includes(id)) pool.push(id);
        }
      };
      push(nf.neighbors.map((n) => n.id));
      for (const id of [...path]) {
        const r = resolvedById.get(id);
        if (r) push(r.neighbors.map((n) => n.id));
      }
      push(nt.neighbors.map((n) => n.id));

      const insertAt = path.length - 1; // just before `to`
      let i = 0;
      while (path.length < MIN_STOPS && i < pool.length) {
        path.splice(insertAt + i, 0, pool[i]);
        i++;
      }
    }

    // Resolve every node on the path (for summaries + neighbour verbs), reusing
    // anything already fetched above so only new stops cost extra.
    const resolved: NodeResponse[] = [];
    for (const id of path) resolved.push(await get(id));

    const nodes: WireNode[] = resolved.map((r) => r.node);
    const verbBetween = (prev: NodeResponse, curId: string): string | undefined =>
      prev.neighbors.find((n) => n.id === curId)?.rel;

    const stops = resolved.map((r, i) => ({
      label: r.node.label,
      summary: firstSentence(r.node.summary, 200),
      via: i > 0 ? verbBetween(resolved[i - 1], r.node.id) : undefined,
    }));

    const captions =
      (await narratePath(ctx.env, question, stops)) ??
      stops.map((s) =>
        s.via ? `${capitalize(s.via)}: ${s.summary}` : s.summary,
      );

    const steps = path.map((nodeId, i) => ({
      nodeId,
      caption: captions[i] ?? firstSentence(resolved[i].node.summary, 120),
    }));

    return json({
      id: `live-${Date.now().toString(36)}`,
      question,
      steps,
      nodes,
    });
  } catch (err: any) {
    return errorJson(`Story build failed: ${err?.message ?? err}`, 502);
  }
}

function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
