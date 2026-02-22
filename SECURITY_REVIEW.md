# Security Review Report

Date: 2026-02-22
Scope: Full repository review with focus on authentication, session management, authorization, and login/logout flow.

## Executive Summary

This project has a **solid baseline** for an MVP (httpOnly cookies, JWT expiry, role middleware, rate limiting, input validation), but it is **not yet production-ready** for a security-sensitive deployment.

The highest-priority issues are:

1. **Weak CSRF protection design** (custom header check only).
2. **Potential user enumeration/timing inconsistency in login flow** due to an invalid dummy bcrypt hash constant.
3. **No explicit account lockout / credential stuffing controls beyond per-IP limiter**.
4. **Operational hardening gaps** (default/admin credential guidance in docs and seed flows, audit logging, and session policy depth).

## What I reviewed

- Backend auth/session code (`auth` routes, JWT, cookies, auth middleware).
- Authorization gates across client/admin routes.
- App-level security middleware (CORS, Helmet, rate limiting, CSRF check).
- Data model elements relevant to identity/session state.
- Frontend API/client behavior around authenticated requests.
- Documentation and seed defaults that affect production risk.

---

## Findings

### 1) CSRF protection is insufficient for production (High)

Current protection for state-changing requests relies only on checking `X-Requested-With: XMLHttpRequest`.

Why this is risky:
- This is not a cryptographic CSRF defense.
- It can be brittle with proxies/mobile clients and does not provide anti-replay semantics.
- Cookie-authenticated apps should use synchronizer token or double-submit token patterns.

Recommendation:
- Implement robust CSRF tokens (`csrf` middleware, signed token cookie + header validation) for all state-changing endpoints.
- Keep SameSite defenses, but treat them as defense-in-depth rather than primary CSRF control.
- Consider route-level exemption only for pure API clients using bearer tokens (if added later).

### 2) Login timing mitigation likely broken by invalid dummy hash (Medium)

The login flow tries to avoid timing leaks by bcrypt-comparing against a dummy hash when user is missing. The configured dummy hash string does not appear to be a valid bcrypt hash format/length and may not provide intended behavior.

Why this is risky:
- Could throw/short-circuit, creating behavior differences between existing and non-existing users.
- May reintroduce measurable timing distinction and increase enumeration risk.

Recommendation:
- Replace with a known-valid precomputed bcrypt hash generated once with the same cost factor.
- Add a test for the "user not found" login path to ensure stable response code/body and no unexpected errors.

### 3) Session policy is good for MVP but incomplete for high assurance (Medium)

Good practices present:
- httpOnly auth cookie.
- Expiring JWTs (24h).
- Server-side token revocation by JTI.
- Global token invalidation via `tokenVersion` bump on password change.

Remaining gaps:
- No idle timeout / rolling session policy.
- No device/session inventory and selective revocation.
- No explicit re-auth step for sensitive admin actions.

Recommendation:
- Add refresh token rotation with short-lived access tokens, or reduce access-token TTL significantly.
- Introduce session records per device and “log out all sessions” UX.
- Add step-up auth for sensitive mutations.

### 4) Authorization model is mostly correct, but defense-in-depth can improve (Low)

Current state:
- `requireAuth` and `requireAdmin` middleware gate protected routes.
- Client routes scope resources by authenticated user ownership.
- Admin routes apply role middleware globally.

Hardening suggestions:
- Add structured authorization tests (positive/negative) for each route category.
- Consider centralized policy layer to avoid future route drift as codebase grows.

### 5) Operational readiness issues in docs/seeding (Medium)

The docs include a default admin credential example, and seed paths print credentials for convenience.

Why this matters:
- Teams often copy defaults into shared environments.
- Operational mistakes are a frequent breach root cause.

Recommendation:
- Remove/avoid static credential examples in top-level docs for production contexts.
- Enforce one-time bootstrap admin creation flow with mandatory password reset.
- Add explicit production startup checks: fail if default credentials/users are detected.

### 6) Monetary precision TODO in schema (Low, business/security integrity)

Pricing fields are `Float` with TODO notes to migrate to decimal.

Risk:
- Precision drift in billing calculations can become financial integrity issues.

Recommendation:
- Migrate monetary fields to `Decimal` and ensure rounding policy is explicit and tested.

---

## Login / Logout / Session Flow Review

### Login
- Positive: rate-limited endpoint, validated input, generic invalid-credentials message.
- Concern: dummy-hash robustness as noted above.

### Logout
- Positive: revokes current token by JTI and clears cookie.
- Caveat: if revocation store is unavailable, revocation silently fails and logout relies on cookie deletion only.

### Session validation
- Positive: verifies JWT signature, requires `jti`, checks revocation list and `tokenVersion`.
- Caveat: no advanced session telemetry (IP/device anomaly detection), no idle timeout.

### Authorization
- Positive: clear role checks and ownership filtering in route queries.
- Caveat: maintainability risk without automated authz test matrix.

---

## Production-readiness verdict

**Verdict: Not production-ready yet** for a public internet deployment handling real customer data/payment-sensitive workflows.

It can be moved toward production readiness by resolving High/Medium findings, especially:
1. Real CSRF token defense.
2. Robust login anti-enumeration behavior and auth-path tests.
3. Stronger session lifecycle controls.
4. Operational safeguards around bootstrap/admin credentials.

---

## Prioritized remediation plan

### Phase 1 (Immediate: before go-live)
1. Implement CSRF token architecture for all state-changing cookie-authenticated endpoints.
2. Fix dummy bcrypt hash and add login behavior tests.
3. Add explicit production checks preventing default/admin weak credential use.
4. Add authz integration tests for client-vs-admin access boundaries.

### Phase 2 (Near-term hardening)
1. Add session table/device awareness + revoke-all/revoke-one controls.
2. Reduce token lifetime or adopt refresh token rotation.
3. Add structured security logging for auth events (login success/failure, password change, admin mutations).
4. Add dependency scanning in CI (npm audit alternative/SCA tooling) and fail on critical advisories.

### Phase 3 (Maturity)
1. Migrate money fields from Float to Decimal with migration/backfill plan.
2. Add re-auth/step-up for sensitive admin operations.
3. Conduct threat modeling and periodic pentest before major releases.

