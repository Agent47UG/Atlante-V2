// gemini.ts — narrate a real graph path with Google Gemini. The graph guarantees
// the path is factual; Gemini only writes the prose between verified stops.

import type { Env } from './types';

interface Stop {
  label: string;
  summary: string;
  /** How we arrived here from the previous stop, e.g. "influenced by". */
  via?: string;
}

export async function narratePath(
  env: Env,
  question: string,
  stops: Stop[],
): Promise<string[] | null> {
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  const lines = stops
    .map((s, i) => {
      const link = s.via ? ` [linked from previous by: ${s.via}]` : '';
      return `${i + 1}. ${s.label}${link} — ${s.summary}`;
    })
    .join('\n');

  const prompt = `You are the narrator of "Atlante", a poetic historical atlas.
Write a caption for each numbered stop on a journey through connected ideas.
The user's question: "${question}".

Rules:
- Return ONLY a JSON array of strings, one caption per stop, in order.
- One elegant sentence per caption (max ~22 words), evocative but accurate.
- Make consecutive captions flow as a single story across time.
- Do not invent facts beyond what each stop's description supports.

Stops:
${lines}`;

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
    `?key=${env.GEMINI_KEY}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
      return parsed as string[];
    }
    return null;
  } catch {
    return null;
  }
}
