---
slug: qnap-k3s-tailscale-operator
status: awaiting-approval
intent: clear
pending-action: write .omo/plans/qnap-k3s-tailscale-operator.md
approach: Add Helm values, install/uninstall scripts, and README docs for Tailscale Kubernetes Operator in gthieleb/qnap-k3s; install on k3s and verify IngressClass.
---

# Draft: qnap-k3s-tailscale-operator

## Components (topology ledger)
| id | outcome | status | evidence path |
|---|---|---|---|
| values | `helm-values/tailscale-operator-values.yaml` committed | active | `.omo/evidence/task-1.1-*.txt` |
| install-script | `scripts/install-tailscale-operator.sh` committed | active | `.omo/evidence/task-1.2-*.txt` |
| uninstall-script | `scripts/uninstall-tailscale-operator.sh` committed | active | `.omo/evidence/task-1.3-*.txt` |
| docs | README.md section added | active | `.omo/evidence/task-1.4-*.txt` |
| operator-installed | `tailscale-operator` deployed on k3s | active | `.omo/evidence/task-2.1-*.txt` |
| verified | `tailscale` IngressClass exists and operator registered | active | `.omo/evidence/task-2.2-*.txt` |

## Open assumptions (announced defaults)
| assumption | adopted default | rationale | reversible? |
|---|---|---|---|
| install method | Helm via upstream chart | user requested Helm, same style as mcp-setup | yes |
| operator namespace | `tailscale` | upstream default and standard convention | yes |
| credentials supply | pre-create Kubernetes Secret `operator-oauth` from env vars | avoids `--set` with secrets in shell history | yes |
| OAuth client creation | manual in Tailscale admin console | cannot be automated without API access | no (external) |
| default tags | `tag:k8s-operator` | upstream default and ACL docs | yes |
| expose k8s API | no | not needed for OpenChamber ingress | yes |

## Findings (cited - path:lines)
- qnap-k3s README documents cluster has Traefik, cert-manager, local-path provisioner: `qnap-k3s/README.md:1-189`.
- No Tailscale operator artifacts exist yet in qnap-k3s: `gh api search/code -q repo:gthieleb/qnap-k3s tailscale` returned no matches.
- mcp-setup uses Helm wrapper charts with `bjw-s/app-template`: `gthieleb/mcp-setup/README.md:62-79`.
- Tailscale operator install requires OAuth client with scopes: General/Services (tag:k8s-operator), Devices/Core (tag:k8s-operator), Keys/Auth Keys (tag:k8s-operator): Tailscale docs.
- Upstream Helm chart creates namespace `tailscale`, deployment `operator`, and IngressClass `tailscale`: Tailscale docs.

## Decisions (with rationale)
1. **Helm values file + install script pattern.** Matches existing `qnap-k3s` style (Ansible playbooks + k8s manifests) and mcp-setup's Helm approach. Versioned config, easy upgrades.
2. **OAuth secret created from environment variables.** Prevents credentials in shell history or Git. The script fails fast if env vars are missing.
3. **Do not expose Kubernetes API server proxy in this plan.** OpenChamber only needs Ingress; API proxy can be added later if desired.
4. **Separate uninstall script with `--force` guard.** Prevents accidental namespace deletion but allows clean teardown.

## Scope IN
- Tailscale Operator Helm values file.
- Install/uninstall scripts.
- README documentation.
- Runtime installation on k3s.
- Verification of operator pod and IngressClass.

## Scope OUT (Must NOT have)
- OAuth client creation (manual admin-console step).
- Tailscale Ingress for OpenChamber (separate plan after operator is ready).
- Replacement or modification of Traefik/cert-manager.
- Public exposure.

## Open questions
- None. Defaults announced above; user can veto at approval.

## Approval gate
status: awaiting-approval
