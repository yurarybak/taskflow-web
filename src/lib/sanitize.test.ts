import { describe, expect, it } from "vitest";
import { sanitizeRichText } from "./sanitize";

describe("sanitizeRichText", () => {
  it("keeps the formatting produced by the rich text editor", () => {
    const html = "<p><b>Bold</b> <i>italic</i></p><ul><li>One</li></ul>";
    expect(sanitizeRichText(html)).toBe(html);
  });

  it.each([
    ["unquoted event handler", "<img src=x onerror=alert(1)>"],
    ["quoted event handler", '<b onclick="alert(1)">x</b>'],
    ["script tag", "<script>alert(1)</script>"],
    ["iframe", '<iframe src="javascript:alert(1)"></iframe>'],
    ["svg payload", "<svg><animate onbegin=alert(1)></svg>"],
    ["encoded javascript url", '<a href="jav&#x61;script:alert(1)">x</a>'],
  ])("removes %s", (_name, payload) => {
    const result = sanitizeRichText(payload);
    expect(result).not.toMatch(/on\w+=|<script|<iframe|<svg|javascript:/i);
  });

  it("drops attributes such as inline styles", () => {
    expect(sanitizeRichText('<p style="color:red">Hi</p>')).toBe("<p>Hi</p>");
  });
});
