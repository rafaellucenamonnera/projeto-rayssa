// Helpers compartilhados de leitura da API Jira (somente GET).
export const JIRA_PROJECT_ID = "10038";
export const JIRA_ISSUE_TYPE_ID = "10042";
export const JIRA_FLOW_LABEL = "monnera-onboarding";
export const CROSS_PANEL_ID = "painel_msj9fyji";

export function jiraEnv() {
  const site = Deno.env.get("ATLASSIAN_SITE_URL")?.trim().replace(/\/+$/, "");
  const email = Deno.env.get("ATLASSIAN_EMAIL")?.trim();
  const token = Deno.env.get("ATLASSIAN_API_TOKEN")?.trim();
  if (!site || !email || !token) {
    throw new Error("Configuração Atlassian ausente (ATLASSIAN_SITE_URL, ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN).");
  }
  return { site, auth: btoa(`${email}:${token}`) };
}

async function jiraGet(path: string): Promise<any> {
  const { site, auth } = jiraEnv();
  const res = await fetch(`${site}${path}`, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Jira ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

/** Texto plano de um campo ADF (description, comentário) ou string simples. */
export function adfToText(node: unknown): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(adfToText).join("\n");
  const obj = node as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof obj.text === "string") parts.push(obj.text);
  if (Array.isArray(obj.content)) parts.push(adfToText(obj.content));
  return parts.join("\n");
}

export interface JiraIssue {
  key: string;
  updated: string;
  summary: string;
  description: string;
  labels: string[];
  customField: string | null;
}

function mapIssue(raw: any): JiraIssue {
  const fields = raw?.fields ?? {};
  const codeFieldId = Deno.env.get("JIRA_CODE_FIELD_ID")?.trim();
  const customRaw = codeFieldId ? fields[codeFieldId] : null;
  return {
    key: raw.key,
    updated: fields.updated ?? new Date().toISOString(),
    summary: fields.summary ?? "",
    description: adfToText(fields.description),
    labels: Array.isArray(fields.labels) ? fields.labels : [],
    customField: customRaw ? adfToText(customRaw) : null,
  };
}

/**
 * Busca issues do fluxo Monnera com paginação completa, até `limit` issues.
 * Ordena por `updated ASC` para permitir cursor incremental sem perder tarefas.
 */
export async function searchFlowIssues(sinceIso: string | null, limit: number): Promise<JiraIssue[]> {
  const clauses = [
    `project = ${JIRA_PROJECT_ID}`,
    `issuetype = ${JIRA_ISSUE_TYPE_ID}`,
    `labels = "${JIRA_FLOW_LABEL}"`,
  ];
  if (sinceIso) {
    const d = new Date(sinceIso);
    const pad = (n: number) => String(n).padStart(2, "0");
    const jql = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
    clauses.push(`updated >= "${jql}"`);
  }
  const jql = `${clauses.join(" AND ")} ORDER BY updated ASC`;

  const out: JiraIssue[] = [];
  let startAt = 0;
  const pageSize = Math.min(50, limit);
  // Paginação completa: só para quando o Jira sinaliza fim ou o limite do lote é atingido.
  while (out.length < limit) {
    const params = new URLSearchParams({
      jql,
      startAt: String(startAt),
      maxResults: String(pageSize),
      fields: "summary,description,labels,updated" + (Deno.env.get("JIRA_CODE_FIELD_ID")?.trim() ? `,${Deno.env.get("JIRA_CODE_FIELD_ID")!.trim()}` : ""),
    });
    const page = await jiraGet(`/rest/api/3/search?${params.toString()}`);
    const issues: any[] = page?.issues ?? [];
    out.push(...issues.map(mapIssue));
    const total = typeof page?.total === "number" ? page.total : out.length;
    startAt += issues.length;
    if (page?.isLast === true || issues.length === 0 || startAt >= total) break;
  }
  return out.slice(0, limit);
}

export async function getIssue(issueKey: string): Promise<JiraIssue> {
  const codeFieldId = Deno.env.get("JIRA_CODE_FIELD_ID")?.trim();
  const fields = "summary,description,labels,updated" + (codeFieldId ? `,${codeFieldId}` : "");
  const raw = await jiraGet(`/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=${fields}`);
  return mapIssue(raw);
}

export interface JiraComment { id: string; created: string; author: string; body: string }

/** Comentários paginados de uma issue, do mais antigo para o mais recente. */
export async function getIssueComments(issueKey: string): Promise<JiraComment[]> {
  const out: JiraComment[] = [];
  let startAt = 0;
  while (true) {
    const page = await jiraGet(
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment?startAt=${startAt}&maxResults=50&orderBy=created`,
    );
    const items: any[] = page?.comments ?? [];
    out.push(...items.map((c) => ({
      id: String(c.id),
      created: c.created ?? "",
      author: c?.author?.displayName ?? "—",
      body: adfToText(c.body),
    })));
    startAt += items.length;
    const total = typeof page?.total === "number" ? page.total : out.length;
    if (items.length === 0 || startAt >= total) break;
  }
  return out;
}
