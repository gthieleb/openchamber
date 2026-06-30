# openchamber-k3s-deploy - Work Plan

## TL;DR (For humans)

**What you'll get:** A personal fork of OpenChamber on GitHub (`gthieleb/openchamber`) that packages your gh-CLI-patched image, pushes it to GitHub Container Registry, and runs it on your k3s host `k3s` with persistent local storage and your existing provider/GitHub auth tokens. OpenChamber is exposed privately over Tailscale via a Tailscale Ingress at `https://openchamber.tail6a9722.ts.net`.

**Why this approach:** Forking first keeps upstream cleanly separate while preserving your Dockerfile patch and setup docs in version control. GHCR is free for public packages and works with your existing `gh` token. A local-path PVC avoids fragile `hostPath` mounts, and the Tailscale Ingress gives automatic MagicDNS + HTTPS without exposing anything publicly.

**What it will NOT do:** It will not expose OpenChamber to the public internet, will not keep auth files in sync automatically after the initial copy, and will not build an ARM image.

**Effort:** Medium
**Risk:** Medium - depends on the Tailscale Operator already being installed; storage provisioning and copying sensitive auth files correctly are the main risks.
**Decisions to sanity-check:** Fork remote naming, Tailscale MagicDNS hostname `openchamber.tail6a9722.ts.net`, initial one-time auth copy vs ongoing sync, image tag `latest`.

Your next move: approve this plan, then execution can begin. Full execution detail follows below.

---

> TL;DR (machine): Medium effort, medium risk; deliver fork + GHCR image + k3s Deployment with local-storage PVC, imagePullSecret, and Tailscale Ingress at `openchamber.tail6a9722.ts.net`.

## Scope
### Must have
1. GitHub fork `gthieleb/openchamber` exists and local repo pushes to it.
2. Local customizations (Dockerfile patch, SETUP.md, docker-compose.override.yml) committed to the fork.
3. Docker image built and pushed to `ghcr.io/gthieleb/openchamber:latest`.
4. k3s namespace `openchamber` exists.
5. `imagePullSecret` for ghcr.io exists in namespace `openchamber`.
6. `local-path` PVC `openchamber-data` exists and is bound.
7. Auth files copied from current host into the provisioned volume path on k3s node.
8. Deployment, ClusterIP Service, and Tailscale Ingress applied; Pod reaches Ready.
9. Health endpoint reachable via `https://openchamber.tail6a9722.ts.net/health`.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- No modifications to OpenChamber application source code.
- No public Ingress or public TLS termination.
- No multi-arch image build.
- No migration from existing Docker Compose state.
- No automated auth-file sync sidecar (initial copy only).
- No secrets committed to Git.
- No NodePort or LoadBalancer service; access is Tailscale-only.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after / smoke tests
- Evidence: `.omo/evidence/task-<N>-openchamber-k3s-deploy.<ext>`
- Every todo ends with an exact `kubectl`, `curl`, or `docker` command that proves success.

## Execution strategy
**Execution Skill:** `subagent-driven-development`

Work is split into sequential waves because each wave depends on the previous one (fork → image → cluster resources → deploy). Within a wave, independent tasks can run in parallel via subagents.

### Parallel execution waves
- **Wave 1: Fork & commit** - Create fork, adjust remotes, commit customizations.
- **Wave 2: Build & push image** - Build Docker image, push to GHCR, verify package.
- **Wave 3: k3s prerequisites** - SSH to k3s, create namespace, pull secret, PVC, copy auth files.
- **Wave 4: Deploy & verify** - Apply manifests (Deployment, ClusterIP Service, Tailscale Ingress), wait for rollout, verify via Tailscale MagicDNS.

**Prerequisite:** The Tailscale Kubernetes Operator must already be installed on k3s and the `tailscale` IngressClass must exist. This is covered by the separate `qnap-k3s-tailscale-operator` plan.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1.1 Fork repo | - | 1.2, 2.1 | - |
| 1.2 Commit customizations | 1.1 | 2.1 | - |
| 2.1 Build image | 1.2 | 2.2 | - |
| 2.2 Push image | 2.1 | 4.1 | 3.1, 3.2, 3.3 |
| 3.1 Create namespace | - | 3.2, 3.3 | - |
| 3.2 Create pull secret | 3.1 | 4.1 | 3.3 |
| 3.3 Create PVC & copy auth | 3.1 | 4.1 | 3.2 |
| 4.1 Apply manifests | 2.2, 3.2, 3.3 | 4.2 | - |
| 4.2 Verify deployment | 4.1 | - | - |

## Todos

### Wave 1: Fork & commit

- [ ] 1.1. Create GitHub fork and adjust local remotes
  What to do / Must NOT do: Fork `openchamber/openchamber` to `gthieleb/openchamber` on GitHub. Add remote `upstream` pointing to original and rewrite `origin` to the fork. Do NOT force-push or rewrite history.
  Parallelization: Wave 1 | Blocked by: - | Blocks: 1.2, 2.1
  References (executor has NO interview context - be exhaustive): `git remote -v` current output; GitHub fork API via `gh repo fork openchamber/openchamber --remote=true --remote-name=origin --default-branch-only=false`.
  Acceptance criteria (agent-executable):
  - `git remote -v` shows `origin https://github.com/gthieleb/openchamber.git (fetch)` and `upstream https://github.com/openchamber/openchamber.git (fetch)`.
  - `git fetch origin` succeeds.
  QA scenarios (name the exact tool + invocation): happy: `gh repo view gthieleb/openchamber --json url`; failure: fork already exists → `gh repo view gthieleb/openchamber` succeeds and remotes are still adjusted. Evidence `.omo/evidence/task-1.1-openchamber-k3s-deploy.txt`.
  Commit: N | -

- [ ] 1.2. Commit local customizations to fork
  What to do / Must NOT do: Stage `Dockerfile`, `SETUP.md`, `docker-compose.override.yml` and commit with a descriptive message. Leave `.env` unstaged/ignored. Do NOT commit `.env`.
  Parallelization: Wave 1 | Blocked by: 1.1 | Blocks: 2.1
  References: `Dockerfile:22-42` gh CLI patch; `SETUP.md`; `docker-compose.override.yml`; `.gitignore` includes `.env`.
  Acceptance criteria (agent-executable):
  - `git status --short` shows no modified `Dockerfile`/`SETUP.md`/`docker-compose.override.yml` and `.env` is still ignored.
  - `git log --oneline -1` shows the commit.
  - `git push origin main` succeeds.
  QA scenarios: happy: `git ls-remote origin HEAD` matches local HEAD; failure: push rejected → pull with `--rebase` and retry. Evidence `.omo/evidence/task-1.2-openchamber-k3s-deploy.txt`.
  Commit: Y | `chore(deploy): add gh CLI patch, setup docs and compose override for k3s deployment`

### Wave 2: Build & push image

- [ ] 2.1. Build Docker image for amd64
  What to do / Must NOT do: Run `docker buildx build --platform linux/amd64 -t ghcr.io/gthieleb/openchamber:latest .` (or `docker build` if buildx unavailable). Do NOT use cache-busting flags unless needed.
  Parallelization: Wave 2 | Blocked by: 1.2 | Blocks: 2.2
  References: `Dockerfile`; root `package.json` `scripts.build:web`.
  Acceptance criteria (agent-executable):
  - `docker images ghcr.io/gthieleb/openchamber:latest` lists the image.
  - `docker run --rm ghcr.io/gthieleb/openchamber:latest gh --version` prints a version.
  QA scenarios: happy: image builds and `gh --version` works; failure: build fails due to network → retry with `--progress=plain` and capture logs. Evidence `.omo/evidence/task-2.1-openchamber-k3s-deploy.txt`.
  Commit: N | -

- [ ] 2.2. Push image to GHCR
  What to do / Must NOT do: `docker push ghcr.io/gthieleb/openchamber:latest`. Ensure `gh auth token` can authenticate Docker to GHCR (`echo $CR_PAT | docker login ghcr.io -u gthieleb --password-stdin`). Do NOT log the token.
  Parallelization: Wave 2 | Blocked by: 2.1 | Blocks: 4.1
  References: `gh auth status` already shows logged-in user `gthieleb`.
  Acceptance criteria (agent-executable):
  - `docker push ghcr.io/gthieleb/openchamber:latest` succeeds.
  - `gh api /users/gthieleb/packages/container/openchamber` returns package metadata.
  QA scenarios: happy: push succeeds and package is visible; failure: 403 → verify package visibility is public or token has `write:packages`. Evidence `.omo/evidence/task-2.2-openchamber-k3s-deploy.txt`.
  Commit: N | -

### Wave 3: k3s prerequisites

- [ ] 3.1. Create k3s namespace
  What to do / Must NOT do: SSH to `k3s` as `gun` and run `kubectl create namespace openchamber` using kubeconfig at `/etc/rancher/k3s/k3s.yaml`. Do NOT overwrite an existing namespace.
  Parallelization: Wave 3 | Blocked by: - | Blocks: 3.2, 3.3
  References: user stated host is `k3s`; kubeconfig at `/etc/rancher/k3s/k3s.yaml`.
  Acceptance criteria (agent-executable):
  - `ssh gun@k3s 'KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl get namespace openchamber -o jsonpath={.metadata.name}'` returns `openchamber`.
  QA scenarios: happy: namespace created; failure: already exists → idempotent, verify it exists. Evidence `.omo/evidence/task-3.1-openchamber-k3s-deploy.txt`.
  Commit: N | -

- [ ] 3.2. Create ghcr.io imagePullSecret
  What to do / Must NOT do: On `k3s` host, create secret `ghcr-pull-secret` in namespace `openchamber` using `kubectl create secret docker-registry`. Use token from local `gh auth token`. Do NOT store the token in Git or evidence files.
  Parallelization: Wave 3 | Blocked by: 3.1 | Blocks: 4.1
  References: GHCR authentication docs; `gh auth token` output.
  Acceptance criteria (agent-executable):
  - `ssh gun@k3s 'KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl get secret ghcr-pull-secret -n openchamber -o jsonpath={.type}'` returns `kubernetes.io/dockerconfigjson`.
  QA scenarios: happy: secret created; failure: token expired → renew via `gh auth refresh` and recreate. Evidence `.omo/evidence/task-3.2-openchamber-k3s-deploy.txt` (redact token).
  Commit: N | -

- [ ] 3.3. Create PVC and copy auth files into provisioned volume
  What to do / Must NOT do: Apply a `local-path` PVC named `openchamber-data` in namespace `openchamber`. Identify the host directory k3s provisioned, then copy `~/.local/share/opencode/auth.json`, `auth-v2.json`, `account.json`, `mcp-auth.json`, and `~/.config/gh/hosts.yml` into it. Set ownership to 1000:1000. Do NOT copy `opencode.db` or other large runtime files.
  Parallelization: Wave 3 | Blocked by: 3.1 | Blocks: 4.1
  References: `SETUP.md:48-63` documents the 4 auth files and gh hosts.yml; container user UID/GID 1000 from `Dockerfile:46-49`.
  Acceptance criteria (agent-executable):
  - PVC `openchamber-data` shows `Bound`.
  - On k3s node, `ls -la <provisioned-path>` shows the 5 files owned by 1000:1000.
  - `ssh gun@k3s 'KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl get pvc openchamber-data -n openchamber -o jsonpath={.status.phase}'` returns `Bound`.
  QA scenarios: happy: files present and PVC bound; failure: `local-path` not available → check `kubectl get storageclass` and annotate default if needed. Evidence `.omo/evidence/task-3.3-openchamber-k3s-deploy.txt` (redact file contents).
  Commit: N | -

### Wave 4: Deploy & verify

- [ ] 4.1. Apply Deployment, Service, and Tailscale Ingress manifests
  What to do / Must NOT do: Create `k8s/openchamber-deployment.yaml`, `k8s/openchamber-service.yaml`, and `k8s/openchamber-ingress.yaml` in the repo. Deployment uses image `ghcr.io/gthieleb/openchamber:latest`, pull secret, env `OPENCHAMBER_UI_PASSWORD` from a secret, mounts PVC at `/home/openchamber/.config/openchamber` and `/home/openchamber/.local/share/opencode` subPaths. Service is `ClusterIP` on port 3000. Ingress uses `ingressClassName: tailscale` and host `openchamber.tail6a9722.ts.net`. Apply with `kubectl apply -f k8s/`. Do NOT hardcode the password in the manifest; do NOT use NodePort or LoadBalancer.
  Parallelization: Wave 4 | Blocked by: 2.2, 3.2, 3.3 and Tailscale Operator ready | Blocks: 4.2
  References: `Dockerfile:64-77` env/entrypoint; `scripts/docker-entrypoint.sh:44-51,68-81`; `packages/web/bin/cli.js` serve entry; Tailscale Ingress docs.
  Acceptance criteria (agent-executable):
  - `kubectl apply -f k8s/` succeeds.
  - `kubectl get deployment openchamber -n openchamber` shows `1/1` ready.
  - `kubectl get svc openchamber -n openchamber -o jsonpath='{.spec.type}'` returns `ClusterIP`.
  - `kubectl get ingress openchamber -n openchamber -o jsonpath='{.spec.ingressClassName}'` returns `tailscale`.
  QA scenarios: happy: Pod starts and reaches Running/Ready; failure: ImagePullBackOff → verify pull secret and GHCR package visibility. Evidence `.omo/evidence/task-4.1-openchamber-k3s-deploy.txt`.
  Commit: Y | `feat(deploy): add k3s deployment, service and tailscale ingress manifests`

- [ ] 4.2. Verify health endpoint over Tailscale
  What to do / Must NOT do: From a machine connected to the tailnet, `curl -I https://openchamber.tail6a9722.ts.net/health` and expect HTTP 200. Verify the Tailscale Ingress has registered a device. Do NOT run automated login with password in logs.
  Parallelization: Wave 4 | Blocked by: 4.1 | Blocks: -
  References: OpenChamber exposes health endpoint on `/health`; Tailscale operator provisions HTTPS automatically.
  Acceptance criteria (agent-executable):
  - `curl -s -o /dev/null -w '%{http_code}' https://openchamber.tail6a9722.ts.net/health` prints `200`.
  - `kubectl logs -n openchamber deployment/openchamber --tail=50` shows no fatal errors.
  - `tailscale status` shows a new device for the `openchamber` ingress.
  QA scenarios: happy: 200 OK and stable logs; failure: DNS not resolving → verify MagicDNS is enabled and the ingress hostname matches. Evidence `.omo/evidence/task-4.2-openchamber-k3s-deploy.txt`.
  Commit: N | -

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit
- [ ] F2. Code quality review
- [ ] F3. Real manual QA
- [ ] F4. Scope fidelity

## Commit strategy
- Fork creation is a GitHub-side operation; no local commit needed for it.
- Local customizations commit: one commit on `main` after fork.
- k8s manifests: one commit on `main` after manifests are written.
- Push after each commit.
- `.env` and any tokens must never be committed.

## Success criteria
1. `gthieleb/openchamber` fork exists and `main` branch contains the Dockerfile patch, SETUP.md, and k8s manifests.
2. `ghcr.io/gthieleb/openchamber:latest` is pullable from k3s.
3. k3s namespace `openchamber` has pull secret, PVC, Deployment, ClusterIP Service, and Tailscale Ingress.
4. Pod is Ready and `https://openchamber.tail6a9722.ts.net/health` returns HTTP 200.
5. No secrets are committed to Git.
