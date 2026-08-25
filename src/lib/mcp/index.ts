import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listarPaineis from "./tools/listar-paineis";
import listarLeads from "./tools/listar-leads";
import obterLead from "./tools/obter-lead";
import listarEmbaixadores from "./tools/listar-embaixadores";
import listarResponsaveis from "./tools/listar-responsaveis";
import criarLead from "./tools/criar-lead";
import atualizarLead from "./tools/atualizar-lead";
import moverLeadEtapa from "./tools/mover-lead-etapa";
import adicionarComentario from "./tools/adicionar-comentario";
import criarTarefa from "./tools/criar-tarefa";
import criarClienteCross from "./tools/criar-cliente-cross";
import atualizarClienteCross from "./tools/atualizar-cliente-cross";
import moverClienteCrossEtapa from "./tools/mover-cliente-cross-etapa";
import anexarArquivoClienteCross from "./tools/anexar-arquivo-cliente-cross";
import listarAnexosClienteCross from "./tools/listar-anexos-cliente-cross";
import listarClientesCross from "./tools/listar-clientes-cross";
import obterClienteCross from "./tools/obter-cliente-cross";
import buscarClienteCrossPorCnpj from "./tools/buscar-cliente-cross-por-cnpj";

import listarEtapasCross from "./tools/listar-etapas-cross";
import adicionarComentarioClienteCross from "./tools/adicionar-comentario-cliente-cross";
import listarComentariosClienteCross from "./tools/listar-comentarios-cliente-cross";
import criarTarefaClienteCross from "./tools/criar-tarefa-cliente-cross";
import listarTarefasClienteCross from "./tools/listar-tarefas-cliente-cross";

import listCards from "./painel/tools/list-cards";
import findCardsByCnpj from "./painel/tools/find-cards-by-cnpj";
import getCard from "./painel/tools/get-card";
import createCard from "./painel/tools/create-card";
import updateCard from "./painel/tools/update-card";
import moveCard from "./painel/tools/move-card";
import listTasks from "./painel/tools/list-tasks";
import createTask from "./painel/tools/create-task";
import updateTask from "./painel/tools/update-task";
import completeTask from "./painel/tools/complete-task";
import reopenTask from "./painel/tools/reopen-task";
import addNote from "./painel/tools/add-note";
import listAttachments from "./painel/tools/list-attachments";
import attachFile from "./painel/tools/attach-file";
import getAttachmentUrl from "./painel/tools/get-attachment-url";
import deleteAttachment from "./painel/tools/delete-attachment";
import getCardHistory from "./painel/tools/get-card-history";



const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "monnera-parceiros",
  title: "Monnera Parceiros",
  version: "0.1.0",
  instructions:
    "Ferramentas do CRM Monnera Parceiros. Use listar_paineis para descobrir painéis e etapas, listar_embaixadores para obter o parceiro_id antes de criar um lead e listar_responsaveis para definir responsáveis. Cards de lead vivem no painel comercial; clientes do painel Onb Clientes Cross usam as ferramentas *_cliente_cross — inclusive mover_cliente_cross_etapa (aceita o rótulo da etapa, ex.: \"Aguardando Informações\") e anexar_arquivo_cliente_cross para upload de anexos em base64. Para o painel Onb Clientes Cross use listar_clientes_cross e obter_cliente_cross para localizar cards, listar_etapas_cross para descobrir stage_ids, e as ferramentas de comentário, tarefa e anexo específicas desse painel. Todas as ações respeitam as permissões do usuário autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listarPaineis,
    listarLeads,
    obterLead,
    listarEmbaixadores,
    listarResponsaveis,
    criarLead,
    atualizarLead,
    moverLeadEtapa,
    adicionarComentario,
    criarTarefa,
    criarClienteCross,
    atualizarClienteCross,
    moverClienteCrossEtapa,
    anexarArquivoClienteCross,
    listarAnexosClienteCross,
    listarClientesCross,
    obterClienteCross,
    buscarClienteCrossPorCnpj,

    listarEtapasCross,
    adicionarComentarioClienteCross,
    listarComentariosClienteCross,
    criarTarefaClienteCross,
    listarTarefasClienteCross,
  ],
});
