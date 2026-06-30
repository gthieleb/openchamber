---
slug: openchamber-k3s-deploy
status: awaiting-approval
intent: clear
pending-action: write .omo/plans/openchamber-k3s-deploy.md
approach: Fork openchamber/openchamber -> gthieleb/openchamber, commit local customizations, build/push image to ghcr.io/gthieleb/openchamber, create k3s local-storage PV/PVC and copy auth data, deploy with imagePullSecret and NodePort service.
---

# Draft: openchamber-k3s-deploy

## Components (topology ledger)
| id | outcome | status | evidence path |
|---|---|---|---|
| fork | gthieleb/openchamber exists, local remotes adjusted | active | `git remote -v`, GitHub UI |
| image | OpenChamber Docker image published to ghcr.io/gthieleb/openchamber | active | `docker images`, `gh package view` |
| pull-secret | k3s imagePullSecret for ghcr.io created | active | `kubectl get secret -n openchamber` |
| storage | local-storage PV/PVC for OpenChamber data created, auth files copied | active | `kubectl get pv,pvc -n openchamber`, `ls` on host path |
| deploy | OpenChamber runs as Deployment on k3s, reachable via NodePort | active | `kubectl get pods,svc -n openchamber`, HTTP health check |

## Open assumptions (announced defaults)
| assumption | adopted default | rationale | reversible? |
|---|---|---|---|
| k3s host name | `k3s` | user stated | yes |
| SSH user | `gun` | matches current local user and existing SETUP.md pattern | yes |
| remote name for fork | `origin` rewritten to `https://github.com/gthieleb/openchamber.git` | keeps `git push` simple; upstream kept as `upstream` | yes |
| image name/tag | `ghcr.io/gthieleb/openchamber:latest` | GHCR convention, single moving tag for now | yes |
| architecture | `linux/amd64` | k3s node runs on x86_64 per earlier EKS output; build on local machine | yes |
| namespace | `openchamber` | dedicated, matches service name | yes |
| storage class | `local-path` (k3s default) | user asked for local-storage; k3s ships `local-path` provisioner | yes |
| service type | NodePort on port 30001 mapped to container 3000 | avoids Ingress complexity; Tailscale can reach `k3s:30001` | yes |
| auth sync | copy current host auth files (`~/.local/share/opencode/*.json`, `~/.config/gh/hosts.yml`) into PV once at setup | avoids hostPath node coupling; updates require re-copy or future sync sidecar | yes |
| UI password | reuse existing `OPENCHAMBER_UI_PASSWORD` from `.env` | user already has a working password | yes |
| data to copy | only the 4 OpenCode auth files + gh hosts.yml + empty dirs for openchamber/opencode state | avoids copying 4.6 GB host DB (same rationale as SETUP.md) | yes |

## Findings (cited - path:lines)
- Local repo is a clone of `openchamber/openchamber` with uncommitted customizations: `git remote -v` shows `origin https://github.com/openchamber/openchamber.git`, `git status --short` shows `M Dockerfile`, `M .env`, untracked `SETUP.md`, `docker-compose.override.yml`.
- Dockerfile already patched for gh CLI: `Dockerfile:22-42` adds `curl` and installs `gh`.
- Entrypoint binds to `0.0.0.0` in Docker: `scripts/docker-entrypoint.sh:68-69`.
- SETUP.md documents host-mount pattern for auth files: `SETUP.md:48-63`.
- `.env` contains `TAILSCALE_IP=100.108.41.111` and `OPENCHAMBER_UI_PASSWORD=...`.
- `gh auth status` confirms `gthieleb` is logged in with scopes `repo, workflow, read:org, project, gist`.

## Decisions (with rationale)
1. **Fork first, then push customizations.** The Dockerfile patch and SETUP.md must live in the fork so GHCR builds and documentation are reproducible. `.env` stays gitignored and is never committed.
2. **Use GHCR + imagePullSecret from `gh auth token`.** k3s needs a pull secret for private GHCR packages; `gh auth token` produces a token with `read:packages` sufficient for pulling images published by the same account.
3. **Use a PVC instead of hostPath.** User explicitly asked for a volume; local-path PVC gives a node-local directory that we can populate via a one-time init Job. This is cleaner than hostPath and survives rescheduling within the node.
4. **Copy auth data into the PVC once during setup.** The Pod will not mount the host home directory; instead we copy the needed files into the provisioned local path. Future token refresh updates can be handled by re-running the copy or a later sync mechanism.
5. **Keep OpenCode managed by OpenChamber inside the container.** No `OPENCODE_SKIP_START`; OpenChamber starts its own OpenCode server on a dynamic port, same as Docker Compose.

## Scope IN
- Create GitHub fork `gthieleb/openchamber`.
- Commit/push local customizations (Dockerfile patch, SETUP.md, docker-compose.override.yml).
- Build Docker image `ghcr.io/gthieleb/openchamber:latest` and push to GHCR.
- Create k3s namespace `openchamber`.
- Create imagePullSecret for ghcr.io using `gh auth token`.
- Create local-path PVC and PV for OpenChamber data.
- Copy auth files from current host into the provisioned volume on the k3s node.
- Write and apply k3s Deployment + Service manifests.
- Verify rollout, health endpoint, and login.

## Scope OUT (Must NOT have)
- No multi-arch image build (arm64) in this wave.
- No Ingress, cert-manager, or HTTPS termination.
- No automated sync sidecar for auth files; initial copy only.
- No migration of existing Docker Compose container state (fresh k3s deployment).
- No changes to OpenChamber application code.

## Open questions
- None. Defaults announced above; user can veto at approval.

## Approval gate
status: awaiting-approval

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->

## Open assumptions (announced defaults)
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->

## Findings (cited - path:lines)

## Decisions (with rationale)

## Scope IN

## Scope OUT (Must NOT have)

## Open questions

## Approval gate
status: drafting
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
