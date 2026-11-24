import {
  Activity, BarChart3, Bot, FolderKanban, Handshake, LayoutDashboard, ListTodo, Receipt, Repeat,
  ScrollText, Settings, ShieldCheck, Timer, Users, type LucideIcon,
} from "lucide-react";

export interface NavItem { href: string; label: string; icon: LucideIcon; group: "Operate" | "Studio" | "Intelligence" | "Control" }

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, group: "Operate" },
  { href: "/projects", label: "Projects", icon: FolderKanban, group: "Operate" },
  { href: "/tasks", label: "Tasks", icon: ListTodo, group: "Operate" },
  { href: "/time", label: "Time", icon: Timer, group: "Operate" },
  { href: "/pipeline", label: "Pipeline", icon: Handshake, group: "Studio" },
  { href: "/clients", label: "Clients", icon: Users, group: "Studio" },
  { href: "/retainers", label: "Retainers", icon: Repeat, group: "Studio" },
  { href: "/billing", label: "Quotes & invoices", icon: Receipt, group: "Studio" },
  { href: "/agents", label: "Agents", icon: Bot, group: "Intelligence" },
  { href: "/reports", label: "Reports", icon: BarChart3, group: "Intelligence" },
  { href: "/approvals", label: "Approvals", icon: ShieldCheck, group: "Control" },
  { href: "/audit-logs", label: "Audit log", icon: ScrollText, group: "Control" },
  { href: "/websites", label: "Websites", icon: Activity, group: "Control" },
  { href: "/settings", label: "Settings", icon: Settings, group: "Control" },
];

// Phone bottom bar, exactly as master spec §12: Home · Projects · Agents · Reports · More.
export const MOBILE_PRIMARY = ["/dashboard", "/projects", "/agents", "/reports"];
