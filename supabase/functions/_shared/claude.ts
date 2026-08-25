import Anthropic from "@anthropic-ai/sdk";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodType } from "zod";

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

export async function callClaudeTool<T>(opts: {
  model: string;
  schema: ZodType<T>;
  toolName: string;
  system: string;
  content: Anthropic.MessageParam["content"];
  maxTokens?: number;
}): Promise<T> {
  const jsonSchema = zodToJsonSchema(opts.schema);

  const message = await anthropic.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 4096,
    temperature: 0,
    system: opts.system,
    messages: [{ role: "user", content: opts.content }],
    tools: [
      {
        name: opts.toolName,
        description: `Return ${opts.toolName} as structured data.`,
        // deno-lint-ignore no-explicit-any
        input_schema: jsonSchema as any,
      },
    ],
    tool_choice: { type: "tool", name: opts.toolName },
  });

  const toolUse = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolUse) throw new Error(`Claude did not return a ${opts.toolName} tool_use block`);

  // Re-validate server-side — tool-use guarantees a schema-shaped response,
  // not necessarily one that satisfies our stricter zod refinements.
  return opts.schema.parse(toolUse.input);
}
