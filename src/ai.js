// ai.js — Gemini API integration layer (Google AI Studio — FREE, no credit card)
// All AI calls go through this module. Easy to swap models or providers later.
// Get your free key at: https://aistudio.google.com/app/apikey

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_BASE  = 'https://generativelanguage.googleapis.com/v1beta/models';

async function getApiKey() {
  const data = await chrome.storage.local.get('settings');
  return data.settings?.apiKey || '';
}

async function callGemini(systemPrompt, userMessage, maxTokens = 400) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('No API key set. Get a FREE key at aistudio.google.com and paste it in the extension popup.');
  }

  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        { role: 'user', parts: [{ text: userMessage }] }
      ],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.4,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err.error?.message || `Gemini API error ${response.status}`;
    throw new Error(msg);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ─── Public AI Actions ─────────────────────────────────────────────────────

export const AI = {

  async explain(text, pageContext = '') {
    const system = `You are a reading assistant embedded in a browser extension. 
    Explain concepts clearly and concisely in 2-4 sentences. 
    Match your depth to the complexity of the text. 
    If context is provided, use it to make your explanation more relevant.
    Never use markdown headers. Use plain flowing prose.`;

    const userMsg = pageContext
      ? `Page context: "${pageContext.slice(0, 300)}"\n\nExplain this: "${text}"`
      : `Explain this: "${text}"`;

    return callGemini(system, userMsg, 300);
  },

  async define(word) {
    const system = `You are a dictionary assistant. Give a clear, brief definition in 1-2 sentences.
    Then give one example sentence. Format: "Definition. Example: ..."
    Never use markdown.`;
    return callGemini(system, `Define: "${word}"`, 150);
  },

  async summarize(pageText) {
    const system = `You are a reading assistant. Summarize the key points of this article in 3-5 bullet points.
    Each bullet should be one concise sentence. Start each with "•".
    Focus on the most important insights, not just what the article is about.`;
    const truncated = pageText.slice(0, 4000);
    return callGemini(system, `Summarize this article:\n\n${truncated}`, 500);
  },

  async askQuestion(question, pageText) {
    const system = `You are a reading assistant. Answer questions about the article the user is reading.
    Be direct and concise. If the answer isn't in the article, say so.
    Never use markdown headers. 2-4 sentences maximum unless the question requires more detail.`;
    const truncated = pageText.slice(0, 4000);
    return callGemini(system, `Article: "${truncated}"\n\nQuestion: ${question}`, 400);
  },

  async simplify(text) {
    const system = `Rewrite the following text in simple, plain English. 
    Assume a 10th-grade reading level. Keep all the key information.
    Return only the rewritten text, nothing else.`;
    return callGemini(system, text, 400);
  },
};
