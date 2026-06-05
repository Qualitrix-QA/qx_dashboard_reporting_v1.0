import { describe, it, expect } from "vitest";
import {
  getProdIssuesData,
  getBugAnalyticsData,
  getTestCoverageData,
  getManualExecutionData,
  getAutomationExecutionData
} from "../utils/dashboardMapper";
import type { RawRow, DataAnalysis } from "@/types/bug";

// Helper dummy analysis
const dummyAnalysis: DataAnalysis = {
  columns: [
    { name: "Bug ID", type: "text", uniqueCount: 0, totalCount: 0, topValues: [], fillRate: 0 },
    { name: "Date Reported", type: "text", uniqueCount: 0, totalCount: 0, topValues: [], fillRate: 0 },
    { name: "Product", type: "text", uniqueCount: 0, totalCount: 0, topValues: [], fillRate: 0 },
    { name: "Module", type: "text", uniqueCount: 0, totalCount: 0, topValues: [], fillRate: 0 },
    { name: "Severity", type: "text", uniqueCount: 0, totalCount: 0, topValues: [], fillRate: 0 },
    { name: "Priority", type: "text", uniqueCount: 0, totalCount: 0, topValues: [], fillRate: 0 },
    { name: "Status", type: "text", uniqueCount: 0, totalCount: 0, topValues: [], fillRate: 0 },
    { name: "Reporter", type: "text", uniqueCount: 0, totalCount: 0, topValues: [], fillRate: 0 },
    { name: "TC ID", type: "text", uniqueCount: 0, totalCount: 0, topValues: [], fillRate: 0 },
    { name: "Execution Mode", type: "text", uniqueCount: 0, totalCount: 0, topValues: [], fillRate: 0 },
    { name: "Team Member", type: "text", uniqueCount: 0, totalCount: 0, topValues: [], fillRate: 0 },
    { name: "Week", type: "text", uniqueCount: 0, totalCount: 0, topValues: [], fillRate: 0 }
  ],
  chartSuggestions: [],
  kpiColumns: [],
  totalRows: 0
};

describe("dashboardMapper utility tests", () => {
  describe("Production Issues Mapping", () => {
    it("should aggregate production bugs correctly for the current week", () => {
      const mockRows: RawRow[] = [
        // Previous week bug
        {
          "Bug ID": "BUG-1001",
          "Date Reported": "20/05/2026",
          "Severity": "Critical",
          "Priority": "P1",
          "Status": "Open",
          "Reporter": "Customer",
          __sheet: "Bug Log"
        },
        // Current week bugs (latest week in mock data is W22, containing 02/06/2026)
        {
          "Bug ID": "BUG-1002",
          "Date Reported": "01/06/2026",
          "Severity": "Critical",
          "Priority": "P1",
          "Status": "Resolved",
          "Date Resolved": "02/06/2026",
          "Reporter": "Customer",
          __sheet: "Bug Log"
        },
        {
          "Bug ID": "BUG-1003",
          "Date Reported": "02/06/2026",
          "Severity": "High",
          "Priority": "P2",
          "Status": "In Progress",
          "Reporter": "Monitoring Alert",
          __sheet: "Bug Log"
        }
      ];

      const data = getProdIssuesData(mockRows, dummyAnalysis);

      expect(data.isDemo).toBe(false);
      expect(data.totalProdIssues).toBe(2); // BUG-1002 and BUG-1003 in current week
      expect(data.criticalP1).toBe(1); // BUG-1002 is P1
      expect(data.resolved).toBe(1); // BUG-1002 resolved
      expect(data.inProgress).toBe(1); // BUG-1003 in progress
      expect(data.carryForward).toBe(1); // BUG-1001 reported before Monday June 1 and still open
      expect(data.bugAgeing).toEqual([
        { age: "< 24 hours", p1: 0, p2: 0, p3: 0, total: 0 },
        { age: "1 - 7 days", p1: 0, p2: 1, p3: 0, total: 1 },
        { age: "> 7 days", p1: 1, p2: 0, p3: 0, total: 1 }
      ]);
    });
  });

  describe("Bug Analytics Mapping", () => {
    it("should calculate overall bug analytics and DDE", () => {
      const mockRows: RawRow[] = [
        {
          "Bug ID": "BUG-1001",
          "Date Reported": "20/05/2026",
          "Severity": "High",
          "Priority": "P2",
          "Status": "Open",
          "Reporter": "QA Team",
          "Product": "Portal",
          __sheet: "Bug Log"
        },
        {
          "Bug ID": "BUG-1002",
          "Date Reported": "01/06/2026",
          "Severity": "Critical",
          "Priority": "P1",
          "Status": "Closed",
          "Reporter": "Customer",
          "Product": "Portal",
          __sheet: "Bug Log"
        }
      ];

      const data = getBugAnalyticsData(mockRows, dummyAnalysis);

      expect(data.isDemo).toBe(false);
      expect(data.totalBugs).toBe(2);
      expect(data.openBugs).toBe(1);
      expect(data.closedBugs).toBe(1);
      expect(data.dde).toBe(50); // 1 QA bug / (1 QA bug + 1 Customer bug) * 100
      expect(data.bugsByProduct).toEqual([{ product: "Portal", count: 2 }]);
    });
  });

  describe("Test Coverage and Execution Mapping", () => {
    const mockExecutionRows: RawRow[] = [
      {
        "TC ID": "TC-2001",
        "Date Executed": "01/06/2026",
        "Product": "Gateway",
        "Test Type": "Functional",
        "Execution Mode": "Manual",
        "Status": "Pass",
        "Module": "Auth",
        __sheet: "Test Execution Log"
      },
      {
        "TC ID": "TC-2002",
        "Date Executed": "01/06/2026",
        "Product": "Gateway",
        "Test Type": "Functional",
        "Execution Mode": "Automation",
        "Status": "Fail",
        "Module": "Auth",
        "Build Number": "Build-100",
        "Notes": "Failed flaky assertion",
        __sheet: "Test Execution Log"
      },
      {
        "TC ID": "TC-2002",
        "Date Executed": "02/06/2026",
        "Product": "Gateway",
        "Test Type": "Functional",
        "Execution Mode": "Automation",
        "Status": "Pass",
        "Module": "Auth",
        "Build Number": "Build-101",
        "Notes": "Flaky test passed",
        __sheet: "Test Execution Log"
      }
    ];

    it("should compute Test Coverage metrics", () => {
      const data = getTestCoverageData(mockExecutionRows, dummyAnalysis);
      expect(data.isDemo).toBe(false);
      expect(data.totalTestCases).toBe(2); // TC-2001, TC-2002
      expect(data.covered).toBe(2); // Both have a Pass status
      expect(data.overallCoverage).toBe(100);
      expect(data.coverageByProduct).toEqual([
        { product: "Gateway", covered: 100, gap: 0 }
      ]);
    });

    it("should process Manual Execution data", () => {
      const data = getManualExecutionData(mockExecutionRows, dummyAnalysis);
      expect(data.isDemo).toBe(false);
      expect(data.executed).toBe(1); // TC-2001 only (Manual)
      expect(data.passed).toBe(1);
      expect(data.failed).toBe(0);
      expect(data.passRate).toBe(100);
    });

    it("should process Automation Execution data", () => {
      const data = getAutomationExecutionData(mockExecutionRows, dummyAnalysis);
      expect(data.isDemo).toBe(false);
      expect(data.totalAutoTCs).toBe(1); // TC-2002 (Automation)
      expect(data.passed).toBe(1);
      expect(data.failed).toBe(1);
      expect(data.insights.stability.flaky).toBe(1); // marked flaky in notes
      expect(data.insights.stability.fixed).toBe(1); // flaky passed in latest run
    });
  });
});
