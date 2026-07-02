import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAIClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export async function generateInsight(
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
  const anthropic = getAIClient();
  if (!anthropic) return null;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const block = response.content[0];
    return block.type === "text" ? block.text : null;
  } catch (err) {
    console.error("Anthropic API error:", err);
    return null;
  }
}

export const SYSTEM_PROMPT_ANALYST = `You are a manufacturing quality analyst assistant for a production plant in India.
You help interpret rejection and rework data to identify trends, root causes, and improvement opportunities.
Use clear, concise language suitable for shop-floor supervisors and plant managers.
Always note that your suggestions are AI-generated and should be verified by domain experts.
All costs are in Indian Rupees (₹).`;
