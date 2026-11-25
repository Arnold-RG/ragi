"use client";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

export interface KanbanColumn<T> {
  id: string;
  label: string;
  items: T[];
  warning?: boolean;
  error?: boolean;
  emptyNote?: string;
  wip?: { used: number; cap: number };
}

export function KanbanBoard<T extends { id: string }>({
  columns, renderCard, onMove, getId = (i) => i.id, activeId, collapsedIds, onToggleCollapse, phone,
}: {
  columns: KanbanColumn<T>[];
  renderCard: (item: T, selected: boolean) => ReactNode;
  onMove?: (item: T, columnId: string) => void;
  getId?: (item: T) => string;
  activeId?: string | null;
  collapsedIds?: string[];
  onToggleCollapse?: (id: string) => void;
  phone?: boolean;
}) {
  const [phoneCol, setPhoneCol] = useState(columns[0]?.id ?? "");
  useEffect(() => {
    if (!columns.find((c) => c.id === phoneCol) && columns[0]) setPhoneCol(columns[0].id);
  }, [columns, phoneCol]);

  if (phone) {
    const col = columns.find((c) => c.id === phoneCol) ?? columns[0];
    const idx = columns.findIndex((c) => c.id === col?.id);
    const next = columns[idx + 1];
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Board columns">
          {columns.map((c) => (
            <button key={c.id} role="tab" aria-selected={c.id === col?.id} className={clsx("chip shrink-0", c.id === col?.id && "on font-bold")}
              onClick={() => setPhoneCol(c.id)}>
              {c.label} <span className="num">{c.items.length}</span>
            </button>
          ))}
        </div>
        {col && (
          <div className="flex min-h-0 gap-2 overflow-hidden">
            <div className="col min-h-[60vh] flex-1" style={{ flexBasis: "auto" }}>
              <ColumnHeader col={col} />
              <ColumnBody col={col} renderCard={renderCard} onMove={onMove} getId={getId} activeId={activeId} />
            </div>
            {next && (
              <button type="button" className="col min hidden sm:flex" style={{ flex: "0 0 28px" }} onClick={() => setPhoneCol(next.id)} aria-label={`Next column: ${next.label}`}>
                <span className="vt">{next.label} <span className="n">{next.items.length}</span></span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  const collapsed = new Set(collapsedIds ?? []);
  return (
    <div className="board pb-4">
      {columns.map((col) => {
        const isMin = collapsed.has(col.id);
        if (isMin) {
          return (
            <button type="button" key={col.id} className="col min" onClick={() => onToggleCollapse?.(col.id)} aria-label={`Expand ${col.label}, ${col.items.length} cards`}>
              <ChevronRight size={14} />
              <span className="vt">{col.label} <span className="n">{col.items.length}</span></span>
            </button>
          );
        }
        return (
          <div key={col.id} className="col" onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("text/kanban");
              const item = columns.flatMap((c) => c.items).find((i) => getId(i) === id);
              if (item && onMove) onMove(item, col.id);
            }}>
            <ColumnHeader col={col} onCollapse={onToggleCollapse ? () => onToggleCollapse(col.id) : undefined} />
            <ColumnBody col={col} renderCard={renderCard} onMove={onMove} getId={getId} activeId={activeId} />
          </div>
        );
      })}
    </div>
  );
}

function ColumnHeader<T>({ col, onCollapse }: { col: KanbanColumn<T>; onCollapse?: () => void }) {
  return (
    <div className={clsx("colh", col.warning && "warnh", col.error && "errh")}>
      {onCollapse && <button type="button" className="btn-ghost px-1" aria-label={`Collapse ${col.label}`} onClick={onCollapse}><ChevronRight size={14} className="rotate-180" /></button>}
      <span>{col.label}</span>
      <span className="n">{col.items.length}</span>
      {col.wip && <span className="wip">WIP {col.wip.used} / {col.wip.cap}</span>}
    </div>
  );
}

function ColumnBody<T extends { id: string }>({ col, renderCard, onMove, getId, activeId }: {
  col: KanbanColumn<T>; renderCard: (item: T, selected: boolean) => ReactNode; onMove?: (item: T, columnId: string) => void;
  getId: (item: T) => string; activeId?: string | null;
}) {
  return (
    <div className="flex min-h-16 flex-col gap-2 overflow-y-auto">
      {col.items.length === 0 && <div className="empty-col">{col.emptyNote ?? "Nothing here yet"}</div>}
      {col.items.map((item) => (
        <div key={getId(item)} draggable={!!onMove} onDragStart={(e) => e.dataTransfer.setData("text/kanban", getId(item))}>
          {renderCard(item, activeId === getId(item))}
        </div>
      ))}
    </div>
  );
}
