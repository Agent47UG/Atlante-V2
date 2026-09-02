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
    // subrequests". Instead we resolve just the two endpoints (reused for
    // narration) and bridge them: a direct link, else a shared neighbour, else
    // the bare leap. Every stop is still a real Wikidata entity, so the story
    // stays fact-anchored; Gemini narrates the connective tissue.
    const [nf, nt] = await Promise.all([
      resolveNode(ctx.env, from),
      resolveNode(ctx.env, to),
    ]);
    const resolvedById = new Map<string, NodeResponse>([
      [from, nf],
      [to, nt],
    ]);

    let path: string[];
    if (nf.neighbors.some((n) => n.id === to)) {
      path = [from, to];
    } else {
      const fromSet = new Set(nf.neighbors.map((n) => n.id));
      const bridge = nt.neighbors.find((n) => fromSet.has(n.id));
      path = bridge ? [from, bridge.id, to] : [from, to];
    }

    // Resolve every node on the path (for summaries + neighbour verbs), reusing
    // the endpoints already fetched so only the bridge (if any) costs extra.
    const resolved: NodeResponse[] = [];
    for (const id of path) {
      let r = resolvedById.get(id);
      if (!r) {
        r = await resolveNode(ctx.env, id);
        resolvedById.set(id, r);
      }
      resolved.push(r);
    }

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
