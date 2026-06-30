# OpenChamber Setup — gthieleb / ubuntu-8gb-hel1-1

Selbstgehostete OpenChamber-Instanz für den OpenCode AI Agenten.
Auth via gh CLI (kein SSH), Netzwerkzugriff über Tailscale + localhost.

## Zugriff

| Von | URL | Hinweis |
|-----|-----|---------|
| Host selbst | `http://localhost:3001` | für Wartung |
| Tailscale-Clients (Handy/Win/Linux) | `http://ubuntu-8gb-hel1-1:3001` | MagicDNS-Kurzname |
| Tailscale-Clients (Fallback) | `http://ubuntu-8gb-hel1-1.tail6a9722.ts.net:3001` | voller Name |

**UI-Passwort:** siehe `.env` (Präfix `tO10...`).

**Öffentliche IP / anderer Host:** nicht erreichbar (bewusst).

## Setup-Übersicht

```
~/openchamber/
├── .git/                           # upstream openchamber/openchamber
├── Dockerfile                      # gepatcht: +curl, +gh CLI (v2.95.0)
├── docker-compose.yml              # original (unangetastet)
├── docker-compose.override.yml     # unsere Customizations
├── .env                            # TAILSCALE_IP + OPENCHAMBER_UI_PASSWORD
├── data/                           # gitignored
│   ├── openchamber/                # UI-Config, JWT, Logs
│   ├── opencode/{share,state,config}/
│   ├── gh/hosts.yml                # gh Token (chmod 600)
│   └── ssh/                        # leer (gh-only Setup)
└── workspaces/                     # geklonte Repos landen hier
```

## GitHub-Authentifizierung

- **Methode:** gh CLI mit Token aus `~/.config/gh/hosts.yml` (Account: gthieleb)
- **Token-Quelle am Host:** `/home/gun/.config/gh/hosts.yml` → kopiert nach `data/gh/hosts.yml`
- **Git-Protocol:** HTTPS (kein SSH)
- **Credential Helper:** `gh auth git-credential` (via `gh auth setup-git` verkabelt)
- **Scopes:** `gist, project, read:org, repo, workflow`

Clone-Beispiel im Container:
```bash
git clone https://github.com/<owner>/<repo>.git /home/openchamber/workspaces/<name>
```

## Provider-Auth via Host-Mount

Damit der Container-OpenCode die Provider-Tokens (OpenAI, Anthropic, Google, etc.) vom Host-OpenCode mitnutzen kann, sind **4 Auth-Dateien als Read-Write-Mount** durchgereicht:

| Host-Pfad | Container-Pfad | Zweck |
|-----------|----------------|-------|
| `/home/gun/.local/share/opencode/auth.json` | `/home/openchamber/.local/share/opencode/auth.json` | Provider-API-Keys (Anthropic, Google, ZAI, ...) |
| `/home/gun/.local/share/opencode/auth-v2.json` | `/home/openchamber/.local/share/opencode/auth-v2.json` | Neue Auth-Variante |
| `/home/gun/.local/share/opencode/account.json` | `/home/openchamber/.local/share/opencode/account.json` | Account-Metadaten |
| `/home/gun/.local/share/opencode/mcp-auth.json` | `/home/openchamber/.local/share/opencode/mcp-auth.json` | MCP-Server-Tokens |

### Konsequenzen
- Beide OpenCode-Instanzen (Host + Container) nutzen **dieselben 11 Credentials** (Stand 22.06.2026)
- Token-Refresh durch eine Instanz aktualisiert die Datei für beide
- Race-Condition bei gleichzeitigem Refresh: akzeptiert (Dateien sind klein, ms-Schreibdauer)
- Die 4.6 GB SQLite-DB vom Host bleibt **unangetastet** – der Container hat seine eigene DB

### Verifizieren
```bash
docker compose exec openchamber /home/openchamber/.npm-global/bin/opencode auth list
# Erwartet: 11 credentials (Anthropic, ZAI, Google, OpenAI, ...)
```

### Was NICHT gemountet wird (bewusst)
- `opencode.db` (4.6 GB) – SQLite-Concurrent-Access mit Host-OC wäre riskant
- `snapshot/`, `tool-output/`, `repos/`, `log/` – Runtime-State bleibt pro Instanz
- `~/.config/opencode/` – Container hat eigene `opencode.jsonc` Config

## Operations

### Status
```bash
cd ~/openchamber
docker compose ps
docker compose logs -f openchamber
```

### Stop / Start / Restart
```bash
docker compose stop
docker compose start
docker compose restart
```

### Update (Image neu bauen nach upstream-Änderung)
```bash
cd ~/openchamber
git pull                                   # upstream holen
# Dockerfile-Patch sichern, falls Konflikt:
git status
docker compose build                       # ~10-15 Min
docker compose up -d                       # Container erneuern
docker compose exec openchamber gh auth status    # prüfen, dass Token noch da
```

> **Dockerfile-Patch:** Der gh-CLI-Block ist als separater `RUN`-Layer zwischen dem Original-apt-Block und dem `userdel/useradd`-Schritt. Bei Merge-Konflikten: einfach den Block in den neuen Dockerfile-Stand wieder einfügen. Patch-Datei als Referenz:
> ```
> RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
>       -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
>  && chmod a+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
>  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
>       > /etc/apt/sources.list.d/github-cli.list \
>  && apt-get update \
>  && apt-get install -y --no-install-recommends gh \
>  && rm -rf /var/lib/apt/lists/*
> ```

### Token-Rotation (gh PAT läuft ab)
1. Neuen Token in GitHub Settings erzeugen: https://github.com/settings/tokens
2. Token-Datei am Host aktualisieren:
   ```bash
   gh auth login        # interaktiv, oder manuell hosts.yml editieren
   ```
3. Token in Container durchreichen:
   ```bash
   cp ~/.config/gh/hosts.yml ~/openchamber/data/gh/hosts.yml
   chmod 600 ~/openchamber/data/gh/hosts.yml
   chown 1000:1000 ~/openchamber/data/gh/hosts.yml
   ```
4. Container muss NICHT restarted werden (Volume-Mount ist live).

### Backup
Kompletter Zustand in `~/openchamber/data/`. Sichern mit:
```bash
restic backup ~/openchamber/data ~/openchamber/workspaces
```
oder simpler tarball:
```bash
tar czf openchamber-backup-$(date +%Y%m%d).tar.gz ~/openchamber/data ~/openchamber/workspaces
```

## Architektur (Referenz)

- **Container-User:** `openchamber` (UID/GID 1000:1000)
- **Container-Port (intern):** 3000
- **Host-Ports (published):** 127.0.0.1:3001 + 100.108.41.111:3001
- **OpenCode-Server:** verwaltet durch OpenChamber, lauscht intern auf dynamischem Port (z. B. 46667)
- **Tailscale-IP:** 100.108.41.111 (`ubuntu-8gb-hel1-1`)
- **MagicDNS-Suffix:** `tail6a9722.ts.net`

## Troubleshooting

### Container startet nicht / Port-Konflikt
```bash
ss -tlnp | grep 3001
```
Wenn belegt: anderen Port in `docker-compose.override.yml` und `.env` (falls Referenz) wählen.

### gh auth schlägt fehl ("token invalid")
Token in `data/gh/hosts.yml` ist abgelaufen. Siehe "Token-Rotation" oben.

### Push schlägt fehl ("Author identity unknown")
Wurde nur einmalig beim Setup gesetzt. Falls verloren:
```bash
docker compose exec openchamber bash -c "\
  git config --global user.name 'Gunnar Thielebein' && \
  git config --global user.email 'gthielebein@users.noreply.github.com'"
```

### Tailscale down → kein Zugriff
Lokal immer noch via `http://localhost:3001` erreichbar (Wartungs-Bind).

### Logs des OpenCode-Servers
```bash
docker compose exec openchamber cat /home/openchamber/.config/openchamber/logs/openchamber-3000.log
```

## Entfernen / Reset

```bash
cd ~/openchamber
docker compose down -v        # Container + Volumes entfernen
docker rmi openchamber-openchamber
# Daten behalten für Re-Setup, sonst:
# rm -rf ~/openchamber/data ~/openchamber/workspaces
```

## Lizenz & Credits

- **OpenChamber:** MIT, upstream https://github.com/openchamber/openchamber
- **gh CLI:** MIT, https://github.com/cli/cli
- Dieses Setup: gthieleb, Juni 2026
