/**
 * Module Risk Mindmap — ECharts force-directed graph representation.
 * Renders a central root node connected to 5 risk tier nodes,
 * which in turn connect to their corresponding module nodes.
 * Uses a physics force layout to prevent text/node overlaps and keep it centralised.
 */
import { useMemo, useState, useEffect } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { GraphChart } from "echarts/charts";
import { TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { ModuleRiskData } from "@/types/bug";
import { RISK_COLORS, getRiskColor } from "@/utils/moduleRisk";
import { Maximize2, Minimize2 } from "lucide-react";

echarts.use([GraphChart, TooltipComponent, CanvasRenderer]);

interface Props {
  modules: ModuleRiskData[];
  theme?: "light" | "dark";
}

const LEVEL_ORDER = ["Critical", "High", "Medium", "Low", "Safe"] as const;

export function ModuleMindmap({ modules, theme }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 150);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  // Clean up fullscreen state when component unmounts
  useEffect(() => {
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isFullscreen]);

  const isDark = theme !== "light";

  const { nodes, links } = useMemo(() => {
    // Group modules by risk level
    const grouped: Record<string, ModuleRiskData[]> = {
      Critical: [], High: [], Medium: [], Low: [], Safe: [],
    };
    for (const m of modules) {
      grouped[m.riskLevel].push(m);
    }

    const totalBugs = modules.reduce((sum, m) => sum + m.total, 0);

    const graphNodes: any[] = [];
    const graphLinks: any[] = [];

    // 1. Add Root Node (fixed in the center)
    graphNodes.push({
      id: "root",
      name: "System Modules",
      value: totalBugs,
      isRoot: true,
      symbolSize: 32,
      // Fixed position to ensure it stays strictly in the center
      x: 0,
      y: 0,
      fixed: true,
      itemStyle: {
        color: isDark ? "#1e293b" : "#e2e8f0",
        borderColor: isDark ? "#475569" : "#cbd5e1",
        borderWidth: 3,
        shadowBlur: 15,
        shadowColor: isDark ? "#64748b" : "#94a3b8",
      },
      label: {
        show: true,
        position: "inside",
        color: isDark ? "#f1f5f9" : "#1e293b",
        fontSize: 10,
        fontWeight: "bold",
        formatter: "{b}",
      },
    });

    // 2. Add Risk Tiers and their Modules
    LEVEL_ORDER.forEach((level, index) => {
      const levelModules = grouped[level];
      if (levelModules.length === 0) return;

      const color = RISK_COLORS[level];
      const tierId = `tier_${level}`;
      const levelTotal = levelModules.reduce((s, m) => s + m.total, 0);

      // Pre-calculate starting angle positions for tiers to distribute them evenly around center
      const angle = (index / LEVEL_ORDER.length) * 2 * Math.PI;
      const radius = 100;

      // Add Tier Node
      graphNodes.push({
        id: tierId,
        name: `${level} (${levelModules.length})`,
        value: levelTotal,
        isTier: true,
        levelName: level,
        symbolSize: 22,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        itemStyle: {
          color: color,
          borderColor: isDark ? "#0f172a" : "#ffffff",
          borderWidth: 2,
          shadowBlur: 10,
          shadowColor: color,
        },
        label: {
          show: true,
          position: "top",
          color: color,
          fontSize: 10,
          fontWeight: "bold",
          backgroundColor: isDark ? "rgba(15, 23, 42, 0.75)" : "rgba(255, 255, 255, 0.85)",
          padding: [2, 4],
          borderRadius: 4,
        },
      });

      // Link Root -> Tier
      graphLinks.push({
        source: "root",
        target: tierId,
        lineStyle: {
          color: color,
          width: 3,
          type: "solid",
          curveness: 0,
        },
      });

      // Add Module Nodes under this Tier
      levelModules.forEach((m, mIndex) => {
        const modId = `mod_${m.module}`;
        
        // Distribute module nodes slightly further out
        const modAngle = angle + ((mIndex - (levelModules.length - 1) / 2) * 0.25);
        const modRadius = 220;

        graphNodes.push({
          id: modId,
          name: m.module,
          value: m.total,
          isModule: true,
          riskScore: m.riskScore,
          riskLevel: m.riskLevel,
          breakdown: m.breakdown,
          symbolSize: Math.min(22, 10 + Math.sqrt(m.total) * 2.5),
          x: Math.cos(modAngle) * modRadius,
          y: Math.sin(modAngle) * modRadius,
          itemStyle: {
            color: color,
            borderColor: isDark ? "rgba(255, 255, 255, 0.4)" : "rgba(15, 23, 42, 0.2)",
            borderWidth: 1.5,
            shadowBlur: 6,
            shadowColor: color,
          },
          label: {
            show: true,
            position: "right",
            color: isDark ? "#e2e8f0" : "#1e293b",
            fontSize: 9.5,
            fontWeight: "semibold",
            backgroundColor: isDark ? "rgba(15, 23, 42, 0.5)" : "rgba(255, 255, 255, 0.8)",
            padding: [2, 4],
            borderRadius: 3,
          },
        });

        // Link Tier -> Module
        graphLinks.push({
          source: tierId,
          target: modId,
          lineStyle: {
            color: color,
            width: 1.5,
            type: "dashed",
            curveness: 0.1,
          },
        });
      });
    });

    return { nodes: graphNodes, links: graphLinks };
  }, [modules, isDark]);

  const option: echarts.EChartsCoreOption = useMemo(() => ({
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(10,12,20,0.95)",
      borderColor: "rgba(255,255,255,0.08)",
      extraCssText: "border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,0.6);z-index:9999;",
      textStyle: { color: "#e2e8f0", fontSize: 12 },
      formatter: (params: any) => {
        if (params.dataType !== "node") return "";
        const d = params.data;
        if (d.isRoot) {
          return `<div style="font-weight:700;font-size:13px;margin-bottom:4px">System Hub</div>
                  <div style="color:#94a3b8;font-size:11px">Total Bugs: <b>${d.value}</b></div>
                  <div style="color:#94a3b8;font-size:11px">Total Modules: <b>${modules.length}</b></div>`;
        }
        if (d.isTier) {
          return `<div style="font-weight:700;font-size:13px;margin-bottom:4px;color:${RISK_COLORS[d.levelName]}">${d.levelName} Tier</div>
                  <div style="color:#94a3b8;font-size:11px">Total Bugs: <b>${d.value}</b></div>`;
        }

        // Individual Module node
        const color = getRiskColor(d.riskScore ?? 0);
        const rows = Object.entries((d.breakdown ?? {}) as Record<string, number>)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .map(([k, v]) => `
            <div style="display:flex;justify-content:space-between;gap:12px;margin-top:2px">
              <span style="color:#94a3b8">${k}</span>
              <b>${v}</b>
            </div>
          `)
          .join("");

        return `
          <div style="min-width:180px">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px">${d.name}</div>
            <div style="font-size:11px;color:#94a3b8;margin-bottom:6px">
              Bugs: <b style="color:#e2e8f0">${d.value}</b>&nbsp;·&nbsp;
              Risk: <b style="color:${color}">${d.riskLevel} (${d.riskScore}/100)</b>
            </div>
            <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:5px;font-size:11px">
              ${rows}
            </div>
          </div>
        `;
      },
    },
    series: [
      {
        type: "graph",
        layout: "force",
        data: nodes,
        links: links,
        roam: true, // Zoom and Pan
        draggable: true, // Drag nodes
        force: {
          repulsion: 420,       // Keep nodes pushed apart
          edgeLength: 95,       // Length of the connection lines
          gravity: 0.05,        // Light center gravity
          friction: 0.7,        // Smooth damping
        },
        lineStyle: {
          opacity: 0.6,
        },
        emphasis: {
          focus: "adjacency",
          lineStyle: {
            width: 4,
            opacity: 1,
          },
        },
      },
    ],
  }), [nodes, links, modules]);

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-[9999] bg-background/98 backdrop-blur-md p-6 flex flex-col"
          : "w-full relative bg-muted/5 rounded-lg border border-white/5 overflow-hidden"
      }
    >
      {/* Header when fullscreen */}
      {isFullscreen && (
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-border/40">
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Module Risk Mindmap (Fullscreen Mode)
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Interactive force-directed graph · drag nodes to manipulate layout · zoom and scroll to explore
            </p>
          </div>
          <button
            onClick={() => setIsFullscreen(false)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-all duration-200 shadow-md shadow-destructive/10 hover:shadow-destructive/20 focus:outline-none focus:ring-2 focus:ring-destructive/50"
          >
            <Minimize2 className="h-4 w-4" />
            Exit Fullscreen
          </button>
        </div>
      )}

      {/* Control overlay when inline */}
      {!isFullscreen && (
        <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
          <div className="text-[10px] text-muted-foreground/60 select-none pointer-events-none bg-background/60 backdrop-blur px-2 py-1 rounded border border-white/5">
            Drag nodes · Zoom/Scroll
          </div>
          <button
            onClick={() => setIsFullscreen(true)}
            className="flex items-center justify-center p-1.5 rounded-md bg-background/80 hover:bg-accent hover:text-accent-foreground text-muted-foreground border border-white/5 transition-all duration-200 cursor-pointer shadow-sm hover:scale-105"
            title="View Fullscreen"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className={isFullscreen ? "flex-1 w-full min-h-0 relative" : "relative w-full"}>
        <ReactEChartsCore
          echarts={echarts}
          option={option}
          style={{ height: isFullscreen ? "100%" : 500, width: "100%" }}
          notMerge
          lazyUpdate
        />
      </div>
    </div>
  );
}
