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
    "Ferramentas do CRM Monnera Parceiros. Painel Onb Clientes Cross (painel_msj9fyji): use as ferramentas em inglês list_cards, find_cards_by_cnpj, get_card, create_card, update_card, move_card, list_tasks, create_task, update_task, complete_task, reopen_task, add_note, list_attachments, attach_file, get_attachment_url, delete_attachment e get_card_history — todas retornam JSON padronizado com success, operation, data e evidence, e operam exclusivamente nesse painel. find_cards_by_cnpj aceita CNPJ com ou sem máscara e retorna todos os cards encontrados sem decidir duplicidade. attach_file recebe o arquivo em base64 (até 10 MB) e pode vincular o anexo a uma tarefa. Nenhuma dessas ferramentas dispara automações, e-mails ou integrações: só executam o que o agente pedir. Para o painel comercial use listar_paineis, listar_leads, listar_embaixadores e listar_responsaveis. Todas as ações respeitam as permissões do usuário autenticado.",

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

    listCards,
    findCardsByCnpj,
    getCard,
    createCard,
    updateCard,
    moveCard,
    listTasks,
    createTask,
    updateTask,
    completeTask,
    reopenTask,
    addNote,
    listAttachments,
    attachFile,
    getAttachmentUrl,
    deleteAttachment,
    getCardHistory,

    listarTarefasClienteCross,
  ],
});
