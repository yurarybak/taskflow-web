import { useEffect, useRef } from "react";
import { sanitizeRichText } from "../lib/sanitize";
import { Button } from "./ui";

// Kept out of ui.tsx so DOMPurify only loads with the pages that edit rich text.
export const RichTextEditor = ({
  value,
  placeholder = "Add details...",
  onChange,
}: {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // `value` can come from the API, so it is sanitized before it reaches the DOM.
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = sanitizeRichText(value);
    }
  }, [value]);
  const run = (command: string) => {
    editorRef.current?.focus();
    document.execCommand(command);
    onChange(editorRef.current?.innerHTML || "");
  };
  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar" aria-label="Formatting toolbar">
        <Button type="button" variant="ghost" onClick={() => run("bold")}>
          Bold
        </Button>
        <Button type="button" variant="ghost" onClick={() => run("italic")}>
          Italic
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => run("insertUnorderedList")}
        >
          Bullet list
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => run("insertOrderedList")}
        >
          Numbered list
        </Button>
      </div>
      <div
        ref={editorRef}
        className="rich-text-surface"
        contentEditable
        data-placeholder={placeholder}
        role="textbox"
        aria-multiline="true"
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
      />
    </div>
  );
};
