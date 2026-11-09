import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { LoaderCircle, X } from "lucide-react";
import { cn } from "../lib/utils";

export const Button = ({
  className,
  variant = "primary",
  loading,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
}) => (
  <button
    className={cn("button", `button-${variant}`, className)}
    {...props}
    disabled={props.disabled || loading}
  >
    {loading && <LoaderCircle size={15} className="spin" />}
    {children}
  </button>
);
export const Input = ({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) => (
  <input className={cn("input", className)} {...props} />
);
export const Textarea = ({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className={cn("input textarea", className)} {...props} />
);
export const Select = ({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={cn("input select", className)} {...props} />
);
export const Badge = ({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) => (
  <span className={cn("badge", `badge-${tone.toLowerCase()}`)}>{children}</span>
);
const defaultAvatarSrc = "/default-avatar.svg";
export const Avatar = ({ label, src }: { label: string; src?: string }) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (src && failedSrc !== src) {
    return (
      <img
        className="avatar"
        src={src}
        alt={label}
        onError={() => setFailedSrc(src)}
      />
    );
  }
  if (failedSrc !== defaultAvatarSrc) {
    return (
      <img
        className="avatar avatar-default"
        src={defaultAvatarSrc}
        alt={label}
        onError={() => setFailedSrc(defaultAvatarSrc)}
      />
    );
  }
  return <span className="avatar avatar-fallback">{label}</span>;
};
export const Empty = ({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) => (
  <div className="empty">
    <h3>{title}</h3>
    <p>{detail}</p>
    {action}
  </div>
);
export const Skeleton = ({ rows = 4 }: { rows?: number }) => (
  <div className="stack">
    {Array.from({ length: rows }, (_, i) => (
      <div className="skeleton" key={i} />
    ))}
  </div>
);
export const Field = ({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) => (
  <label className="field">
    <span>{label}</span>
    {children}
    {error && <small>{error}</small>}
  </label>
);
type DialogProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  actions?: ReactNode;
};
export const Dialog = ({ open, ...props }: DialogProps) =>
  open ? createPortal(<DialogPanel {...props} />, document.body) : null;

// Open dialogs with their nesting depth. Only the top one (deepest, then
// latest) reacts to Escape and Tab. Depth comes from context because a child
// dialog's effect runs before its parent's when both mount together.
const DialogDepth = createContext(0);
const openDialogs: { panel: HTMLElement; depth: number }[] = [];
const isTopDialog = (panel: HTMLElement) => {
  const top = openDialogs.reduce<(typeof openDialogs)[number] | undefined>(
    (current, entry) =>
      !current || entry.depth >= current.depth ? entry : current,
    undefined,
  );
  return top?.panel === panel;
};
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';
const focusableIn = (panel: HTMLElement) =>
  [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => element.checkVisibility?.() ?? true,
  );
const keepFocusInside = (event: KeyboardEvent, panel: HTMLElement) => {
  const items = focusableIn(panel);
  const first = items[0];
  const last = items.at(-1);
  const active = document.activeElement;
  if (!first || !last) {
    event.preventDefault();
    panel.focus();
  } else if (event.shiftKey && (active === first || active === panel)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
};

/**
 * Modal behaviour: focus moves into the dialog and is trapped there, Escape
 * closes it (unless an inner handler called `preventDefault`), the page
 * behind does not scroll, and focus returns to the opener on close.
 */
function DialogPanel({
  title,
  children,
  onClose,
  wide = false,
  actions,
}: Omit<DialogProps, "open">) {
  const panelRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const depth = useContext(DialogDepth) + 1;
  const close = useEffectEvent(onClose);
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const entry = { panel, depth };
    openDialogs.push(entry);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Respect an `autoFocus` field inside the dialog.
    if (isTopDialog(panel) && !panel.contains(document.activeElement))
      panel.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopDialog(panel) || event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "Tab") {
        keepFocusInside(event, panel);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      openDialogs.splice(openDialogs.indexOf(entry), 1);
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [depth]);
  return (
    <DialogDepth.Provider value={depth}>
      <div
        className="dialog-backdrop"
        role="presentation"
        // Only a press on the backdrop itself closes the dialog, not one that
        // started inside the panel or inside a nested dialog's backdrop.
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <section
          ref={panelRef}
          className={cn("dialog", wide && "dialog-wide")}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
        >
          <header>
            <h2 id={titleId}>{title}</h2>
            <div className="dialog-header-actions">
              {actions}
              <Button variant="ghost" aria-label="Close" onClick={onClose}>
                <X size={17} />
              </Button>
            </div>
          </header>
          {children}
        </section>
      </div>
    </DialogDepth.Provider>
  );
}
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
      <Button
        type="button"
        variant="danger"
        loading={loading}
        onClick={onConfirm}
      >
        {confirmText}
      </Button>
    </div>
  </Dialog>
);
