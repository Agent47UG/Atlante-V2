// POST /api/story  { prompt } (or { question })
// Generates a complete 6–8 stop historical journey directly via Google Gemini,
// returning rich nodes (with coordinates, eras, civilizations, countries, and
// 2–3 sentence narrative captions) without hitting Turso or Wikidata.

import { generateStory } from './_lib/gemini';
import { CORS, errorJson, json, type Ctx } from './_lib/http';
import type { WireNode } from './_lib/types';

export const onRequestOptions = () =>
  new Response(null, { status: 204, headers: CORS });

export async function onRequestPost(ctx: Ctx): Promise<Response> {
  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return errorJson('Expected JSON body', 400);
  }

  const prompt = String(body.prompt ?? body.question ?? '').trim();
  if (!prompt) {
    return errorJson('Expected { prompt: "..." }', 400);
  }

  try {
    const generated = await generateStory(ctx.env, prompt);
    if (!generated || generated.stops.length < 2) {
      return errorJson('Could not generate a story for that prompt', 422);
    }

    const storyPrefix = `story-${Date.now().toString(36)}`;
    const nodes: WireNode[] = generated.stops.map((s, i) => ({
      id: `${storyPrefix}-${i}-${s.id}`,
      label: s.label,
      type: s.type,
      summary: s.caption,
      lat: s.lat,
      lon: s.lon,
      year: s.year,
      era: s.era,
      civName: s.civName,
      country: s.country,
    }));

    const steps = generated.stops.map((s, i) => ({
      nodeId: nodes[i].id,
      caption: s.caption,
    }));

    return json({
      id: storyPrefix,
      question: generated.question,
      steps,
      nodes,
    });
  } catch (err: any) {
    return errorJson(`Story build failed: ${err?.message ?? err}`, 502);
  }
}
