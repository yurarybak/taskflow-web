import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { LoaderCircle, X } from "lucide-react";
import { cn } from "../lib/utils";

export const Button = ({ className, variant = "primary", loading, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; loading?: boolean }) => (
  <button className={cn("button", `button-${variant}`, className)} {...props} disabled={props.disabled || loading}>
    {loading && <LoaderCircle size={15} className="spin" />}{children}
  </button>
);
export const Input = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => <input className={cn("input", className)} {...props} />;
export const Textarea = ({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className={cn("input textarea", className)} {...props} />;
export const Select = ({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) => <select className={cn("input select", className)} {...props} />;
export const Badge = ({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) => <span className={cn("badge", `badge-${tone.toLowerCase()}`)}>{children}</span>;
const defaultAvatarSrc = "/default-avatar.svg";
export const Avatar = ({ label, src }: { label: string; src?: string }) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (src && failedSrc !== src) {
    return <img className="avatar" src={src} alt={label} onError={() => setFailedSrc(src)} />;
  }
  if (failedSrc !== defaultAvatarSrc) {
    return <img className="avatar avatar-default" src={defaultAvatarSrc} alt={label} onError={() => setFailedSrc(defaultAvatarSrc)} />;
  }
  return <span className="avatar avatar-fallback">{label}</span>;
};
export const Empty = ({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) => <div className="empty"><h3>{title}</h3><p>{detail}</p>{action}</div>;
export const Skeleton = ({ rows = 4 }: { rows?: number }) => <div className="stack">{Array.from({ length: rows }, (_, i) => <div className="skeleton" key={i} />)}</div>;
export const Field = ({ label, error, children }: { label: string; error?: string; children: ReactNode }) => <label className="field"><span>{label}</span>{children}{error && <small>{error}</small>}</label>;
export const Dialog = ({ open, title, children, onClose, wide = false, actions }: { open: boolean; title: string; children: ReactNode; onClose: () => void; wide?: boolean; actions?: ReactNode }) => open ? createPortal(
  <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
    <section className={cn("dialog", wide && "dialog-wide")} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
      <header><h2>{title}</h2><div className="dialog-header-actions">{actions}<Button variant="ghost" aria-label="Close" onClick={onClose}><X size={17} /></Button></div></header>{children}
    </section>
  </div>,
  document.body,
) : null;
export const ConfirmDialog = ({
  open,
  title = "Are you sure?",
  description,
  confirmText = "Delete",
  cancelText = "Cancel",
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) => (
  <Dialog open={open} title={title} onClose={onClose}>
    <p className="confirm-description">{description}</p>
    <div className="dialog-actions">
      <Button type="button" variant="secondary" onClick={onClose}>
        {cancelText}
      </Button>
      <Button type="button" variant="danger" loading={loading} onClick={onConfirm}>
        {confirmText}
      </Button>
    </div>
  </Dialog>
);
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
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
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
        <Button type="button" variant="ghost" onClick={() => run("bold")}>Bold</Button>
        <Button type="button" variant="ghost" onClick={() => run("italic")}>Italic</Button>
        <Button type="button" variant="ghost" onClick={() => run("insertUnorderedList")}>Bullet list</Button>
        <Button type="button" variant="ghost" onClick={() => run("insertOrderedList")}>Numbered list</Button>
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
