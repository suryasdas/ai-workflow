import { workflowLog } from "../logger";

export function parseJsonFromClaudeText(text: string): unknown {
  const trimmed = text.trim();

  try {
    workflowLog("AI parser accepted raw JSON response");
    return JSON.parse(trimmed);
  } catch {
    const unfenced = trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    try {
      workflowLog("AI parser stripped Markdown code fence before parsing JSON");
      return JSON.parse(unfenced);
    } catch {
      const objectStart = unfenced.indexOf("{");
      const objectEnd = unfenced.lastIndexOf("}");

      if (objectStart >= 0 && objectEnd > objectStart) {
        workflowLog("AI parser extracted first JSON object from response text");
        return JSON.parse(unfenced.slice(objectStart, objectEnd + 1));
      }

      throw new Error("Anthropic response did not contain valid JSON.");
    }
  }
}
