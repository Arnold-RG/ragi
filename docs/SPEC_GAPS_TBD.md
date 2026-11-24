# Spec gaps — how RAGI v2 handles each (marked TBD, not invented)

Source: Mentor's `docs-mentor/spec-gaps.md` (29 gaps). "TBD" means the UI shows a note and the code keeps the
behaviour behind a single switch or interface until the owner decides.

| # | Gap | RAGI v2 now |
|---|-----|-------------|
| 1 | Accounts and sign-in | Owner created by the seed; local password + TOTP. No self-registration. |
| 2 | Shared sign-in RAGI/OMH | TBD. OIDC settings exist (`OIDC_*`), not wired. |
| 3 | Roles | owner, admin, operator, viewer, client — proposal, owner to confirm. |
| 4–5, 7–11, 13–16 | OMH-side finance topics | Not RAGI's scope. |
| 6 | Client portal vs billing portal | Portal shows projects, milestones and *issued* documents only. |
| 12 | Quote → invoice workflow | Proposed events `quotation.requested` / `invoice.requested` (RAGI → OMH) and `quotation.issued` / `invoice.issued` / `invoice.paid` (OMH → RAGI). TBD. |
| 17 | Agent roster | Jarvis, Forge, Sentinel, Nova, Mentor as placeholders; spec §07 lists different names. TBD. |
| 18 | Which actions need approval | Quote/invoice hand-off, agent runs, publishing. More TBD. |
| 19 | Emergency stop and settings | Env switches only, all off. Who may flip them: TBD. |
| 20 | Communications, files, support | Portal shows "not available yet". TBD. |
| 21 | Command centre | Dashboard + ⌘K palette. Separate command centre TBD. |
| 22 | Website monitoring rules | On-demand checks only; schedule, thresholds, alerts TBD. |
| 23 | Org ↔ OMH workspace mapping | OMH maps `arnovagroup` via `OMH_RAGI_WORKSPACE_ID` until decided. |
| 24 | Finance overview | RAGI shows OMH's per-currency summary only when connected; never sums currencies. |
| 25 | Brand tokens | Spec §12 palette in one token file, contrast fixed to AA; final palette TBD. |
| 26 | Company name | "Arnova Group" used in UI and credits. |
| 27 | Locale | English UI, dates `25 Nov 2026`, times shown relative; Europe/Warsaw vs Africa/Kigali TBD. |
| 28 | Retention | Audit log kept indefinitely for now. TBD. |
| 29 | Event destinations | Only OMH. TBD. |
