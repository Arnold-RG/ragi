import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AlarmBanner } from "@/components/ui/AlarmBanner";
import { FilterBar } from "@/components/ui/FilterBar";
import { KpiCard } from "@/components/ui/KpiCard";
import { Sparkline } from "@/components/ui/Sparkline";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";

describe("Sparkline", () => {
  it("exposes a labelled graphic", () => {
    render(<Sparkline values={[1, 2, 3, 2, 4]} label="Approvals trend" />);
    expect(screen.getByRole("img", { name: "Approvals trend" })).toBeInTheDocument();
  });
});

describe("KpiCard", () => {
  it("marks the hero tile and names its sparkline", () => {
    render(<KpiCard hero label="Awaiting approval" value={3} series={[1, 2, 3]} />);
    expect(screen.getByText("Awaiting approval")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Awaiting approval trend" })).toBeInTheDocument();
    expect(document.querySelector(".kpi.hero")).toBeTruthy();
  });
});

describe("AlarmBanner", () => {
  it("announces STOP with the blocked count", () => {
    render(<AlarmBanner message="Agent emergency stop is on." count={4} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("STOP");
    expect(alert).toHaveTextContent("4 blocked");
  });
});

describe("FilterBar", () => {
  it("can save a view", () => {
    render(<FilterBar storageKey="test-view"><span>Status</span></FilterBar>);
    fireEvent.click(screen.getByRole("button", { name: "Save this view" }));
    expect(screen.getByRole("button", { name: "Save this view" })).toHaveTextContent("Saved");
    expect(localStorage.getItem("test-view")).toBeTruthy();
  });
});

describe("KanbanBoard", () => {
  it("shows a numeric count on every column, including an empty Done column", () => {
    render(
      <KanbanBoard
        columns={[
          { id: "review", label: "Review", items: [{ id: "a" }], warning: true },
          { id: "done", label: "Done", items: [], emptyNote: "Nothing done yet" },
        ]}
        renderCard={(item) => <div>{item.id}</div>}
      />,
    );
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Nothing done yet")).toBeInTheDocument();
    const counts = screen.getAllByText("0");
    expect(counts.length).toBeGreaterThanOrEqual(1);
  });
});
