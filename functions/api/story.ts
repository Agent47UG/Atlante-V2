// POST /api/story  { from, to, question? }
// Builds a real graph path, then narrates it with Gemini (falling back to each
// node's own summary). Returns a playable story + the nodes it touches.

import { findPath } from './_lib/pathfind';
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
    // Prefer a real, walkable graph path (fully grounded). If the sparse graph
    // can't connect the two concepts, fall back to a shared-neighbour bridge,
    // then finally to the bare endpoints — Gemini narrates the leap. Either way
    // every stop is a real Wikidata entity, so the story stays fact-anchored.
    let path = await findPath(ctx.env, from, to);
    if (!path || path.length === 0) {
      const [nf, nt] = await Promise.all([
        resolveNode(ctx.env, from),
        resolveNode(ctx.env, to),
      ]);
      const fromNeighbors = new Set(nf.neighbors.map((n) => n.id));
      const bridge = nt.neighbors.find((n) => fromNeighbors.has(n.id));
      path = bridge ? [from, bridge.id, to] : [from, to];
    }

    // Resolve every node on the path (for summaries + neighbour verbs).
    const resolved: NodeResponse[] = [];
    for (const id of path) resolved.push(await resolveNode(ctx.env, id));

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
