// gemini.ts — generate full historical stories (or narrate graph paths) with
// Google Gemini using structured JSON output.

import type { Env, NodeType } from './types';

export interface GeneratedStoryStop {
  id: string;
  label: string;
  type: NodeType;
  era: string;
  year: number;
  civName: string;
  country: string;
  lat: number;
  lon: number;
  caption: string;
}

export interface GeneratedStory {
  question: string;
  stops: GeneratedStoryStop[];
}

const VALID_TYPES = new Set<NodeType>([
  'civilization',
  'person',
  'concept',
  'technology',
  'place',
  'artwork',
]);

function slugify(s: string, index: number): string {
  const slug = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || `stop-${index + 1}`;
}

/**
 * Ask Gemini to author an entire 6–8 stop historical journey directly as
 * structured JSON, with accurate eras, coordinates, civilizations, countries,
 * and 2–3 sentence narrative captions.
 */
export async function generateStory(
  env: Env,
  userPrompt: string,
): Promise<GeneratedStory | null> {
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';

  const systemInstruction = `You are the historian and cartographer of "Atlante", a poetic interactive 3D historical atlas.
Given a user's topic, question, or pair of concepts, chart a chronological historical journey of 6 to 8 stops that traces how the idea, technology, culture, or event unfolded across time and geography.

Rules:
1. Return between 6 and 8 chronological stops. Every stop must be a real, historically verifiable person, invention/technology, place, artwork, concept, or civilization — never filler or generic placeholders.
2. Each stop must include:
   - "id": unique kebab-case slug (e.g. "brahmagupta-zero", "house-of-wisdom").
   - "label": concise, canonical name (max 4 words, e.g. "Brahmagupta's Zero", "Al-Khwarizmi", "The Analytical Engine").
   - "type": one of "civilization", "person", "concept", "technology", "place", "artwork".
   - "era": readable historical date or period (e.g. "628 AD", "c. 820 AD", "3000 BC – 539 BC").
   - "year": integer year (negative for BC, positive for AD, e.g. -3200 or 1679).
   - "civName": the historical civilization, empire, or cultural era of this stop (e.g. "Classical India", "Abbasid Caliphate", "Renaissance Italy", "Industrial Britain", "Han Dynasty").
   - "country": the modern country name corresponding to the stop's location (e.g. "India", "Iraq", "Italy", "United Kingdom", "China").
   - "lat" and "lon": accurate terrestrial land coordinates (latitude -90..90, longitude -180..180) inside that country so the 3D globe can fly there and highlight the country polygon.
   - "caption": 2 to 3 evocative, historically rich sentences (40–70 words) explaining what happened at this stop and how it connects the previous stop to the next in the overarching story.`;

  const responseSchema = {
    type: 'OBJECT',
    properties: {
      question: {
        type: 'STRING',
        description: 'A polished title or question framing the historical journey.',
      },
      stops: {
        type: 'ARRAY',
        description: '6 to 8 chronological stops tracing the story across time and geography.',
        items: {
          type: 'OBJECT',
          properties: {
            id: { type: 'STRING' },
            label: { type: 'STRING' },
            type: {
              type: 'STRING',
              enum: ['civilization', 'person', 'concept', 'technology', 'place', 'artwork'],
            },
            era: { type: 'STRING' },
            year: { type: 'INTEGER' },
            civName: { type: 'STRING' },
            country: { type: 'STRING' },
            lat: { type: 'NUMBER' },
            lon: { type: 'NUMBER' },
            caption: { type: 'STRING' },
          },
          required: [
            'id',
            'label',
            'type',
            'era',
            'year',
            'civName',
            'country',
            'lat',
            'lon',
            'caption',
          ],
        },
      },
    },
    required: ['question', 'stops'],
  };

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
    `?key=${env.GEMINI_KEY}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [
          {
            role: 'user',
            parts: [{ text: `User prompt: "${userPrompt}"` }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json',
          responseSchema,
        },
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;

    const cleaned = String(rawText)
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed || !Array.isArray(parsed.stops) || parsed.stops.length < 2) {
      return null;
    }

    const usedIds = new Set<string>();
    const stops: GeneratedStoryStop[] = [];
    for (let i = 0; i < parsed.stops.length; i++) {
      const s = parsed.stops[i];
      if (!s || typeof s.label !== 'string' || !s.label.trim()) continue;
      let id = slugify(String(s.id || s.label), i);
      if (usedIds.has(id)) id = `${id}-${i + 1}`;
      usedIds.add(id);

      const type: NodeType = VALID_TYPES.has(s.type) ? s.type : 'concept';
      const year = Number.isFinite(Number(s.year)) ? Math.round(Number(s.year)) : 0;
      const lat = Number.isFinite(Number(s.lat))
        ? Math.max(-85, Math.min(85, Number(s.lat)))
        : 0;
      const lon = Number.isFinite(Number(s.lon))
        ? Math.max(-180, Math.min(180, Number(s.lon)))
        : 0;

      stops.push({
        id,
        label: s.label.trim(),
        type,
        era: String(s.era ?? '').trim() || (year < 0 ? `${Math.abs(year)} BC` : `${year} AD`),
        year,
        civName: String(s.civName ?? '').trim() || 'World History',
        country: String(s.country ?? '').trim(),
        lat,
        lon,
        caption: String(s.caption ?? '').trim(),
      });
    }

    if (stops.length < 2) return null;

    return {
      question: String(parsed.question || userPrompt).trim(),
      stops,
    };
  } catch {
    return null;
  }
}
