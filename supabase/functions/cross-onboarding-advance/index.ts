// ============================================================================
// cross-onboarding-advance
// Orquestrador idempotente do fluxo pós-código Monnera (painel Onb Clientes Cross).
//
// Regras invariáveis:
//   - dry_run = true por padrão: só grava auditoria em automation_runs.
//     Não cria tarefa Jira, não altera card, não gera Canva, não envia e-mail,
//     não move etapa e não notifica.
//   - Um card por execução (cron, botão manual, retry, reprocessamento).
//   - Modo controlado: allowlist exclusiva do card TESTE FASE A QA.
//   - Etapas validadas pelo stage_id oficial; label só para exibição.
//   - Cards protegidos (ORCA LOGÍSTICA) nunca são tocados.
//   - Esta função não envia e-mail: o envio real continua em send-onboarding-email
//     e só é considerado concluído com message_id confirmado pela API Gmail.
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { getIssue, jiraEnv, jiraGetRaw } from "../_shared/jira.ts";
import {
  CARD_FIELDS,
  MAX_CARDS_PER_RUN,
  NOTIFY_USERS,
  QA_CARD_ID,
  STEPS,
  STEP_LABELS,
  buildRecipients,
  canvaGate,
  entryGate,
  
  nextStep,
  resolveStages,
  threadGate,
  type CrossCard,
  type Gate,
  type Step,
} from "../_shared/crossOnboarding.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function audit(params: {
  cardId: string | null;
  status: string;
  error?: string | null;
  payload: Record<string, unknown>;
  origin: string;
}) {
  await admin.rpc("record_automation_run", {
    p_stage: "cross_onboarding_advance",
    p_status: params.status,
    p_card_id: params.cardId,
    p_error: params.error ?? null,
    p_origin: params.origin,
    p_payload: params.payload,
  });
}

async function notify(cardId: string, title: string, message: string) {
  for (const userId of NOTIFY_USERS) {
    try {
      await admin.rpc("create_notification", {
        p_recipient_user_id: userId,
        p_type: "cross_block_created",
        p_title: title,
        p_message: message,
        p_representative_card_id: cardId,
        p_delivery_key: `cross_onboarding:${cardId}:${title}:${new Date().toISOString().slice(0, 10)}`,
      });
    } catch (_) { /* notificação nunca derruba o fluxo */ }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Não autenticado." }, 401);
    const { data: userData } = await admin.auth.getUser(token);
    if (!userData?.user) return json({ error: "Não autenticado." }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Acesso restrito a administradores." }, 403);

    const body = await req.json().catch(() => ({}));

    // ---- Modo diagnóstico somente leitura da resolução Jira ----------------
    // Não toca em card, Canva, e-mail, etapa ou tarefa. Só executa GETs no Jira.
    const diagKey = String(body?.diag_issue_key ?? "").trim();
    if (diagKey) {
      const { site } = jiraEnv();
      const host = (() => { try { return new URL(site).host; } catch { return site; } })();
      const codeFieldId = Deno.env.get("JIRA_CODE_FIELD_ID")?.trim();
      const fields = "summary,description,labels,updated" + (codeFieldId ? `,${codeFieldId}` : "");
      const enc = encodeURIComponent(diagKey);
      const checks: Record<string, string> = {
        myself: "/rest/api/3/myself",
        issue_with_fields: `/rest/api/3/issue/${enc}?fields=${fields}`,
        issue_without_fields: `/rest/api/3/issue/${enc}`,
        issue_full: `/rest/api/3/issue/${enc}?fields=summary,status,assignee`,
        search_by_key: `/rest/api/3/search/jql?jql=${encodeURIComponent(`key = "${diagKey}"`)}&maxResults=1&fields=summary,status,assignee`,
        mypermissions: `/rest/api/3/mypermissions?issueKey=${enc}&permissions=BROWSE_PROJECTS`,
      };
      const results: Record<string, unknown> = {};
      for (const [name, path] of Object.entries(checks)) {
        try {
          const r = await jiraGetRaw(path);
          results[name] = { endpoint: `https://${host}${path}`, http_status: r.status, body: r.body };
        } catch (e) {
          results[name] = { endpoint: `https://${host}${path}`, error: e instanceof Error ? e.message : String(e) };
        }
      }
      let resolved: unknown = null;
      let resolveError: string | null = null;
      try { resolved = await getIssue(diagKey); } catch (e) { resolveError = e instanceof Error ? e.message : String(e); }
      return json({ diagnostic: true, issue_key: diagKey, jira_host: host, checks: results, resolved, resolve_error: resolveError });
    }

    const cardId = String(body?.card_id ?? "").trim();
    const dryRun = body?.dry_run === false ? false : true; // padrão sempre dry-run
    const controlledMode = body?.controlled_mode === false ? false : true;
    if (!cardId) return json({ error: "card_id obrigatório." }, 400);


    // Um card por execução, sempre.
    const cards = [cardId].slice(0, MAX_CARDS_PER_RUN);

    const { data: card } = await admin
      .from("representative_cards")
      .select(CARD_FIELDS)
      .eq("id", cards[0])
      .maybeSingle<CrossCard>();
    if (!card) return json({ error: "Card não encontrado." }, 404);

    const stages = await resolveStages(admin);
    const requestedOrigin = String(body?.origin ?? "").trim();
    const origin = dryRun
      ? "dry_run"
      : ["manual_move", "resume", "cron"].includes(requestedOrigin)
        ? requestedOrigin
        : "manual";
    const resumeFrom = String(body?.resume_from ?? "").trim();
    const trace: Array<{ step: string; status: string; detail?: string }> = [];

    const finish = async (result: Record<string, unknown>, status: string, error?: string) => {
      await audit({ cardId: card.id, status, error, origin, payload: { dry_run: dryRun, trace, ...result } });
      return json({ dry_run: dryRun, card_id: card.id, trace, ...result });
    };

    // ------------------------------------------------------------- gate de entrada
    const entry = await entryGate(admin, card, { controlledMode, dryRun, stages });
    if (!entry.ok) {
      trace.push({ step: "gate_entrada", status: entry.status, detail: entry.reason });
      return await finish({ blocked: true, reason: entry.reason }, "ignorado", entry.reason);
    }
    trace.push({ step: "gate_entrada", status: "ok" });

    // ---- Jira NÃO é consultado no avanço --------------------------------
    // O código Monnera chega por e-mail (Gmail). Nenhuma leitura de issue aqui.
    trace.push({
      step: "gate_jira",
      status: "ignorado",
      detail: card.jira_issue_key
        ? `Jira não consultado (${card.jira_issue_key}); fonte do código é o Gmail.`
        : "Jira não consultado; fonte do código é o Gmail.",
    });



    // ------------------------------------------------------ etapas já concluídas
    const { data: stepRows } = await admin
      .from("cross_onboarding_steps")
      .select("step, status, message_id")
      .eq("card_id", card.id);
    const done: Record<string, string> = {};
    const messageIds: Record<string, string | null> = {};
    for (const row of stepRows ?? []) {
      done[row.step] = row.status;
      messageIds[row.step] = row.message_id ?? null;
    }
    // A retomada reavalia a etapa indicada mesmo que já tenha sido gravada.
    if (resumeFrom && (STEPS as readonly string[]).includes(resumeFrom)) delete done[resumeFrom];

    // Estado local do card: atualizado a cada movimentação executada no laço.
    let currentStage = card.stage_id;

    /** Avalia o gate de uma etapa sem executar efeito algum. */
    const evaluateStep = async (
      step: Step,
    ): Promise<{ gate: Gate; payload: Record<string, unknown> }> => {
      const payload: Record<string, unknown> = {};
      let gate: Gate = { ok: true };

      switch (step) {
        case "codigo_validado":
          payload.codigo = card.codigo_monnera;
          payload.codigo_recebido_at = card.codigo_recebido_at;
          break;

        case "codigo_aplicado":
          if (!card.codigo_monnera) {
            gate = { ok: false, status: "bloqueado", reason: "Código Monnera ausente no card." };
          }
          payload.codigo = card.codigo_monnera;
          break;

        case "card_movido_material": {
          if (currentStage === stages.materialOnboarding) {
            // Movimentação manual é reconhecida: nada é movido de novo.
            payload.already_in_stage = true;
            payload.origem = "manual_move";
          } else if (currentStage !== stages.criacaoPainel) {
            gate = {
              ok: false,
              status: "bloqueado",
              reason: `Movimentação exige o card em Criação Painel (atual: ${currentStage ?? "sem etapa"}).`,
            };
          }
          payload.from_stage = stages.criacaoPainel;
          payload.to_stage = stages.materialOnboarding;
          break;
        }

        case "canva_pronto":
          gate = canvaGate(card);
          payload.canva_public_url = card.canva_public_url;
          break;

        case "html_pronto": {
          gate = canvaGate(card);
          if (gate.ok && !card.full_name) {
            gate = { ok: false, status: "bloqueado", reason: "Nome do parceiro ausente." };
          }
          if (gate.ok) {
            const render = renderOnboardingEmail({
              nomeParceiro: card.full_name ?? "",
              codigoParceiro: card.codigo_monnera ?? "",
              linkMaterial: card.canva_public_url ?? "",
            });
            if (render.errors.length) {
              gate = { ok: false, status: "bloqueado", reason: `HTML não pôde ser gerado: ${render.errors.join(" ")}` };
            } else {
              const checklist = htmlChecklist(render.html, {
                nome: card.full_name ?? "",
                codigo: (card.codigo_monnera ?? "").toUpperCase(),
                link: card.canva_public_url ?? "",
                assunto: ONBOARDING_EMAIL_SUBJECT,
              });
              if (!checklist.ok) {
                gate = {
                  ok: false,
                  status: "bloqueado",
                  reason: `Checklist do HTML reprovado: ${checklist.problems.join(" ")}`,
                };
              } else {
                payload.assunto = ONBOARDING_EMAIL_SUBJECT;
                payload.html_length = render.html.length;
                payload.html_snapshot = render.html;
              }
            }
          }
          break;
        }

        case "email_pendente": {
          // Thread ausente não bloqueia: os e-mails rastreados no card valem como origem.
          let participants: string[] = [];
          if (card.origin_thread_id) {
            const { data: msg } = await admin
              .from("gmail_processed_messages")
              .select("thread_participants")
              .eq("thread_id", card.origin_thread_id)
              .limit(1)
              .maybeSingle();
            participants = Array.isArray(msg?.thread_participants) ? msg!.thread_participants : [];
          }
          const recipients = buildRecipients({
            cardEmail: card.email,
            threadParticipants: participants,
            senderAccount: "rafael.lucena@monnera.com.br",
            qaMode: card.id === QA_CARD_ID && card.test_mode === true,
          });
          payload.thread_id = card.origin_thread_id;
          payload.destinatarios = recipients.to;
          payload.excluidos = recipients.excluded;
          payload.ultimo_recurso = recipients.lastResort;
          if (!recipients.to.length) {
            gate = {
              ok: false,
              status: "pendencia_manual",
              reason: "Nenhum destinatário comprovado na thread ou no card.",
            };
          }
          break;
        }

        case "email_enviado": {
          // Só conclui com message_id confirmado pela API Gmail (registrado por send-onboarding-email).
          const { data: sent } = await admin
            .from("onboarding_email_sends")
            .select("id, message_id, thread_id, sent_at")
            .eq("card_id", card.id)
            .eq("status", "enviado")
            .not("message_id", "is", null)
            .order("sent_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!sent?.message_id) {
            gate = {
              ok: false,
              status: "pendencia_manual",
              reason: "Envio ainda não confirmado pela API Gmail (sem message_id). Outbox não é envio concluído.",
            };
          } else {
            payload.message_id = sent.message_id;
            payload.thread_id = sent.thread_id;
          }
          break;
        }

        case "card_movido": {
          const confirmedMessageId = messageIds["email_enviado"];
          if (done["email_enviado"] !== "sucesso" || !confirmedMessageId) {
            gate = { ok: false, status: "bloqueado", reason: "Movimentação exige envio confirmado com message_id." };
          } else {
            payload.from_stage = stages.materialOnboarding;
            payload.to_stage = stages.recebimentoDados;
            payload.message_id = confirmedMessageId;
          }
          break;
        }
      }

      return { gate, payload };
    };

    // Movimentações de etapa: únicos efeitos externos desta função.
    const moves: Record<string, { from: string; to: string; label: string }> = {
      card_movido_material: {
        from: stages.criacaoPainel,
        to: stages.materialOnboarding,
        label: "Material Onboarding Cliente",
      },
      card_movido: {
        from: stages.materialOnboarding,
        to: stages.recebimentoDados,
        label: "Recebimento Dados",
      },
    };

    // --------------------------------------------------- laço sequencial de etapas
    const executed: Array<{ step: string; status: string; reason?: string }> = [];
    let stoppedAt: { step: string; status: string; reason: string } | null = null;

    for (const step of STEPS) {
      if (done[step] === "sucesso") continue;

      const { gate, payload } = await evaluateStep(step);
      const stepStatus: "sucesso" | "bloqueado" | "pendencia_manual" = gate.ok ? "sucesso" : gate.status;
      trace.push({ step, status: gate.ok ? "ok" : gate.status, detail: gate.ok ? undefined : gate.reason });

      if (dryRun) {
        executed.push({ step, status: stepStatus, reason: gate.ok ? undefined : gate.reason });
        if (!gate.ok) {
          stoppedAt = { step, status: stepStatus, reason: gate.reason };
          break;
        }
        done[step] = "sucesso";
        if (moves[step] && !payload.already_in_stage) currentStage = moves[step].to;
        continue;
      }

      const { error: recordError } = await admin.rpc("cross_onboarding_record_step", {
        p_card_id: card.id,
        p_step: step,
        p_status: stepStatus,
        p_gate: gate.ok ? { ok: true } : { ok: false, reason: gate.reason },
        p_payload: payload,
        p_error: gate.ok ? null : gate.reason,
        p_codigo: card.codigo_monnera,
        p_jira_key: card.jira_issue_key,
        p_thread_id: card.origin_thread_id,
        p_message_id: (payload.message_id as string | undefined) ?? null,
      });
      if (recordError) return await finish({ step, executed, error: recordError.message }, "erro", recordError.message);

      if (!gate.ok) {
        const label = STEP_LABELS[step] ?? step;
        await admin.rpc("cross_onboarding_upsert_pendencia", {
          p_card_id: card.id,
          p_titulo: `Onboarding Cross pendente: ${label}`,
          p_descricao: gate.reason,
          p_assigned_to: NOTIFY_USERS[0],
        });
        await notify(card.id, `Onboarding Cross pendente: ${label}`, gate.reason);
        executed.push({ step, status: stepStatus, reason: gate.reason });
        stoppedAt = { step, status: stepStatus, reason: gate.reason };
        break;
      }

      const move = moves[step];
      if (move && !payload.already_in_stage) {
        const { error: moveError } = await admin
          .from("representative_cards")
          .update({ stage_id: move.to })
          .eq("id", card.id)
          .eq("stage_id", move.from);
        if (moveError) {
          await admin.rpc("cross_onboarding_record_step", {
            p_card_id: card.id, p_step: step, p_status: "erro",
            p_error: moveError.message, p_payload: payload,
          });
          await admin.rpc("cross_onboarding_upsert_pendencia", {
            p_card_id: card.id,
            p_titulo: `Onboarding Cross falhou: ${STEP_LABELS[step] ?? step}`,
            p_descricao: moveError.message,
            p_assigned_to: NOTIFY_USERS[0],
          });
          await notify(card.id, `Onboarding Cross falhou: ${STEP_LABELS[step] ?? step}`, moveError.message);
          return await finish({ step, executed, error: moveError.message }, "erro", moveError.message);
        }
        currentStage = move.to;
        await admin.from("representative_card_history").insert({
          representative_card_id: card.id,
          action: "stage_change",
          actor_label: "cross-onboarding-advance",
          source_stage_id: move.from,
          destination_stage_id: move.to,
          payload,
        });
        await notify(card.id, "Onboarding Cross avançou", `Card movido para ${move.label}.`);
      }

      done[step] = "sucesso";
      if (payload.message_id) messageIds[step] = payload.message_id as string;
      executed.push({ step, status: "sucesso" });
    }

    const remaining = nextStep(done);
    if (!executed.length && !remaining) {
      return await finish({ completed: true, reason: "Fluxo já concluído." }, "sucesso");
    }

    return await finish(
      {
        executed,
        stopped_at: stoppedAt,
        next_step: remaining,
        completed: !remaining,
        note: dryRun
          ? "dry_run: nenhum card, etapa, tarefa, Canva, e-mail ou notificação foi alterado."
          : undefined,
      },
      stoppedAt ? "ignorado" : "sucesso",
      stoppedAt?.reason,
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return json({ error: message }, 500);
  }
});
