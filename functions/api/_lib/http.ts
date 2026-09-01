// Shared HTTP helpers for the Pages Functions.
import type { Env } from './types';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
      ...CORS,
      ...(init.headers ?? {}),
    },
  });
}

export function errorJson(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  });
}

/** Minimal Pages Functions context shape (avoids needing workers-types). */
export interface Ctx {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
  waitUntil: (p: Promise<unknown>) => void;
}
