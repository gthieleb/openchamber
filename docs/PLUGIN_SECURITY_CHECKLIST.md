# Plugin Security Review Checklist

This checklist must be reviewed for every new capability, plugin contribution type, or plugin loader change.

## Capability Design

- [ ] **Principle of least privilege**: Does the capability grant only what is strictly necessary?
- [ ] **Dangerous flag**: If the capability can modify state, execute code, or access sensitive data, is it marked as dangerous?
- [ ] **Deny-by-default**: Can the host deny this capability without breaking core functionality?
- [ ] **Scope isolation**: Does the capability operate within a well-defined namespace (e.g., `storage.global` vs arbitrary localStorage)?
- [ ] **No raw bridge exposure**: Does the capability go through the facade layer (`createPluginRuntimeFacade`)?

## Server-Side Enforcement

- [ ] **Policy in core logic, not UI**: Is the security policy enforced in server/host logic, not just in presentation?
- [ ] **Auth gating**: Are protected routes behind the correct auth phase (`postAuthFeatureRoutes` or later)?
- [ ] **Rate limiting**: Does the capability introduce endpoints that need rate limiting?
- [ ] **Input validation**: Are all plugin-provided inputs validated before use?
- [ ] **Path traversal**: If the capability involves file paths, is path traversal prevented?
- [ ] **Capability validation**: Does the server loader reject capabilities outside the allowed set (`ALLOWED_SERVER_CAPABILITIES`)?

## Plugin Loader Security

- [ ] **Allowlist enforcement**: Are user plugins restricted to allowlisted paths?
- [ ] **No remote code loading**: Are plugins only loaded at build time, never from remote URLs?
- [ ] **Import isolation**: Are plugin imports sandboxed (no access to host internals)?
- [ ] **Setup error isolation**: Does a plugin setup failure not crash the host?
- [ ] **Dispose on failure**: Are partial registrations cleaned up on setup error?

## Data Protection

- [ ] **No secrets in storage**: Does the storage API prevent storing sensitive data without redaction?
- [ ] **Quota enforcement**: Are byte/count quotas enforced to prevent DoS?
- [ ] **Cross-plugin isolation**: Can Plugin A read Plugin B's storage? (Should be no)
- [ ] **Uninstall cleanup**: Is all plugin data cleaned up on uninstall?

## UI Security

- [ ] **Render isolation**: Are plugin UI components wrapped in error boundaries?
- [ ] **No eval/innerHTML**: Do plugin renderers avoid `eval()`, `dangerouslySetInnerHTML`, or equivalent?
- [ ] **CSP compliance**: Do plugin contributions respect Content Security Policy?
- [ ] **Clickjacking prevention**: Are plugin surfaces not embeddable in iframes?

## Auth Provider Security

- [ ] **Host owns session**: Does the auth provider API not allow plugins to create/modify sessions directly?
- [ ] **Callback validation**: Are OAuth/callback URLs validated against expected origins?
- [ ] **Token isolation**: Are auth tokens not exposed to plugin storage or capabilities?
- [ ] **Disabled provider behavior**: Does disabling a provider immediately block all its flows?

## Review Process

1. Author fills out this checklist for the new capability/contribution.
2. Reviewer verifies each item and signs off.
3. Any unchecked items must have a documented exception with rationale.
4. Checklist is stored alongside the capability definition.
