import { useEffect, useEffectEvent, type RefObject } from "react";

/**
 * Calls `onOutside` when a pointer goes down outside `ref`. Listens in the
 * capture phase so it also fires when inner handlers stop propagation.
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onOutside: () => void,
  enabled = true,
) {
  const handleOutside = useEffectEvent(onOutside);
  useEffect(() => {
    if (!enabled) return;
    const listener = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node))
        handleOutside();
    };
    document.addEventListener("pointerdown", listener, true);
    return () => document.removeEventListener("pointerdown", listener, true);
  }, [ref, enabled]);
}
