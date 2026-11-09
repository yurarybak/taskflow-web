import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useClickOutside } from "./use-click-outside";

function Popover({
  onOutside,
  enabled,
}: {
  onOutside: () => void;
  enabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onOutside, enabled);
  return (
    <>
      <div ref={ref}>
        <button>Inside</button>
      </div>
      <button>Outside</button>
    </>
  );
}

describe("useClickOutside", () => {
  it("fires for pointer events outside the element only", () => {
    const onOutside = vi.fn();
    render(<Popover onOutside={onOutside} />);
    fireEvent.pointerDown(screen.getByText("Inside"));
    expect(onOutside).not.toHaveBeenCalled();
    fireEvent.pointerDown(screen.getByText("Outside"));
    expect(onOutside).toHaveBeenCalledTimes(1);
  });

  it("does nothing while disabled", () => {
    const onOutside = vi.fn();
    render(<Popover onOutside={onOutside} enabled={false} />);
    fireEvent.pointerDown(screen.getByText("Outside"));
    expect(onOutside).not.toHaveBeenCalled();
  });

  it("calls the latest callback without re-subscribing", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Popover onOutside={first} />);
    rerender(<Popover onOutside={second} />);
    fireEvent.pointerDown(screen.getByText("Outside"));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
