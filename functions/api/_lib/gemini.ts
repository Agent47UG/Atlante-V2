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

/** Memoised working model per Worker isolate so a discovered replacement model
 *  is used immediately on subsequent requests without extra 404 round-trips. */
let cachedWorkingModel: string | null = null;

/**
 * Query Google's `/v1beta/models` list to dynamically find the newest active
 * Gemini Flash text model supporting `generateContent`. Used if all hardcoded
 * model names are ever retired.
 */
async function discoverLatestFlashModel(apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    const list: any[] = data?.models ?? [];
    const candidates = list
      .filter((m) => {
        const name = String(m?.name ?? '').toLowerCase();
        const methods: string[] = m?.supportedGenerationMethods ?? [];
        return (
          methods.includes('generateContent') &&
          name.includes('gemini') &&
          name.includes('flash') &&
          !name.includes('tts') &&
          !name.includes('image') &&
          !name.includes('audio') &&
          !name.includes('embedding')
        );
      })
      .map((m) => String(m.name).replace(/^models\//, ''));

    // Sort descending so highest version numbers (e.g. gemini-4.x-flash > gemini-3.8-flash) come first.
    candidates.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    return candidates[0] ?? null;
  } catch {
    return null;
  }
}

function slugify(s: string, index: number): string {
  const slug = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || `stop-${index + 1}`;
}

export interface GenerateStoryResult {
  story: GeneratedStory | null;
  error?: string;
}

/** Extract the first balanced or outer JSON object/array from a string. */
function extractJsonPayload(raw: string): any {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall back to slicing from the first '{' or '[' to the matching end.
    const objStart = cleaned.indexOf('{');
    const objEnd = cleaned.lastIndexOf('}');
    if (objStart !== -1 && objEnd > objStart) {
      try {
        return JSON.parse(cleaned.slice(objStart, objEnd + 1));
      } catch {
        // continue
      }
    }
    const arrStart = cleaned.indexOf('[');
    const arrEnd = cleaned.lastIndexOf(']');
    if (arrStart !== -1 && arrEnd > arrStart) {
      try {
        return JSON.parse(cleaned.slice(arrStart, arrEnd + 1));
      } catch {
        // continue
      }
    }
    return null;
  }
}

/**
 * Ask Gemini to author an entire 6–8 stop historical journey directly as
 * structured JSON, with accurate eras, coordinates, civilizations, countries,
 * and 2–3 sentence narrative captions.
 */
export async function generateStory(
  env: Env,
  userPrompt: string,
): Promise<GenerateStoryResult> {
  const apiKey = (
    env.GEMINI_KEY ||
    (env as any).GEMINI_API_KEY ||
    (env as any).GOOGLE_API_KEY ||
    ''
  ).trim();
  if (!apiKey) {
    return { story: null, error: 'Missing GEMINI_KEY environment variable' };
  }

  const configuredModel = env.GEMINI_MODEL?.trim();
  // Prefer gemini-3.8-flash (current active Gemini Flash model). Ignore legacy
  // 1.x / 2.x GEMINI_MODEL env values if they are still set in dashboard vars,
  // or try them only after gemini-3.8-flash and gemini-flash-latest.
  const isLegacyConfigured =
    configuredModel && /^gemini-[12]\./i.test(configuredModel);
  const models = Array.from(
    new Set(
      [
        cachedWorkingModel,
        !isLegacyConfigured ? configuredModel : undefined,
        'gemini-3.8-flash',
        'gemini-flash-latest',
        isLegacyConfigured ? configuredModel : undefined,
      ].filter(Boolean) as string[],
    ),
  );

  const prompt = `You are the historian and cartographer of "Atlante", a poetic interactive 3D historical atlas.
Given a user's topic, question, or pair of concepts, chart a chronological historical journey of 6 to 8 stops that traces how the idea, technology, culture, or event unfolded across time and geography.

User prompt: "${userPrompt}"

Return ONLY valid JSON matching this exact structure:
{
  "question": "A polished title or question framing the historical journey",
  "stops": [
    {
      "id": "unique-kebab-case-slug",
      "label": "Concise Name (max 4 words)",
      "type": "concept",
      "era": "628 AD",
      "year": 628,
      "civName": "Classical India",
      "country": "India",
      "lat": 24.5,
      "lon": 72.8,
      "caption": "2 to 3 evocative, historically accurate sentences (40-70 words) explaining what happened at this stop and how it connects in the overarching story."
    }
  ]
}

Rules:
1. Include between 6 and 8 chronological stops in "stops". Every stop must be a real, historically verifiable person, invention, place, artwork, concept, or civilization.
2. "type" must be one of: "civilization", "person", "concept", "technology", "place", "artwork".
3. "year" must be an integer (negative for BC, positive for AD, e.g. -3000 or 1679).
4. "lat" (-85 to 85) and "lon" (-180 to 180) must be terrestrial land coordinates inside "country" so the 3D globe can fly there and highlight the country.`;

  let lastError = 'Unknown Gemini failure';

  const tried = new Set<string>();
  let discoveredFromApi = false;

  for (let idx = 0; idx < models.length; idx++) {
    const model = models[idx].replace(/^models\//, '');
    if (tried.has(model)) continue;
    tried.add(model);

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
      `?key=${encodeURIComponent(apiKey)}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        lastError = `Model ${model} HTTP ${res.status}: ${errBody.slice(0, 200)}`;
        if (cachedWorkingModel === model) cachedWorkingModel = null;
        // 1. If Google's 404 message recommends a replacement model
        //    (e.g. "Please update your code to use models/gemini-3.8-flash"),
        //    automatically enqueue and try it.
        const suggested = /use\s+models\/([a-zA-Z0-9._-]+)/i.exec(errBody)?.[1];
        if (suggested && !tried.has(suggested) && !models.includes(suggested)) {
          models.push(suggested);
        }
        // 2. If we've exhausted known models on a 404, query Google's /v1beta/models
        //    endpoint to auto-discover the newest active Flash model.
        if (res.status === 404 && idx === models.length - 1 && !discoveredFromApi) {
          discoveredFromApi = true;
          const discovered = await discoverLatestFlashModel(apiKey);
          if (discovered && !tried.has(discovered)) {
            models.push(discovered);
          }
        }
        continue;
      }

      cachedWorkingModel = model;

      const data: any = await res.json();
      const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
      if (!parts.length) {
        lastError = `Model ${model} returned no content parts`;
        continue;
      }

      // Gemini 2.5 thinking models may emit a thought part before the JSON part.
      // Try non-thought parts from last to first, then fall back to all parts.
      const orderedParts = [
        ...parts.filter((p) => !p?.thought && typeof p?.text === 'string').reverse(),
        ...parts.filter((p) => p?.thought && typeof p?.text === 'string').reverse(),
      ];

      let parsed: any = null;
      for (const part of orderedParts) {
        parsed = extractJsonPayload(part.text);
        if (parsed) break;
      }

      if (!parsed) {
        lastError = `Model ${model} returned non-JSON text`;
        continue;
      }

      const rawStops: any[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.stops)
          ? parsed.stops
          : Array.isArray(parsed.steps)
            ? parsed.steps
            : [];

      if (rawStops.length < 2) {
        lastError = `Model ${model} returned fewer than 2 stops`;
        continue;
      }

      const usedIds = new Set<string>();
      const stops: GeneratedStoryStop[] = [];
      for (let i = 0; i < rawStops.length; i++) {
        const s = rawStops[i];
        if (!s || typeof s.label !== 'string' || !s.label.trim()) continue;
        let id = slugify(String(s.id || s.label), i);
        if (usedIds.has(id)) id = `${id}-${i + 1}`;
        usedIds.add(id);

        const rawType = String(s.type ?? '').toLowerCase() as NodeType;
        const type: NodeType = VALID_TYPES.has(rawType) ? rawType : 'concept';
        const year = Number.isFinite(Number(s.year)) ? Math.round(Number(s.year)) : 0;
        const lat = Number.isFinite(Number(s.lat))
          ? Math.max(-85, Math.min(85, Number(s.lat)))
          : 0;
        const lon = Number.isFinite(Number(s.lon))
          ? Math.max(-180, Math.min(180, Number(s.lon)))
          : 0;
        const caption = String(s.caption ?? s.summary ?? '').trim();

        stops.push({
          id,
          label: s.label.trim(),
          type,
          era: String(s.era ?? '').trim() || (year < 0 ? `${Math.abs(year)} BC` : `${year} AD`),
          year,
          civName: String(s.civName ?? s.civilization ?? '').trim() || 'World History',
          country: String(s.country ?? '').trim(),
          lat,
          lon,
          caption,
        });
      }

      if (stops.length < 2) {
        lastError = `Model ${model} produced fewer than 2 valid stops`;
        continue;
      }

      return {
        story: {
          question: String(parsed.question || parsed.title || userPrompt).trim(),
          stops,
        },
      };
    } catch (err: any) {
      lastError = `Model ${model} exception: ${err?.message ?? err}`;
    }
  }

  return { story: null, error: lastError };
}
