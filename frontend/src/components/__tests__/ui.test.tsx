import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sheet } from "@/components/ui/Sheet";
import { DemoBadge, Progress, StatusChip, TbdNote } from "@/components/ui/primitives";

describe("UI primitives", () => {
  it("labels sample data clearly", () => {
    render(<DemoBadge />);
    expect(screen.getByText("SAMPLE")).toBeInTheDocument();
  });
  it("renders nothing for real rows", () => {
    const { container } = render(<DemoBadge show={false} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("shows spec gap numbers on TBD notes", () => {
    render(<TbdNote gap={12}>Owner decision</TbdNote>);
    expect(screen.getByText(/spec gap #12/)).toBeInTheDocument();
  });
  it("humanises status chips", () => {
    render(<StatusChip status="pending_approval" />);
    expect(screen.getByText("pending approval")).toBeInTheDocument();
  });
  it("names progress bars for assistive tech", () => {
    render(<Progress value={40} label="Website progress" />);
    const bar = screen.getByRole("progressbar", { name: "Website progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });
  it("falls back to a generic name when no label is passed", () => {
    render(<Progress value={10} />);
    expect(screen.getByRole("progressbar", { name: "Progress" })).toBeInTheDocument();
  });
});

describe("Sheet (native dialog)", () => {
  it("opens as a labelled modal dialog and closes from the close button", () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose} title="New task"><p>Body</p></Sheet>);
    const dialog = screen.getByRole("dialog", { name: "New task" });
    expect(dialog).toHaveAttribute("open");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });
});
