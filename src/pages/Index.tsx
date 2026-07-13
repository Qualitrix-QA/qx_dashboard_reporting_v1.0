import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useProject } from "@/context/ProjectContext";
import { Bug, Trash2, Upload as UploadIcon, Settings, History, AlertTriangle, Camera, Scan, ThumbsUp, Sparkles, Plus, Lock, Unlock } from "lucide-react";
import { FileUpload } from "@/components/FileUpload";
import { GoogleSheetsConnect } from "@/components/GoogleSheetsConnect";
import { JiraConnect } from "@/components/JiraConnect";
import { SheetSelector } from "@/components/SheetSelector";
import { ProjectSelector } from "@/components/ProjectSelector";
import { fetchJiraIssues, type JiraProject } from "@/utils/jira";
import { DynamicKPICards } from "@/components/DynamicKPICards";
import { DynamicCharts } from "@/components/DynamicCharts";
import { DynamicTable } from "@/components/DynamicTable";
import { DynamicDetailDrawer } from "@/components/DynamicDetailDrawer";
import { SettingsModal } from "@/components/SettingsModal";
import { AIInsightsPanel } from "@/components/AIInsightsPanel";
import { ExportBar } from "@/components/ExportBar";
import { AuthWidget } from "@/components/AuthWidget";
import { ProjectToolbar } from "@/components/ProjectToolbar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InsightsSidebar } from "@/components/InsightsSidebar";
import { ModuleHealthMap } from "@/components/ModuleHealthMap";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ProdIssuesDashboard } from "@/components/ProdIssuesDashboard";
import { BugAnalyticsDashboard } from "@/components/BugAnalyticsDashboard";
import { TestCoverageDashboard } from "@/components/TestCoverageDashboard";
import { ManualExecutionDashboard } from "@/components/ManualExecutionDashboard";
import { AutomationExecutionDashboard } from "@/components/AutomationExecutionDashboard";
import { NewInitiativesDashboard } from "@/components/NewInitiativesDashboard";
import { RiskMitigationDashboard } from "@/components/RiskMitigationDashboard";
import { ProjectLevelDashboard } from "@/components/ProjectLevelDashboard";
import {
  getProdIssuesData,
  getBugAnalyticsData,
  getTestCoverageData,
  getManualExecutionData,
  getAutomationExecutionData
} from "@/utils/dashboardMapper";
import { parseWorkbook, type SheetInfo } from "@/utils/excelParser";
import { analyzeColumns, dynamicAggregate } from "@/utils/columnAnalyzer";
import { getActiveApiKey, getActiveModel } from "@/utils/aiProviders";
import { generateAISchema, generateFallbackSchema, detectDataTypeHeuristic } from "@/utils/aiSchema";
import {
  saveBugData, loadBugData,
  savePreferences, loadPreferences, clearAllData,
  saveAnalysisRecord, updateAnalysisRecord, type AnalysisRecord,
} from "@/utils/store";
import {
  detectModuleColumn, detectRiskColumn, calculateModuleRisks,
} from "@/utils/moduleRisk";
import type { RawRow, UserPreferences, GoogleSheetsConfig, JiraConfig, AISchema } from "@/types/bug";

const BLANK_TEMPLATE_ROWS: RawRow[] = [
  // Production Issues sheet
  {
    "Date Reported": new Date().toISOString().split("T")[0],
    "Date Resolved": new Date().toISOString().split("T")[0],
    "Severity": "Critical",
    "Priority": "P1",
    "Status": "Resolved",
    "RCA Category": "Code Defect",
    "Reporter": "Customer",
    "Product": "Portal",
    "Module": "Authentication",
    "__sheet": "Production Issues"
  },
  {
    "Date Reported": new Date(Date.now() - 86400000).toISOString().split("T")[0],
    "Date Resolved": "",
    "Severity": "High",
    "Priority": "P2",
    "Status": "In Progress",
    "RCA Category": "Configuration Error",
    "Reporter": "Monitoring Alert",
    "Product": "Portal",
    "Module": "Payments",
    "__sheet": "Production Issues"
  },
  {
    "Date Reported": new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0],
    "Date Resolved": "",
    "Severity": "Medium",
    "Priority": "P3",
    "Status": "Open",
    "RCA Category": "Data Sync Issue",
    "Reporter": "QA Team",
    "Product": "Admin console",
    "Module": "User Management",
    "__sheet": "Production Issues"
  },

  // Test execution logs (Test Coverage, Manual, Automation)
  {
    "TC ID": "TC-AUTH-01",
    "Date Executed": new Date().toISOString().split("T")[0],
    "Product": "Portal",
    "Module": "Authentication",
    "Status": "Pass",
    "Test Type": "Functional",
    "Execution Mode": "Manual",
    "Build Number": "Bld-104",
    "Execution Time (min)": "8",
    "Test Name": "Verify Login with valid 2FA token",
    "Notes": "Works as expected",
    "__sheet": "Test Execution Log"
  },
  {
    "TC ID": "TC-AUTH-02",
    "Date Executed": new Date().toISOString().split("T")[0],
    "Product": "Portal",
    "Module": "Authentication",
    "Status": "Fail",
    "Test Type": "Security",
    "Execution Mode": "Manual",
    "Build Number": "Bld-104",
    "Execution Time (min)": "12",
    "Test Name": "Verify rate limiting on failed OTP requests",
    "Notes": "Server returns 500 error instead of 429 rate limit block",
    "__sheet": "Test Execution Log"
  },
  {
    "TC ID": "TC-PAY-05",
    "Date Executed": new Date(Date.now() - 86400000).toISOString().split("T")[0],
    "Product": "Portal",
    "Module": "Payments",
    "Status": "Blocked",
    "Test Type": "Integration",
    "Execution Mode": "Manual",
    "Build Number": "Bld-103",
    "Execution Time (min)": "5",
    "Test Name": "Verify credit card checkout flow",
    "Notes": "Sandbox gateway returns connection timeout",
    "__sheet": "Test Execution Log"
  },
  {
    "TC ID": "TC-AUTO-01",
    "Date Executed": new Date().toISOString().split("T")[0],
    "Product": "Portal",
    "Module": "Authentication",
    "Status": "Pass",
    "Test Type": "Regression",
    "Execution Mode": "Automation",
    "Build Number": "Bld-104",
    "Execution Time (min)": "1.2",
    "Test Name": "Sanity check - Welcome Page loading time",
    "Notes": "Fully automated run",
    "__sheet": "Test Execution Log"
  },
  {
    "TC ID": "TC-AUTO-02",
    "Date Executed": new Date().toISOString().split("T")[0],
    "Product": "Portal",
    "Module": "Payments",
    "Status": "Fail",
    "Test Type": "Regression",
    "Execution Mode": "Automation",
    "Build Number": "Bld-104",
    "Execution Time (min)": "3.5",
    "Test Name": "Automated checkout validation",
    "Notes": "Element click intercepted: button not clickable",
    "__sheet": "Test Execution Log"
  }
];

const DEFAULT_PREFS: UserPreferences = { theme: "dark", aiEnabled: false };

export default function Dashboard() {
  // ── Project state (from ProjectContext) ──────────────────────────────────
  const {
    rows, setRows,
    filteredRows, setFilteredRows,
    fileName, setFileName,
    truncationWarning, setTruncationWarning,
    aiSchema, setAiSchema,
    latestInsights, setLatestInsights,
    projectLevelData, setProjectLevelData,
    newInitiativesData, setNewInitiativesData,
    riskMitigationData, setRiskMitigationData,
    dashboardOverrides,
    dashboardNotes,
    slideVisibility, setSlideVisible,
    updateDashboardOverride,
    resetDashboardOverride,
    handleAddNote,
    handleDeleteNote,
    clearProjectData,
  } = useProject();

  // ── Local UI/App state (NOT serialized as project) ───────────────────────
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<RawRow | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [showSettings, setShowSettings] = useState(false);
  const [googleConfig, setGoogleConfig] = useState<GoogleSheetsConfig | null>(null);
  const [jiraConfig, setJiraConfig] = useState<JiraConfig | null>(null);
  const [pendingSheets, setPendingSheets] = useState<SheetInfo[] | null>(null);
  const [pendingFileName, setPendingFileName] = useState("");
  const [pendingJiraProjects, setPendingJiraProjects] = useState<JiraProject[] | null>(null);
  const [pendingJiraConfig, setPendingJiraConfig] = useState<JiraConfig | null>(null);
  const [visibleKPIs, setVisibleKPIs] = useState<Set<number>>(new Set());
  const [showSidebar, setShowSidebar] = useState(false);

  const [schemaLoading, setSchemaLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<string>("project_level");
  const hasUserSelectedTab = useRef(false);
  const [globalEditMode, setGlobalEditMode] = useState<boolean>(false);

  // Slide visibility aliases (sourced from ProjectContext for cleaner JSX)
  const showProdIssues        = slideVisibility["prod_issues"];
  const showBugAnalytics      = slideVisibility["bug_analytics"];
  const showTestCoverage      = slideVisibility["test_coverage"];
  const showManualExecution   = slideVisibility["manual_execution"];
  const showAutomationExecution = slideVisibility["automation_execution"];
  const showNewInitiatives    = slideVisibility["new_initiatives"];
  const showRiskMitigation    = slideVisibility["risk_mitigation"];

  // Track current analysis record ID to update (not duplicate) on insights generation
  const currentAnalysisId = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      const savedPrefs = await loadPreferences();
      if (savedPrefs) {
        setPrefs(savedPrefs);
        setTheme(savedPrefs.theme);
        document.documentElement.classList.toggle("dark", savedPrefs.theme === "dark");
      } else {
        document.documentElement.classList.add("dark");
      }
      const cached = await loadBugData();
      if (cached) {
        setRows(cached.rows);
        setFileName(cached.fileName);
        if (cached.googleConfig) setGoogleConfig(cached.googleConfig);
        if (cached.jiraConfig) {
          const sanitized = { ...cached.jiraConfig };
          if (sanitized.proxyUrl?.includes("allorigins")) {
            sanitized.proxyUrl = "/api/jira-proxy";
          }
          if (sanitized.host?.includes("localhost:8080")) {
            sanitized.host = sanitized.host.replace(/^https?:\/\/localhost:8080\/?/i, "");
            if (!/^https?:\/\//i.test(sanitized.host)) {
              sanitized.host = `https://${sanitized.host}`;
            }
          }
          setJiraConfig(sanitized);
        }
      }
    })();
  }, []);

  const toggleTheme = useCallback(async () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    const updated = { ...prefs, theme: next as "light" | "dark" };
    setPrefs(updated);
    await savePreferences(updated);
  }, [theme, prefs]);

  const handleSavePrefs = useCallback(async (newPrefs: UserPreferences) => {
    setPrefs(newPrefs);
    setTheme(newPrefs.theme);
    document.documentElement.classList.toggle("dark", newPrefs.theme === "dark");
    await savePreferences(newPrefs);
  }, []);

  const loadSheets = useCallback(async (
    sheets: SheetInfo[],
    fName: string,
    gConfig?: GoogleSheetsConfig
  ) => {
    const allRows: RawRow[] = [];
    const sheetNames: string[] = [];
    let totalOriginalRows = 0;

    for (const sheet of sheets) {
      totalOriginalRows += sheet.rowCount;
      if (sheets.length > 1) {
        for (const row of sheet.sampleRows) {
          allRows.push({ ...row, __sheet: sheet.name });
        }
      } else {
        allRows.push(...sheet.sampleRows);
      }
      sheetNames.push(sheet.name);
    }

    // Warn if data was truncated
    if (totalOriginalRows > allRows.length) {
      setTruncationWarning(
        `File has ${totalOriginalRows.toLocaleString()} rows — showing first 10,000 only.`
      );
    } else {
      setTruncationWarning("");
    }

    hasUserSelectedTab.current = false;
    setActiveTab("project_level");
    setRows(allRows);
    setFilteredRows(allRows);
    setLatestInsights(null);
    setAiSchema(null);
    const displayName = sheets.length > 1 ? `${fName} (${sheetNames.join(", ")})` : fName;
    setFileName(displayName);

    const cfg = gConfig || googleConfig;
    if (cfg) setGoogleConfig(cfg);
    await saveBugData(allRows, displayName, undefined, cfg || undefined);

    // Save one analysis record per load
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    currentAnalysisId.current = id;

    const record: AnalysisRecord = {
      id,
      fileName: displayName,
      timestamp: Date.now(),
      rowCount: allRows.length,
      columnCount: allRows.length > 0
        ? Object.keys(allRows[0]).filter(k => k !== "__sheet").length
        : 0,
      hasInsights: false,
    };
    await saveAnalysisRecord(record);
  }, [googleConfig]);

  const loadSheet = useCallback(async (sheet: SheetInfo, fName: string, gConfig?: GoogleSheetsConfig) => {
    return loadSheets([sheet], fName, gConfig);
  }, [loadSheets]);

  const handleFile = useCallback(async (data: ArrayBuffer, fName: string) => {
    setIsLoading(true);
    try {
      const sheets = parseWorkbook(data);
      if (sheets.length === 0) { setIsLoading(false); return; }
      if (sheets.length > 1) {
        setPendingSheets(sheets);
        setPendingFileName(fName);
        setIsLoading(false);
        return;
      }
      await loadSheet(sheets[0], fName);
    } catch (e) {
      console.error("Parse error:", e);
    }
    setIsLoading(false);
  }, [loadSheet]);

  const handleSheetsSelected = useCallback(async (selectedSheets: SheetInfo[]) => {
    setPendingSheets(null);
    setIsLoading(true);
    const sheetName = selectedSheets.length === 1 ? selectedSheets[0].name : undefined;
    const updatedConfig = googleConfig ? { ...googleConfig, sheetName } : undefined;
    await loadSheets(selectedSheets, pendingFileName, updatedConfig);
    setIsLoading(false);
  }, [pendingFileName, loadSheets, googleConfig]);

  const handleGoogleSheet = useCallback(async (sheet: SheetInfo, config: GoogleSheetsConfig) => {
    setIsLoading(true);
    await loadSheet(sheet, `Google Sheet: ${sheet.name}`, config);
    setIsLoading(false);
  }, [loadSheet]);

  const handleGoogleSheetsMulti = useCallback((sheets: SheetInfo[], config: GoogleSheetsConfig) => {
    if (sheets.length === 1) {
      handleGoogleSheet(sheets[0], config);
    } else {
      if (googleConfig?.sheetName) {
        const previousSheet = sheets.find(s => s.name === googleConfig.sheetName);
        if (previousSheet) {
          config.sheetName = googleConfig.sheetName;
          handleGoogleSheet(previousSheet, config);
          return;
        }
      }
      setPendingSheets(sheets);
      setPendingFileName("Google Sheet");
      setGoogleConfig(config);
    }
  }, [handleGoogleSheet, googleConfig]);

  const handleJiraLoaded = useCallback(async (newRows: RawRow[], config: JiraConfig) => {
    setPendingSheets(null);
    setPendingJiraProjects(null);
    setPendingJiraConfig(null);
    hasUserSelectedTab.current = false;
    setActiveTab("project_level");
    setRows(newRows);
    setFilteredRows(newRows);
    setLatestInsights(null);
    setAiSchema(null);
    setTruncationWarning("");
    const projectDisplayList = config.selectedProjects && config.selectedProjects.length > 0
      ? config.selectedProjects.join(", ")
      : config.projectKey || "Jira";
    const displayName = `Jira: ${projectDisplayList}`;
    setFileName(displayName);
    setJiraConfig(config);
    setGoogleConfig(null); // Disconnect Google Sheets if Jira is loaded
    await saveBugData(newRows, displayName, undefined, undefined, config);

    // Save one analysis record per load
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    currentAnalysisId.current = id;

    const record: AnalysisRecord = {
      id,
      fileName: displayName,
      timestamp: Date.now(),
      rowCount: newRows.length,
      columnCount: newRows.length > 0
        ? Object.keys(newRows[0]).filter(k => k !== "__sheet").length
        : 0,
      hasInsights: false,
    };
    await saveAnalysisRecord(record);
  }, []);

  const handleJiraProjectsFetched = useCallback((projects: JiraProject[], config: JiraConfig) => {
    setPendingJiraProjects(projects);
    setPendingJiraConfig(config);
  }, []);

  const handleJiraProjectsSelected = useCallback(async (selectedKeys: string[]) => {
    if (!pendingJiraConfig) return;
    setPendingJiraProjects(null);
    setIsLoading(true);

    try {
      // Construct JQL dynamically
      const jql = selectedKeys.length === 1
        ? `project = "${selectedKeys[0]}" ORDER BY created DESC`
        : `project IN (${selectedKeys.map(k => `"${k}"`).join(", ")}) ORDER BY created DESC`;

      const configWithProjects: JiraConfig = {
        ...pendingJiraConfig,
        jql,
        selectedProjects: selectedKeys,
        projectKey: selectedKeys[0], // fallback
        lastFetched: Date.now(),
      };

      const result = await fetchJiraIssues(configWithProjects);
      await handleJiraLoaded(result.rows, configWithProjects);
    } catch (e: any) {
      console.error("Failed to load Jira projects:", e);
      alert(e.message || "Failed to load Jira issues for selected projects.");
    } finally {
      setIsLoading(false);
      setPendingJiraConfig(null);
    }
  }, [pendingJiraConfig, handleJiraLoaded]);

  const handleDisconnectJira = useCallback(async () => {
    const confirmed = window.confirm("Disconnect Jira and clear data?");
    if (!confirmed) return;
    setJiraConfig(null);
    await clearAllData();
    clearProjectData();
    currentAnalysisId.current = null;
  }, [clearProjectData]);

  const handleClearCache = useCallback(async () => {
    const confirmed = window.confirm(
      "Clear all data? This will remove your current dataset and analysis. This cannot be undone."
    );
    if (!confirmed) return;
    await clearAllData();
    setGoogleConfig(null);
    setJiraConfig(null);
    clearProjectData();
    currentAnalysisId.current = null;
  }, [clearProjectData]);

  const handleDisconnectGoogle = useCallback(async () => {
    const confirmed = window.confirm("Disconnect Google Sheet and clear data?");
    if (!confirmed) return;
    setGoogleConfig(null);
    await clearAllData();
    clearProjectData();
    currentAnalysisId.current = null;
  }, [clearProjectData]);

  const handleStartBlankTemplate = useCallback(async () => {
    setIsLoading(true);
    try {
      hasUserSelectedTab.current = true;
      setRows(BLANK_TEMPLATE_ROWS);
      setFilteredRows(BLANK_TEMPLATE_ROWS);
      setFileName("Interactive Manual Dashboard");
      setLatestInsights(null);
      setAiSchema(null);
      setTruncationWarning("");
      
      setGlobalEditMode(true);
      setActiveTab("specialized_qa");

      await saveBugData(BLANK_TEMPLATE_ROWS, "Interactive Manual Dashboard");

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      currentAnalysisId.current = id;
      const record: AnalysisRecord = {
        id,
        fileName: "Interactive Manual Dashboard",
        timestamp: Date.now(),
        rowCount: BLANK_TEMPLATE_ROWS.length,
        columnCount: Object.keys(BLANK_TEMPLATE_ROWS[0]).filter(k => k !== "__sheet").length,
        hasInsights: false,
      };
      await saveAnalysisRecord(record);
    } catch (e) {
      console.error("Error setting up blank template:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInsightsGenerated = useCallback(async (insights: string) => {
    setLatestInsights(insights);
    // Update existing record instead of creating a new duplicate
    if (currentAnalysisId.current) {
      await updateAnalysisRecord(currentAnalysisId.current, {
        hasInsights: true,
        insights,
      });
    }
  }, []);

  const handleLoadRecord = useCallback((record: AnalysisRecord) => {
    if (record.insights) {
      setLatestInsights(record.insights);
    }
  }, []);

  const rawAnalysis = useMemo(() => analyzeColumns(rows), [rows]);

  const activeRows = filteredRows.length > 0 ? filteredRows : rows;
  const analysis = useMemo(() => analyzeColumns(activeRows), [activeRows]);
  const agg = useMemo(() => dynamicAggregate(activeRows, analysis), [activeRows, analysis]);

  const hasAnySpecializedData = useMemo(() => {
    if (rows.length === 0) return false;
    const prodData = getProdIssuesData(activeRows, analysis, aiSchema);
    const bugData = getBugAnalyticsData(activeRows, analysis, aiSchema);
    const coverageData = getTestCoverageData(activeRows, analysis, aiSchema);
    const manualData = getManualExecutionData(activeRows, analysis, aiSchema);
    const autoData = getAutomationExecutionData(activeRows, analysis, aiSchema);

    return (
      prodData.totalProdIssues > 0 ||
      bugData.totalBugs > 0 ||
      coverageData.totalTestCases > 0 ||
      manualData.executed > 0 ||
      autoData.totalAutoTCs > 0
    );
  }, [activeRows, analysis, aiSchema, rows]);

  const prodIssuesData = useMemo(() => {
    const base = getProdIssuesData(activeRows, analysis, aiSchema);
    return { ...base, ...(dashboardOverrides["prod_issues"] || {}) };
  }, [activeRows, analysis, aiSchema, dashboardOverrides]);

  const bugAnalyticsData = useMemo(() => {
    const base = getBugAnalyticsData(activeRows, analysis, aiSchema);
    return { ...base, ...(dashboardOverrides["bug_analytics"] || {}) };
  }, [activeRows, analysis, aiSchema, dashboardOverrides]);

  const testCoverageData = useMemo(() => {
    const base = getTestCoverageData(activeRows, analysis, aiSchema);
    return { ...base, ...(dashboardOverrides["test_coverage"] || {}) };
  }, [activeRows, analysis, aiSchema, dashboardOverrides]);

  const manualExecutionData = useMemo(() => {
    const base = getManualExecutionData(activeRows, analysis, aiSchema);
    return { ...base, ...(dashboardOverrides["manual_execution"] || {}) };
  }, [activeRows, analysis, aiSchema, dashboardOverrides]);

  const automationExecutionData = useMemo(() => {
    const base = getAutomationExecutionData(activeRows, analysis, aiSchema);
    return { ...base, ...(dashboardOverrides["automation_execution"] || {}) };
  }, [activeRows, analysis, aiSchema, dashboardOverrides]);

  useEffect(() => {
    if (hasUserSelectedTab.current || !aiSchema?.dataType) return;
    if (activeTab === "project_level") return;

    // Auto switch tabs based on detected dataset type
    if (
      aiSchema.dataType === "bug_report" ||
      aiSchema.dataType === "test_execution" ||
      aiSchema.dataType === "test_case"
    ) {
      if (hasAnySpecializedData) {
        setActiveTab("specialized_qa");
      } else {
        setActiveTab("report_explorer");
      }
    } else {
      setActiveTab("report_explorer");
    }
  }, [aiSchema, rows, hasAnySpecializedData, activeTab]);

  const handleDateFilter = useCallback((filtered: RawRow[]) => {
    setFilteredRows(filtered);
  }, []);

  const moduleRisks = useMemo(() => {
    if (activeRows.length === 0 || !aiSchema) return [];
    const moduleCol = detectModuleColumn(analysis, aiSchema);
    const riskInfo = detectRiskColumn(analysis, aiSchema);
    if (!moduleCol || !riskInfo) return [];
    return calculateModuleRisks(activeRows, moduleCol, riskInfo.column, riskInfo.type);
  }, [activeRows, analysis, aiSchema]);

  useEffect(() => {
    if (!rows.length || !rawAnalysis.columns.length) return;

    const rawAgg = dynamicAggregate(rows, rawAnalysis);
    const activeKey = getActiveApiKey(prefs);
    if (!prefs.aiEnabled || !activeKey) {
      const dt = detectDataTypeHeuristic(rawAnalysis);
      setAiSchema(generateFallbackSchema(rawAnalysis, rawAgg, dt));
      return;
    }

    let cancelled = false;
    setSchemaLoading(true);

    generateAISchema(
      activeKey,
      prefs.aiProvider || "groq",
      getActiveModel(prefs),
      rawAnalysis,
      rows
    ).then(schema => {
      if (cancelled) return;
      if (schema) {
        setAiSchema(schema);
      } else {
        const dt = detectDataTypeHeuristic(rawAnalysis);
        setAiSchema(generateFallbackSchema(rawAnalysis, rawAgg, dt));
      }
      setSchemaLoading(false);
    }).catch(() => {
      if (cancelled) return;
      const dt = detectDataTypeHeuristic(rawAnalysis);
      setAiSchema(generateFallbackSchema(rawAnalysis, rawAgg, dt));
      setSchemaLoading(false);
    });

    return () => { cancelled = true; };
  }, [rows, rawAnalysis, prefs.aiEnabled, prefs.aiProvider, prefs.aiModel, prefs.apiKeys]);

  const hasData = rows.length > 0;
  const activeKey = getActiveApiKey(prefs);
  const isFiltered = filteredRows.length !== rows.length;

  // Stable dataset key for chat history (based on file name + row count)
  const datasetKey = useMemo(() => {
    if (!fileName) return "";
    return `${fileName}-${rows.length}`.replace(/[^a-zA-Z0-9\-_]/g, "_");
  }, [fileName, rows.length]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <ThumbsUp className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">QualityLens</h1>
            {schemaLoading && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary animate-pulse">
                AI analyzing…
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <AuthWidget />
            <ProjectToolbar />
            {hasData && (
              <>
                <ExportBar
                  bugs={rows}
                  fileName={fileName}
                  analysis={analysis}
                  agg={agg}
                  visibleKPIs={visibleKPIs}
                  aiInsights={latestInsights}
                  aiSchema={aiSchema}
                  activeTab={activeTab}
                  theme={theme}
                  setTheme={setTheme}
                  globalEditMode={globalEditMode}
                  setGlobalEditMode={setGlobalEditMode}
                />
                <button
                  onClick={() => setShowSidebar(true)}
                  className="flex h-9 items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  title="Analysis History"
                >
                  <History className="h-3.5 w-3.5" />
                  History
                </button>
                <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted">
                  <UploadIcon className="h-3.5 w-3.5" />
                  New
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          if (ev.target?.result) handleFile(ev.target.result as ArrayBuffer, file.name);
                        };
                        reader.readAsArrayBuffer(file);
                      }
                      // Reset so same file can be re-uploaded
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  onClick={handleClearCache}
                  className="flex h-9 items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                  title="Clear data"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="flex h-9 w-9 items-center justify-center rounded-md border bg-card text-foreground transition-colors hover:bg-muted"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* Truncation warning banner */}
        {truncationWarning && (
          <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-2.5">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <p className="text-sm text-foreground">{truncationWarning}</p>
          </div>
        )}

        {!hasData ? (
          <div className="mx-auto max-w-xl pt-20 animate-fade-in">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 animate-pulse-glow">
                <ThumbsUp className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Universal Data Analytics</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Upload any Excel/CSV or connect Google Sheets — charts auto-adapt to your data.
              </p>
              {prefs.aiEnabled && activeKey && (
                <p className="mt-1.5 text-xs text-primary font-medium animate-pulse">✨ AI-powered insights active</p>
              )}
            </div>
            <div className="rounded-2xl border bg-card/45 p-6 backdrop-blur-sm shadow-xl">
              <Tabs defaultValue="file" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-lg">
                  <TabsTrigger value="file" className="text-xs font-semibold py-1.5 rounded-md">Upload File</TabsTrigger>
                  <TabsTrigger value="sheets" className="text-xs font-semibold py-1.5 rounded-md">Google Sheets</TabsTrigger>
                  <TabsTrigger value="jira" className="text-xs font-semibold py-1.5 rounded-md">Jira Connect</TabsTrigger>
                </TabsList>

                <TabsContent value="file" className="mt-2 outline-none">
                  <FileUpload onFileLoaded={handleFile} isLoading={isLoading} />
                </TabsContent>

                <TabsContent value="sheets" className="mt-2 outline-none">
                  <GoogleSheetsConnect
                    googleApiKey={prefs.googleSheetsApiKey}
                    onSheetLoaded={handleGoogleSheet}
                    onMultipleSheets={handleGoogleSheetsMulti}
                    activeConfig={null}
                    onDisconnect={() => { }}
                  />
                </TabsContent>

                <TabsContent value="jira" className="mt-2 outline-none">
                  <JiraConnect
                    preferences={prefs}
                    onJiraLoaded={handleJiraLoaded}
                    onProjectsFetched={handleJiraProjectsFetched}
                    activeConfig={null}
                    onDisconnect={() => { }}
                    onSavePreferences={handleSavePrefs}
                  />
                </TabsContent>
              </Tabs>

              <div className="mt-6 pt-6 border-t border-border/60">
                <div className="flex flex-col items-center text-center space-y-2.5">
                  <div className="text-xs text-muted-foreground font-medium">No data source or API connections?</div>
                  <button
                    onClick={handleStartBlankTemplate}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4.5 py-2.5 text-xs font-bold text-primary-foreground shadow-lg hover:bg-primary/95 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                  >
                    <Plus className="h-4 w-4" />
                    Start with Blank Interactive Report
                  </button>
                  <p className="text-[10px] text-muted-foreground/80 leading-normal max-w-sm">
                    This pre-populates editable template slides so you can build your charts and key metrics manually.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-6 text-center">
              <button
                onClick={() => setShowSidebar(true)}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <History className="h-3.5 w-3.5" />
                View Analysis History
              </button>
            </div>
          </div>
        ) : (
          <div id="dashboard-content" className="space-y-6">
            {googleConfig && (
              <GoogleSheetsConnect
                googleApiKey={prefs.googleSheetsApiKey}
                onSheetLoaded={handleGoogleSheet}
                onMultipleSheets={handleGoogleSheetsMulti}
                activeConfig={googleConfig}
                onDisconnect={handleDisconnectGoogle}
              />
            )}

            {jiraConfig && (
              <JiraConnect
                preferences={prefs}
                onJiraLoaded={handleJiraLoaded}
                onProjectsFetched={handleJiraProjectsFetched}
                activeConfig={jiraConfig}
                onDisconnect={handleDisconnectJira}
                onSavePreferences={handleSavePrefs}
                rowCount={rows.length}
              />
            )}

            <div className="flex items-center gap-3">
              <DateRangeFilter
                rows={rows}
                analysis={rawAnalysis}
                onFilteredRows={handleDateFilter}
              />
              {isFiltered && (
                <span className="text-xs text-muted-foreground">
                  Showing <b className="text-foreground">{activeRows.length.toLocaleString()}</b> of {rows.length.toLocaleString()} rows
                </span>
              )}
            </div>

            <Tabs
              value={activeTab}
              onValueChange={(v) => {
                hasUserSelectedTab.current = true;
                setActiveTab(v);
              }}
              className="space-y-6"
            >
              <TabsList className="flex h-auto flex-wrap items-center justify-start gap-1.5 border border-border bg-card/45 p-1.5 backdrop-blur-md rounded-xl">
                <TabsTrigger value="project_level" className="rounded-lg px-4 py-2 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Project Level Dashboard
                </TabsTrigger>
                <TabsTrigger value="report_explorer" className="rounded-lg px-4 py-2 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Report Explorer
                </TabsTrigger>
                <TabsTrigger value="specialized_qa" className="rounded-lg px-4 py-2 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Specialized QA Dashboards
                </TabsTrigger>
              </TabsList>

              <TabsContent id="tab-project_level" value="project_level" className="mt-4 outline-none space-y-8 animate-fade-in">
                <ProjectLevelDashboard isEditable={globalEditMode} theme={theme} data={projectLevelData} onUpdateData={setProjectLevelData} />
              </TabsContent>

              <TabsContent id="tab-report_explorer" value="report_explorer" className="mt-4 outline-none space-y-8 animate-fade-in">
                <div data-pdf-page="dashboard">
                  <DynamicKPICards
                    analysis={analysis}
                    agg={agg}
                    fileName={fileName}
                    aiSchema={aiSchema}
                    onVisibleKPIsChange={setVisibleKPIs}
                  />
                </div>

                <div data-pdf-page="dashboard">
                  <DynamicCharts rows={activeRows} analysis={analysis} agg={agg} aiSchema={aiSchema} theme={theme} />
                </div>

                <div data-healthmap-card data-pdf-page="dashboard" className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="mb-4 text-sm font-semibold text-foreground">Module Health Map</h3>
                  <ModuleHealthMap rows={activeRows} analysis={analysis} agg={agg} aiSchema={aiSchema} theme={theme} />
                </div>

                {prefs.aiEnabled && activeKey && (
                  <div data-pdf-page="dashboard">
                    <AIInsightsPanel
                      apiKey={activeKey}
                      provider={prefs.aiProvider || "groq"}
                      model={getActiveModel(prefs)}
                      agg={agg}
                      bugs={activeRows}
                      datasetKey={datasetKey}
                      moduleRisks={moduleRisks}
                      initialInsights={latestInsights}
                      onInsightsGenerated={handleInsightsGenerated}
                      analysis={analysis}
                      aiSchema={aiSchema}
                    />
                  </div>
                )}

                <div data-pdf-page="dashboard" className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="mb-3 text-sm font-semibold text-foreground">
                    Data Records
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                      {activeRows.length.toLocaleString()} rows
                    </span>
                    {isFiltered && (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-normal text-primary">
                        filtered
                      </span>
                    )}
                  </h3>
                  <DynamicTable
                    key={fileName}
                    rows={activeRows}
                    analysis={analysis}
                    onSelectRow={setSelectedRow}
                  />
                </div>
              </TabsContent>

              <TabsContent id="tab-specialized_qa" value="specialized_qa" className="mt-4 outline-none space-y-8 animate-fade-in">
                {/* Global Edit Mode Switch */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-border bg-card shadow-lg backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl transition-colors ${globalEditMode ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {globalEditMode ? <Unlock className="h-4.5 w-4.5" /> : <Lock className="h-4.5 w-4.5" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Interactive Dashboard Editor</h3>
                      <p className="text-xs text-muted-foreground">
                        {globalEditMode
                          ? "Edit Mode Active: Click on any cell, label, list item, or metric to edit values in-place."
                          : "Read-Only Mode: Enable edit mode to customize metrics, tables, and charts."
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                    <span className="text-xs font-semibold text-muted-foreground">{globalEditMode ? "Editing Enabled" : "Read-Only"}</span>
                    <button
                      onClick={() => setGlobalEditMode(!globalEditMode)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${globalEditMode ? "bg-primary" : "bg-muted"
                        }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${globalEditMode ? "translate-x-5" : "translate-x-0"
                          }`}
                      />
                    </button>
                  </div>
                </div>

                {/* 1. Production Issues & Analytics */}
                {showProdIssues && (
                  <div data-pdf-page="dashboard" className="rounded-2xl border border-border bg-card p-6 shadow-xl space-y-6">
                    <ProdIssuesDashboard
                      rows={activeRows}
                      analysis={analysis}
                      aiSchema={aiSchema}
                      data={prodIssuesData}
                      onUpdateData={(newData) => updateDashboardOverride("prod_issues", newData)}
                      onReset={() => resetDashboardOverride("prod_issues")}
                      hasOverrides={!!dashboardOverrides["prod_issues"]}
                      isEditable={globalEditMode}
                      theme={theme}
                      onDelete={() => setSlideVisible("prod_issues", false)}
                    />
                    <DashboardNotesList
                      dashboardId="prod_issues"
                      notes={dashboardNotes["prod_issues"]}
                      onAddNote={handleAddNote}
                      onDeleteNote={handleDeleteNote}
                      isEditable={globalEditMode}
                    />
                  </div>
                )}

                {/* 2. Defect Metrics & Bug Analytics */}
                {showBugAnalytics && (
                  <div data-pdf-page="dashboard" className="rounded-2xl border border-border bg-card p-6 shadow-xl space-y-6">
                    <BugAnalyticsDashboard
                      rows={activeRows}
                      analysis={analysis}
                      aiSchema={aiSchema}
                      data={bugAnalyticsData}
                      onUpdateData={(newData) => updateDashboardOverride("bug_analytics", newData)}
                      onReset={() => resetDashboardOverride("bug_analytics")}
                      hasOverrides={!!dashboardOverrides["bug_analytics"]}
                      isEditable={globalEditMode}
                      theme={theme}
                      onDelete={() => setSlideVisible("bug_analytics", false)}
                    />
                    <DashboardNotesList
                      dashboardId="bug_analytics"
                      notes={dashboardNotes["bug_analytics"]}
                      onAddNote={handleAddNote}
                      onDeleteNote={handleDeleteNote}
                      isEditable={globalEditMode}
                    />
                  </div>
                )}

                {/* 3. Test Coverage & Requirement Analysis */}
                {showTestCoverage && (
                  <div data-pdf-page="dashboard" className="rounded-2xl border border-border bg-card p-6 shadow-xl space-y-6">
                    <TestCoverageDashboard
                      rows={activeRows}
                      analysis={analysis}
                      aiSchema={aiSchema}
                      data={testCoverageData}
                      onUpdateData={(newData) => updateDashboardOverride("test_coverage", newData)}
                      onReset={() => resetDashboardOverride("test_coverage")}
                      hasOverrides={!!dashboardOverrides["test_coverage"]}
                      isEditable={globalEditMode}
                      theme={theme}
                      onDelete={() => setSlideVisible("test_coverage", false)}
                    />
                    <DashboardNotesList
                      dashboardId="test_coverage"
                      notes={dashboardNotes["test_coverage"]}
                      onAddNote={handleAddNote}
                      onDeleteNote={handleDeleteNote}
                      isEditable={globalEditMode}
                    />
                  </div>
                )}

                {/* 4. Manual Test Execution */}
                {showManualExecution && (
                  <div data-pdf-page="dashboard" className="rounded-2xl border border-border bg-card p-6 shadow-xl space-y-6">
                    <ManualExecutionDashboard
                      rows={activeRows}
                      analysis={analysis}
                      aiSchema={aiSchema}
                      data={manualExecutionData}
                      onUpdateData={(newData) => updateDashboardOverride("manual_execution", newData)}
                      onReset={() => resetDashboardOverride("manual_execution")}
                      hasOverrides={!!dashboardOverrides["manual_execution"]}
                      isEditable={globalEditMode}
                      theme={theme}
                      onDelete={() => setSlideVisible("manual_execution", false)}
                    />
                    <DashboardNotesList
                      dashboardId="manual_execution"
                      notes={dashboardNotes["manual_execution"]}
                      onAddNote={handleAddNote}
                      onDeleteNote={handleDeleteNote}
                      isEditable={globalEditMode}
                    />
                  </div>
                )}

                {/* 5. Automation Test Execution */}
                {showAutomationExecution && (
                  <div data-pdf-page="dashboard" className="rounded-2xl border border-border bg-card p-6 shadow-xl space-y-6">
                    <AutomationExecutionDashboard
                      rows={activeRows}
                      analysis={analysis}
                      aiSchema={aiSchema}
                      data={automationExecutionData}
                      onUpdateData={(newData) => updateDashboardOverride("automation_execution", newData)}
                      onReset={() => resetDashboardOverride("automation_execution")}
                      hasOverrides={!!dashboardOverrides["automation_execution"]}
                      isEditable={globalEditMode}
                      theme={theme}
                      onDelete={() => setSlideVisible("automation_execution", false)}
                    />
                    <DashboardNotesList
                      dashboardId="automation_execution"
                      notes={dashboardNotes["automation_execution"]}
                      onAddNote={handleAddNote}
                      onDeleteNote={handleDeleteNote}
                      isEditable={globalEditMode}
                    />
                  </div>
                )}

                {/* 6. New Initiatives */}
                {showNewInitiatives && (
                  <div data-pdf-page="dashboard" className="rounded-2xl border border-border bg-card p-6 shadow-xl space-y-6">
                    <NewInitiativesDashboard
                      onDelete={() => setSlideVisible("new_initiatives", false)}
                      isEditable={globalEditMode}
                      data={newInitiativesData}
                      onUpdateData={setNewInitiativesData}
                    />
                    <DashboardNotesList
                      dashboardId="new_initiatives"
                      notes={dashboardNotes["new_initiatives"]}
                      onAddNote={handleAddNote}
                      onDeleteNote={handleDeleteNote}
                      isEditable={globalEditMode}
                    />
                  </div>
                )}

                {/* 7. Risk & Mitigation */}
                {showRiskMitigation && (
                  <div data-pdf-page="dashboard" className="rounded-2xl border border-border bg-card p-6 shadow-xl space-y-6">
                    <RiskMitigationDashboard
                      onDelete={() => setSlideVisible("risk_mitigation", false)}
                      isEditable={globalEditMode}
                      data={riskMitigationData}
                      onUpdateData={setRiskMitigationData}
                    />
                    <DashboardNotesList
                      dashboardId="risk_mitigation"
                      notes={dashboardNotes["risk_mitigation"]}
                      onAddNote={handleAddNote}
                      onDeleteNote={handleDeleteNote}
                      isEditable={globalEditMode}
                    />
                  </div>
                )}

                {/* Optional slides restoration button */}
                {(!showProdIssues || !showBugAnalytics || !showTestCoverage || !showManualExecution || !showAutomationExecution || !showNewInitiatives || !showRiskMitigation) && (
                  <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl border border-dashed border-border bg-muted/10">
                    <span className="text-xs font-semibold text-muted-foreground mr-1">Optional Slides:</span>
                    {!showProdIssues && (
                      <Button
                        onClick={() => setSlideVisible("prod_issues", true)}
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1.5 h-8 border-dashed"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Prod Issues Slide
                      </Button>
                    )}
                    {!showBugAnalytics && (
                      <Button
                        onClick={() => setSlideVisible("bug_analytics", true)}
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1.5 h-8 border-dashed"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Bug Analytics Slide
                      </Button>
                    )}
                    {!showTestCoverage && (
                      <Button
                        onClick={() => setSlideVisible("test_coverage", true)}
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1.5 h-8 border-dashed"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Test Coverage Slide
                      </Button>
                    )}
                    {!showManualExecution && (
                      <Button
                        onClick={() => setSlideVisible("manual_execution", true)}
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1.5 h-8 border-dashed"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Manual Execution Slide
                      </Button>
                    )}
                    {!showAutomationExecution && (
                      <Button
                        onClick={() => setSlideVisible("automation_execution", true)}
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1.5 h-8 border-dashed"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Automation Execution Slide
                      </Button>
                    )}
                    {!showNewInitiatives && (
                      <Button
                        onClick={() => setSlideVisible("new_initiatives", true)}
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1.5 h-8 border-dashed"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add New Initiatives Slide
                      </Button>
                    )}
                    {!showRiskMitigation && (
                      <Button
                        onClick={() => setSlideVisible("risk_mitigation", true)}
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1.5 h-8 border-dashed"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Risk & Mitigation Slide
                      </Button>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>

      <DynamicDetailDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />

      {pendingSheets && (
        <SheetSelector
          sheets={pendingSheets}
          onSelect={handleSheetsSelected}
          onCancel={() => setPendingSheets(null)}
        />
      )}

      {pendingJiraProjects && (
        <ProjectSelector
          projects={pendingJiraProjects}
          onSelect={handleJiraProjectsSelected}
          onCancel={() => {
            setPendingJiraProjects(null);
            setPendingJiraConfig(null);
          }}
          initialSelected={pendingJiraConfig?.selectedProjects}
        />
      )}

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        preferences={prefs}
        onSave={handleSavePrefs}
      />

      <InsightsSidebar
        open={showSidebar}
        onClose={() => setShowSidebar(false)}
        onLoadRecord={handleLoadRecord}
      />
    </div>
  );
}

interface DashboardNotesListProps {
  dashboardId: string;
  notes?: string[];
  onAddNote: (dashboardId: string, text: string) => void;
  onDeleteNote: (dashboardId: string, index: number) => void;
  isEditable?: boolean;
}

function DashboardNotesList({
  dashboardId,
  notes = [],
  onAddNote,
  onDeleteNote,
  isEditable = false
}: DashboardNotesListProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [tempNote, setTempNote] = useState("");

  const handleSave = () => {
    if (tempNote.trim()) {
      onAddNote(dashboardId, tempNote);
      setTempNote("");
      setIsAdding(false);
    }
  };

  if (!isEditable && notes.length === 0) return null;

  return (
    <div className="border-t border-border/50 pt-4 mt-2 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 select-none">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Commentary & Notes
        </span>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="text-[10px] text-primary hover:underline font-semibold"
          >
            + Add Note
          </button>
        )}
      </div>

      {notes.length > 0 ? (
        <div className="space-y-1.5 pl-1.5">
          {notes.map((note, index) => (
            <div key={index} className="flex items-start gap-2 text-xs text-foreground/90 group/note leading-relaxed">
              <span className="text-primary font-bold font-mono shrink-0 select-none">*</span>
              <span className="flex-1 break-words">{note}</span>
              <button
                onClick={() => onDeleteNote(dashboardId, index)}
                className="opacity-0 group-hover/note:opacity-100 text-[10px] text-destructive hover:underline transition-opacity shrink-0 ml-2"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      ) : (
        <span></span>
      )}

      {isAdding && (
        <div className="flex items-center gap-2 max-w-lg animate-fade-in pl-1.5">
          <input
            type="text"
            placeholder="Add a minimalistic note..."
            value={tempNote}
            onChange={e => setTempNote(e.target.value)}
            className="flex h-8 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-xs shadow-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setIsAdding(false);
            }}
          />
          <button
            onClick={handleSave}
            className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 shadow transition-colors shrink-0"
          >
            Add
          </button>
          <button
            onClick={() => setIsAdding(false)}
            className="h-8 px-2 rounded-md hover:bg-muted text-muted-foreground text-xs transition-colors shrink-0"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}