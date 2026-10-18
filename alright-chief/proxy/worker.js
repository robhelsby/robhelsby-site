/* ============================================================
   Alright Chief — Claude proxy (Cloudflare Worker)

   The thin backend that lets every visitor get the full
   Claude-powered experience without pasting a key. The
   Anthropic API key lives here as a server-side secret and
   never ships to the client.

   The client only supplies content (system + messages). The
   proxy decides the model and caps max_tokens, so a stolen
   endpoint URL can't be used to run arbitrary or expensive
   workloads — worst case it can only make Alright-Chief-shaped
   requests. Lock it down further with ALLOWED_ORIGIN.

   Env:
     ANTHROPIC_API_KEY  (secret, required)
     ALLOWED_ORIGIN     (optional; comma-separated list of exact
                         origins allowed to call this proxy.
                         Unset = any origin, fine for a pilot)
     MODEL              (optional; defaults to claude-opus-4-8)
   ============================================================ */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-opus-4-8";
const MAX_TOKENS_CAP = 600; // the app never asks for more than 500
const MAX_MESSAGES = 8;
const MAX_CHARS = 8000;

function corsOrigin(origin, env) {
  if (!env.ALLOWED_ORIGIN) return origin || "*";
  const list = env.ALLOWED_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);
  return list.includes(origin) ? origin : "";
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, "content-type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = corsOrigin(origin, env);
    const cors = {
      "Access-Control-Allow-Origin": allowed || "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "POST only" }, 405, cors);
    if (env.ALLOWED_ORIGIN && !allowed) return json({ error: "origin not allowed" }, 403, cors);
    if (!env.ANTHROPIC_API_KEY) return json({ error: "server is missing ANTHROPIC_API_KEY" }, 500, cors);

    let body;
    try { body = await request.json(); } catch (e) { return json({ error: "invalid JSON" }, 400, cors); }
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return json({ error: "messages required" }, 400, cors);
    }

    const payload = {
      model: env.MODEL || DEFAULT_MODEL,
      max_tokens: Math.min(Math.max(1, Number(body.max_tokens) || 200), MAX_TOKENS_CAP),
      messages: body.messages.slice(0, MAX_MESSAGES).map((m) => ({
        role: m && m.role === "assistant" ? "assistant" : "user",
        content: String((m && m.content) || "").slice(0, MAX_CHARS),
      })),
    };
    if (typeof body.system === "string" && body.system) payload.system = body.system.slice(0, MAX_CHARS);

    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    return new Response(text, { status: res.status, headers: { ...cors, "content-type": "application/json" } });
  },
};
