import { OctagonX } from "lucide-react";
import type { ReactNode } from "react";

export function AlarmBanner({ message, count, action, children }: { message: string; count?: number; action?: ReactNode; children?: ReactNode }) {
  return (
    <div className="alarm" role="alert">
      <div className="ib"><OctagonX size={14} /></div>
      <div style={{ flex: 1 }}><b>STOP</b>&nbsp; {message}</div>
      {typeof count === "number" && count > 0 && <span className="pill err">{count} blocked</span>}
      {children}
      {action}
    </div>
  );
}
