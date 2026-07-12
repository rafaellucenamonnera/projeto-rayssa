#!/usr/bin/env node
/**
 * Seed inicial da FAQ de Documentação.
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed:documentacao
 *
 * Variáveis opcionais:
 *   DOCUMENTACAO_SOURCE_DIR  Diretório com os PDFs (default: pasta local do dev)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SOURCE_DIR =
  process.env.DOCUMENTACAO_SOURCE_DIR ||
  "C:\\Users\\Rafael Lucena\\OneDrive\\Documentos\\Vendas Monnera\\output\\pdf";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltam SUPABASE_URL/VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  process.exit(1);
}

const BUCKET = "documentation-files";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const ARTICLES = [
  {
    title: "Playbook Meio de Funil Monnera",
    question: "Como conduzir os contatos e oportunidades no meio do funil comercial?",
    answer:
      "Use este playbook como material de consulta para conduzir contatos em fase de avaliação, reforçar dores, organizar próximos passos e apoiar o uso do painel comercial.",
    tags: ["playbook", "meio de funil", "comercial", "monnera"],
    file: "playbook-meio-funil-monnera.pdf",
  },
  {
    title: "Playbook Topo de Funil Monnera",
    question: "Como trabalhar os primeiros contatos e a entrada de leads pelo topo de funil?",
    answer:
      "Use este playbook como material de apoio para abordagem inicial, qualificação, contexto da landing e orientação dos primeiros passos no painel comercial.",
    tags: ["playbook", "topo de funil", "landing", "comercial", "monnera"],
    file: "playbook-topo-funil-landing-teste-art-457-monnera.pdf",
  },
];

async function upsertArticle(a) {
  // Upsert por title
  const { data: existing } = await supabase
    .from("documentation_articles")
    .select("id")
    .eq("title", a.title)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("documentation_articles")
      .update({
        question: a.question,
        answer: a.answer,
        tags: a.tags,
        is_active: true,
      })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data, error } = await supabase
    .from("documentation_articles")
    .insert({
      title: a.title,
      question: a.question,
      answer: a.answer,
      tags: a.tags,
      is_active: true,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function upsertAttachment(articleId, file) {
  const local = join(SOURCE_DIR, file);
  if (!existsSync(local)) {
    console.warn(`Arquivo não encontrado, pulando: ${local}`);
    return;
  }
  const buf = readFileSync(local);
  const storagePath = `materiais-iniciais/${file}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buf, { contentType: "application/pdf", upsert: true });
  if (upErr) throw upErr;

  const { data: existing } = await supabase
    .from("documentation_attachments")
    .select("id")
    .eq("storage_path", storagePath)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("documentation_attachments")
      .update({
        article_id: articleId,
        file_name: file,
        mime_type: "application/pdf",
        size_bytes: buf.length,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("documentation_attachments").insert({
      article_id: articleId,
      storage_path: storagePath,
      file_name: file,
      mime_type: "application/pdf",
      size_bytes: buf.length,
    });
  }
  console.log(`OK: ${file}`);
}

(async () => {
  for (const a of ARTICLES) {
    console.log(`> ${a.title}`);
    const id = await upsertArticle(a);
    await upsertAttachment(id, a.file);
  }
  console.log("Seed concluído.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
