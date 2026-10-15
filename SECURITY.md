# Security Policy

## Supported versions

Security updates apply to the latest commit on the default branch of this repository.

## Reporting a vulnerability

Email **rurangwaarnold32@gmail.com** with:

- Repository name and affected URL/path
- Description and impact
- Steps to reproduce (proof of concept if available)

Please do **not** open a public issue for unpatched vulnerabilities.

We aim to acknowledge reports within 7 days and publish a fix or mitigation when confirmed.

## Practice

- No secrets in source; use `.env.example` only (`RAGI_MASTER_KEY`, `RAGI_SESSION_SECRET`, API keys stay off-repo)
- Prefer `textContent` / `esc()` over `innerHTML` for untrusted data
- External links use `rel="noopener noreferrer"`
- Owner vaults: Argon2id / PBKDF2 password hashes, AES-GCM field seal, session revoke, auth rate limits + lockouts
- Device Pages mode: IndexedDB accounts with PBKDF2 (310k) and local fail lockouts
- Dependabot / Actions least privilege where applicable
