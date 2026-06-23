export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ambassador_card_tasks: {
        Row: {
          ambassador_card_id: string
          assigned_to: string
          completed_at: string | null
          completed_note: string | null
          created_at: string
          created_by: string | null
          due_at: string
          due_date: string | null
          id: string
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ambassador_card_id: string
          assigned_to: string
          completed_at?: string | null
          completed_note?: string | null
          created_at?: string
          created_by?: string | null
          due_at: string
          due_date?: string | null
          id?: string
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ambassador_card_id?: string
          assigned_to?: string
          completed_at?: string | null
          completed_note?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string
          due_date?: string | null
          id?: string
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambassador_card_tasks_ambassador_card_id_fkey"
            columns: ["ambassador_card_id"]
            isOneToOne: false
            referencedRelation: "ambassador_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambassador_card_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ambassador_card_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      ambassador_cards: {
        Row: {
          city: string | null
          cnpj: string | null
          created_at: string
          created_by_user_id: string
          csv_import_batch_id: string | null
          email: string
          full_name: string
          id: string
          notes: string | null
          panel_id: string
          parceiro_id: string | null
          partner_code: string | null
          phone: string
          region: string | null
          responsible_user_id: string
          source: string | null
          stage_id: string
          state: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          cnpj?: string | null
          created_at?: string
          created_by_user_id: string
          csv_import_batch_id?: string | null
          email: string
          full_name: string
          id?: string
          notes?: string | null
          panel_id: string
          parceiro_id?: string | null
          partner_code?: string | null
          phone: string
          region?: string | null
          responsible_user_id: string
          source?: string | null
          stage_id: string
          state?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          cnpj?: string | null
          created_at?: string
          created_by_user_id?: string
          csv_import_batch_id?: string | null
          email?: string
          full_name?: string
          id?: string
          notes?: string | null
          panel_id?: string
          parceiro_id?: string | null
          partner_code?: string | null
          phone?: string
          region?: string | null
          responsible_user_id?: string
          source?: string | null
          stage_id?: string
          state?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambassador_cards_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ambassador_cards_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "pipeline_panels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambassador_cards_panel_stage_fk"
            columns: ["panel_id", "stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages_config"
            referencedColumns: ["panel_key", "value"]
          },
          {
            foreignKeyName: "ambassador_cards_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros_comerciais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambassador_cards_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      commercial_proposals: {
        Row: {
          accepted_at: string | null
          accepted_by_email: string | null
          accepted_by_name: string | null
          accepted_ip: string | null
          accepted_user_agent: string | null
          created_at: string
          created_by_user_id: string | null
          id: string
          last_opened_at: string | null
          lead_id: string
          omit_financials: boolean
          omit_financials_reason: string | null
          open_count: number
          opened_at: string | null
          payload: Json
          proposal_name: string | null
          public_url: string | null
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_email?: string | null
          accepted_by_name?: string | null
          accepted_ip?: string | null
          accepted_user_agent?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          last_opened_at?: string | null
          lead_id: string
          omit_financials?: boolean
          omit_financials_reason?: string | null
          open_count?: number
          opened_at?: string | null
          payload?: Json
          proposal_name?: string | null
          public_url?: string | null
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_email?: string | null
          accepted_by_name?: string | null
          accepted_ip?: string | null
          accepted_user_agent?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          last_opened_at?: string | null
          lead_id?: string
          omit_financials?: boolean
          omit_financials_reason?: string | null
          open_count?: number
          opened_at?: string | null
          payload?: Json
          proposal_name?: string | null
          public_url?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_proposals_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "commercial_proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          arquivo_proposta_url: string | null
          contrato_pdf_url: string | null
          created_at: string
          data_geracao: string | null
          id: string
          lead_id: string
          numero_proposta: string | null
        }
        Insert: {
          arquivo_proposta_url?: string | null
          contrato_pdf_url?: string | null
          created_at?: string
          data_geracao?: string | null
          id?: string
          lead_id: string
          numero_proposta?: string | null
        }
        Update: {
          arquivo_proposta_url?: string | null
          contrato_pdf_url?: string | null
          created_at?: string
          data_geracao?: string | null
          id?: string
          lead_id?: string
          numero_proposta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      kit_argumentos: {
        Row: {
          created_at: string
          id: string
          objecao: string
          ordem: number
          pilar: string
          pilar_descricao: string | null
          resposta: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          objecao: string
          ordem?: number
          pilar?: string
          pilar_descricao?: string | null
          resposta: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          objecao?: string
          ordem?: number
          pilar?: string
          pilar_descricao?: string | null
          resposta?: string
          updated_at?: string
        }
        Relationships: []
      }
      kit_portfolio: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          pdf_url: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          pdf_url: string
          titulo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          pdf_url?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      kit_redes_sociais: {
        Row: {
          comentario: string | null
          created_at: string
          id: string
          imagem_url: string | null
          link: string
          ordem: number
          titulo: string
          updated_at: string
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          id?: string
          imagem_url?: string | null
          link: string
          ordem?: number
          titulo: string
          updated_at?: string
        }
        Update: {
          comentario?: string | null
          created_at?: string
          id?: string
          imagem_url?: string | null
          link?: string
          ordem?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      kit_videos: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          ordem: number
          subtitulo: string | null
          thumbnail_url: string | null
          titulo: string
          updated_at: string
          video_url: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          ordem?: number
          subtitulo?: string | null
          thumbnail_url?: string | null
          titulo: string
          updated_at?: string
          video_url: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          ordem?: number
          subtitulo?: string | null
          thumbnail_url?: string | null
          titulo?: string
          updated_at?: string
          video_url?: string
        }
        Relationships: []
      }
      kit_whatsapp_messages: {
        Row: {
          created_at: string
          id: string
          imagem_url: string | null
          mensagem: string
          ordem: number
          subtitulo: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          imagem_url?: string | null
          mensagem: string
          ordem?: number
          subtitulo?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          imagem_url?: string | null
          mensagem?: string
          ordem?: number
          subtitulo?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_campaign_links: {
        Row: {
          campaign_lead_id: string
          created_at: string
          id: string
          opening_task_id: string | null
          requested_by_user_id: string | null
          success_lead_id: string
          updated_at: string
        }
        Insert: {
          campaign_lead_id: string
          created_at?: string
          id?: string
          opening_task_id?: string | null
          requested_by_user_id?: string | null
          success_lead_id: string
          updated_at?: string
        }
        Update: {
          campaign_lead_id?: string
          created_at?: string
          id?: string
          opening_task_id?: string | null
          requested_by_user_id?: string | null
          success_lead_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_campaign_links_campaign_lead_id_fkey"
            columns: ["campaign_lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_campaign_links_opening_task_id_fkey"
            columns: ["opening_task_id"]
            isOneToOne: false
            referencedRelation: "lead_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_campaign_links_success_lead_id_fkey"
            columns: ["success_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_comment_attachments: {
        Row: {
          comment_id: string
          created_at: string
          created_by: string
          file_name: string
          id: string
          lead_id: string
          mime_type: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          created_by: string
          file_name: string
          id?: string
          lead_id: string
          mime_type: string
          size_bytes: number
          storage_path: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          created_by?: string
          file_name?: string
          id?: string
          lead_id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_comment_attachments_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "lead_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_comment_attachments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_comment_mentions: {
        Row: {
          comment_id: string
          created_at: string
          created_by: string
          id: string
          lead_id: string
          mentioned_user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          created_by: string
          id?: string
          lead_id: string
          mentioned_user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          created_by?: string
          id?: string
          lead_id?: string
          mentioned_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_comment_mentions_comment_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "lead_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_comment_mentions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "lead_comment_mentions_lead_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_comment_mentions_mentioned_fkey"
            columns: ["mentioned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      lead_comments: {
        Row: {
          comentario: string
          data_comentario: string
          etapa: string
          id: string
          lead_id: string
          user_id: string
          usuario: string
        }
        Insert: {
          comentario: string
          data_comentario?: string
          etapa: string
          id?: string
          lead_id: string
          user_id: string
          usuario: string
        }
        Update: {
          comentario?: string
          data_comentario?: string
          etapa?: string
          id?: string
          lead_id?: string
          user_id?: string
          usuario?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_comments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_contatos: {
        Row: {
          cargo: string | null
          comentario: string | null
          created_at: string
          created_by: string | null
          email: string | null
          empresa: string | null
          id: string
          lead_id: string | null
          nome: string
          observacao: string | null
          principal: boolean
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          comentario?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          empresa?: string | null
          id?: string
          lead_id?: string | null
          nome: string
          observacao?: string | null
          principal?: boolean
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          comentario?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          empresa?: string | null
          id?: string
          lead_id?: string | null
          nome?: string
          observacao?: string | null
          principal?: boolean
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lead_stage_history: {
        Row: {
          data_entrada: string
          data_saida: string | null
          dias_na_etapa: number | null
          etapa: string
          id: string
          lead_id: string
        }
        Insert: {
          data_entrada?: string
          data_saida?: string | null
          dias_na_etapa?: number | null
          etapa: string
          id?: string
          lead_id: string
        }
        Update: {
          data_entrada?: string
          data_saida?: string | null
          dias_na_etapa?: number | null
          etapa?: string
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_stage_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_task_participants: {
        Row: {
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_task_participants_task_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "lead_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_task_participants_user_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      lead_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          completed_note: string | null
          created_at: string
          created_by: string | null
          due_at: string | null
          due_date: string | null
          id: string
          lead_id: string
          reminder_24h_sent_at: string | null
          reminder_48h_sent_at: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_note?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          due_date?: string | null
          id?: string
          lead_id: string
          reminder_24h_sent_at?: string | null
          reminder_48h_sent_at?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_note?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string
          reminder_24h_sent_at?: string | null
          reminder_48h_sent_at?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "lead_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          auto_lost_at: string | null
          auto_lost_reason: string | null
          campaign_status_current: string | null
          campaign_status_current_month: string | null
          campaign_status_previous: string | null
          campaign_status_previous_month: string | null
          canal_tracao: string | null
          cargo_participante: string | null
          categoria: string | null
          cidade: string | null
          cnpj: string | null
          comissao_vitalicia: boolean
          completion_token: string | null
          consultor: string | null
          contrato_url: string | null
          csat: number | null
          csat_current: number | null
          csat_current_month: string | null
          csat_direction: string | null
          csat_previous: number | null
          csat_previous_month: string | null
          csat_variation: number | null
          dados_completos: boolean
          data_cadastro: string
          data_contrato_assinado: string | null
          descricao_necessidade: string | null
          email_responsavel: string | null
          endereco_cep: string | null
          endereco_estado: string | null
          endereco_numero: string | null
          endereco_rua: string | null
          erp_utilizado: string | null
          financeiro_editado_em: string | null
          financeiro_editado_por: string | null
          financeiro_preenchido_em: string | null
          financeiro_preenchido_por: string | null
          health_status: string | null
          id: string
          impact_level: string | null
          impacto: string | null
          juros_recebidos: number | null
          modelo_campanha: string | null
          motivo_perda: string | null
          multas_recebidas: number | null
          nome_fantasia: string
          nome_responsavel: string
          numero_funcionarios: number | null
          numero_proposta: string | null
          origem: string
          panel_id: string
          parceiro_id: string
          parcelas_pagas: number | null
          participantes_reuniao: string | null
          percentual_consultor: number | null
          proposta_url: string | null
          qtd_parcelas: number | null
          quantidade_funcionarios: number | null
          quantidade_lojas: number | null
          razao_social: string | null
          receita_taxa_boleto: number | null
          responsavel_comercial_email: string | null
          responsavel_comercial_nome: string | null
          responsavel_comercial_telefone: string | null
          responsavel_rh_email: string | null
          responsavel_rh_nome: string | null
          responsavel_rh_telefone: string | null
          responsavel_tecnico_email: string | null
          responsavel_tecnico_nome: string | null
          responsavel_tecnico_telefone: string | null
          responsible_user_id: string | null
          revenue_current: number | null
          revenue_current_month: string | null
          revenue_previous: number | null
          revenue_previous_month: string | null
          revenue_total: number
          revenue_variation: number | null
          risco: string | null
          status: string
          status_lead: string
          telefone_responsavel: string
          tipo_empresa: string | null
          valor_campanhas: number | null
          valor_campanhas_anterior: number | null
          valor_mensalidade: number | null
          valor_mensalidade_anterior: number | null
          valor_pagamento: number | null
          valor_pagamento_anterior: number | null
          valor_setup: number | null
          volume_premiacao_comissao: number | null
        }
        Insert: {
          auto_lost_at?: string | null
          auto_lost_reason?: string | null
          campaign_status_current?: string | null
          campaign_status_current_month?: string | null
          campaign_status_previous?: string | null
          campaign_status_previous_month?: string | null
          canal_tracao?: string | null
          cargo_participante?: string | null
          categoria?: string | null
          cidade?: string | null
          cnpj?: string | null
          comissao_vitalicia?: boolean
          completion_token?: string | null
          consultor?: string | null
          contrato_url?: string | null
          csat?: number | null
          csat_current?: number | null
          csat_current_month?: string | null
          csat_direction?: string | null
          csat_previous?: number | null
          csat_previous_month?: string | null
          csat_variation?: number | null
          dados_completos?: boolean
          data_cadastro?: string
          data_contrato_assinado?: string | null
          descricao_necessidade?: string | null
          email_responsavel?: string | null
          endereco_cep?: string | null
          endereco_estado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          erp_utilizado?: string | null
          financeiro_editado_em?: string | null
          financeiro_editado_por?: string | null
          financeiro_preenchido_em?: string | null
          financeiro_preenchido_por?: string | null
          health_status?: string | null
          id?: string
          impact_level?: string | null
          impacto?: string | null
          juros_recebidos?: number | null
          modelo_campanha?: string | null
          motivo_perda?: string | null
          multas_recebidas?: number | null
          nome_fantasia: string
          nome_responsavel: string
          numero_funcionarios?: number | null
          numero_proposta?: string | null
          origem?: string
          panel_id?: string
          parceiro_id: string
          parcelas_pagas?: number | null
          participantes_reuniao?: string | null
          percentual_consultor?: number | null
          proposta_url?: string | null
          qtd_parcelas?: number | null
          quantidade_funcionarios?: number | null
          quantidade_lojas?: number | null
          razao_social?: string | null
          receita_taxa_boleto?: number | null
          responsavel_comercial_email?: string | null
          responsavel_comercial_nome?: string | null
          responsavel_comercial_telefone?: string | null
          responsavel_rh_email?: string | null
          responsavel_rh_nome?: string | null
          responsavel_rh_telefone?: string | null
          responsavel_tecnico_email?: string | null
          responsavel_tecnico_nome?: string | null
          responsavel_tecnico_telefone?: string | null
          responsible_user_id?: string | null
          revenue_current?: number | null
          revenue_current_month?: string | null
          revenue_previous?: number | null
          revenue_previous_month?: string | null
          revenue_total?: number
          revenue_variation?: number | null
          risco?: string | null
          status?: string
          status_lead?: string
          telefone_responsavel: string
          tipo_empresa?: string | null
          valor_campanhas?: number | null
          valor_campanhas_anterior?: number | null
          valor_mensalidade?: number | null
          valor_mensalidade_anterior?: number | null
          valor_pagamento?: number | null
          valor_pagamento_anterior?: number | null
          valor_setup?: number | null
          volume_premiacao_comissao?: number | null
        }
        Update: {
          auto_lost_at?: string | null
          auto_lost_reason?: string | null
          campaign_status_current?: string | null
          campaign_status_current_month?: string | null
          campaign_status_previous?: string | null
          campaign_status_previous_month?: string | null
          canal_tracao?: string | null
          cargo_participante?: string | null
          categoria?: string | null
          cidade?: string | null
          cnpj?: string | null
          comissao_vitalicia?: boolean
          completion_token?: string | null
          consultor?: string | null
          contrato_url?: string | null
          csat?: number | null
          csat_current?: number | null
          csat_current_month?: string | null
          csat_direction?: string | null
          csat_previous?: number | null
          csat_previous_month?: string | null
          csat_variation?: number | null
          dados_completos?: boolean
          data_cadastro?: string
          data_contrato_assinado?: string | null
          descricao_necessidade?: string | null
          email_responsavel?: string | null
          endereco_cep?: string | null
          endereco_estado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          erp_utilizado?: string | null
          financeiro_editado_em?: string | null
          financeiro_editado_por?: string | null
          financeiro_preenchido_em?: string | null
          financeiro_preenchido_por?: string | null
          health_status?: string | null
          id?: string
          impact_level?: string | null
          impacto?: string | null
          juros_recebidos?: number | null
          modelo_campanha?: string | null
          motivo_perda?: string | null
          multas_recebidas?: number | null
          nome_fantasia?: string
          nome_responsavel?: string
          numero_funcionarios?: number | null
          numero_proposta?: string | null
          origem?: string
          panel_id?: string
          parceiro_id?: string
          parcelas_pagas?: number | null
          participantes_reuniao?: string | null
          percentual_consultor?: number | null
          proposta_url?: string | null
          qtd_parcelas?: number | null
          quantidade_funcionarios?: number | null
          quantidade_lojas?: number | null
          razao_social?: string | null
          receita_taxa_boleto?: number | null
          responsavel_comercial_email?: string | null
          responsavel_comercial_nome?: string | null
          responsavel_comercial_telefone?: string | null
          responsavel_rh_email?: string | null
          responsavel_rh_nome?: string | null
          responsavel_rh_telefone?: string | null
          responsavel_tecnico_email?: string | null
          responsavel_tecnico_nome?: string | null
          responsavel_tecnico_telefone?: string | null
          responsible_user_id?: string | null
          revenue_current?: number | null
          revenue_current_month?: string | null
          revenue_previous?: number | null
          revenue_previous_month?: string | null
          revenue_total?: number
          revenue_variation?: number | null
          risco?: string | null
          status?: string
          status_lead?: string
          telefone_responsavel?: string
          tipo_empresa?: string | null
          valor_campanhas?: number | null
          valor_campanhas_anterior?: number | null
          valor_mensalidade?: number | null
          valor_mensalidade_anterior?: number | null
          valor_pagamento?: number | null
          valor_pagamento_anterior?: number | null
          valor_setup?: number | null
          volume_premiacao_comissao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "pipeline_panels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros_comerciais"
            referencedColumns: ["id"]
          },
        ]
      }
      links_parceiros: {
        Row: {
          ativo: boolean
          codigo_link: string
          data_criacao: string
          id: string
          parceiro_id: string
          url_link: string
        }
        Insert: {
          ativo?: boolean
          codigo_link: string
          data_criacao?: string
          id?: string
          parceiro_id: string
          url_link: string
        }
        Update: {
          ativo?: boolean
          codigo_link?: string
          data_criacao?: string
          id?: string
          parceiro_id?: string
          url_link?: string
        }
        Relationships: [
          {
            foreignKeyName: "links_parceiros_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros_comerciais"
            referencedColumns: ["id"]
          },
        ]
      }
      lojas: {
        Row: {
          cnpj: string
          created_at: string
          id: string
          lead_id: string
          nome_interno: string
          razao_social: string
        }
        Insert: {
          cnpj: string
          created_at?: string
          id?: string
          lead_id: string
          nome_interno: string
          razao_social: string
        }
        Update: {
          cnpj?: string
          created_at?: string
          id?: string
          lead_id?: string
          nome_interno?: string
          razao_social?: string
        }
        Relationships: [
          {
            foreignKeyName: "lojas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      module_permissions: {
        Row: {
          acao: string
          id: string
          modulo: string
          permitido: boolean
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          acao: string
          id?: string
          modulo: string
          permitido?: boolean
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          acao?: string
          id?: string
          modulo?: string
          permitido?: boolean
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_deliveries: {
        Row: {
          channel: string
          created_at: string
          delivery_key: string | null
          error: string | null
          id: string
          notification_id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          channel: string
          created_at?: string
          delivery_key?: string | null
          error?: string | null
          id?: string
          notification_id: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          channel?: string
          created_at?: string
          delivery_key?: string | null
          error?: string | null
          id?: string
          notification_id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          actor_user_id: string | null
          comment_id: string | null
          created_at: string
          id: string
          lead_id: string | null
          message: string
          metadata: Json
          read_at: string | null
          recipient_user_id: string
          task_id: string | null
          title: string
          type: string
        }
        Insert: {
          action_url?: string | null
          actor_user_id?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          message: string
          metadata?: Json
          read_at?: string | null
          recipient_user_id: string
          task_id?: string | null
          title: string
          type: string
        }
        Update: {
          action_url?: string | null
          actor_user_id?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          message?: string
          metadata?: Json
          read_at?: string | null
          recipient_user_id?: string
          task_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "lead_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "lead_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_consultores: {
        Row: {
          created_at: string
          data_competencia: string | null
          data_pagamento: string | null
          id: string
          lead_id: string | null
          parceiro_id: string
          status_pagamento: string
          updated_at: string
          valor_comissao: number
        }
        Insert: {
          created_at?: string
          data_competencia?: string | null
          data_pagamento?: string | null
          id?: string
          lead_id?: string | null
          parceiro_id: string
          status_pagamento?: string
          updated_at?: string
          valor_comissao?: number
        }
        Update: {
          created_at?: string
          data_competencia?: string | null
          data_pagamento?: string | null
          id?: string
          lead_id?: string | null
          parceiro_id?: string
          status_pagamento?: string
          updated_at?: string
          valor_comissao?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_consultores_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_consultores_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros_comerciais"
            referencedColumns: ["id"]
          },
        ]
      }
      parceiros_comerciais: {
        Row: {
          aprovado: boolean
          ativo: boolean
          cliente_monnera: boolean | null
          cliente_monnera_cnpj: string | null
          codigo_parceiro: string
          cpf: string
          data_cadastro: string
          email: string
          id: string
          nome: string
          slug_consultor: string | null
          telefone_ddd: string
          telefone_numero: string
          user_id: string | null
        }
        Insert: {
          aprovado?: boolean
          ativo?: boolean
          cliente_monnera?: boolean | null
          cliente_monnera_cnpj?: string | null
          codigo_parceiro: string
          cpf: string
          data_cadastro?: string
          email: string
          id?: string
          nome: string
          slug_consultor?: string | null
          telefone_ddd: string
          telefone_numero: string
          user_id?: string | null
        }
        Update: {
          aprovado?: boolean
          ativo?: boolean
          cliente_monnera?: boolean | null
          cliente_monnera_cnpj?: string | null
          codigo_parceiro?: string
          cpf?: string
          data_cadastro?: string
          email?: string
          id?: string
          nome?: string
          slug_consultor?: string | null
          telefone_ddd?: string
          telefone_numero?: string
          user_id?: string | null
        }
        Relationships: []
      }
      permission_change_logs: {
        Row: {
          acao: string
          changed_at: string
          changed_by: string | null
          id: string
          modulo: string
          permitido: boolean
          user_id: string
        }
        Insert: {
          acao: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          modulo: string
          permitido: boolean
          user_id: string
        }
        Update: {
          acao?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          modulo?: string
          permitido?: boolean
          user_id?: string
        }
        Relationships: []
      }
      pipeline_panels: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      pipeline_stages_config: {
        Row: {
          created_at: string
          id: string
          label: string
          panel_key: string
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          panel_key?: string
          sort_order?: number
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          panel_key?: string
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          can_be_responsible: boolean
          data_criacao: string
          id: string
          nome: string
          primeiro_acesso: boolean
          telefone: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean
          can_be_responsible?: boolean
          data_criacao?: string
          id?: string
          nome: string
          primeiro_acesso?: boolean
          telefone?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean
          can_be_responsible?: boolean
          data_criacao?: string
          id?: string
          nome?: string
          primeiro_acesso?: boolean
          telefone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      representative_card_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          representative_card_id: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          representative_card_id: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          representative_card_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "representative_card_comments_representative_card_id_fkey"
            columns: ["representative_card_id"]
            isOneToOne: false
            referencedRelation: "representative_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "representative_card_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      representative_card_dossiers: {
        Row: {
          created_at: string
          created_by_user_id: string
          description: string | null
          file_url: string | null
          id: string
          representative_card_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          description?: string | null
          file_url?: string | null
          id?: string
          representative_card_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          file_url?: string | null
          id?: string
          representative_card_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "representative_card_dossiers_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "representative_card_dossiers_representative_card_id_fkey"
            columns: ["representative_card_id"]
            isOneToOne: false
            referencedRelation: "representative_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      representative_card_meetings: {
        Row: {
          created_at: string
          created_by_user_id: string
          id: string
          meeting_date: string
          notes: string | null
          representative_card_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          id?: string
          meeting_date: string
          notes?: string | null
          representative_card_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          id?: string
          meeting_date?: string
          notes?: string | null
          representative_card_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "representative_card_meetings_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "representative_card_meetings_representative_card_id_fkey"
            columns: ["representative_card_id"]
            isOneToOne: false
            referencedRelation: "representative_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      representative_cards: {
        Row: {
          city: string | null
          created_at: string
          created_by_user_id: string
          csv_import_batch_id: string | null
          email: string
          full_name: string
          id: string
          notes: string | null
          panel_id: string
          parceiro_id: string | null
          partner_code: string | null
          phone: string
          region: string | null
          responsible_user_id: string
          source: string | null
          stage_id: string
          state: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_by_user_id: string
          csv_import_batch_id?: string | null
          email: string
          full_name: string
          id?: string
          notes?: string | null
          panel_id: string
          parceiro_id?: string | null
          partner_code?: string | null
          phone: string
          region?: string | null
          responsible_user_id: string
          source?: string | null
          stage_id: string
          state?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          created_by_user_id?: string
          csv_import_batch_id?: string | null
          email?: string
          full_name?: string
          id?: string
          notes?: string | null
          panel_id?: string
          parceiro_id?: string | null
          partner_code?: string | null
          phone?: string
          region?: string | null
          responsible_user_id?: string
          source?: string | null
          stage_id?: string
          state?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "representative_cards_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "representative_cards_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "pipeline_panels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "representative_cards_panel_stage_fk"
            columns: ["panel_id", "stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages_config"
            referencedColumns: ["panel_key", "value"]
          },
          {
            foreignKeyName: "representative_cards_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros_comerciais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "representative_cards_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      reunioes: {
        Row: {
          created_at: string
          created_by: string
          data_reuniao: string | null
          google_event_id: string | null
          google_meet_link: string | null
          horario_reuniao: string | null
          id: string
          lead_id: string
          link_reuniao: string | null
          observacao: string | null
          realizada: boolean
          resumo: string | null
          tipo_reuniao: string
        }
        Insert: {
          created_at?: string
          created_by: string
          data_reuniao?: string | null
          google_event_id?: string | null
          google_meet_link?: string | null
          horario_reuniao?: string | null
          id?: string
          lead_id: string
          link_reuniao?: string | null
          observacao?: string | null
          realizada?: boolean
          resumo?: string | null
          tipo_reuniao?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          data_reuniao?: string | null
          google_event_id?: string | null
          google_meet_link?: string | null
          horario_reuniao?: string | null
          id?: string
          lead_id?: string
          link_reuniao?: string | null
          observacao?: string | null
          realizada?: boolean
          resumo?: string | null
          tipo_reuniao?: string
        }
        Relationships: [
          {
            foreignKeyName: "reunioes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      success_customer_assignments: {
        Row: {
          contratante_cnpj: string
          cs_name_snapshot: string | null
          cs_user_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          contratante_cnpj: string
          cs_name_snapshot?: string | null
          cs_user_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          contratante_cnpj?: string
          cs_name_snapshot?: string | null
          cs_user_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      success_customer_feedback_history: {
        Row: {
          contratante_cnpj: string
          created_at: string
          csat_dono: number | null
          csat_exp: number | null
          filled_at: string
          filled_by: string | null
          id: string
          nps: number | null
          survey_month: string
          updated_at: string
        }
        Insert: {
          contratante_cnpj: string
          created_at?: string
          csat_dono?: number | null
          csat_exp?: number | null
          filled_at?: string
          filled_by?: string | null
          id?: string
          nps?: number | null
          survey_month: string
          updated_at?: string
        }
        Update: {
          contratante_cnpj?: string
          created_at?: string
          csat_dono?: number | null
          csat_exp?: number | null
          filled_at?: string
          filled_by?: string | null
          id?: string
          nps?: number | null
          survey_month?: string
          updated_at?: string
        }
        Relationships: []
      }
      success_customers: {
        Row: {
          acao_recomendada: string | null
          aderencia: number | null
          classificacao: string | null
          contratante_cnpj: string
          dias_atraso_venda_media: number | null
          dias_sem_sincronizacao_media: number | null
          mensalidade: number | null
          mes_referencia: string | null
          meses_monnera: number | null
          motivo_classificacao: string | null
          municipio: string | null
          nome_fantasia: string | null
          prioridade:
            | Database["public"]["Enums"]["success_panel_rule_priority"]
            | null
          quantidade_cnpjs_atraso_venda: number
          quantidade_cnpjs_sem_sincronizacao: number
          quantidade_empresas: number | null
          quantidade_empresas_ativas: number | null
          razao_social: string | null
          receita_campanhas: number
          receita_ordem_pagamento: number
          receita_servicos_outros: number
          receita_transferencias: number
          segmento: string | null
          source_updated_at: string | null
          stage_id: string
          status_campanha: string | null
          tipo_contratante: string | null
          uf: string | null
          updated_at: string
          venda_premiada: number
          venda_total: number
        }
        Insert: {
          acao_recomendada?: string | null
          aderencia?: number | null
          classificacao?: string | null
          contratante_cnpj: string
          dias_atraso_venda_media?: number | null
          dias_sem_sincronizacao_media?: number | null
          mensalidade?: number | null
          mes_referencia?: string | null
          meses_monnera?: number | null
          motivo_classificacao?: string | null
          municipio?: string | null
          nome_fantasia?: string | null
          prioridade?:
            | Database["public"]["Enums"]["success_panel_rule_priority"]
            | null
          quantidade_cnpjs_atraso_venda?: number
          quantidade_cnpjs_sem_sincronizacao?: number
          quantidade_empresas?: number | null
          quantidade_empresas_ativas?: number | null
          razao_social?: string | null
          receita_campanhas?: number
          receita_ordem_pagamento?: number
          receita_servicos_outros?: number
          receita_transferencias?: number
          segmento?: string | null
          source_updated_at?: string | null
          stage_id?: string
          status_campanha?: string | null
          tipo_contratante?: string | null
          uf?: string | null
          updated_at?: string
          venda_premiada?: number
          venda_total?: number
        }
        Update: {
          acao_recomendada?: string | null
          aderencia?: number | null
          classificacao?: string | null
          contratante_cnpj?: string
          dias_atraso_venda_media?: number | null
          dias_sem_sincronizacao_media?: number | null
          mensalidade?: number | null
          mes_referencia?: string | null
          meses_monnera?: number | null
          motivo_classificacao?: string | null
          municipio?: string | null
          nome_fantasia?: string | null
          prioridade?:
            | Database["public"]["Enums"]["success_panel_rule_priority"]
            | null
          quantidade_cnpjs_atraso_venda?: number
          quantidade_cnpjs_sem_sincronizacao?: number
          quantidade_empresas?: number | null
          quantidade_empresas_ativas?: number | null
          razao_social?: string | null
          receita_campanhas?: number
          receita_ordem_pagamento?: number
          receita_servicos_outros?: number
          receita_transferencias?: number
          segmento?: string | null
          source_updated_at?: string | null
          stage_id?: string
          status_campanha?: string | null
          tipo_contratante?: string | null
          uf?: string | null
          updated_at?: string
          venda_premiada?: number
          venda_total?: number
        }
        Relationships: []
      }
      sync_job_logs: {
        Row: {
          created_at: string
          created_count: number
          error_count: number
          error_details: string | null
          id: string
          job_name: string
          processed_count: number
          updated_count: number
        }
        Insert: {
          created_at?: string
          created_count?: number
          error_count?: number
          error_details?: string | null
          id?: string
          job_name: string
          processed_count?: number
          updated_count?: number
        }
        Update: {
          created_at?: string
          created_count?: number
          error_count?: number
          error_details?: string | null
          id?: string
          job_name?: string
          processed_count?: number
          updated_count?: number
        }
        Relationships: []
      }
      user_panel_permissions: {
        Row: {
          can_access: boolean
          id: string
          panel_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          can_access?: boolean
          id?: string
          panel_id: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          can_access?: boolean
          id?: string
          panel_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      success_customer_cards_view: {
        Row: {
          acao_recomendada: string | null
          aderencia: number | null
          classificacao: string | null
          contratante_cnpj: string | null
          cs_name_snapshot: string | null
          cs_user_id: string | null
          csat_dono: number | null
          csat_exp: number | null
          dias_atraso_venda_media: number | null
          dias_sem_sincronizacao_media: number | null
          filled_at: string | null
          mensalidade: number | null
          mes_referencia: string | null
          meses_monnera: number | null
          motivo_classificacao: string | null
          municipio: string | null
          nome_fantasia: string | null
          nps: number | null
          prioridade:
            | Database["public"]["Enums"]["success_panel_rule_priority"]
            | null
          quantidade_cnpjs_atraso_venda: number | null
          quantidade_cnpjs_sem_sincronizacao: number | null
          quantidade_empresas: number | null
          quantidade_empresas_ativas: number | null
          razao_social: string | null
          receita_campanhas: number | null
          receita_ordem_pagamento: number | null
          receita_servicos_outros: number | null
          receita_transferencias: number | null
          segmento: string | null
          stage_id: string | null
          status_campanha: string | null
          survey_month: string | null
          tipo_contratante: string | null
          uf: string | null
          updated_at: string | null
          venda_premiada: number | null
          venda_total: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_commercial_proposal: {
        Args: {
          p_accepted_by_email: string
          p_accepted_by_name: string
          p_accepted_ip?: string
          p_accepted_user_agent?: string
          p_token: string
        }
        Returns: Json
      }
      business_days_between: {
        Args: { p_from: string; p_to: string }
        Returns: number
      }
      business_days_between_dates: {
        Args: { p_end: string; p_start: string }
        Returns: number
      }
      complete_lead_by_token: {
        Args: { p_data: Json; p_lojas?: Json; p_token: string }
        Returns: Json
      }
      create_notification: {
        Args: {
          p_action_url?: string
          p_actor_user_id?: string
          p_comment_id?: string
          p_delivery_key?: string
          p_lead_id?: string
          p_message: string
          p_metadata?: Json
          p_recipient_user_id: string
          p_task_id?: string
          p_title: string
          p_type: string
        }
        Returns: string
      }
      duplicate_card: {
        Args: { card_id: string; target_stage_id: string }
        Returns: string
      }
      generate_partner_code: { Args: never; Returns: string }
      generate_slug: { Args: { name_input: string }; Returns: string }
      get_available_responsible_users: {
        Args: never
        Returns: {
          nome: string
          user_id: string
        }[]
      }
      get_financeiro_consultores:
        | { Args: never; Returns: Json }
        | { Args: { p_ano?: number; p_mes?: number }; Returns: Json }
      get_financeiro_dashboard:
        | { Args: never; Returns: Json }
        | { Args: { p_ano?: number; p_mes?: number }; Returns: Json }
      get_lead_by_completion_token: {
        Args: { p_token: string }
        Returns: {
          cidade: string
          dados_completos: boolean
          email_responsavel: string
          endereco_cep: string
          endereco_estado: string
          endereco_numero: string
          endereco_rua: string
          id: string
          nome_fantasia: string
          nome_responsavel: string
          quantidade_lojas: number
          razao_social: string
          responsavel_comercial_email: string
          responsavel_comercial_nome: string
          responsavel_comercial_telefone: string
          responsavel_rh_email: string
          responsavel_rh_nome: string
          responsavel_rh_telefone: string
          responsavel_tecnico_email: string
          responsavel_tecnico_nome: string
          responsavel_tecnico_telefone: string
          telefone_responsavel: string
        }[]
      }
      get_pipeline_stage_metrics: { Args: never; Returns: Json }
      get_public_commercial_proposal: {
        Args: { p_token: string }
        Returns: Json
      }
      has_any_admin: { Args: never; Returns: boolean }
      has_module_permission: {
        Args: { _acao: string; _modulo: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_commercial_panel: { Args: { p_panel_id: string }; Returns: boolean }
      is_valid_parceiro: { Args: { p_id: string }; Returns: boolean }
      lookup_parceiro_by_code: {
        Args: { code: string }
        Returns: {
          id: string
          nome: string
        }[]
      }
      lookup_parceiro_by_slug: {
        Args: { slug: string }
        Returns: {
          id: string
          nome: string
        }[]
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      move_inactive_commercial_leads_to_lost: { Args: never; Returns: number }
      register_lead_public: {
        Args: {
          p_canal_tracao?: string
          p_email_responsavel: string
          p_erp_utilizado?: string
          p_nome_fantasia: string
          p_nome_responsavel: string
          p_origem?: string
          p_parceiro_id: string
          p_quantidade_lojas?: number
          p_telefone_responsavel: string
          p_tipo_empresa?: string
          p_valor_campanhas?: number
        }
        Returns: string
      }
      register_parceiro: {
        Args: {
          p_cliente_monnera: boolean
          p_cliente_monnera_cnpj: string
          p_codigo_parceiro: string
          p_cpf: string
          p_email: string
          p_nome: string
          p_slug_consultor: string
          p_telefone_ddd: string
          p_telefone_numero: string
          p_user_id: string
        }
        Returns: Json
      }
      reset_commercial_lead_stage_timer: {
        Args: { p_lead_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "gestor_conta"
      lead_status:
        | "novo_lead"
        | "reuniao_agendada"
        | "proposta_comercial"
        | "lead_convertido"
        | "contato_realizado"
        | "proposta_enviada"
        | "contrato_enviado"
        | "contrato_assinado"
        | "reuniao_realizada"
        | "lead_perdido"
      success_panel_rule_priority: "baixa" | "media" | "alta" | "critica"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "gestor_conta"],
      lead_status: [
        "novo_lead",
        "reuniao_agendada",
        "proposta_comercial",
        "lead_convertido",
        "contato_realizado",
        "proposta_enviada",
        "contrato_enviado",
        "contrato_assinado",
        "reuniao_realizada",
        "lead_perdido",
      ],
      success_panel_rule_priority: ["baixa", "media", "alta", "critica"],
    },
  },
} as const
