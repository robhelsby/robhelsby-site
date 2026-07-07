# Alright Chief — Claude proxy

The thin backend that gives **every visitor** the full Claude-powered experience with
zero setup. The Anthropic API key lives here as a server-side secret; the prototype's
"paste your key in the browser" mode remains only as a dev fallback.

```
browser ──POST {system, messages, max_tokens}──▶ this worker ──(+ secret key)──▶ Claude API
```

The client sends only content. The worker decides the model, caps `max_tokens`, trims
message count/length, and can pin allowed origins — so someone who finds the endpoint URL
can at most make Alright-Chief-shaped requests, never arbitrary or expensive ones.

## Deploy (Cloudflare Workers, ~5 minutes, free tier is plenty)

```sh
cd alright-chief/proxy
npx wrangler login                          # once
npx wrangler deploy                         # prints https://alright-chief-proxy.<you>.workers.dev
npx wrangler secret put ANTHROPIC_API_KEY   # paste your sk-ant-… key when prompted
```

Optional hardening (recommended once the app has a stable home):

```sh
# only these origins may call the proxy (comma-separated, exact match)
npx wrangler deploy --var ALLOWED_ORIGIN:"https://your-domain.com"
```

## Point the app at it

Either of:

1. **For everyone, permanently:** set `DEFAULT_PROXY_URL` at the top of
   `alright-chief/app.js` to your workers.dev URL and redeploy the site. Every visitor
   gets Claude from the first tap — nothing to paste, nothing stored on their device.
2. **Just this device:** open **Connect Claude** in the app (or the desktop side panel)
   and paste the proxy URL there.

A pasted API key still works as before and is only ever used when no proxy is set.

## Not Cloudflare?

`worker.js` is a standard `fetch(request, env)` module — it ports to a Vercel Edge
Function or Deno Deploy nearly verbatim; only the env-var plumbing differs.
