import {
  Activity, Bot, FolderKanban, Handshake, LayoutDashboard, ListTodo, Settings, ShieldCheck,
  Sparkles, Timer, Users, Repeat, CalendarRange, type LucideIcon,
} from "lucide-react";

export interface NavItem { href: string; label: string; icon: LucideIcon; group: "Workspace" | "Control" | "More" }

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, group: "Workspace" },
  { href: "/projects", label: "Projects", icon: FolderKanban, group: "Workspace" },
  { href: "/agents", label: "Agents", icon: Bot, group: "Workspace" },
  { href: "/activity", label: "Activity", icon: Activity, group: "Workspace" },
  { href: "/showcase", label: "Showcase", icon: Sparkles, group: "Workspace" },
  { href: "/pipeline", label: "Pipeline", icon: Handshake, group: "Workspace" },
  { href: "/future-projects", label: "Future projects", icon: CalendarRange, group: "Workspace" },
  { href: "/approvals", label: "Approvals", icon: ShieldCheck, group: "Control" },
  { href: "/settings", label: "Settings", icon: Settings, group: "Control" },
  { href: "/tasks", label: "Tasks", icon: ListTodo, group: "More" },
  { href: "/time", label: "Time", icon: Timer, group: "More" },
  { href: "/clients", label: "Clients", icon: Users, group: "More" },
  { href: "/retainers", label: "Retainers", icon: Repeat, group: "More" },
];

// Phone bottom bar: Home · Projects · Agents · More (Approvals badge lives on More).
export const MOBILE_PRIMARY = ["/dashboard", "/projects", "/agents"];
