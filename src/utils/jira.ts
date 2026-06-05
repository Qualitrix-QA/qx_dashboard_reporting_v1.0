import type { RawRow, JiraConfig } from "@/types/bug";

export interface JiraFetchResult {
  rows: RawRow[];
  totalCount: number;
}

/**
 * Helper to recursively extract plain text from Atlassian Document Format (ADF) JSON structure.
 */
function extractTextFromADF(adf: any): string {
  if (!adf) return "";
  if (typeof adf === "string") return adf;
  if (adf.text) return adf.text;
  if (Array.isArray(adf.content)) {
    return adf.content.map(extractTextFromADF).filter(Boolean).join(" ");
  }
  if (typeof adf === "object") {
    return extractTextFromADF(adf.content);
  }
  return "";
}

/**
 * Fetch issues from Jira REST API (v3 JQL) and convert them to RawRows.
 */
export async function fetchJiraIssues(config: JiraConfig): Promise<JiraFetchResult> {
  const { host, email, apiToken, jql, useProxy, proxyUrl } = config;

  if (!host) throw new Error("Jira Host URL is required.");
  if (!email) throw new Error("Jira Email/Username is required.");
  if (!apiToken) throw new Error("Jira API Token is required.");

  // Clean Host URL
  let cleanHost = host.trim();
  if (!/^https?:\/\//i.test(cleanHost)) {
    cleanHost = `https://${cleanHost}`;
  }
  // Remove trailing slash
  cleanHost = cleanHost.replace(/\/$/, "");

  // Basic Authentication headers
  const authHeader = `Basic ${btoa(`${email.trim()}:${apiToken.trim()}`)}`;
  const headers: HeadersInit = {
    "Authorization": authHeader,
    "Accept": "application/json",
  };

  let apiPath = "/rest/api/3/search/jql"; // Try modern v3 search JQL first
  let isV3Jql = true;

  const allIssues: any[] = [];
  let nextPageToken: string | undefined = undefined;
  let startAt = 0;
  let pageCount = 0;
  const maxPages = 100; // Cap at 10,000 issues to prevent rate-limit blocks or memory bloat
  const maxResults = 100;
  let hasMore = true;
  let totalIssuesCount = 0;

  do {
    // Construct search URL for this page (supporting both token and offset pagination)
    let pageTargetUrl = `${cleanHost}${apiPath}?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}`;
    if (isV3Jql) {
      if (nextPageToken) {
        pageTargetUrl += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;
      }
      pageTargetUrl += `&fields=*all`;
    } else {
      pageTargetUrl += `&startAt=${startAt}&fields=*all`;
    }

    // Apply CORS Proxy if enabled
    let fetchUrl = pageTargetUrl;
    if (useProxy && proxyUrl) {
      const cleanProxy = proxyUrl.trim();
      if (cleanProxy.includes("/api/jira-proxy")) {
        // Use internal Vite dev proxy route
        let proxyPath = `/api/jira-proxy${apiPath}?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}`;
        if (isV3Jql) {
          if (nextPageToken) {
            proxyPath += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;
          }
          proxyPath += `&fields=*all`;
        } else {
          proxyPath += `&startAt=${startAt}&fields=*all`;
        }
        fetchUrl = proxyPath;
        headers["x-jira-target"] = cleanHost;
      } else {
        // Use external CORS proxy
        fetchUrl = `${cleanProxy}${encodeURIComponent(pageTargetUrl)}`;
      }
    }

    let response = await fetch(fetchUrl, {
      method: "GET",
      headers,
    });

    // Fallback if the modern endpoint doesn't exist (e.g. Jira Server/Data Center)
    if (response.status === 404 && isV3Jql && pageCount === 0) {
      console.log("[Jira API] /rest/api/3/search/jql returned 404. Falling back to /rest/api/2/search...");
      apiPath = "/rest/api/2/search";
      isV3Jql = false;

      pageTargetUrl = `${cleanHost}${apiPath}?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&startAt=${startAt}&fields=*all`;
      fetchUrl = pageTargetUrl;
      if (useProxy && proxyUrl) {
        const cleanProxy = proxyUrl.trim();
        if (cleanProxy.includes("/api/jira-proxy")) {
          fetchUrl = `/api/jira-proxy${apiPath}?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&startAt=${startAt}&fields=*all`;
          headers["x-jira-target"] = cleanHost;
        } else {
          fetchUrl = `${cleanProxy}${encodeURIComponent(pageTargetUrl)}`;
        }
      }

      response = await fetch(fetchUrl, {
        method: "GET",
        headers,
      });
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Jira API Request failed on page ${pageCount + 1} with status ${response.status}: ${response.statusText}. ${
          errorText ? `Details: ${errorText.substring(0, 150)}` : ""
        }`
      );
    }

    const data = await response.json();
    const pageIssues = data.issues || [];

    if (pageIssues.length === 0) {
      hasMore = false;
      break;
    }

    if (pageCount === 0) {
      totalIssuesCount = typeof data.total === "number" ? data.total : pageIssues.length;
    }

    // Deduplicate issues to prevent infinite loops if startAt or nextPageToken is ignored
    let newIssuesAdded = 0;
    for (const issue of pageIssues) {
      const isDuplicate = allIssues.some(
        (existing) => existing.id === issue.id || existing.key === issue.key
      );
      if (!isDuplicate) {
        allIssues.push(issue);
        newIssuesAdded++;
      }
    }

    if (newIssuesAdded === 0) {
      console.warn("[Jira API] Stopped pagination: all returned issues in this page are duplicates.");
      hasMore = false;
      break;
    }

    pageCount++;

    // Pagination determination
    if (isV3Jql && data.nextPageToken) {
      nextPageToken = data.nextPageToken;
      startAt = 0;
      hasMore = true;
    } else {
      nextPageToken = undefined;
      const total = typeof data.total === "number" ? data.total : null;
      const returnedStartAt = typeof data.startAt === "number" ? data.startAt : startAt;

      startAt = returnedStartAt + pageIssues.length;

      if (total !== null) {
        hasMore = startAt < total;
      } else {
        hasMore = pageIssues.length >= maxResults;
      }
    }

  } while (hasMore && pageCount < maxPages);

  const issues = allIssues;

  // Diagnostic log to inspect the exact shape of standard and custom fields
  if (issues.length > 0) {
    console.log("[Jira API Diagnostic] Sample issue keys:", Object.keys(issues[0] || {}));
    console.log("[Jira API Diagnostic] Sample issue fields structure:", JSON.stringify(issues[0]?.fields || {}, null, 2));
  }

  const rows: RawRow[] = issues.map((issue: any) => {
    const fields = issue.fields || {};

    const row: RawRow = {
      "Key": issue.key || "",
      "Summary": fields.summary || "",
      "Status": fields.status?.name || "",
      "Priority": fields.priority?.name || "",
      "Type": fields.issuetype?.name || "",
      "Assignee": fields.assignee?.displayName || fields.assignee?.emailAddress || fields.assignee?.accountId || fields.assignee?.name || "Unassigned",
      "Reporter": fields.reporter?.displayName || fields.reporter?.emailAddress || fields.reporter?.accountId || fields.reporter?.name || "Unknown",
      "Created": fields.created ? fields.created.substring(0, 10) : "",
      "Updated": fields.updated ? fields.updated.substring(0, 10) : "",
      "Due date": fields.duedate || "",
      "Project": fields.project?.name || fields.project?.key || "",
      "Components": fields.components?.map((c: any) => c.name).join(", ") || "",
      "Labels": fields.labels?.join(", ") || "",
      "Fix Version": fields.fixVersions?.map((v: any) => v.name).join(", ") || "",
      "Resolution": fields.resolution?.name || "Unresolved",
      "Description": typeof fields.description === "string" ? fields.description : extractTextFromADF(fields.description),
      "__sheet": fields.project?.name || fields.project?.key || "",
    };

    // Dynamically map and flatten custom fields to expose them to analyzer/charts
    for (const [key, val] of Object.entries(fields)) {
      if (key.startsWith("customfield_") && val !== null && val !== undefined) {
        let finalVal = "";
        if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
          finalVal = String(val);
        } else if (Array.isArray(val)) {
          finalVal = val
            .map((item: any) => (typeof item === "object" ? item.value || item.name || JSON.stringify(item) : String(item)))
            .join(", ");
        } else if (typeof val === "object") {
          finalVal = (val as any).value || (val as any).name || (val as any).displayName || JSON.stringify(val);
        }
        if (finalVal) {
          row[key] = finalVal;
        }
      }
    }

    return row;
  });

  return {
    rows,
    totalCount: totalIssuesCount || rows.length,
  };
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

/**
 * Fetch list of projects visible to the authenticated user.
 */
export async function fetchJiraProjects(config: Omit<JiraConfig, "jql">): Promise<JiraProject[]> {
  const { host, email, apiToken, useProxy, proxyUrl } = config;

  if (!host) throw new Error("Jira Host URL is required.");
  if (!email) throw new Error("Jira Email/Username is required.");
  if (!apiToken) throw new Error("Jira API Token is required.");

  let cleanHost = host.trim();
  if (!/^https?:\/\//i.test(cleanHost)) {
    cleanHost = `https://${cleanHost}`;
  }
  cleanHost = cleanHost.replace(/\/$/, "");

  const targetUrl = `${cleanHost}/rest/api/3/project`;

  const authHeader = `Basic ${btoa(`${email.trim()}:${apiToken.trim()}`)}`;
  const headers: HeadersInit = {
    "Authorization": authHeader,
    "Accept": "application/json",
  };

  let apiPath = "/rest/api/3/project";
  let fetchUrl = `${cleanHost}${apiPath}`;

  if (useProxy && proxyUrl) {
    const cleanProxy = proxyUrl.trim();
    if (cleanProxy.includes("/api/jira-proxy")) {
      fetchUrl = `/api/jira-proxy${apiPath}`;
      headers["x-jira-target"] = cleanHost;
    } else {
      fetchUrl = `${cleanProxy}${encodeURIComponent(fetchUrl)}`;
    }
  }

  let response = await fetch(fetchUrl, {
    method: "GET",
    headers,
  });

  // Fallback to /rest/api/2/project if /rest/api/3/project is not found (e.g. Jira Server/Data Center)
  if (response.status === 404) {
    console.log("[Jira API] /rest/api/3/project returned 404. Falling back to /rest/api/2/project...");
    apiPath = "/rest/api/2/project";
    fetchUrl = `${cleanHost}${apiPath}`;

    if (useProxy && proxyUrl) {
      const cleanProxy = proxyUrl.trim();
      if (cleanProxy.includes("/api/jira-proxy")) {
        fetchUrl = `/api/jira-proxy${apiPath}`;
        headers["x-jira-target"] = cleanHost;
      } else {
        fetchUrl = `${cleanProxy}${encodeURIComponent(fetchUrl)}`;
      }
    }

    response = await fetch(fetchUrl, {
      method: "GET",
      headers,
    });
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Failed to load projects: ${response.statusText}. ${errText ? `Details: ${errText.substring(0, 100)}` : ""}`);
  }

  const data = await response.json();
  return (data || []).map((p: any) => ({
    id: p.id,
    key: p.key,
    name: p.name,
  }));
}
