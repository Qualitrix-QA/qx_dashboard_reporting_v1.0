import { useState, useEffect } from "react";
import { Settings, X, Eye, EyeOff, Sparkles, ChevronDown, Link2, Kanban, HelpCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AI_PROVIDERS, getProviderConfig } from "@/utils/aiProviders";
import type { AIProvider, UserPreferences } from "@/types/bug";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  onSave: (prefs: UserPreferences) => void;
}

export function SettingsModal({ open, onClose, preferences, onSave }: SettingsModalProps) {
  const [aiEnabled, setAiEnabled] = useState(preferences.aiEnabled);
  const [provider, setProvider] = useState<AIProvider>(preferences.aiProvider || "groq");
  const [model, setModel] = useState(preferences.aiModel || "");
  const [apiKeys, setApiKeys] = useState<Partial<Record<AIProvider, string>>>(preferences.apiKeys || {});
  const [showKey, setShowKey] = useState(false);
  const [googleKey, setGoogleKey] = useState(preferences.googleSheetsApiKey || "");
  const [showGoogleKey, setShowGoogleKey] = useState(false);
  const [keyError, setKeyError] = useState("");

  // Jira States
  const [jiraHost, setJiraHost] = useState(preferences.jiraHost || "");
  const [jiraEmail, setJiraEmail] = useState(preferences.jiraEmail || "");
  const [jiraApiToken, setJiraApiToken] = useState(preferences.jiraApiToken || "");
  const [showJiraToken, setShowJiraToken] = useState(false);
  const [jiraJql, setJiraJql] = useState(preferences.jiraJql || "issuetype = Bug ORDER BY created DESC");
  const [jiraUseProxy, setJiraUseProxy] = useState(preferences.jiraUseProxy !== false);
  const [jiraProxyUrl, setJiraProxyUrl] = useState(() => {
    const pUrl = preferences.jiraProxyUrl || "/api/jira-proxy";
    return pUrl.includes("allorigins") ? "/api/jira-proxy" : pUrl;
  });

  useEffect(() => {
    setAiEnabled(preferences.aiEnabled);
    setProvider(preferences.aiProvider || "groq");
    setModel(preferences.aiModel || "");
    const keys = { ...(preferences.apiKeys || {}) };
    if (preferences.groqApiKey && !keys.groq) keys.groq = preferences.groqApiKey;
    setApiKeys(keys);
    setGoogleKey(preferences.googleSheetsApiKey || "");

    // Load Jira prefs
    setJiraHost(preferences.jiraHost || "");
    setJiraEmail(preferences.jiraEmail || "");
    setJiraApiToken(preferences.jiraApiToken || "");
    setJiraJql(preferences.jiraJql || "issuetype = Bug ORDER BY created DESC");
    setJiraUseProxy(preferences.jiraUseProxy !== false);
    const pUrl = preferences.jiraProxyUrl || "/api/jira-proxy";
    setJiraProxyUrl(pUrl.includes("allorigins") ? "/api/jira-proxy" : pUrl);
  }, [preferences, open]);

  if (!open) return null;

  const config = getProviderConfig(provider);
  const currentKey = apiKeys[provider] || "";

  const handleSave = () => {
    setKeyError("");
    // Validate API key when AI is enabled
    if (aiEnabled) {
      const key = apiKeys[provider] || "";
      if (!key.trim()) {
        setKeyError(`Please enter your ${config.name} API key to enable AI features.`);
        return;
      }
      if (config.keyPrefix && !key.startsWith(config.keyPrefix)) {
        setKeyError(`${config.name} API key should start with "${config.keyPrefix}". Please check your key.`);
        return;
      }
    }
    const activeModel = model || config.models[0].id;
    onSave({
      ...preferences,
      aiEnabled,
      aiProvider: provider,
      aiModel: activeModel,
      apiKeys,
      groqApiKey: apiKeys.groq,
      googleSheetsApiKey: googleKey || undefined,
      jiraHost: jiraHost.trim(),
      jiraEmail: jiraEmail.trim(),
      jiraApiToken: jiraApiToken.trim(),
      jiraJql: jiraJql.trim(),
      jiraUseProxy,
      jiraProxyUrl: jiraProxyUrl.trim(),
    });
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-4 top-[5%] z-50 mx-auto max-w-md rounded-lg border bg-card shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Settings</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          {/* Google Sheets API Key */}
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              <Label className="text-sm font-medium text-foreground">Google Sheets API Key</Label>
              <span className="text-[10px] text-muted-foreground">(optional)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              For private sheets. Public sheets work without a key.
            </p>
            <div className="relative">
              <Input
                type={showGoogleKey ? "text" : "password"}
                value={googleKey}
                onChange={(e) => setGoogleKey(e.target.value)}
                placeholder="AIza..."
                className="pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowGoogleKey(!showGoogleKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showGoogleKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Get key at{" "}
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Google Cloud Console
              </a>
              . Enable Google Sheets API.
            </p>
          </div>

          {/* Jira Integration Defaults */}
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2">
              <Kanban className="h-4 w-4 text-primary" />
              <Label className="text-sm font-medium text-foreground">Jira Defaults</Label>
              <span className="text-[10px] text-muted-foreground">(optional)</span>
            </div>
            
            <div className="space-y-2.5 text-xs">
              <div>
                <Label className="text-[11px] text-muted-foreground">Jira Host URL</Label>
                <Input
                  type="text"
                  value={jiraHost}
                  onChange={(e) => setJiraHost(e.target.value)}
                  placeholder="https://mycompany.atlassian.net"
                  className="mt-1 h-8 text-xs font-mono"
                />
              </div>

              <div>
                <Label className="text-[11px] text-muted-foreground">Email / Username</Label>
                <Input
                  type="text"
                  value={jiraEmail}
                  onChange={(e) => setJiraEmail(e.target.value)}
                  placeholder="user@mycompany.com"
                  className="mt-1 h-8 text-xs font-mono"
                />
              </div>

              <div>
                <Label className="text-[11px] text-muted-foreground">API Token</Label>
                <div className="relative mt-1">
                  <Input
                    type={showJiraToken ? "text" : "password"}
                    value={jiraApiToken}
                    onChange={(e) => setJiraApiToken(e.target.value)}
                    placeholder="ATATT..."
                    className="h-8 pr-10 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowJiraToken(!showJiraToken)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showJiraToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <Label className="text-[11px] text-muted-foreground">Default JQL Query</Label>
                <Input
                  type="text"
                  value={jiraJql}
                  onChange={(e) => setJiraJql(e.target.value)}
                  placeholder='project = "PROJ" AND issuetype = Bug'
                  className="mt-1 h-8 text-xs font-mono"
                />
              </div>

              <div className="flex items-center justify-between rounded-md border bg-card/40 px-2 py-1.5 mt-2">
                <div className="flex items-center gap-1.5">
                  <Switch checked={jiraUseProxy} onCheckedChange={setJiraUseProxy} />
                  <Label className="text-[11px] text-foreground">Use CORS Proxy</Label>
                </div>
                <span title="Atlassian Jira Cloud blocks direct CORS requests from client browsers. Using a CORS proxy solves this.">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </span>
              </div>

              {jiraUseProxy && (
                <div>
                  <Label className="text-[11px] text-muted-foreground">Proxy URL Wrapper</Label>
                  <Input
                    type="text"
                    value={jiraProxyUrl}
                    onChange={(e) => setJiraProxyUrl(e.target.value)}
                    placeholder="https://api.allorigins.win/raw?url="
                    className="mt-1 h-8 text-xs font-mono"
                  />
                </div>
              )}
            </div>
          </div>

          {/* AI Toggle */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <Label className="text-sm font-medium text-foreground">AI Features</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Column mapping, insights & Q&A
                </p>
              </div>
            </div>
            <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
          </div>

          {aiEnabled && (
            <div className="space-y-4 animate-fade-in">
              {/* Provider Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">AI Provider</Label>
                <div className="grid grid-cols-2 gap-2">
                  {AI_PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setProvider(p.id); setModel(""); setShowKey(false); }}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-all ${
                        provider === p.id
                          ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/30"
                          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <span className="font-medium">{p.name}</span>
                      {apiKeys[p.id] && <span className="ml-auto h-2 w-2 rounded-full bg-chart-low" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Model Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Model</Label>
                <div className="relative">
                  <select
                    value={model || config.models[0].id}
                    onChange={(e) => setModel(e.target.value)}
                    className="h-10 w-full appearance-none rounded-md border bg-background px-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {config.models.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">{config.name} API Key</Label>
                <div className="relative">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={currentKey}
                    onChange={(e) => setApiKeys({ ...apiKeys, [provider]: e.target.value })}
                    placeholder={`${config.keyPrefix}...`}
                    className="pr-10 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get your key at{" "}
                  <a href={config.keyUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    {config.keyUrl.replace("https://", "").split("/")[0]}
                  </a>
                  . Stored only in your browser.
                </p>
              </div>

              {currentKey && !keyError && (
                <div className="rounded-md border border-chart-low/30 bg-chart-low/5 px-3 py-2">
                  <p className="text-xs text-foreground">
                    ✓ {config.name} key configured. AI features active.
                  </p>
                </div>
              )}

              {keyError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                  <p className="text-xs text-destructive">
                    ⚠ {keyError}
                  </p>
                </div>
              )}

              {Object.entries(apiKeys).filter(([, v]) => v).length > 1 && (
                <div className="rounded-md border bg-muted/30 px-3 py-2">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Configured Providers</p>
                  <div className="flex flex-wrap gap-1.5">
                    {AI_PROVIDERS.filter((p) => apiKeys[p.id]).map((p) => (
                      <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        <span className="h-1.5 w-1.5 rounded-full bg-chart-low" />
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Save Settings
          </button>
        </div>
      </div>
    </>
  );
}
