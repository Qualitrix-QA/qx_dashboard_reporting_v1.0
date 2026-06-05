// Raw row from any spreadsheet — actual column names preserved
export type RawRow = Record<string, string>;

// Column analysis result
export type ColumnType = "categorical" | "numeric" | "id" | "text" | "url" | "date";

export type ColumnAnalysis = {
  name: string;
  type: ColumnType;
  uniqueCount: number;
  totalCount: number;
  topValues: { value: string; count: number }[];
  fillRate: number; // percentage of non-empty values
};

export type ChartSuggestion = {
  type: "pie" | "hbar" | "vbar" | "heatmap" | "stacked_bar" | "line";
  columns: string[]; // 1 for simple, 2 for cross-analysis
  title: string;
  priority: number; // higher = more important
};

export type DataAnalysis = {
  columns: ColumnAnalysis[];
  chartSuggestions: ChartSuggestion[];
  kpiColumns: string[]; // columns to show as KPI cards
  totalRows: number;
};

export type DataFormat = "bug_report" | "test_case" | "generic";

export type GoogleSheetsConfig = {
  url: string;
  sheetId: string;
  gid?: string;
  sheetName?: string;
  pollInterval: number;
  lastFetched?: number;
};

export type JiraConfig = {
  host: string;
  email: string;
  apiToken: string;
  jql: string;
  useProxy: boolean;
  proxyUrl?: string;
  pollInterval: number;
  lastFetched?: number;
  projectKey?: string;
  projects?: { id: string; key: string; name: string }[];
  selectedProjects?: string[];
};

// Multi-provider AI support
export type AIProvider = "groq" | "openai" | "google" | "anthropic";

export type AIProviderConfig = {
  id: AIProvider;
  name: string;
  baseUrl: string;
  models: { id: string; name: string; maxTokens: number }[];
  keyPrefix: string;
  keyUrl: string;
 };

export type UserPreferences = {
  theme: "light" | "dark";
  aiEnabled: boolean;
  groqApiKey?: string;
  aiProvider?: AIProvider;
  aiModel?: string;
  apiKeys?: Partial<Record<AIProvider, string>>;
  googleSheetsApiKey?: string;
  jiraHost?: string;
  jiraEmail?: string;
  jiraApiToken?: string;
  jiraJql?: string;
  jiraUseProxy?: boolean;
  jiraProxyUrl?: string;
  jiraSelectedProjects?: string[];
};

// Legacy compat - keep for template fingerprints
export type TemplateFingerprint = {
  id: string;
  headers: string[];
  sheetName: string;
  mapping: Record<string, string | null>;
  createdAt: number;
};

// Aggregations are now dynamic
export type DynamicAggregations = {
  total: number;
  columnCounts: Record<string, Record<string, number>>; // columnName -> { value: count }
};

// Keep old type name as alias for backward compat in AI insights
export type BugRow = RawRow;
export type Aggregations = DynamicAggregations;

// ─── NEW: Detected data type (more specific than DataFormat) ─────────────────
export type DetectedDataType = "bug_report" | "test_execution" | "test_case" | "generic";

// ─── NEW: AI Schema — structured JSON the AI returns to drive the dashboard ──
export type AISchemaKPI = {
  id: string;
  label: string;
  column: string;         // which column to derive this from
  value?: string;         // specific value to count (e.g., "Critical")
  type: "count" | "count_value" | "percentage" | "ratio";
  format?: string;        // display format hint
  color?: "red" | "orange" | "yellow" | "green" | "blue" | "purple" | "gray";
};

export type AISchemaChart = {
  id: string;
  type: "pie" | "hbar" | "vbar" | "heatmap" | "stacked_bar" | "line";
  title: string;
  columns: string[];      // 1 for simple, 2 for cross-analysis
  priority: number;
};

export type AISchemaColumnMap = {
  moduleColumn?: string;
  severityColumn?: string;
  priorityColumn?: string;
  statusColumn?: string;
  resultColumn?: string;
  typeColumn?: string;
  assigneeColumn?: string;
  releaseColumn?: string;
};

export type AISchema = {
  dataType: DetectedDataType;
  kpis: AISchemaKPI[];
  charts: AISchemaChart[];
  columnMap: AISchemaColumnMap;
  summary: string;        // one-line description of the dataset
};

// ─── NEW: RAG chunk types ────────────────────────────────────────────────────
export type RAGChunk = {
  id: string;
  type: "column_distribution" | "value_detail" | "cross_column" | "summary" | "metadata";
  text: string;
  keywords: string[];     // for keyword matching at query time
  weight: number;         // base relevance weight
};

// ─── NEW: Module risk types ──────────────────────────────────────────────────
export type ModuleRiskData = {
  module: string;
  total: number;
  riskScore: number;
  riskLevel: "Critical" | "High" | "Medium" | "Low" | "Safe";
  breakdown: Record<string, number>; // e.g., { Critical: 5, High: 3, ... }
};
