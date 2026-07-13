import { useState, useMemo, useEffect } from "react";
import { Sparkles, Edit3, Trash2, Plus, Search, HelpCircle, Activity, LayoutGrid, CheckCircle } from "lucide-react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart, PieChart, LineChart } from "echarts/charts";
import { TooltipComponent, GridComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { Button } from "@/components/ui/button";

echarts.use([BarChart, PieChart, LineChart, TooltipComponent, GridComponent, LegendComponent, CanvasRenderer]);

export interface ProjectLevelData {
  // Row 1 KPIs
  totalExecutable: number;
  totalExecuted: number; // %
  totalPass: number; // %
  totalFail: number; // %
  totalBlocked: number; // %
  totalNoRun: number; // %
  executionVelocity: number; // %

  // Row 2 KPIs
  totalDefects: number;
  totalOpenDefects: number;
  openDefectsHighCritical: number;
  defectDensity: number; // %
  reopenRatio: number; // %

  // Filter list data
  projects: string[];
  sprints: string[];

  // Chart data
  projectWiseRAG: { name: string; value: number }[]; // Red, Yellow, Green
  sprintWiseRAG: { name: string; value: number }[]; // Red, Yellow, Green

  defectsAging: {
    bucket: string; // "0-5", "6-10", "11+"
    critical: number;
    high: number;
    medium: number;
    low: number;
  }[];

  defectDensityTrend: { name: string; rate: number }[];
  executionVelocityTrend: { name: string; rate: number }[];
}

export const defaultProjectData: ProjectLevelData = {
  totalExecutable: 59585,
  totalExecuted: 89,
  totalPass: 88,
  totalFail: 1,
  totalBlocked: 3,
  totalNoRun: 9,
  executionVelocity: 88,
  totalDefects: 6119,
  totalOpenDefects: 751,
  openDefectsHighCritical: 201,
  defectDensity: 12,
  reopenRatio: 32,

  projects: ["CIB", "Intuition", "ODD"],
  sprints: ["Peripheral System:", "Regression", "SIT", "Sprint 1", "Sprint 2", "Sprint 3"],

  projectWiseRAG: [
    { name: "Green", value: 3 },
    { name: "Yellow", value: 1 },
    { name: "Red", value: 1 }
  ],
  sprintWiseRAG: [
    { name: "Green", value: 11 },
    { name: "Yellow", value: 5 },
    { name: "Red", value: 4 }
  ],

  defectsAging: [
    { bucket: "0-5", critical: 27, high: 109, low: 61, medium: 273 },
    { bucket: "6-10", critical: 6, high: 26, low: 12, medium: 49 },
    { bucket: "11+", critical: 7, high: 26, low: 23, medium: 132 }
  ],

  defectDensityTrend: [
    { name: "Peripheral...", rate: 29 },
    { name: "Regression", rate: 4 },
    { name: "SIT", rate: 6 },
    { name: "Sprint 1", rate: 6 },
    { name: "Sprint 2", rate: 7 },
    { name: "Sprint 3", rate: 17 },
    { name: "Sprint 4", rate: 170 },
    { name: "Sprint 5", rate: 111 },
    { name: "Sprint 6", rate: 53 },
    { name: "Sprint 7", rate: 19 },
    { name: "Sprint 8", rate: 14 },
    { name: "Sprint 9", rate: 11 }
  ],

  executionVelocityTrend: [
    { name: "Peripheral...", rate: 64 },
    { name: "Regression", rate: 99 },
    { name: "SIT", rate: 30 },
    { name: "Sprint 1", rate: 90 },
    { name: "Sprint 2", rate: 100 },
    { name: "Sprint 3", rate: 100 },
    { name: "Sprint 4", rate: 100 },
    { name: "Sprint 5", rate: 100 },
    { name: "Sprint 6", rate: 100 },
    { name: "Sprint 7", rate: 100 },
    { name: "Sprint 8", rate: 100 },
    { name: "Sprint 9", rate: 95 }
  ]
};

interface Props {
  isEditable?: boolean;
  theme?: "light" | "dark";
  data: ProjectLevelData;
  onUpdateData: (data: ProjectLevelData) => void;
}

export function ProjectLevelDashboard({ isEditable = false, theme, data: baseData = defaultProjectData, onUpdateData }: Props) {
  const setBaseData = (newData: ProjectLevelData) => {
    onUpdateData(newData);
  };

  const resetToDefault = () => {
    if (window.confirm("Are you sure you want to reset dashboard metrics to default mockup data?")) {
      onUpdateData(defaultProjectData);
    }
  };

  // Filters State
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedSprint, setSelectedSprint] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState("");
  const [sprintSearch, setSprintSearch] = useState("");

  // Editors Collapsible State
  const [showRAGEditor, setShowRAGEditor] = useState(false);
  const [showAgingEditor, setShowAgingEditor] = useState(false);
  const [showDensityEditor, setShowDensityEditor] = useState(false);
  const [showVelocityEditor, setShowVelocityEditor] = useState(false);

  // Dynamic multipliers based on active filters for immersive premium feel
  const activeScale = useMemo(() => {
    let scale = 1.0;
    if (selectedProject === "CIB") scale *= 0.45;
    else if (selectedProject === "Intuition") scale *= 0.35;
    else if (selectedProject === "ODD") scale *= 0.20;

    if (selectedSprint === "Peripheral System:") scale *= 0.12;
    else if (selectedSprint === "Regression") scale *= 0.32;
    else if (selectedSprint === "SIT") scale *= 0.22;
    else if (selectedSprint === "Sprint 1") scale *= 0.14;
    else if (selectedSprint === "Sprint 2") scale *= 0.16;
    else if (selectedSprint === "Sprint 3") scale *= 0.08;

    return scale;
  }, [selectedProject, selectedSprint]);

  // Scaled Data representing the filtered results
  const liveData = useMemo(() => {
    const scale = (val: number) => Math.round(val * (activeScale / 100));
    return {
      ...baseData,
      totalExecutable: scale(baseData.totalExecutable),
      totalDefects: scale(baseData.totalDefects),
      totalOpenDefects: scale(baseData.totalOpenDefects),
      openDefectsHighCritical: scale(baseData.openDefectsHighCritical),
      // Charts data scales proportionately
      projectWiseRAG: baseData.projectWiseRAG.map(item => ({
        ...item,
        value: scale(item.value)
      })),
      sprintWiseRAG: baseData.sprintWiseRAG.map(item => ({
        ...item,
        value: scale(item.value)
      })),
      defectsAging: baseData.defectsAging.map(item => ({
        ...item,
        critical: scale(item.critical),
        high: scale(item.high),
        medium: scale(item.medium),
        low: scale(item.low)
      }))
    };
  }, [baseData, activeScale]);

  // Handle in-place KPI edits (updates the base data model)
  const handleKPIChange = (key: keyof ProjectLevelData, val: string) => {
    const num = Math.max(0, parseInt(val) || 0);
    setBaseData(prev => ({
      ...prev,
      [key]: num
    }));
  };

  // Filter lists based on searches
  const filteredProjects = useMemo(() => {
    return baseData.projects.filter(p => p.toLowerCase().includes(projectSearch.toLowerCase()));
  }, [baseData.projects, projectSearch]);

  const filteredSprints = useMemo(() => {
    return baseData.sprints.filter(s => s.toLowerCase().includes(sprintSearch.toLowerCase()));
  }, [baseData.sprints, sprintSearch]);

  const isDark = theme !== "light";
  const colors = {
    text: isDark ? "#e2e8f0" : "#475569",
    subText: isDark ? "#94a3b8" : "#64748b",
    line: isDark ? "#334155" : "#cbd5e1",
    grid: isDark ? "#1e293b" : "#f1f5f9",
    label: isDark ? "#e2e8f0" : "#475569",
  };

  // ECharts Configurations
  const projectWiseRAGOption = useMemo(() => {
    const ragColors = { Green: "#10b981", Yellow: "#f59e0b", Red: "#ef4444" };
    return {
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(15,15,20,0.95)",
        borderColor: "rgba(255,255,255,0.15)",
        textStyle: { color: "#e2e8f0", fontSize: 11 }
      },
      series: [
        {
          type: "pie",
          radius: ["40%", "75%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 4,
            borderColor: "transparent",
            borderWidth: 2
          },
          label: { show: false },
          labelLine: { show: false },
          data: liveData.projectWiseRAG.map(d => ({
            ...d,
            itemStyle: { color: ragColors[d.name as keyof typeof ragColors] || "#94a3b8" }
          }))
        }
      ]
    };
  }, [liveData.projectWiseRAG, isDark]);

  const sprintWiseRAGOption = useMemo(() => {
    const ragColors = { Green: "#10b981", Yellow: "#f59e0b", Red: "#ef4444" };
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(15,15,20,0.95)",
        borderColor: "rgba(255,255,255,0.15)",
        textStyle: { color: "#e2e8f0", fontSize: 11 }
      },
      grid: { left: 45, right: 10, top: 5, bottom: 20 },
      xAxis: {
        type: "value",
        axisLabel: { fontSize: 9, color: colors.subText },
        splitLine: { lineStyle: { color: colors.grid, type: "dashed" } }
      },
      yAxis: {
        type: "category",
        data: liveData.sprintWiseRAG.map(d => d.name),
        axisLabel: { fontSize: 9, color: colors.subText },
        axisLine: { lineStyle: { color: colors.line } }
      },
      series: [
        {
          type: "bar",
          data: liveData.sprintWiseRAG.map(d => ({
            value: d.value,
            itemStyle: { color: ragColors[d.name as keyof typeof ragColors] || "#94a3b8", borderRadius: [0, 4, 4, 0] }
          })),
          barMaxWidth: 12
        }
      ]
    };
  }, [liveData.sprintWiseRAG, isDark]);

  const defectsAgingOption = useMemo(() => {
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(15,15,20,0.95)",
        borderColor: "rgba(255,255,255,0.15)",
        textStyle: { color: "#e2e8f0", fontSize: 11 }
      },
      legend: {
        data: ["Critical", "High", "Medium", "Low"],
        textStyle: { color: colors.subText, fontSize: 10 },
        top: 0
      },
      grid: { left: 35, right: 10, top: 35, bottom: 20 },
      xAxis: {
        type: "category",
        data: liveData.defectsAging.map(d => d.bucket),
        axisLabel: { fontSize: 10, color: colors.subText },
        axisLine: { lineStyle: { color: colors.line } }
      },
      yAxis: {
        type: "value",
        axisLabel: { fontSize: 10, color: colors.subText },
        splitLine: { lineStyle: { color: colors.grid, type: "dashed" } }
      },
      series: [
        {
          name: "Critical",
          type: "bar",
          stack: "severity",
          data: liveData.defectsAging.map(d => d.critical),
          itemStyle: { color: "#ef4444" },
          barMaxWidth: 20
        },
        {
          name: "High",
          type: "bar",
          stack: "severity",
          data: liveData.defectsAging.map(d => d.high),
          itemStyle: { color: "#3b82f6" }
        },
        {
          name: "Medium",
          type: "bar",
          stack: "severity",
          data: liveData.defectsAging.map(d => d.medium),
          itemStyle: { color: "#f59e0b" }
        },
        {
          name: "Low",
          type: "bar",
          stack: "severity",
          data: liveData.defectsAging.map(d => d.low),
          itemStyle: { color: "#10b981", borderRadius: [4, 4, 0, 0] }
        }
      ]
    };
  }, [liveData.defectsAging, isDark]);

  const densityOption = useMemo(() => {
    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(15,15,20,0.95)",
        borderColor: "rgba(255,255,255,0.15)",
        textStyle: { color: "#e2e8f0", fontSize: 11 },
        formatter: "{b}: <b>{c}%</b>"
      },
      grid: { left: 40, right: 15, top: 20, bottom: 40 },
      xAxis: {
        type: "category",
        data: baseData.defectDensityTrend.map(d => d.name),
        axisLabel: { rotate: 30, fontSize: 9, color: colors.subText },
        axisLine: { lineStyle: { color: colors.line } }
      },
      yAxis: {
        type: "value",
        axisLabel: { formatter: "{value}%", fontSize: 9, color: colors.subText },
        splitLine: { lineStyle: { color: colors.grid, type: "dashed" } }
      },
      series: [
        {
          type: "line",
          data: baseData.defectDensityTrend.map(d => d.rate),
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          itemStyle: { color: "#06b6d4" },
          lineStyle: { width: 2.5 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(6,182,212,0.25)" },
              { offset: 1, color: "rgba(6,182,212,0.0)" }
            ])
          },
          label: {
            show: true,
            position: "top",
            formatter: "{c}%",
            color: colors.label,
            fontSize: 8,
            fontWeight: "semibold"
          }
        }
      ]
    };
  }, [baseData.defectDensityTrend, isDark]);

  const velocityOption = useMemo(() => {
    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(15,15,20,0.95)",
        borderColor: "rgba(255,255,255,0.15)",
        textStyle: { color: "#e2e8f0", fontSize: 11 },
        formatter: "{b}: <b>{c}%</b>"
      },
      grid: { left: 40, right: 15, top: 20, bottom: 40 },
      xAxis: {
        type: "category",
        data: baseData.executionVelocityTrend.map(d => d.name),
        axisLabel: { rotate: 30, fontSize: 9, color: colors.subText },
        axisLine: { lineStyle: { color: colors.line } }
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 100,
        axisLabel: { formatter: "{value}%", fontSize: 9, color: colors.subText },
        splitLine: { lineStyle: { color: colors.grid, type: "dashed" } }
      },
      series: [
        {
          type: "line",
          data: baseData.executionVelocityTrend.map(d => d.rate),
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          itemStyle: { color: "#10b981" },
          lineStyle: { width: 2.5 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(16,185,129,0.25)" },
              { offset: 1, color: "rgba(16,185,129,0.0)" }
            ])
          },
          label: {
            show: true,
            position: "top",
            formatter: "{c}%",
            color: colors.label,
            fontSize: 8,
            fontWeight: "semibold"
          }
        }
      ]
    };
  }, [baseData.executionVelocityTrend, isDark]);

  return (
    <div className="space-y-6">
      {/* Top Layout Grid: Left Filters, Right KPIs & Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start" data-pdf-page="dashboard">
        
        {/* Left Column (Col-Span 2): Title and Filters */}
        <div className="lg:col-span-2 space-y-4 flex flex-col">
          {/* Cyan Title Card */}
          <div className="relative">
            <div className="bg-[#0097a7] text-white font-extrabold text-xs rounded-lg shadow border border-[#00bcd4]/30 select-none tracking-wide text-center py-3.5 px-4 h-[52px] flex items-center justify-center uppercase">
              Project Level Dashboard
            </div>
            {isEditable && (
              <button
                onClick={resetToDefault}
                className="absolute -top-2 -right-2 px-1.5 py-0.5 text-[8px] bg-destructive text-white rounded border border-destructive/20 hover:bg-destructive/90 transition-all font-bold shadow-md z-20"
                title="Reset customization to mockup values"
              >
                Reset
              </button>
            )}
          </div>

          {/* 1. Projects Panel */}
          <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm space-y-3">
            <div className="relative">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search Product..."
                value={projectSearch}
                onChange={e => setProjectSearch(e.target.value)}
                className="w-full bg-muted/40 border border-border rounded pl-7 pr-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary/50"
              />
            </div>
            <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto pr-1">
              <button
                onClick={() => setSelectedProject(null)}
                className={`w-full text-left text-xs px-2.5 py-1.5 rounded transition-all font-semibold flex items-center justify-between ${
                  selectedProject === null
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <span>ALL PRODUCTS</span>
                {selectedProject === null && <CheckCircle className="h-3.5 w-3.5" />}
              </button>
              {filteredProjects.map(proj => (
                <div key={proj} className="flex items-center gap-1 group/row">
                  <button
                    onClick={() => setSelectedProject(proj)}
                    className={`flex-1 text-left text-xs px-2.5 py-1.5 rounded transition-all flex items-center justify-between ${
                      selectedProject === proj
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    {isEditable ? (
                      <input
                        type="text"
                        value={proj}
                        onChange={(e) => {
                          const copy = [...baseData.projects];
                          const idx = copy.indexOf(proj);
                          if (idx !== -1) {
                            copy[idx] = e.target.value;
                            setBaseData({ ...baseData, projects: copy });
                          }
                        }}
                        className="bg-transparent border-0 p-0 text-xs text-inherit focus:ring-0 focus:outline-none w-full cursor-text"
                      />
                    ) : (
                      <span className="text-xs font-semibold select-all truncate block">
                        {proj}
                      </span>
                    )}
                    {selectedProject === proj && <CheckCircle className="h-3.5 w-3.5 shrink-0 ml-1" />}
                  </button>
                  {isEditable && (
                    <button
                      onClick={() => {
                        const copy = baseData.projects.filter(p => p !== proj);
                        setBaseData({ ...baseData, projects: copy });
                        if (selectedProject === proj) setSelectedProject(null);
                      }}
                      className="opacity-0 group-hover/row:opacity-100 text-muted-foreground hover:text-destructive p-1 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {isEditable && (
                <button
                  onClick={() => {
                    const copy = [...baseData.projects, `Product ${baseData.projects.length + 1}`];
                    setBaseData({ ...baseData, projects: copy });
                  }}
                  className="text-[10px] text-primary font-bold hover:underline flex items-center gap-0.5 mt-1 justify-center py-1 border border-dashed border-primary/20 rounded"
                >
                  <Plus className="h-3 w-3" /> Add Product
                </button>
              )}
            </div>
          </div>

          {/* 2. Sprints Panel */}
          <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm space-y-3">
            <div className="relative">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search Sprint..."
                value={sprintSearch}
                onChange={e => setSprintSearch(e.target.value)}
                className="w-full bg-muted/40 border border-border rounded pl-7 pr-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary/50"
              />
            </div>
            <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto pr-1">
              <button
                onClick={() => setSelectedSprint(null)}
                className={`w-full text-left text-xs px-2.5 py-1.5 rounded transition-all font-semibold flex items-center justify-between ${
                  selectedSprint === null
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <span>ALL SPRINTS</span>
                {selectedSprint === null && <CheckCircle className="h-3.5 w-3.5" />}
              </button>
              {filteredSprints.map(sprint => (
                <div key={sprint} className="flex items-center gap-1 group/row">
                  <button
                    onClick={() => setSelectedSprint(sprint)}
                    className={`flex-1 text-left text-xs px-2.5 py-1.5 rounded transition-all flex items-center justify-between ${
                      selectedSprint === sprint
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    {isEditable ? (
                      <input
                        type="text"
                        value={sprint}
                        onChange={(e) => {
                          const copy = [...baseData.sprints];
                          const idx = copy.indexOf(sprint);
                          if (idx !== -1) {
                            copy[idx] = e.target.value;
                            setBaseData({ ...baseData, sprints: copy });
                          }
                        }}
                        className="bg-transparent border-0 p-0 text-xs text-inherit focus:ring-0 focus:outline-none w-full cursor-text"
                      />
                    ) : (
                      <span className="text-xs font-semibold select-all truncate block">
                        {sprint}
                      </span>
                    )}
                    {selectedSprint === sprint && <CheckCircle className="h-3.5 w-3.5 shrink-0 ml-1" />}
                  </button>
                  {isEditable && (
                    <button
                      onClick={() => {
                        const copy = baseData.sprints.filter(s => s !== sprint);
                        setBaseData({ ...baseData, sprints: copy });
                        if (selectedSprint === sprint) setSelectedSprint(null);
                      }}
                      className="opacity-0 group-hover/row:opacity-100 text-muted-foreground hover:text-destructive p-1 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {isEditable && (
                <button
                  onClick={() => {
                    const copy = [...baseData.sprints, `Sprint ${baseData.sprints.length + 1}`];
                    setBaseData({ ...baseData, sprints: copy });
                  }}
                  className="text-[10px] text-primary font-bold hover:underline flex items-center gap-0.5 mt-1 justify-center py-1 border border-dashed border-primary/20 rounded"
                >
                  <Plus className="h-3 w-3" /> Add Sprint
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Right Column (Col-Span 10): KPIs and Charts */}
        <div className="lg:col-span-10 space-y-4">
          
          {/* KPI Card Grids */}
          <div className="space-y-3">
            {/* Row 1: Execution KPIs */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-7">
              {[
                { label: "Total Executable", value: liveData.totalExecutable, suffix: "", key: "totalExecutable" },
                { label: "Total Executed", value: liveData.totalExecuted, suffix: "%", key: "totalExecuted" },
                { label: "Total Pass", value: liveData.totalPass, suffix: "%", key: "totalPass" },
                { label: "Total Fail", value: liveData.totalFail, suffix: "%", key: "totalFail" },
                { label: "Total Blocked", value: liveData.totalBlocked, suffix: "%", key: "totalBlocked" },
                { label: "Total NoRun", value: liveData.totalNoRun, suffix: "%", key: "totalNoRun" },
                { label: "Execution Velocity", value: liveData.executionVelocity, suffix: "%", key: "executionVelocity" }
              ].map((card, idx) => (
                <div key={idx} className="rounded-xl border border-border bg-card p-3 text-center shadow-sm">
                  <div className="text-xl font-extrabold text-foreground tracking-tight flex justify-center items-center gap-0.5">
                    {isEditable ? (
                      <input
                        type="number"
                        value={card.value}
                        onChange={(e) => handleKPIChange(card.key as any, e.target.value)}
                        className="w-full bg-transparent border-0 text-center font-extrabold p-0 focus:ring-0 rounded-none text-xl focus:border-b focus:border-primary/50 hover:border-b hover:border-primary/20 cursor-text"
                      />
                    ) : (
                      <span className="font-extrabold text-xl select-all">
                        {card.value}
                      </span>
                    )}
                    <span className="font-extrabold text-xl">{card.suffix}</span>
                  </div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">{card.label}</p>
                </div>
              ))}
            </div>

            {/* Row 2: Defect KPIs */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
              {[
                { label: "Total Defects", value: liveData.totalDefects, suffix: "", key: "totalDefects" },
                { label: "Total Open Defects", value: liveData.totalOpenDefects, suffix: "", key: "totalOpenDefects" },
                { label: "Open Defects High & Critical", value: liveData.openDefectsHighCritical, suffix: "", key: "openDefectsHighCritical" },
                { label: "Defect Density", value: liveData.defectDensity, suffix: "%", key: "defectDensity" },
                { label: "Reopen Ratio", value: liveData.reopenRatio, suffix: "%", key: "reopenRatio" }
              ].map((card, idx) => (
                <div key={idx} className="rounded-xl border border-border bg-card p-3 text-center shadow-sm">
                  <div className="text-xl font-extrabold text-foreground tracking-tight flex justify-center items-center gap-0.5">
                    {isEditable ? (
                      <input
                        type="number"
                        value={card.value}
                        onChange={(e) => handleKPIChange(card.key as any, e.target.value)}
                        className="w-full bg-transparent border-0 text-center font-extrabold p-0 focus:ring-0 rounded-none text-xl focus:border-b focus:border-primary/50 hover:border-b hover:border-primary/20 cursor-text"
                      />
                    ) : (
                      <span className="font-extrabold text-xl select-all">
                        {card.value}
                      </span>
                    )}
                    <span className="font-extrabold text-xl">{card.suffix}</span>
                  </div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">{card.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Charts Area: Left RAG charts, Right Aging Column Chart */}
          <div className="grid gap-5 lg:grid-cols-12 items-stretch">
            
            {/* RAGs Column (Col-Span 3 of the Right Column) */}
            <div className="lg:col-span-3 space-y-4 flex flex-col justify-between">
              
              {/* ProjectWise RAG Chart Card */}
              <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm relative group flex-1 flex flex-col justify-between">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">ProjectWise RAG</span>
                  {isEditable && (
                    <button
                      onClick={() => setShowRAGEditor(!showRAGEditor)}
                      className="text-[9px] text-primary hover:underline"
                    >
                      {showRAGEditor ? "Hide" : "Edit"}
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-center flex-1 min-h-[95px]">
                  <ReactEChartsCore
                    echarts={echarts}
                    option={projectWiseRAGOption}
                    style={{ height: 95, width: "100%" }}
                    notMerge
                  />
                </div>

                {/* RAG Editor */}
                {showRAGEditor && isEditable && (
                  <div className="space-y-1.5 pt-2 border-t border-border/20 mt-1 text-[10px]">
                    {baseData.projectWiseRAG.map((item, idx) => (
                      <div key={item.name} className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-foreground">{item.name}:</span>
                        <input
                          type="number"
                          value={item.value}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            const copy = [...baseData.projectWiseRAG];
                            copy[idx] = { ...copy[idx], value: val };
                            setBaseData({ ...baseData, projectWiseRAG: copy });
                          }}
                          className="w-12 bg-muted/50 border border-border rounded text-[10px] py-0.5 px-1 text-center"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SprintWise RAG Chart Card */}
              <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm relative group flex-1 flex flex-col justify-between">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">SprintWise RAG</span>
                  {isEditable && (
                    <button
                      onClick={() => setShowRAGEditor(!showRAGEditor)}
                      className="text-[9px] text-primary hover:underline"
                    >
                      {showRAGEditor ? "Hide" : "Edit"}
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-center flex-1 min-h-[100px]">
                  <ReactEChartsCore
                    echarts={echarts}
                    option={sprintWiseRAGOption}
                    style={{ height: 100, width: "100%" }}
                    notMerge
                  />
                </div>

                {/* RAG Editor */}
                {showRAGEditor && isEditable && (
                  <div className="space-y-1.5 pt-2 border-t border-border/20 mt-1 text-[10px]">
                    {baseData.sprintWiseRAG.map((item, idx) => (
                      <div key={item.name} className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-foreground">{item.name}:</span>
                        <input
                          type="number"
                          value={item.value}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            const copy = [...baseData.sprintWiseRAG];
                            copy[idx] = { ...copy[idx], value: val };
                            setBaseData({ ...baseData, sprintWiseRAG: copy });
                          }}
                          className="w-12 bg-muted/50 border border-border rounded text-[10px] py-0.5 px-1 text-center"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Aging Column Chart Card (Col-Span 9 of the Right Column) */}
            <div className="lg:col-span-9 rounded-xl border border-border bg-card p-5 shadow-sm group relative flex flex-col justify-between">
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                {isEditable && (
                  <button
                    onClick={() => setShowAgingEditor(!showAgingEditor)}
                    className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded shadow transition-all ${
                      showAgingEditor
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "bg-muted/90 border border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Edit3 className="h-3 w-3" /> {showAgingEditor ? "Close Editor" : "Edit Aging"}
                  </button>
                )}
              </div>
              <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-center">Open Defects Aging by Severity</h3>
              <div className="flex-1 flex items-center justify-center">
                <ReactEChartsCore
                  echarts={echarts}
                  option={defectsAgingOption}
                  style={{ height: 260, width: "100%" }}
                  notMerge
                />
              </div>

              {/* Collapsible Aging Editor Grid */}
              {showAgingEditor && isEditable && (
                <div className="border-t border-border/40 pt-4 mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in text-xs">
                  {baseData.defectsAging.map((d, i) => (
                    <div key={d.bucket} className="p-3 rounded-lg border border-border bg-card shadow-sm space-y-2">
                      <div className="font-bold text-center text-foreground">{d.bucket} Bucket</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-semibold text-red-500 uppercase">Critical</span>
                          <input
                            type="number"
                            value={d.critical}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              const copy = [...baseData.defectsAging];
                              copy[i] = { ...copy[i], critical: val };
                              setBaseData({ ...baseData, defectsAging: copy });
                            }}
                            className="w-full bg-muted/40 border border-border rounded text-[10px] py-0.5 text-center"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-semibold text-blue-500 uppercase">High</span>
                          <input
                            type="number"
                            value={d.high}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              const copy = [...baseData.defectsAging];
                              copy[i] = { ...copy[i], high: val };
                              setBaseData({ ...baseData, defectsAging: copy });
                            }}
                            className="w-full bg-muted/40 border border-border rounded text-[10px] py-0.5 text-center"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-semibold text-amber-500 uppercase">Medium</span>
                          <input
                            type="number"
                            value={d.medium}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              const copy = [...baseData.defectsAging];
                              copy[i] = { ...copy[i], medium: val };
                              setBaseData({ ...baseData, defectsAging: copy });
                            }}
                            className="w-full bg-muted/40 border border-border rounded text-[10px] py-0.5 text-center"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-semibold text-green-500 uppercase">Low</span>
                          <input
                            type="number"
                            value={d.low}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              const copy = [...baseData.defectsAging];
                              copy[i] = { ...copy[i], low: val };
                              setBaseData({ ...baseData, defectsAging: copy });
                            }}
                            className="w-full bg-muted/40 border border-border rounded text-[10px] py-0.5 text-center"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* Bottom Area Line Charts */}
      <div className="grid gap-6 lg:grid-cols-2" data-pdf-page="dashboard">
        {/* Left Bottom: Defect Density */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm group relative">
          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            {isEditable && (
              <button
                onClick={() => setShowDensityEditor(!showDensityEditor)}
                className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded shadow transition-all ${
                  showDensityEditor
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-muted/90 border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Edit3 className="h-3 w-3" /> {showDensityEditor ? "Close Editor" : "Edit Density"}
              </button>
            )}
          </div>
          <h3 className="mb-4 text-xs font-bold text-center uppercase tracking-wider text-muted-foreground">
            ProjectWise Defect Density % = [Total Defects] / [Total Executed Test Cases]
          </h3>
          <ReactEChartsCore
            echarts={echarts}
            option={densityOption}
            style={{ height: 260 }}
            notMerge
          />

          {/* Density Trend Editor */}
          {showDensityEditor && isEditable && (
            <div className="border-t border-border/40 pt-4 mt-4 space-y-3 animate-fade-in text-xs">
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {baseData.defectDensityTrend.map((d, idx) => (
                  <div key={idx} className="p-2 border border-border bg-muted/20 rounded space-y-1">
                    <div className="font-bold text-[9px] truncate text-center text-foreground">{d.name}</div>
                    <div className="flex items-center gap-0.5 justify-center">
                      <input
                        type="number"
                        value={d.rate}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          const copy = [...baseData.defectDensityTrend];
                          copy[idx] = { ...copy[idx], rate: val };
                          setBaseData({ ...baseData, defectDensityTrend: copy });
                        }}
                        className="w-12 bg-muted/40 border border-border rounded text-[10px] text-center"
                      />
                      <span>%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Bottom: Execution Velocity */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm group relative">
          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            {isEditable && (
              <button
                onClick={() => setShowVelocityEditor(!showVelocityEditor)}
                className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded shadow transition-all ${
                  showVelocityEditor
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-muted/90 border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Edit3 className="h-3 w-3" /> {showVelocityEditor ? "Close Editor" : "Edit Velocity"}
              </button>
            )}
          </div>
          <h3 className="mb-4 text-xs font-bold text-center uppercase tracking-wider text-muted-foreground">
            ProjectWise Execution Velocity % = [Total Executed Test Cases] / [Total Planned Test Cases]
          </h3>
          <ReactEChartsCore
            echarts={echarts}
            option={velocityOption}
            style={{ height: 260 }}
            notMerge
          />

          {/* Velocity Trend Editor */}
          {showVelocityEditor && isEditable && (
            <div className="border-t border-border/40 pt-4 mt-4 space-y-3 animate-fade-in text-xs">
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {baseData.executionVelocityTrend.map((d, idx) => (
                  <div key={idx} className="p-2 border border-border bg-muted/20 rounded space-y-1">
                    <div className="font-bold text-[9px] truncate text-center text-foreground">{d.name}</div>
                    <div className="flex items-center gap-0.5 justify-center">
                      <input
                        type="number"
                        value={d.rate}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          const copy = [...baseData.executionVelocityTrend];
                          copy[idx] = { ...copy[idx], rate: val };
                          setBaseData({ ...baseData, executionVelocityTrend: copy });
                        }}
                        className="w-12 bg-muted/40 border border-border rounded text-[10px] text-center"
                      />
                      <span>%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
