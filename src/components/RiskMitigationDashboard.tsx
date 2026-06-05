import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface RiskItem {
  id: string;
  description: string;
  category: "Technical" | "Resource" | "Scope" | "Environment" | "Process";
  impact: "Critical" | "High" | "Medium" | "Low";
  likelihood: "Critical" | "High" | "Medium" | "Low";
  status: "Open" | "Monitoring" | "Escalated" | "Mitigated";
  mitigationPlan: string;
  owner: string;
}

const defaultRisks: RiskItem[] = [
  {
    id: "risk-1",
    description: "[Risk description – e.g. Automation suite lag]",
    category: "Technical",
    impact: "High",
    likelihood: "Medium",
    status: "Open",
    mitigationPlan: "[Mitigation action]",
    owner: "Name"
  },
  {
    id: "risk-2",
    description: "[Risk description – e.g. Key resource unavailability]",
    category: "Resource",
    impact: "High",
    likelihood: "Low",
    status: "Monitoring",
    mitigationPlan: "[Mitigation action]",
    owner: "Name"
  },
  {
    id: "risk-3",
    description: "[Risk description – e.g. Scope creep in sprint]",
    category: "Scope",
    impact: "Medium",
    likelihood: "High",
    status: "Open",
    mitigationPlan: "[Mitigation action]",
    owner: "Name"
  },
  {
    id: "risk-4",
    description: "[Risk description – e.g. Env instability blocking testing]",
    category: "Environment",
    impact: "Critical",
    likelihood: "Medium",
    status: "Escalated",
    mitigationPlan: "[Mitigation action]",
    owner: "Name"
  },
  {
    id: "risk-5",
    description: "[Risk description – add more as needed]",
    category: "Process",
    impact: "Low",
    likelihood: "Low",
    status: "Mitigated",
    mitigationPlan: "[Mitigation action]",
    owner: "Name"
  }
];

const LOCAL_STORAGE_KEY = "qualitylens_risk_mitigation_data";

interface Props {
  onDelete?: () => void;
  isEditable?: boolean;
}

export function RiskMitigationDashboard({ onDelete, isEditable = false }: Props) {
  const [risks, setRisks] = useState<RiskItem[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved risks data", e);
      }
    }
    return defaultRisks;
  });

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(risks));
  }, [risks]);

  const updateRisk = (id: string, field: keyof RiskItem, value: string) => {
    setRisks((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const addRisk = () => {
    const newId = `risk-${Date.now()}`;
    const newItem: RiskItem = {
      id: newId,
      description: "[Risk description - click to edit]",
      category: "Technical",
      impact: "Medium",
      likelihood: "Medium",
      status: "Open",
      mitigationPlan: "[Mitigation action]",
      owner: "Name"
    };
    setRisks((prev) => [...prev, newItem]);
  };

  const deleteRisk = (id: string) => {
    setRisks((prev) => prev.filter((item) => item.id !== id));
  };

  const resetToDefault = () => {
    if (window.confirm("Are you sure you want to reset all risks to placeholders?")) {
      setRisks(defaultRisks);
    }
  };

  // Dynamically calculate KPIs based on live risks data
  const kpis = useMemo(() => {
    const total = risks.length;
    const critical = risks.filter((r) => r.impact === "Critical").length;
    const high = risks.filter((r) => r.impact === "High").length;
    const medium = risks.filter((r) => r.impact === "Medium").length;
    const mitigated = risks.filter((r) => r.status === "Mitigated").length;

    // Pad with leading zero if less than 10
    const pad = (num: number) => String(num).padStart(2, "0");

    return {
      total: pad(total),
      critical: pad(critical),
      high: pad(high),
      medium: pad(medium),
      mitigated: pad(mitigated),
    };
  }, [risks]);

  const getImpactColor = (val: RiskItem["impact"]) => {
    switch (val) {
      case "Critical":
        return "text-red-600 dark:text-red-400 font-bold";
      case "High":
        return "text-orange-600 dark:text-orange-400 font-semibold";
      case "Medium":
        return "text-amber-600 dark:text-amber-400";
      case "Low":
        return "text-green-600 dark:text-green-400";
    }
  };

  const getStatusBadgeClass = (val: RiskItem["status"]) => {
    switch (val) {
      case "Open":
        return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800";
      case "Monitoring":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800";
      case "Escalated":
        return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800";
      case "Mitigated":
        return "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="border-b border-border pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-orange-500/10 rounded-lg text-[#f97316]">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">Risk & Mitigation</h2>
              {isEditable && (
                <button
                  onClick={resetToDefault}
                  className="px-2 py-0.5 text-[10px] bg-orange-500/10 text-[#f97316] rounded border border-orange-500/20 hover:bg-orange-500/20 transition-all font-semibold"
                  title="Reset risks to placeholders"
                >
                  Reset to Placeholders
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Active risks, impact assessment and mitigation strategies</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditable && (
            <Button onClick={addRisk} size="sm" className="gap-1.5 shadow-sm h-8 text-xs">
              <Plus className="h-4 w-4" /> Add Risk Row
            </Button>
          )}
          {onDelete && isEditable && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
              title="Delete this slide"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total Risks */}
        <div className="rounded-xl border border-border border-t-4 border-t-slate-800 dark:border-t-slate-300 bg-card p-4 shadow-sm text-center">
          <div className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{kpis.total}</div>
          <div className="text-xs font-bold text-muted-foreground mt-1">Total Risks</div>
          <div className="text-[10px] text-muted-foreground/75">Identified</div>
        </div>

        {/* Critical Risks */}
        <div className="rounded-xl border border-border border-t-4 border-t-red-500 bg-card p-4 shadow-sm text-center">
          <div className="text-3xl font-extrabold text-red-500">{kpis.critical}</div>
          <div className="text-xs font-bold text-muted-foreground mt-1">Critical Risks</div>
          <div className="text-[10px] text-red-400 dark:text-red-500">Immediate action</div>
        </div>

        {/* High Risks */}
        <div className="rounded-xl border border-border border-t-4 border-t-orange-500 bg-card p-4 shadow-sm text-center">
          <div className="text-3xl font-extrabold text-orange-500">{kpis.high}</div>
          <div className="text-xs font-bold text-muted-foreground mt-1">High Risks</div>
          <div className="text-[10px] text-orange-400 dark:text-orange-500">Close monitoring</div>
        </div>

        {/* Medium Risks */}
        <div className="rounded-xl border border-border border-t-4 border-t-amber-500 bg-card p-4 shadow-sm text-center">
          <div className="text-3xl font-extrabold text-amber-500">{kpis.medium}</div>
          <div className="text-xs font-bold text-muted-foreground mt-1">Medium Risks</div>
          <div className="text-[10px] text-amber-400 dark:text-amber-500 font-medium">Track & review</div>
        </div>

        {/* Mitigated Risks */}
        <div className="rounded-xl border border-border border-t-4 border-t-green-500 bg-card p-4 shadow-sm text-center col-span-2 md:col-span-1">
          <div className="text-3xl font-extrabold text-green-500">{kpis.mitigated}</div>
          <div className="text-xs font-bold text-muted-foreground mt-1">Mitigated</div>
          <div className="text-[10px] text-green-500">This week</div>
        </div>
      </div>

      {/* Live Inline Inputs Table */}
      <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-900 dark:bg-slate-950">
              <TableRow className="hover:bg-slate-900 border-b-border">
                <TableHead className="w-12 text-center text-white font-bold text-xs py-3">#</TableHead>
                <TableHead className="w-1/4 text-white font-bold text-xs py-3">Risk Description</TableHead>
                <TableHead className="w-40 text-white font-bold text-xs py-3">Category</TableHead>
                <TableHead className="w-32 text-white font-bold text-xs py-3">Impact</TableHead>
                <TableHead className="w-32 text-white font-bold text-xs py-3">Likelihood</TableHead>
                <TableHead className="w-36 text-white font-bold text-xs py-3">Status</TableHead>
                <TableHead className="w-1/4 text-white font-bold text-xs py-3">Mitigation Plan</TableHead>
                <TableHead className="w-32 text-white font-bold text-xs py-3">Owner</TableHead>
                {isEditable && <TableHead className="w-12 text-center text-white font-bold text-xs py-3"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {risks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isEditable ? 9 : 8} className="text-center py-10 text-sm text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <AlertTriangle className="h-6 w-6 text-amber-500" />
                      <span>No risks defined. Click "Add Risk Row" to log a risk.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                risks.map((risk, index) => (
                  <TableRow key={risk.id} className="hover:bg-muted/30 border-b-border/40 transition-colors">
                    {/* ID */}
                    <TableCell className="text-center font-bold text-xs text-muted-foreground py-2 select-none">
                      {`R${index + 1}`}
                    </TableCell>

                    {/* Risk Description */}
                    <TableCell className="py-2">
                      {isEditable ? (
                        <input
                          value={risk.description}
                          onChange={(e) => updateRisk(risk.id, "description", e.target.value)}
                          className="bg-transparent border-0 p-0 text-xs rounded-none shadow-none font-medium h-7 w-full text-foreground focus:ring-0 focus:outline-none border-b border-transparent hover:border-border/60 focus:border-primary cursor-text"
                          placeholder="Risk description"
                        />
                      ) : (
                        <span className="text-xs font-medium text-foreground select-all w-full block py-1 line-clamp-2">
                          {risk.description}
                        </span>
                      )}
                    </TableCell>

                    {/* Category */}
                    <TableCell className="py-2">
                      {isEditable ? (
                        <Select
                          value={risk.category}
                          onValueChange={(val: RiskItem["category"]) => updateRisk(risk.id, "category", val)}
                        >
                          <SelectTrigger className="h-7 border-0 border-b border-transparent hover:border-border/60 focus:border-primary focus:ring-0 p-0 text-xs rounded-none shadow-none w-full">
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Technical">Technical</SelectItem>
                            <SelectItem value="Resource">Resource</SelectItem>
                            <SelectItem value="Scope">Scope</SelectItem>
                            <SelectItem value="Environment">Environment</SelectItem>
                            <SelectItem value="Process">Process</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-foreground font-medium">{risk.category}</span>
                      )}
                    </TableCell>

                    {/* Impact */}
                    <TableCell className="py-2">
                      {isEditable ? (
                        <Select
                          value={risk.impact}
                          onValueChange={(val: RiskItem["impact"]) => updateRisk(risk.id, "impact", val)}
                        >
                          <SelectTrigger className={`h-7 border-0 border-b border-transparent hover:border-border/60 focus:border-primary focus:ring-0 p-0 text-xs rounded-none shadow-none w-full font-medium ${getImpactColor(risk.impact)}`}>
                            <SelectValue placeholder="Impact" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Critical">Critical</SelectItem>
                            <SelectItem value="High">High</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="Low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={`text-xs font-semibold ${getImpactColor(risk.impact)}`}>{risk.impact}</span>
                      )}
                    </TableCell>

                    {/* Likelihood */}
                    <TableCell className="py-2">
                      {isEditable ? (
                        <Select
                          value={risk.likelihood}
                          onValueChange={(val: RiskItem["likelihood"]) => updateRisk(risk.id, "likelihood", val)}
                        >
                          <SelectTrigger className={`h-7 border-0 border-b border-transparent hover:border-border/60 focus:border-primary focus:ring-0 p-0 text-xs rounded-none shadow-none w-full font-medium ${getImpactColor(risk.likelihood)}`}>
                            <SelectValue placeholder="Likelihood" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Critical">Critical</SelectItem>
                            <SelectItem value="High">High</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="Low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={`text-xs font-semibold ${getImpactColor(risk.likelihood)}`}>{risk.likelihood}</span>
                      )}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-2">
                      {isEditable ? (
                        <Select
                          value={risk.status}
                          onValueChange={(val: RiskItem["status"]) => updateRisk(risk.id, "status", val)}
                        >
                          <SelectTrigger className={`h-7 px-2 border rounded-full text-xs font-semibold shadow-none w-28 shrink-0 ${getStatusBadgeClass(risk.status)}`}>
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Open">Open</SelectItem>
                            <SelectItem value="Monitoring">Monitoring</SelectItem>
                            <SelectItem value="Escalated">Escalated</SelectItem>
                            <SelectItem value="Mitigated">Mitigated</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className={`h-7 px-2.5 py-1 border rounded-full text-xs font-semibold w-28 shrink-0 text-center flex items-center justify-center ${getStatusBadgeClass(risk.status)}`}>
                          {risk.status}
                        </div>
                      )}
                    </TableCell>

                    {/* Mitigation Plan */}
                    <TableCell className="py-2">
                      {isEditable ? (
                        <input
                          value={risk.mitigationPlan}
                          onChange={(e) => updateRisk(risk.id, "mitigationPlan", e.target.value)}
                          className="bg-transparent border-0 p-0 text-xs rounded-none shadow-none h-7 w-full text-foreground focus:ring-0 focus:outline-none border-b border-transparent hover:border-border/60 focus:border-primary cursor-text"
                          placeholder="Mitigation action"
                        />
                      ) : (
                        <span className="text-xs text-foreground select-all w-full block py-1 line-clamp-2">
                          {risk.mitigationPlan}
                        </span>
                      )}
                    </TableCell>

                    {/* Owner */}
                    <TableCell className="py-2">
                      {isEditable ? (
                        <input
                          value={risk.owner}
                          onChange={(e) => updateRisk(risk.id, "owner", e.target.value)}
                          className="bg-transparent border-0 p-0 text-xs rounded-none shadow-none h-7 w-full text-foreground focus:ring-0 focus:outline-none border-b border-transparent hover:border-border/60 focus:border-primary cursor-text"
                          placeholder="Owner name"
                        />
                      ) : (
                        <span className="text-xs text-foreground select-all w-full block py-1 truncate">
                          {risk.owner}
                        </span>
                      )}
                    </TableCell>

                    {/* Delete Action */}
                    {isEditable && (
                      <TableCell className="text-center py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteRisk(risk.id)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
