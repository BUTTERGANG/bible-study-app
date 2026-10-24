# Changelog

All notable changes to bible-study-app. Newest first.

## 2026-10-23 — Security: dependency vulnerability fixes

Known advisories (OSV) in lockfiles: **2 critical, 34 high, 25 moderate, 10 low, 4 unrated → 1 low**.

- **Replaced `python-jose` with `PyJWT` 2.15.1** in `backend/auth.py` — python-jose has an unpatched critical algorithm-confusion advisory (not exploitable with our HS256-only config, but no fixed release). Drop-in: `jwt.encode`/`jwt.decode`, `PyJWTError` as `JWTError`
- `python-multipart` 0.0.32, `python-dotenv` 1.2.4, `pytest` 9.1.1, `pytest-asyncio` 1.4.0
- `frontend/pnpm-lock.yaml` regenerated from `package-lock.json` (`pnpm import`) — it had drifted to vulnerable versions
- THE-VISION roadmap / feature-gaps: PyJWT migration marked done
- Critical/high advisories cleared in: `dompurify`, `python-jose`, `brace-expansion`, `browserslist`, `fast-uri`, `js-yaml`, `nanoid`, `postcss`, `source-map-js`, `vite`
- Verified: 160/160 backend tests pass on Python 3.11
