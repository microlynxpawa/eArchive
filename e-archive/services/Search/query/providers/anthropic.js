const fetch = require("node-fetch");

/**
 * Anthropic's own API.
 *
 * This exists as a separate file because Anthropic is genuinely a different
 * shape, not just a different address: /v1/messages rather than
 * /chat/completions, the system prompt as its own top-level field rather than
 * a message, max_tokens required rather than optional, and x-api-key plus
 * anthropic-version instead of a bearer token.
 *
 * It returns exactly what the OpenAI-compatible adapter returns, so nothing
 * downstream knows or cares which one ran.
 */

// Pinned deliberately. The API is versioned by this header, so leaving it
// floating would mean a remote change could alter behaviour with no deploy.
const API_VERSION = "2023-06-01";

async function complete({ baseUrl, apiKey, model, system, user, timeoutMs, maxTokens }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const root = (baseUrl || "https://api.anthropic.com").replace(/\/+$/, "");

  try {
    const res = await fetch(`${root}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": API_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0,
        system,
        messages: [{ role: "user", content: user }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${res.status} ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    // Content is a list of blocks; the text ones are what we asked for.
    const text = Array.isArray(data?.content)
      ? data.content.filter((b) => b.type === "text").map((b) => b.text).join("")
      : null;
    if (!text) throw new Error("no text in response");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { complete, API_VERSION };
