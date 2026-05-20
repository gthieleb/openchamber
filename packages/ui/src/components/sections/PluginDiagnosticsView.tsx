import React from "react";
import { Icon } from "@/components/icon/Icon";
import type { IconName } from "@/components/icon/icons";
import { Button } from "@/components/ui/button";
import { ScrollableOverlay } from "@/components/ui/ScrollableOverlay";

interface PluginDiagnostic {
  id: string;
  name: string;
  version: string;
  description: string | null;
  source: "builtin" | "bundled" | "user";
  targets: string[];
  capabilities: string[];
  optionalCapabilities: string[];
  enabled: boolean;
  enabledByDefault: boolean;
  required: boolean;
  contributionCount: number;
  contributions: { type: string; id: string; phase: string | null; priority: number }[];
  setupErrors: { phase: string; error: string }[];
  status: "ready" | "error" | "disabled" | "pending" | "skipped";
  hasDangerousCapabilities?: boolean;
  path?: string;
  hasServerEntry?: boolean;
}

interface PluginDiagnosticsResponse {
  loadedAt: string;
  pluginCount: number;
  builtinCount: number;
  bundledCount: number;
  userLoadedCount?: number;
  userErrorCount?: number;
  contributionCount: number;
  plugins: PluginDiagnostic[];
}

const statusConfig: Record<string, { color: string; icon: IconName; label: string }> = {
  ready: { color: "var(--status-success)", icon: "check", label: "Ready" },
  error: { color: "var(--status-error)", icon: "alert", label: "Error" },
  disabled: { color: "var(--status-warning)", icon: "stop", label: "Disabled" },
  pending: { color: "var(--text-muted)", icon: "loader", label: "Pending" },
  skipped: { color: "var(--text-muted)", icon: "arrow-down-s", label: "Skipped" },
};

const sourceLabels: Record<string, string> = {
  builtin: "Built-in",
  bundled: "Bundled",
  user: "User",
};

const PluginCard: React.FC<{ plugin: PluginDiagnostic }> = ({ plugin }) => {
  const [expanded, setExpanded] = React.useState(false);
  const status = statusConfig[plugin.status] ?? statusConfig.ready;
  const hasErrors = plugin.setupErrors.length > 0;
  const isError = plugin.status === "error";

  return (
    <div
      className="rounded-lg border transition-colors"
      style={{
        borderColor: isError ? "var(--status-error-border)" : "var(--border-subtle)",
        backgroundColor: hasErrors ? "var(--status-error-background)" : "var(--surface-subtle)",
      }}
    >
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--surface-hover)] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <Icon
          name={status.icon}
          className="h-4 w-4 shrink-0"
          style={{ color: status.color }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="typography-ui-label font-medium text-foreground truncate">
              {plugin.name}
            </span>
            <span className="typography-meta text-muted-foreground">
              v{plugin.version}
            </span>
            {plugin.hasDangerousCapabilities && (
              <Icon name="shield-warning" className="h-3.5 w-3.5" style={{ color: "var(--status-warning)" }} />
            )}
          </div>
          <div className="flex items-center gap-2 typography-meta text-muted-foreground">
            <span>{sourceLabels[plugin.source] ?? plugin.source}</span>
            <span>·</span>
            <span>{plugin.contributionCount} contributions</span>
            {plugin.path && (
              <>
                <span>·</span>
                <span className="truncate max-w-[200px]">{plugin.path}</span>
              </>
            )}
          </div>
        </div>
        <Icon
          name={expanded ? "arrow-up-s" : "arrow-down-s"}
          className="h-4 w-4 text-muted-foreground shrink-0 transition-transform"
        />
      </button>

      {expanded && (
        <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: "var(--border-subtle)" }}>
          {plugin.description && (
            <p className="typography-meta text-muted-foreground">{plugin.description}</p>
          )}

          {hasErrors && (
            <div className="rounded-md border p-3 space-y-2" style={{ borderColor: "var(--status-error-border)", backgroundColor: "var(--surface-elevated)" }}>
              <div className="typography-ui-label font-medium" style={{ color: "var(--status-error)" }}>
                Setup Errors
              </div>
              {plugin.setupErrors.map((err, idx) => (
                <div key={idx} className="typography-meta text-muted-foreground">
                  <span className="text-foreground font-medium">[{err.phase}]</span> {err.error}
                </div>
              ))}
            </div>
          )}

          {plugin.capabilities.length > 0 && (
            <div>
              <div className="typography-ui-label font-medium text-foreground mb-2">Capabilities</div>
              <div className="flex flex-wrap gap-1.5">
                {plugin.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="typography-meta rounded-md px-2 py-1"
                    style={{ backgroundColor: "var(--surface-overlay)", color: "var(--text-muted)" }}
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          )}

          {plugin.contributions.length > 0 && (
            <div>
              <div className="typography-ui-label font-medium text-foreground mb-2">Contributions</div>
              <div className="space-y-1">
                {plugin.contributions.map((c, idx) => (
                  <div key={idx} className="typography-meta text-muted-foreground flex items-center gap-2">
                    <span className="text-foreground font-medium">{c.type}</span>
                    {c.phase && <span>→ {c.phase}</span>}
                    <span className="text-muted-foreground">({c.id})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 typography-meta text-muted-foreground pt-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
            <span>Targets: {plugin.targets.join(", ")}</span>
            {plugin.required && <span className="text-status-warning">· Required</span>}
            {!plugin.enabled && <span className="text-status-error">· Disabled</span>}
            {plugin.hasServerEntry && <span>· Has server entry</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export const PluginDiagnosticsView: React.FC = () => {
  const [data, setData] = React.useState<PluginDiagnosticsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | "error" | "user">("all");

  React.useEffect(() => {
    let cancelled = false;
    const fetchDiagnostics = async () => {
      try {
        const res = await fetch("/api/plugins", {
          method: "GET",
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load plugin diagnostics");
          setLoading(false);
        }
      }
    };
    void fetchDiagnostics();
    return () => { cancelled = true; };
  }, []);

  const filteredPlugins = React.useMemo(() => {
    if (!data) return [];
    let plugins = data.plugins;
    if (filter === "error") plugins = plugins.filter((p) => p.status === "error");
    if (filter === "user") plugins = plugins.filter((p) => p.source === "user");
    return plugins;
  }, [data, filter]);

  if (loading) {
    return (
      <ScrollableOverlay outerClassName="h-full" className="w-full">
        <div className="openchamber-page-body mx-auto max-w-3xl space-y-6 p-3 sm:p-6 sm:pt-8">
          <div className="flex items-center justify-center py-12">
            <Icon name="loader-4" className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 typography-meta text-muted-foreground">Loading plugins...</span>
          </div>
        </div>
      </ScrollableOverlay>
    );
  }

  if (error) {
    return (
      <ScrollableOverlay outerClassName="h-full" className="w-full">
        <div className="openchamber-page-body mx-auto max-w-3xl space-y-6 p-3 sm:p-6 sm:pt-8">
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--status-error-border)", backgroundColor: "var(--status-error-background)" }}>
            <div className="typography-ui-label font-medium" style={{ color: "var(--status-error)" }}>
              Failed to load plugin diagnostics
            </div>
            <div className="typography-meta text-muted-foreground mt-1">{error}</div>
          </div>
        </div>
      </ScrollableOverlay>
    );
  }

  if (!data) return null;

  const errorCount = data.plugins.filter((p) => p.status === "error").length;
  const userCount = data.plugins.filter((p) => p.source === "user").length;

  return (
    <ScrollableOverlay outerClassName="h-full" className="w-full">
      <div className="openchamber-page-body mx-auto max-w-3xl space-y-6 p-3 sm:p-6 sm:pt-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="typography-ui-header font-semibold text-foreground">
              Plugins
            </h2>
            <p className="typography-meta text-muted-foreground mt-1">
              {data.pluginCount} plugins · {data.contributionCount} contributions · Loaded at {new Date(data.loadedAt).toLocaleTimeString()}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All ({data.pluginCount})
            </Button>
            {errorCount > 0 && (
              <Button
                variant={filter === "error" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("error")}
                style={filter === "error" ? { backgroundColor: "var(--status-error)" } : undefined}
              >
                Errors ({errorCount})
              </Button>
            )}
            {userCount > 0 && (
              <Button
                variant={filter === "user" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("user")}
              >
                User ({userCount})
              </Button>
            )}
          </div>
        </div>

        {filteredPlugins.length === 0 ? (
          <div className="rounded-lg border p-8 text-center" style={{ borderColor: "var(--border-subtle)" }}>
            <Icon name="code-box" className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="typography-meta text-muted-foreground mt-3">No plugins match the current filter</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPlugins.map((plugin) => (
              <PluginCard key={plugin.id} plugin={plugin} />
            ))}
          </div>
        )}
      </div>
    </ScrollableOverlay>
  );
};
