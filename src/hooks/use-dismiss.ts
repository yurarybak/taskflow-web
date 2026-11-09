import { useEffect, useEffectEvent, type RefObject } from "react";
import { useClickOutside } from "./use-click-outside";

/**
 * Closes an open popover/menu on a click outside `ref` or on Escape.
 *
 * Pass the popover's open state as `open`: only an open popover takes Escape.
 * It listens in the capture phase and calls `preventDefault()`, so a
 * surrounding `Dialog` does not close as well. If focus was inside the
 * popover, it returns to the first focusable element in `ref` (the trigger).
 */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  open: boolean,
) {
  useClickOutside(ref, onDismiss, open);
  const dismissWithEscape = useEffectEvent(() => {
    const container = ref.current;
    const hadFocus = !!container?.contains(document.activeElement);
    onDismiss();
    if (hadFocus)
      requestAnimationFrame(() =>
        container
          ?.querySelector<HTMLElement>("button:not([disabled]), [tabindex]")
          ?.focus(),
      );
  });
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      dismissWithEscape();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open]);
}
