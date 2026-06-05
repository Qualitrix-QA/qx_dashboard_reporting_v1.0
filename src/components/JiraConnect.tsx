import { useState, useEffect, useRef, useCallback } from "react";
import {
  RefreshCw, Unplug, Loader2, Clock, ExternalLink, AlertCircle,
  Kanban, HelpCircle, User, Key, Globe, Eye, EyeOff
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { fetchJiraIssues, fetchJiraProjects, type JiraProject } from "@/utils/jira";
import type { RawRow, JiraConfig, UserPreferences } from "@/types/bug";

interface Props {
  preferences: UserPreferences;
  onJiraLoaded: (rows: RawRow[], config: JiraConfig) => void;
  onProjectsFetched: (projects: JiraProject[], config: JiraConfig) => void;
  activeConfig?: JiraConfig | null;
  onDisconnect: () => void;
  onSavePreferences: (prefs: UserPreferences) => void;
  rowCount?: number;
}

export function JiraConnect({
  preferences,
  onJiraLoaded,
  onProjectsFetched,
  activeConfig,
  onDisconnect,
  onSavePreferences,
  rowCount: propRowCount,
}: Props) {
  // Connection states
  const [host, setHost] = useState(activeConfig?.host || preferences.jiraHost || "");
  const [email, setEmail] = useState(activeConfig?.email || preferences.jiraEmail || "");
  const [apiToken, setApiToken] = useState(activeConfig?.apiToken || preferences.jiraApiToken || "");
  const [showToken, setShowToken] = useState(false);
  const [useProxy, setUseProxy] = useState(activeConfig?.useProxy ?? preferences.jiraUseProxy ?? true);
  const [proxyUrl, setProxyUrl] = useState(() => {
    const val = activeConfig?.proxyUrl || preferences.jiraProxyUrl || "/api/jira-proxy";
    return val.includes("allorigins") ? "/api/jira-proxy" : val;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [autoPoll, setAutoPoll] = useState((activeConfig?.pollInterval || 0) > 0);
  const [pollInterval, setPollInterval] = useState(activeConfig?.pollInterval || 30);
  const [lastFetched, setLastFetched] = useState<number | null>(activeConfig?.lastFetched || null);
  const [rowCount, setRowCount] = useState<number | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync rows count on activeConfig load
  useEffect(() => {
    if (activeConfig?.lastFetched) {
      setLastFetched(activeConfig.lastFetched);
    }
  }, [activeConfig]);

  const handleFetch = useCallback(
    async (silent = false) => {
      if (!activeConfig) return;

      if (!silent) setLoading(true);
      setError("");

      try {
        const result = await fetchJiraIssues(activeConfig);
        setRowCount(result.rows.length);
        setLastFetched(Date.now());

        const updatedConfig: JiraConfig = {
          ...activeConfig,
          lastFetched: Date.now(),
        };

        // Notify parent dashboard
        onJiraLoaded(result.rows, updatedConfig);
      } catch (e: any) {
        if (!silent) {
          setError(
            e.message || "Failed to sync issues from Jira. Please check your connection."
          );
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [activeConfig, onJiraLoaded]
  );

  // Sync state with active configuration changes
  useEffect(() => {
    if (activeConfig) {
      setHost(activeConfig.host);
      setEmail(activeConfig.email);
      setApiToken(activeConfig.apiToken);
      setUseProxy(activeConfig.useProxy);
      if (activeConfig.proxyUrl) setProxyUrl(activeConfig.proxyUrl);
      setAutoPoll(activeConfig.pollInterval > 0);
      if (activeConfig.pollInterval > 0) setPollInterval(activeConfig.pollInterval);
      if (activeConfig.lastFetched) setLastFetched(activeConfig.lastFetched);
    }
  }, [activeConfig]);

  // Setup auto polling timer
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (autoPoll && activeConfig && pollInterval > 0) {
      pollRef.current = setInterval(() => handleFetch(true), pollInterval * 1000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [autoPoll, pollInterval, activeConfig, handleFetch]);

  const handleConnect = async () => {
    if (!host.trim()) {
      setError("Jira Instance URL is required.");
      return;
    }
    if (!email.trim()) {
      setError("Email / Username is required.");
      return;
    }
    if (!apiToken.trim()) {
      setError("API Token is required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const loadedProjects = await fetchJiraProjects({
        host: host.trim(),
        email: email.trim(),
        apiToken: apiToken.trim(),
        useProxy,
        proxyUrl: useProxy ? proxyUrl.trim() : undefined,
        pollInterval: 0,
      });

      if (loadedProjects.length === 0) {
        throw new Error("No projects found in this Jira account. Verify credentials.");
      }

      // Create a base Jira config structure
      const config: JiraConfig = {
        host: host.trim(),
        email: email.trim(),
        apiToken: apiToken.trim(),
        jql: "",
        useProxy,
        proxyUrl: useProxy ? proxyUrl.trim() : undefined,
        pollInterval: autoPoll ? pollInterval : 0,
        projects: loadedProjects,
      };

      // Notify parent dashboard to open the Project Selector modal
      onProjectsFetched(loadedProjects, config);

      // Save preferences
      onSavePreferences({
        ...preferences,
        jiraHost: host.trim(),
        jiraEmail: email.trim(),
        jiraApiToken: apiToken.trim(),
        jiraUseProxy: useProxy,
        jiraProxyUrl: proxyUrl.trim(),
      });
    } catch (e: any) {
      setError(
        e.message || "Failed to connect and fetch projects. Check your credentials and proxy setup."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSelector = () => {
    if (activeConfig && activeConfig.projects) {
      onProjectsFetched(activeConfig.projects, activeConfig);
    }
  };

  if (activeConfig) {
    const selectedCount = activeConfig.selectedProjects?.length || 1;
    const projectDisplayList = activeConfig.selectedProjects?.join(", ") || activeConfig.projectKey || "";

    return (
      <div className="rounded-lg border border-primary/20 bg-card p-4 space-y-3 animate-fade-in shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Kanban className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium text-foreground">Jira Connected</span>
            
            {activeConfig.projects && activeConfig.projects.length > 0 && (
              <button
                onClick={handleOpenSelector}
                disabled={loading}
                className="h-6 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/20 disabled:opacity-50 cursor-pointer focus:outline-none flex items-center gap-1"
                title="Manage selected projects/spaces"
              >
                <span>Projects ({selectedCount})</span>
                <span className="text-[9px] opacity-70">▼</span>
              </button>
            )}
            
            {(propRowCount !== undefined || rowCount !== null) && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground font-medium">
                {propRowCount !== undefined ? propRowCount : rowCount} tickets loaded
              </span>
            )}
            <span className="h-2 w-2 rounded-full bg-chart-low animate-pulse shrink-0" />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => handleFetch(false)}
              disabled={loading}
              className="flex h-8 items-center gap-1.5 rounded-md border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Sync
            </button>
            <button
              onClick={onDisconnect}
              className="flex h-8 items-center gap-1.5 rounded-md border bg-card px-2.5 text-xs font-medium text-destructive hover:bg-destructive/10"
              title="Disconnect Jira"
            >
              <Unplug className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="rounded border bg-muted/20 px-3 py-1.5 text-xs font-mono text-muted-foreground break-all max-h-24 overflow-y-auto">
          <span className="text-[10px] font-semibold text-foreground">Selected Spaces:</span>{" "}
          <span className="text-primary font-bold">{projectDisplayList}</span>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {lastFetched && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Synced: {new Date(lastFetched).toLocaleTimeString()}
            </span>
          )}
          <a
            href={`${activeConfig.host.replace(/\/$/, "")}/issues/?jql=${encodeURIComponent(activeConfig.jql)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> Open in Jira
          </a>
        </div>

        <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-2">
            <Switch checked={autoPoll} onCheckedChange={setAutoPoll} />
            <Label className="text-xs text-foreground">Auto-refresh polling</Label>
          </div>
          {autoPoll && (
            <select
              value={pollInterval}
              onChange={(e) => setPollInterval(Number(e.target.value))}
              className="h-7 rounded border bg-background px-2 text-xs text-foreground font-medium"
            >
              <option value={10}>10s</option>
              <option value={30}>30s</option>
              <option value={60}>1 min</option>
              <option value={120}>2 min</option>
              <option value={300}>5 min</option>
            </select>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 animate-fade-in">
            <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-primary/30 bg-card p-5 space-y-3 shadow-sm">
      <div className="flex items-center gap-2">
        <Kanban className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Connect Jira Instance</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Fetch tickets directly from Jira projects or spaces. Once connected, select one or multiple projects to analyze together.
      </p>

      <div className="space-y-2.5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Globe className="h-3 w-3" /> Jira Instance Host URL
            </Label>
            <Input
              value={host}
              onChange={(e) => { setHost(e.target.value); setError(""); }}
              placeholder="https://your-company.atlassian.net"
              className="text-xs font-mono h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" /> Email / Username
            </Label>
            <Input
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              placeholder="user@company.com"
              className="text-xs font-mono h-9"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Key className="h-3 w-3" /> API Token / Password
            </Label>
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                value={apiToken}
                onChange={(e) => { setApiToken(e.target.value); setError(""); }}
                placeholder="Jira API Token"
                className="text-xs font-mono h-9 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 mt-1">
          <div className="flex items-center gap-2">
            <Switch checked={useProxy} onCheckedChange={setUseProxy} />
            <Label className="text-xs text-foreground">Use CORS Proxy (Required for Jira Cloud)</Label>
          </div>
          <span title="Atlassian Jira Cloud blocks browser requests from external domains. We proxy requests client-side to bypass this block.">
            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
          </span>
        </div>

        {useProxy && (
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Proxy Endpoint Wrapper</Label>
            <Input
              value={proxyUrl}
              onChange={(e) => { setProxyUrl(e.target.value); setError(""); }}
              placeholder="/api/jira-proxy"
              className="text-xs font-mono h-9"
            />
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 animate-fade-in">
          <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      <button
        onClick={handleConnect}
        disabled={loading}
        className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Kanban className="h-4 w-4" />}
        {loading ? "Connecting to Jira..." : "Connect Jira"}
      </button>

      <div className="rounded-md bg-muted/40 p-3 text-[10px] text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground">How to connect Jira Cloud:</p>
        <ol className="list-decimal pl-4 space-y-0.5">
          <li>Go to Atlassian Account Settings &gt; Security &gt; Create API Token.</li>
          <li>Paste the token into the API Token field above.</li>
          <li>Ensure CORS proxy is checked so the browser is not blocked by Atlassian policies.</li>
        </ol>
      </div>
    </div>
  );
}
