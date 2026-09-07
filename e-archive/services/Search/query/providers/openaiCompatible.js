const fetch = require("node-fetch");

/**
 * Any provider that speaks the OpenAI chat-completions shape.
 *
 * That is most of them - OpenRouter, Groq, Azure OpenAI, Ollama, LM Studio,
 * vLLM - and they differ only by base URL, model name and key. Swapping
 * between them is therefore a change to .env and nothing else.
 */

async function complete({ baseUrl, apiKey, model, system, user, timeoutMs, maxTokens }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        // Reading a sentence into fixed fields has one right answer; there is
        // nothing to be gained from sampling.
        temperature: 0,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${res.status} ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string") throw new Error("no text in response");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { complete };
