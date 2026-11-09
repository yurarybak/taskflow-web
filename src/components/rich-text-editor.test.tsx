import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RichTextEditor } from "./rich-text-editor";

const surface = () => screen.getByRole("textbox", { name: "Add details..." });

describe("RichTextEditor", () => {
  it("loads stored HTML with its formatting", async () => {
    render(
      <RichTextEditor
        value="<p><b>Bold</b> and <i>italic</i></p><ul><li>One</li></ul>"
        onChange={vi.fn()}
      />,
    );
    await waitFor(() => expect(surface()).toHaveTextContent("Bold and italic"));
    expect(within(surface()).getByText("Bold").tagName).toBe("STRONG");
    expect(within(surface()).getByText("italic").tagName).toBe("EM");
    expect(surface().querySelector("ul li")).toHaveTextContent("One");
  });

  it("drops executable markup from stored HTML", async () => {
    const payload =
      '<p>Hi</p><img src=x onerror="window.__xss=1"><script>window.__xss=1</script>';
    render(<RichTextEditor value={payload} onChange={vi.fn()} />);
    await waitFor(() => expect(surface()).toHaveTextContent("Hi"));
    expect(surface().querySelector("img, script")).toBeNull();
    expect(surface().innerHTML).not.toContain("onerror");
    expect((window as { __xss?: number }).__xss).toBeUndefined();
  });

  it("formats with the toolbar and reports the new HTML", async () => {
    const onChange = vi.fn();
    render(<RichTextEditor value="<p>Hello</p>" onChange={onChange} />);
    await waitFor(() => expect(surface()).toHaveTextContent("Hello"));
    const numbered = screen.getByRole("button", { name: "Numbered list" });
    expect(numbered).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(numbered);
    expect(onChange).toHaveBeenLastCalledWith("<ol><li><p>Hello</p></li></ol>");
    await waitFor(() =>
      expect(numbered).toHaveAttribute("aria-pressed", "true"),
    );
  });

  it("follows a new value from outside without reporting a change", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <RichTextEditor value="<p>First</p>" onChange={onChange} />,
    );
    await waitFor(() => expect(surface()).toHaveTextContent("First"));
    rerender(<RichTextEditor value="<p>Second</p>" onChange={onChange} />);
    await waitFor(() => expect(surface()).toHaveTextContent("Second"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports an empty document as an empty string", async () => {
    const onChange = vi.fn();
    render(<RichTextEditor value="<p>x</p>" onChange={onChange} />);
    await waitFor(() => expect(surface()).toHaveTextContent("x"));
    fireEvent.click(screen.getByRole("button", { name: "Bullet list" }));
    fireEvent.click(screen.getByRole("button", { name: "Bullet list" }));
    expect(onChange).toHaveBeenLastCalledWith("<p>x</p>");
  });
});
