import { describe, expect, it } from "vitest";
import { parseJsonFromClaudeText } from "./anthropic-parser";

describe("parseJsonFromClaudeText", () => {
  it("parses raw JSON text", () => {
    expect(parseJsonFromClaudeText('{"category":"refund_request","priority":4}')).toEqual({
      category: "refund_request",
      priority: 4,
    });
  });

  it("parses fenced JSON text", () => {
    expect(parseJsonFromClaudeText('```json\n{"category":"shipping_issue","priority":3}\n```')).toEqual({
      category: "shipping_issue",
      priority: 3,
    });
  });

  it("extracts a JSON object from surrounding prose", () => {
    expect(
      parseJsonFromClaudeText(
        'Here is the analysis:\n{"category":"account_issue","confidence":0.62}\nThanks.',
      ),
    ).toEqual({
      category: "account_issue",
      confidence: 0.62,
    });
  });

  it("throws when no JSON object is present", () => {
    expect(() => parseJsonFromClaudeText("I could not determine a result.")).toThrow(
      "Anthropic response did not contain valid JSON.",
    );
  });
});
