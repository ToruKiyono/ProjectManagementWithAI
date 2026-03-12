import type { AIConfig, AIJsonResult } from "../../models/ai";

type ChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

function readEnvValue(key: string) {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  return env[key] ?? env[`VITE_${key}`] ?? "";
}

export function getDefaultAIConfig(): AIConfig {
  const timeoutMs = Number(readEnvValue("AI_TIMEOUT_MS") || 20000);
  return {
    baseUrl: readEnvValue("AI_BASE_URL"),
    apiKey: readEnvValue("AI_API_KEY"),
    model: readEnvValue("AI_MODEL"),
    providerName: readEnvValue("AI_PROVIDER_NAME") || "OpenAI-Compatible",
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 20000
  };
}

function extractContent(payload: ChatResponse): string {
  const content = payload.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    return content.map((item) => item.text || "").join("").trim();
  }
  return String(content || "").trim();
}

function extractJsonText(input: string): string {
  const fenced = input.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  const firstBrace = fenced.indexOf("{");
  const lastBrace = fenced.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) return fenced.slice(firstBrace, lastBrace + 1);
  const firstBracket = fenced.indexOf("[");
  const lastBracket = fenced.lastIndexOf("]");
  if (firstBracket >= 0 && lastBracket > firstBracket) return fenced.slice(firstBracket, lastBracket + 1);
  return fenced;
}

export async function callAIJson<T>(systemPrompt: string, payload: unknown, config: AIConfig): Promise<AIJsonResult<T>> {
  if (!config.baseUrl || !config.model) {
    return {
      ok: false,
      data: null,
      error: "AI 配置不完整，已跳过外部模型调用",
      provider: config.providerName || "unconfigured"
    };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {})
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(payload) }
        ]
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        ok: false,
        data: null,
        error: `AI 请求失败: ${response.status} ${response.statusText}`,
        provider: config.providerName
      };
    }

    const result = (await response.json()) as ChatResponse;
    const jsonText = extractJsonText(extractContent(result));
    return {
      ok: true,
      data: JSON.parse(jsonText) as T,
      error: "",
      provider: config.providerName
    };
  } catch (error) {
    return {
      ok: false,
      data: null,
      error: error instanceof Error ? error.message : "AI 请求异常",
      provider: config.providerName
    };
  } finally {
    window.clearTimeout(timeout);
  }
}
