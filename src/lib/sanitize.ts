import DOMPurify from "dompurify";

// Markup produced by RichTextEditor (execCommand bold/italic/lists) plus the
// block elements browsers insert for line breaks. No attributes are allowed.
const RICH_TEXT_TAGS = [
  "p",
  "div",
  "br",
  "span",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "ul",
  "ol",
  "li",
];

export const sanitizeRichText = (html: string) =>
  DOMPurify.sanitize(html, { ALLOWED_TAGS: RICH_TEXT_TAGS, ALLOWED_ATTR: [] });
