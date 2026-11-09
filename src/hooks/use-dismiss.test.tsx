import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "../components/ui";
import { useDismiss } from "./use-dismiss";

function Menu() {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useDismiss(ref, () => setOpen(false), open);
  return (
    <div ref={ref}>
      <button onClick={() => setOpen(true)}>Priority</button>
      {open && (
        <div role="menu">
          <button>High</button>
        </div>
      )}
    </div>
  );
}

describe("useDismiss", () => {
  it("closes an open menu on Escape without closing the dialog around it", () => {
    const onClose = vi.fn();
    render(
      <Dialog open title="Task" onClose={onClose}>
        <Menu />
      </Dialog>,
    );
    fireEvent.click(screen.getByText("Priority"));
    const option = screen.getByText("High");
    option.focus();
    fireEvent.keyDown(option, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("returns focus to the trigger after Escape", () => {
    vi.useFakeTimers();
    render(<Menu />);
    fireEvent.click(screen.getByText("Priority"));
    screen.getByText("High").focus();
    fireEvent.keyDown(screen.getByText("High"), { key: "Escape" });
    act(() => {
      vi.runAllTimers();
    });
    expect(screen.getByText("Priority")).toHaveFocus();
    vi.useRealTimers();
  });

  it("leaves Escape to the dialog while the menu is closed", () => {
    const onClose = vi.fn();
    render(
      <Dialog open title="Task" onClose={onClose}>
        <Menu />
      </Dialog>,
    );
    fireEvent.keyDown(screen.getByText("Priority"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on a click outside", () => {
    render(
      <>
        <Menu />
        <button>Elsewhere</button>
      </>,
    );
    fireEvent.click(screen.getByText("Priority"));
    fireEvent.pointerDown(screen.getByText("Elsewhere"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
