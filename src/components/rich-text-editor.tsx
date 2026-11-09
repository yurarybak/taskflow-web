import { Placeholder } from "@tiptap/extensions";
import {
  EditorContent,
  useEditor,
  useEditorState,
  type Editor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";
import { sanitizeRichText } from "../lib/sanitize";
import { cn } from "../lib/utils";
import { Button } from "./ui";

// Only the formatting the toolbar offers. Everything else in StarterKit is
// off, so the editor never produces markup that sanitizeRichText would strip
// (and pasted headings, code, links, ... fall back to plain paragraphs).
const formattingExtensions = StarterKit.configure({
  blockquote: false,
  code: false,
  codeBlock: false,
  heading: false,
  horizontalRule: false,
  link: false,
  strike: false,
  underline: false,
});

/**
 * Editor HTML in the stored format: an empty document is "", and trailing
 * empty paragraphs (TrailingNode adds one after a list so the user can type
 * below it) are not saved.
 */
const editorHtml = (editor: Editor) =>
  editor.isEmpty ? "" : editor.getHTML().replace(/(<p><\/p>)+$/, "");

/**
 * Rich text editor (Tiptap) for task descriptions. Stores HTML; kept out of
 * ui.tsx so Tiptap and DOMPurify only load with the pages that edit rich text.
 */
export const RichTextEditor = ({
  value,
  placeholder = "Add details...",
  onChange,
  onEscape,
}: {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  /** Called on Escape; the key then no longer reaches a surrounding Dialog. */
  onEscape?: () => void;
}) => {
  const callbacks = useRef({ onChange, onEscape });
  useEffect(() => {
    callbacks.current = { onChange, onEscape };
  });
  const editor = useEditor({
    extensions: [formattingExtensions, Placeholder.configure({ placeholder })],
    // `value` can come from the API, so it is sanitized before it is parsed.
    content: sanitizeRichText(value),
    editorProps: {
      attributes: {
        class: "rich-text-surface",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": placeholder,
      },
      handleKeyDown: (_view, event) => {
        const { onEscape } = callbacks.current;
        if (event.key !== "Escape" || !onEscape) return false;
        event.preventDefault();
        onEscape();
        return true;
      },
    },
    onUpdate: ({ editor }) => callbacks.current.onChange(editorHtml(editor)),
  });
  // Follow `value` when it changes from outside (not from typing here).
  useEffect(() => {
    // A Suspense boundary above can disconnect and reconnect effects, and
    // Tiptap destroys the editor on disconnect; never touch a destroyed one.
    if (!editor || editor.isDestroyed || editorHtml(editor) === value) return;
    editor.commands.setContent(sanitizeRichText(value), { emitUpdate: false });
  }, [editor, value]);
  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive("bold") ?? false,
      italic: editor?.isActive("italic") ?? false,
      bulletList: editor?.isActive("bulletList") ?? false,
      orderedList: editor?.isActive("orderedList") ?? false,
    }),
  });
  const tools = [
    {
      label: "Bold",
      shortcut: "Ctrl+B",
      active: active?.bold,
      run: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      shortcut: "Ctrl+I",
      active: active?.italic,
      run: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      label: "Bullet list",
      active: active?.bulletList,
      run: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      active: active?.orderedList,
      run: () => editor?.chain().focus().toggleOrderedList().run(),
    },
  ];
  return (
    <div className="rich-text-editor">
      <div
        className="rich-text-toolbar"
        role="toolbar"
        aria-label="Formatting toolbar"
      >
        {tools.map((tool) => (
          <Button
            key={tool.label}
            type="button"
            variant="ghost"
            className={cn(tool.active && "is-active")}
            aria-pressed={!!tool.active}
            title={
              tool.shortcut ? `${tool.label} (${tool.shortcut})` : undefined
            }
            disabled={!editor}
            onClick={tool.run}
          >
            {tool.label}
          </Button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
};
