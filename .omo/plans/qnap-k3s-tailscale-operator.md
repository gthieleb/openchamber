# qnap-k3s-tailscale-operator - Work Plan

## TL;DR (For humans)

**What you'll get:** The Tailscale Kubernetes Operator installed on your k3s cluster via Helm, with all configuration stored as versioned code in `gthieleb/qnap-k3s`. Once running, it lets you expose services like OpenChamber through a Tailscale Ingress with automatic MagicDNS names and HTTPS.

**Why this approach:** Helm keeps upgrades simple and repeatable. Putting the values and install script in `qnap-k3s` makes the cluster setup reproducible, just like the existing Traefik and cert-manager configuration.

**What it will NOT do:** It will not create the OAuth client for you (that requires the Tailscale admin console), it will not expose services to the public internet, and it will not replace your existing Traefik ingresses.

**Effort:** Short
**Risk:** Low - the operator is a well-tested upstream chart; the only manual step is creating the OAuth client.
**Decisions to sanity-check:** Operator namespace `tailscale`; installing via Helm values file vs inline `--set`; whether to expose the Kubernetes API server over Tailscale.

Your next move: approve this plan, then start execution. Full execution detail follows below.

---

> TL;DR (machine): Short effort, low risk; install Tailscale Kubernetes Operator on k3s via Helm with versioned config in gthieleb/qnap-k3s.

## Scope
### Must have
1. Directory structure for Helm values and install scripts in `gthieleb/qnap-k3s`.
2. `helm-values/tailscale-operator-values.yaml` with non-sensitive configuration.
3. `scripts/install-tailscale-operator.sh` that creates the OAuth secret and installs/upgrades the operator.
4. `scripts/uninstall-tailscale-operator.sh` for clean removal.
5. `k8s-manifests/tailscale-operator/namespace.yaml` or rely on Helm `--create-namespace`.
6. README update documenting prerequisites (OAuth client, ACL tags), install steps, and verification commands.
7. Operator installed on k3s and verified running.
8. `tailscale` IngressClass available in the cluster.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- No OAuth credentials or secrets committed to Git.
- No custom operator image unless required.
- No replacement of existing Traefik `letsencrypt-prod` / `letsencrypt-dns` ingresses.
- No public exposure through FritzBox.
- No OpenChamber deployment in this plan (separate follow-up plan).

## Verification strategy
> Zero human intervention - all verification is agent-executed after the manual OAuth creation step.
- Test decision: tests-after / smoke tests
- Evidence: `.omo/evidence/task-<N>-qnap-k3s-tailscale-operator.<ext>`
- Each todo ends with exact `kubectl`, `helm`, or `tailscale status` commands that prove success.

## Execution strategy
**Execution Skill:** `subagent-driven-development`

Sequential waves because the operator install depends on the prepared config and script.

### Parallel execution waves
- **Wave 1: Prepare repo artifacts** - Create values file, install/uninstall scripts, README section.
- **Wave 2: Install and verify** - Run install script on k3s, check operator pod, IngressClass, and tailnet device.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1.1 Create values file | - | 1.2, 1.3 | - |
| 1.2 Create install script | 1.1 | 2.1 | 1.3 |
| 1.3 Create uninstall script | 1.1 | - | 1.2 |
| 1.4 Update README | 1.1, 1.2 | 2.1 | 1.3 |
| 2.1 Install operator | 1.2, 1.4 | 2.2 | - |
| 2.2 Verify operator | 2.1 | F1-F4 | - |

## Todos

### Wave 1: Prepare repo artifacts

- [ ] 1.1. Create `helm-values/tailscale-operator-values.yaml`
  What to do / Must NOT do: Add a Helm values file for the upstream `tailscale-operator` chart with sensible defaults for k3s. Include only non-sensitive settings such as `operatorConfig.hostname`, `operatorConfig.defaultTags`, `operatorConfig.logging`, and `ingressClass.enabled`. Leave `oauth.clientId` and `oauth.clientSecret` empty; credentials are supplied via a pre-created Kubernetes Secret. Do NOT put real credentials in this file.
  Parallelization: Wave 1 | Blocked by: - | Blocks: 1.2, 1.3, 1.4
  References (executor has NO interview context - be exhaustive):
    - `tailscale/tailscale/cmd/k8s-operator/deploy/chart/values.yaml` — upstream defaults.
    - Tailscale docs: https://tailscale.com/kb/1236/kubernetes-operator and https://tailscale.com/docs/kubernetes-operator/install-operator.
    - `qnap-k3s/README.md:1-189` — existing cluster documentation style.
  Acceptance criteria (agent-executable):
    - `helm-values/tailscale-operator-values.yaml` exists and passes `yamllint`.
    - `grep -E 'clientId|clientSecret' helm-values/tailscale-operator-values.yaml` shows empty/default placeholders only.
    - `helm show values tailscale/tailscale-operator | head -20` works after repo add.
  QA scenarios (name the exact tool + invocation): happy + failure, Evidence `.omo/evidence/task-1.1-qnap-k3s-tailscale-operator.txt`
    - Happy: `yamllint -c .yamllint helm-values/tailscale-operator-values.yaml` passes.
    - Failure: YAML indentation error → `yamllint` reports the line.
  Commit: Y | `feat(tailscale): add operator Helm values for k3s`

- [ ] 1.2. Create `scripts/install-tailscale-operator.sh`
  What to do / Must NOT do: Write an idempotent install script that:
    1. Adds the Tailscale Helm repo and updates it.
    2. Creates namespace `tailscale` if missing.
    3. Creates the `operator-oauth` secret from environment variables `TS_OAUTH_CLIENT_ID` and `TS_OAUTH_CLIENT_SECRET` (fails if missing).
    4. Runs `helm upgrade --install tailscale-operator tailscale/tailscale-operator --namespace tailscale -f helm-values/tailscale-operator-values.yaml --wait`.
  Do NOT hardcode credentials in the script.
  Parallelization: Wave 1 | Blocked by: 1.1 | Blocks: 2.1
  References:
    - Tailscale install docs: https://tailscale.com/docs/kubernetes-operator/install-operator.
    - `qnap-k3s/inventory.yml:11-19` — k3s host and user context.
  Acceptance criteria (agent-executable):
    - Script is executable (`chmod +x`).
    - `shellcheck scripts/install-tailscale-operator.sh` passes or has no errors (warnings allowed if justified).
    - Script exits non-zero if `TS_OAUTH_CLIENT_ID` or `TS_OAUTH_CLIENT_SECRET` is unset.
  QA scenarios (name the exact tool + invocation): happy + failure, Evidence `.omo/evidence/task-1.2-qnap-k3s-tailscale-operator.txt`
    - Happy: `shellcheck scripts/install-tailscale-operator.sh` returns no errors.
    - Failure: Run with missing env vars → script exits with code 1 and clear message.
  Commit: Y | `feat(tailscale): add idempotent operator install script`

- [ ] 1.3. Create `scripts/uninstall-tailscale-operator.sh`
  What to do / Must NOT do: Write a script that uninstalls the Helm release and optionally deletes the namespace and OAuth secret. Must prompt or require `--force` before deleting namespace to avoid accidental data loss. Do NOT delete other namespaces.
  Parallelization: Wave 1 | Blocked by: 1.1 | Blocks: -
  References:
    - Helm uninstall behavior.
  Acceptance criteria (agent-executable):
    - Script is executable.
    - `shellcheck` passes (no errors).
    - Without `--force`, namespace deletion is skipped.
  QA scenarios (name the exact tool + invocation): happy + failure, Evidence `.omo/evidence/task-1.3-qnap-k3s-tailscale-operator.txt`
    - Happy: `./scripts/uninstall-tailscale-operator.sh --force` removes release and namespace (verified in dry-run or actual run).
    - Failure: Run without `--force` → namespace deletion skipped, message printed.
  Commit: Y | `feat(tailscale): add operator uninstall script`

- [ ] 1.4. Update `README.md` with Tailscale Operator section
  What to do / Must NOT do: Add a section to `qnap-k3s/README.md` describing:
    - What the Tailscale Operator provides.
    - Prerequisites: create OAuth client in Tailscale admin console with scopes `General/Services`, `Devices/Core`, `Keys/Auth Keys` all tagged `tag:k8s-operator`; ensure ACL `tagOwners` grants `tag:k8s-operator` to itself.
    - Install command: `TS_OAUTH_CLIENT_ID=... TS_OAUTH_CLIENT_SECRET=... ./scripts/install-tailscale-operator.sh`.
    - Verify commands.
  Do NOT include example real credentials.
  Parallelization: Wave 1 | Blocked by: 1.1, 1.2 | Blocks: 2.1
  References:
    - `qnap-k3s/README.md` current structure and tone.
    - Tailscale OAuth setup docs.
  Acceptance criteria (agent-executable):
    - `grep -i 'tailscale operator' README.md` finds the new section.
    - Markdown table of contents or headings are consistent.
  QA scenarios (name the exact tool + invocation): happy + failure, Evidence `.omo/evidence/task-1.4-qnap-k3s-tailscale-operator.txt`
    - Happy: `markdownlint README.md` passes (or manual heading check).
    - Failure: Broken internal link → grep shows no matching anchor.
  Commit: Y | `docs(qnap-k3s): document Tailscale Operator setup`

### Wave 2: Install and verify

- [ ] 2.1. Install Tailscale Operator on k3s
  What to do / Must NOT do: On the k3s host (or from the control machine with `KUBECONFIG=~/.kube/qnap-k3s`), run the install script with the OAuth client credentials. Wait for Helm release to become deployed. Do NOT log the credentials.
  Parallelization: Wave 2 | Blocked by: 1.2, 1.4 | Blocks: 2.2
  References:
    - `scripts/install-tailscale-operator.sh` from Todo 1.2.
    - `~/.kube/qnap-k3s` kubeconfig context.
  Acceptance criteria (agent-executable):
    - `helm list -n tailscale` shows `tailscale-operator` with status `deployed`.
    - `kubectl get pods -n tailscale` shows the operator Pod in `Running` state.
  QA scenarios (name the exact tool + invocation): happy + failure, Evidence `.omo/evidence/task-2.1-qnap-k3s-tailscale-operator.txt`
    - Happy: `kubectl wait --for=condition=Ready pod -l app=tailscale-operator -n tailscale --timeout=120s` succeeds.
    - Failure: OAuth secret missing → Pod in `CrashLoopBackOff`; logs show OAuth error.
  Commit: N | Runtime operation; no repo commit.

- [ ] 2.2. Verify Tailscale network registration and IngressClass
  What to do / Must NOT do: Verify that the operator registered a device on the tailnet and that the `tailscale` IngressClass exists. Optionally verify the Kubernetes API server proxy if configured. Do NOT expose the API proxy unless explicitly requested.
  Parallelization: Wave 2 | Blocked by: 2.1 | Blocks: F1-F4
  References:
    - Tailscale operator verification docs.
  Acceptance criteria (agent-executable):
    - `kubectl get ingressclass tailscale` returns an IngressClass with controller `tailscale.com/ingress-controller`.
    - `tailscale status` on a tailnet device shows a new machine named like `tailscale-operator` (or configured hostname).
    - `kubectl get pods -n tailscale` shows no restarts.
  QA scenarios (name the exact tool + invocation): happy + failure, Evidence `.omo/evidence/task-2.2-qnap-k3s-tailscale-operator.txt`
    - Happy: `kubectl get ingressclass tailscale -o jsonpath='{.spec.controller}'` prints `tailscale.com/ingress-controller`.
    - Failure: IngressClass missing → `helm upgrade` was not run with default values; rerun install script.
  Commit: N | Runtime operation; no repo commit.

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit
  - Verify every Must-have is implemented and every Must-NOT-have respected.
  - Tool: file existence checks and `grep`.
  - Evidence: `.omo/evidence/f1-qnap-k3s-tailscale-operator.txt`
- [ ] F2. Code quality review
  - Run `yamllint` on the values file and `shellcheck` on both scripts.
  - Tool: `yamllint`, `shellcheck`.
  - Evidence: `.omo/evidence/f2-qnap-k3s-tailscale-operator.txt`
- [ ] F3. Real manual QA
  - Confirm operator Pod is Ready, `tailscale` IngressClass exists, and a test Ingress reconciles.
  - Tool: `kubectl` + `tailscale status`.
  - Evidence: `.omo/evidence/f3-qnap-k3s-tailscale-operator.txt`
- [ ] F4. Scope fidelity
  - Confirm no secrets committed to `qnap-k3s` and no changes to existing Traefik/cert-manager setup.
  - Tool: `git status`, `git diff`.
  - Evidence: `.omo/evidence/f4-qnap-k3s-tailscale-operator.txt`

## Commit strategy
- One commit per Wave 1 todo.
- Push Wave 1 commits to `origin/main` after QA passes.
- Wave 2 is runtime execution; no repo commit except evidence files.

## Success criteria
- [ ] `helm-values/tailscale-operator-values.yaml` exists and is lint-clean.
- [ ] `scripts/install-tailscale-operator.sh` and `scripts/uninstall-tailscale-operator.sh` exist and pass `shellcheck`.
- [ ] `README.md` documents the Tailscale Operator setup including OAuth prerequisites.
- [ ] `tailscale-operator` Helm release is `deployed` in namespace `tailscale`.
- [ ] Operator Pod is Ready and `tailscale` IngressClass exists.
- [ ] No OAuth credentials are committed to the repository.
