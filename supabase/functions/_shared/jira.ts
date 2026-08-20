// Helpers compartilhados de leitura da API Jira (somente GET).
export const JIRA_FLOW_LABEL = "monnera-onboarding";
export const CROSS_PANEL_ID = "painel_msj9fyji";

/** Chave do projeto Jira (secret JIRA_PROJECT_KEY; padrão MB apenas quando ausente). */
export function jiraProjectKey(): string {
  return Deno.env.get("JIRA_PROJECT_KEY")?.trim() || "MB";
}

/** Id do tipo de item (secret JIRA_IMPLEMENTATION_ISSUE_TYPE_ID; padrão 10042 apenas quando ausente). */
export function jiraIssueTypeId(): string {
  return Deno.env.get("JIRA_IMPLEMENTATION_ISSUE_TYPE_ID")?.trim() || "10042";
}

export function jiraEnv() {
  const site = Deno.env.get("ATLASSIAN_SITE_URL")?.trim().replace(/\/+$/, "");
  const email = Deno.env.get("ATLASSIAN_EMAIL")?.trim();
  const token = Deno.env.get("ATLASSIAN_API_TOKEN")?.trim();
  if (!site || !email || !token) {
    throw new Error("Configuração Atlassian ausente (ATLASSIAN_SITE_URL, ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN).");
  }
  return { site, auth: btoa(`${email}:${token}`), projectKey: jiraProjectKey(), issueTypeId: jiraIssueTypeId() };
}

/** GET cru: devolve status + corpo, sem lançar. Usado pelo diagnóstico somente leitura. */
export async function jiraGetRaw(path: string): Promise<{ status: number; body: string }> {
  const { site, auth } = jiraEnv();
  const res = await fetch(`${site}${path}`, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
  });
  return { status: res.status, body: (await res.text()).slice(0, 600) };
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
    `project = "${jiraProjectKey()}"`,
    `issuetype = ${jiraIssueTypeId()}`,
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
  const pageSize = Math.min(50, limit);
  const codeFieldId = Deno.env.get("JIRA_CODE_FIELD_ID")?.trim();
  const fields = ["summary", "description", "labels", "updated", ...(codeFieldId ? [codeFieldId] : [])];
  let nextPageToken: string | null = null;
  // Endpoint atual: /rest/api/3/search/jql (o antigo /search foi removido pela Atlassian).
  // Paginação completa por nextPageToken; para no fim da lista ou no limite do lote.
  while (out.length < limit) {
    const params = new URLSearchParams({
      jql,
      maxResults: String(pageSize),
      fields: fields.join(","),
    });
    if (nextPageToken) params.set("nextPageToken", nextPageToken);
    const page = await jiraGet(`/rest/api/3/search/jql?${params.toString()}`);
    const issues: any[] = page?.issues ?? [];
    out.push(...issues.map(mapIssue));
    nextPageToken = page?.nextPageToken ?? null;
    if (page?.isLast === true || !nextPageToken || issues.length === 0) break;
  }
  return out.slice(0, limit);
}

/**
 * Resolve uma issue já existente. Nunca cria nada.
 * Tentativas em cascata (a chave é sempre a mesma, só muda a forma de leitura):
 *   1. /issue/KEY?fields=... (campo customizado incluído quando configurado);
 *   2. /issue/KEY sem `fields` (descarta JIRA_CODE_FIELD_ID inválido como causa);
 *   3. /search/jql com `key = KEY` (algumas permissões respondem só pela busca).
 */
export async function getIssue(issueKey: string): Promise<JiraIssue> {
  const key = issueKey.trim();
  const codeFieldId = Deno.env.get("JIRA_CODE_FIELD_ID")?.trim();
  const fields = "summary,description,labels,updated" + (codeFieldId ? `,${codeFieldId}` : "");
  const errors: string[] = [];

  try {
    return mapIssue(await jiraGet(`/rest/api/3/issue/${encodeURIComponent(key)}?fields=${fields}`));
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  try {
    return mapIssue(await jiraGet(`/rest/api/3/issue/${encodeURIComponent(key)}`));
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  try {
    const params = new URLSearchParams({
      jql: `key = "${key}"`,
      maxResults: "1",
      fields: "summary,description,labels,updated",
    });
    const page = await jiraGet(`/rest/api/3/search/jql?${params.toString()}`);
    const found = (page?.issues ?? [])[0];
    if (found) return mapIssue(found);
    errors.push("search/jql: nenhuma issue retornada");
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  throw new Error(errors[0] ?? `Jira: falha ao resolver ${key}`);
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
