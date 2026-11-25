export interface Project {
  id: string; slug: string; name: string; category: string; status: string; priority: string; summary: string | null;
  client_id: string | null; client_name: string | null; repo_owner: string | null; repo_name: string | null;
  production_url: string | null; start_date: string | null; due_date: string | null; completed_at: string | null;
  retainer_id: string | null;
  kind?: string | null; visibility?: string | null; is_private?: boolean;
  repo_pushed_at?: string | null;
  verified: boolean; is_demo: boolean; task_total: number; task_done: number; progress: number; updated_at: string;
  milestones?: { id: string; title: string; due_date: string | null; done: boolean }[];
}
export interface Activity { id: number; actor: string; action: string; summary: string | null; at: string }
export interface Retainer {
  id: string; client_name: string; name: string; hours_per_month: number;
  used_minutes: number; included_minutes: number; used_pct: number; usage_state: "ok" | "warning" | "over"; is_demo: boolean;
  projects: { id: string; name: string }[]; status: string; month_start: string;
}
export interface Summary {
  generated_at: string; demo_data: boolean;
  projects: { active: number; completed: number; upcoming: number; total: number; by_status: Record<string, number> };
  tasks: { open: number; overdue: number; by_status: Record<string, number>; throughput_14d: { day: string; completed: number; created: number }[] };
  clients: { active: number; total: number };
  pipeline: { open: number; won: number; by_stage: Record<string, number> };
  time: { billable_minutes: number; non_billable_minutes: number; month_start: string };
  retainers: Retainer[];
  billing: { by_status: Record<string, number> };
  agents: { total: number; enabled: number; emergency_stop: boolean; runs_blocked: number; items: { id: string; display_name: string; role: string; provider: string; status: string }[] };
  websites: { total: number; checked: number; up: number; availability_pct: number | null };
  approvals: { pending: number };
  active_projects: Project[];
  activity: Activity[];
  safety: { agents_enabled: boolean; repository_writes_enabled: boolean; production_deployment_enabled: boolean };
}
export interface Client { id: string; name: string; contact_name: string | null; email: string | null; city: string | null; country: string; sector: string | null; status: string; notes: string | null; is_demo: boolean; project_count: number }
export interface Agent { id: string; slug: string; display_name: string; department: string; role: string; provider: string; enabled: boolean; placeholder: boolean; capabilities: string[]; permissions: Record<string, boolean>; execution: Record<string, unknown>; governance: Record<string, boolean>; connection: string; connection_detail: string; run_count: number; open_tasks: number }
export interface AgentRun { id: string; agent_id: string; agent_slug?: string | null; task_title: string | null; requested_by: string; status: string; checks: { name: string; passed: boolean; detail: string }[]; blocked_reason: string | null; created_at: string }
export interface Approval { id: string; kind: string; title: string; detail: string | null; requested_by: string; status: string; decided_by: string | null; decided_at: string | null; is_demo: boolean; created_at: string }
export interface Lead { id: string; name: string; company: string | null; email: string | null; service: string | null; source: string | null; stage: string; estimated_amount: string | null; currency: string; notes: string | null; lost_reason: string | null; project_id: string | null; is_demo: boolean; updated_at: string }
export interface TimeEntry { id: string; project_id: string; project_name: string | null; task_title: string | null; note: string | null; started_at: string; ended_at: string | null; minutes: number; billable: boolean; billed: boolean; running: boolean; is_demo: boolean }
export interface Handoff { id: string; kind: "quote" | "invoice"; client_name: string; project_name: string | null; title: string; lines: { description: string; quantity?: string }[]; status: string; omh_reference: string | null; is_demo: boolean; created_at: string; handed_at: string | null; outbox_event_id: string | null }
export interface Website { id: string; project_id: string | null; label: string; url: string; status: string; last_status_code: number | null; last_response_ms: number | null; last_checked_at: string | null; is_demo?: boolean; verified?: boolean }
export interface AuditRow { id: number; actor_label: string; action: string; subject_type: string | null; subject_id: string | null; summary: string | null; detail: Record<string, unknown> | null; created_at: string }
export interface TimeSummary { month_start: string; total_billable: number; total_non_billable: number; projects: { project_id: string; project_name: string | null; billable: number; non_billable: number; unbilled_billable: number }[] }
export interface PortalOverview {
  client: { name: string; is_demo: boolean };
  projects: { id: string; name: string; status: string; progress: number; summary: string | null; due_date: string | null; is_demo: boolean; milestones: { title: string; due_date: string | null; done: boolean }[] }[];
  documents: { kind: string; title: string; status: string; omh_reference: string | null }[];
  files: { available: boolean; detail: string }; support: { available: boolean; detail: string };
}

export type OmhMoney = { amount: string; currency: string; minor?: number } | null;
export interface OmhCurrencyRow {
  balance?: OmhMoney; pending?: OmhMoney; income_month?: OmhMoney;
  expenses_month?: OmhMoney; net_month?: OmhMoney; ai_usage_month?: OmhMoney;
}
export interface OmhAiBudget {
  id: string; name: string; provider?: string | null; allocated?: OmhMoney;
  actual?: OmhMoney; reserved?: OmhMoney; available?: OmhMoney; state?: string;
  ragi_project_id?: string | null;
}
export interface OmhFinancePayload {
  source?: string; schema_version?: string; as_of?: string; month?: string;
  has_data?: boolean; linked?: boolean; note?: string;
  by_currency?: Record<string, OmhCurrencyRow>;
  ai_budgets?: OmhAiBudget[];
}
export interface OmhFinanceResponse {
  status: "ok" | "unlinked" | "not_configured" | "asleep" | "error";
  detail: string; source: string; summary: OmhFinancePayload | null;
}
export interface GithubSyncStatus {
  configured: boolean; user?: string; include_private?: boolean; interval_hours?: number;
  last_at: string | null; last_result: string | null; last_ok: boolean | null;
}
export interface RegistryPlanItem {
  name: string; slug: string; kind: string; repo?: string | null; private?: boolean;
  production_url?: string | null; sites?: number; action: string; detail?: string;
}
