import type { AIProvider, AIProviderConfig } from "@/types/bug";

export const AI_PROVIDERS: AIProviderConfig[] = [
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    keyPrefix: "gsk_",
    keyUrl: "https://console.groq.com/keys",
    models: [
      { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B", maxTokens: 65536 },
      { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B", maxTokens: 65536 },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    keyPrefix: "sk-",
    keyUrl: "https://platform.openai.com/api-keys",
    models: [
      { id: "gpt-4o", name: "GPT-4o", maxTokens: 4096 },
      { id: "gpt-4o-mini", name: "GPT-4o Mini (Fast)", maxTokens: 4096 },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo", maxTokens: 4096 },
    ],
  },
  {
    id: "google",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    keyPrefix: "AI",
    keyUrl: "https://aistudio.google.com/apikey",
    models: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", maxTokens: 4096 },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", maxTokens: 4096 },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash (Fast)", maxTokens: 4096 },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    baseUrl: "https://api.anthropic.com/v1/messages",
    keyPrefix: "sk-ant-",
    keyUrl: "https://console.anthropic.com/settings/keys",
    models: [
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", maxTokens: 4096 },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku (Fast)", maxTokens: 4096 },
    ],
  },
];

export function getProviderConfig(id: AIProvider): AIProviderConfig {
  return AI_PROVIDERS.find((p) => p.id === id) || AI_PROVIDERS[0];
}

export function getActiveApiKey(prefs: { aiProvider?: AIProvider; apiKeys?: Partial<Record<AIProvider, string>>; groqApiKey?: string }): string | undefined {
  const provider = prefs.aiProvider || "groq";
  // Backward compat with groqApiKey
  if (provider === "groq" && prefs.groqApiKey && !prefs.apiKeys?.groq) {
    return prefs.groqApiKey;
  }
  return prefs.apiKeys?.[provider];
}

export function getActiveModel(prefs: { aiProvider?: AIProvider; aiModel?: string }): string {
  const provider = prefs.aiProvider || "groq";
  const config = getProviderConfig(provider);
  if (prefs.aiModel && config.models.some((m) => m.id === prefs.aiModel)) {
    return prefs.aiModel!;
  }
  return config.models[0].id;
}

/**
 * Unified AI call that works across all providers.
 * Anthropic uses a different API format, so we handle it separately.
 */
export async function callAI(
  apiKey: string,
  provider: AIProvider,
  model: string,
  messages: { role: string; content: string }[],
  options: { temperature?: number; maxTokens?: number; jsonMode?: boolean } = {}
): Promise<string | null> {
  const config = getProviderConfig(provider);
  const { temperature = 0.3, maxTokens = 1200, jsonMode = false } = options;

  try {
    if (provider === "anthropic") {
      // Anthropic uses different API format
      const systemMsg = messages.find((m) => m.role === "system");
      const otherMsgs = messages.filter((m) => m.role !== "system");
      
      const res = await fetch(config.baseUrl, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          ...(systemMsg ? { system: systemMsg.content } : {}),
          messages: otherMsgs,
        }),
      });

      if (!res.ok) {
        console.error("Anthropic API error:", res.status, await res.text());
        return null;
      }
      const data = await res.json();
      return data.content?.[0]?.text || null;
    }

    // OpenAI-compatible (Groq, OpenAI, Google Gemini)
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };
    if (jsonMode && provider !== "google") {
      body.response_format = { type: "json_object" };
    }

    const res = await fetch(config.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error(`${config.name} API error:`, res.status, await res.text());
      return null;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error(`AI call failed (${provider}):`, e);
    return null;
  }
}
