# RAGI — Private AI Assistant Platform

**Owner-focused assistant and services** · [GitHub repository](https://github.com/Arnold-RG/ragi)

## Project overview

Multi-service application with a TypeScript/Fastify backend, browser frontend, PostgreSQL, Redis, Docker Compose and persistent data. The repository's current Compose configuration is optimized for substantial host memory and **must not be exposed to the public internet unchanged**.

**Technology:** TypeScript, Fastify, Prisma, PostgreSQL, Redis, Docker/Compose.

> **Verification note:** This documentation reflects observed repository structure. It does not imply that paid features, security tests, certifications, deployment configurations or third-party integrations have been approved.

## Architecture map

| Location | What belongs here |
| --- | --- |
| `backend/` | Fastify API, authentication and database integration |
| `web/` | Browser UI |
| `docker-compose.yml` | Local multi-service stack |
| `scripts/` | Infrastructure helpers |
| `.github/` | Automation definitions |

## Development and setup

Install Git and the relevant runtime. Inspect the environment template and repository deployment docs before exposing any network services.

```sh
cd backend
npm ci
npm run typecheck
# Review environment setup before using the API or database
# Do NOT expose the provided Compose stack publicly
```

**Important:** Do not run production deployment from the example Compose stack without security review.

## Product functionality and user experience

- Private assistant capabilities require explicit scope, clear account state and explainable actions.
- Provide useful errors, mobile-friendly navigation and confirmation for destructive operations.
- Data import, memory and account management require consent and recovery controls.

Prioritize accessibility, keyboard and touch navigation, meaningful empty/error/loading states and truthful product claims. Never copy third-party images or logos without authorization.

## Security and data protection

- **Urgent:** existing Compose defaults include a predictable database-password fallback and host port exposure for PostgreSQL/Redis. Replace defaults, enforce private networks, secret injection and firewall rules before production.
- Verify authentication and authorization at every API boundary; protect cookies, MFA recovery and session tokens.
- Implement encrypted backups, retention, audit events, resource quotas, monitoring and incident response.

Use secrets management, least privilege, deployment environment isolation, dependency audits and a private vulnerability disclosure path. Release claims must be tied to actual evidence.

## Engineering and CI/CD standards

| Gate | Expected evidence |
| --- | --- |
| Code quality | Lint/type checks, peer review and maintained documentation |
| Automated testing | Relevant unit/integration/security regression tests |
| Dependency and supply chain | Locked builds, dependency reviews, secret scanning and SBOM when helpful |
| Security | Threat model, input validation, authz tests and secure configuration |
| User experience | Responsive layouts, accessibility, functioning navigation and real-world test flows |
| Release | Staging verification, owner approval, traceable deploy and rollback |
| Operations | Metrics/logging and alerting for services; link/uptime checks for static sites |

These are **release criteria**, not claims that every control is currently enabled. Kubernetes should only be used when the actual runtime complexity justifies it.

## Contributing and support

Create a small, reviewable change, include reproduction steps and tests, and document environmental impacts. Do not publish unapproved customer details or change live services without release authorization. Report security vulnerabilities privately via `SECURITY.md` where available.
