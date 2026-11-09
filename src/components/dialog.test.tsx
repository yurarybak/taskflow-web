import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./ui";

function Harness({ nested = false }: { nested?: boolean }) {
  const [open, setOpen] = useState(false);
  const [innerOpen, setInnerOpen] = useState(nested);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Dialog open={open} title="Outer" onClose={() => setOpen(false)}>
        <input aria-label="Name" />
        <button>Save</button>
        <Dialog
          open={innerOpen}
          title="Inner"
          onClose={() => setInnerOpen(false)}
        >
          <button>Confirm</button>
        </Dialog>
      </Dialog>
    </>
  );
}

const openDialog = () => {
  const opener = screen.getByRole("button", { name: "Open" });
  opener.focus();
  fireEvent.click(opener);
  return opener;
};

describe("Dialog", () => {
  it("is labelled by its title and takes focus when opened", () => {
    render(<Harness />);
    openDialog();
    const dialog = screen.getByRole("dialog", { name: "Outer" });
    expect(dialog).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("closes on Escape and returns focus to the opener", () => {
    render(<Harness />);
    const opener = openDialog();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps Tab focus inside the dialog", () => {
    render(<Harness />);
    openDialog();
    const close = screen.getByRole("button", { name: "Close" });
    const save = screen.getByRole("button", { name: "Save" });
    save.focus();
    fireEvent.keyDown(save, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(save).toHaveFocus();
  });

  it("closes only the innermost dialog on Escape", () => {
    render(<Harness nested />);
    openDialog();
    expect(screen.getByRole("dialog", { name: "Inner" })).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "Inner" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Outer" })).toBeInTheDocument();
  });

  it("lets an inner handler keep Escape for itself", () => {
    const onClose = vi.fn();
    render(
      <Dialog open title="Edit" onClose={onClose}>
        <input
          aria-label="Title"
          onKeyDown={(event) => {
            if (event.key === "Escape") event.preventDefault();
          }}
        />
      </Dialog>,
    );
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("Dialog backdrop", () => {
  it("closes on a press on the backdrop but not inside the panel", () => {
    const onClose = vi.fn();
    render(
      <Dialog open title="Edit" onClose={onClose}>
        <button>Inside</button>
      </Dialog>,
    );
    fireEvent.mouseDown(screen.getByText("Inside"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes only the inner dialog when its backdrop is pressed", () => {
    const closeOuter = vi.fn();
    const closeInner = vi.fn();
    render(
      <Dialog open title="Outer" onClose={closeOuter}>
        <Dialog open title="Inner" onClose={closeInner}>
          <span>Body</span>
        </Dialog>
      </Dialog>,
    );
    fireEvent.mouseDown(
      screen.getByRole("dialog", { name: "Inner" }).parentElement!,
    );
    expect(closeInner).toHaveBeenCalledTimes(1);
    expect(closeOuter).not.toHaveBeenCalled();
  });
});
