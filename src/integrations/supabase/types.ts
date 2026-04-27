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
      leads: {
        Row: {
          cidade: string | null
          cnpj: string | null
          completion_token: string | null
          contrato_url: string | null
          dados_completos: boolean
          data_cadastro: string
          data_contrato_assinado: string | null
          descricao_necessidade: string | null
          email_responsavel: string
          endereco_cep: string | null
          endereco_estado: string | null
          endereco_numero: string | null
          endereco_rua: string | null
          erp_utilizado: string
          id: string
          motivo_perda: string | null
          nome_fantasia: string
          nome_responsavel: string
          numero_proposta: string | null
          origem: string
          parceiro_id: string
          parcelas_pagas: number | null
          percentual_consultor: number | null
          proposta_url: string | null
          qtd_parcelas: number | null
          quantidade_funcionarios: number | null
          quantidade_lojas: number
          razao_social: string | null
          responsavel_comercial_email: string | null
          responsavel_comercial_nome: string | null
          responsavel_comercial_telefone: string | null
          responsavel_rh_email: string | null
          responsavel_rh_nome: string | null
          responsavel_rh_telefone: string | null
          responsavel_tecnico_email: string | null
          responsavel_tecnico_nome: string | null
          responsavel_tecnico_telefone: string | null
          status: string
          status_lead: Database["public"]["Enums"]["lead_status"]
          telefone_responsavel: string
          valor_campanhas: number | null
          valor_mensalidade: number | null
        }
        Insert: {
          cidade?: string | null
          cnpj?: string | null
          completion_token?: string | null
          contrato_url?: string | null
          dados_completos?: boolean
          data_cadastro?: string
          data_contrato_assinado?: string | null
          descricao_necessidade?: string | null
          email_responsavel: string
          endereco_cep?: string | null
          endereco_estado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          erp_utilizado: string
          id?: string
          motivo_perda?: string | null
          nome_fantasia: string
          nome_responsavel: string
          numero_proposta?: string | null
          origem?: string
          parceiro_id: string
          parcelas_pagas?: number | null
          percentual_consultor?: number | null
          proposta_url?: string | null
          qtd_parcelas?: number | null
          quantidade_funcionarios?: number | null
          quantidade_lojas: number
          razao_social?: string | null
          responsavel_comercial_email?: string | null
          responsavel_comercial_nome?: string | null
          responsavel_comercial_telefone?: string | null
          responsavel_rh_email?: string | null
          responsavel_rh_nome?: string | null
          responsavel_rh_telefone?: string | null
          responsavel_tecnico_email?: string | null
          responsavel_tecnico_nome?: string | null
          responsavel_tecnico_telefone?: string | null
          status?: string
          status_lead?: Database["public"]["Enums"]["lead_status"]
          telefone_responsavel: string
          valor_campanhas?: number | null
          valor_mensalidade?: number | null
        }
        Update: {
          cidade?: string | null
          cnpj?: string | null
          completion_token?: string | null
          contrato_url?: string | null
          dados_completos?: boolean
          data_cadastro?: string
          data_contrato_assinado?: string | null
          descricao_necessidade?: string | null
          email_responsavel?: string
          endereco_cep?: string | null
          endereco_estado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          erp_utilizado?: string
          id?: string
          motivo_perda?: string | null
          nome_fantasia?: string
          nome_responsavel?: string
          numero_proposta?: string | null
          origem?: string
          parceiro_id?: string
          parcelas_pagas?: number | null
          percentual_consultor?: number | null
          proposta_url?: string | null
          qtd_parcelas?: number | null
          quantidade_funcionarios?: number | null
          quantidade_lojas?: number
          razao_social?: string | null
          responsavel_comercial_email?: string | null
          responsavel_comercial_nome?: string | null
          responsavel_comercial_telefone?: string | null
          responsavel_rh_email?: string | null
          responsavel_rh_nome?: string | null
          responsavel_rh_telefone?: string | null
          responsavel_tecnico_email?: string | null
          responsavel_tecnico_nome?: string | null
          responsavel_tecnico_telefone?: string | null
          status?: string
          status_lead?: Database["public"]["Enums"]["lead_status"]
          telefone_responsavel?: string
          valor_campanhas?: number | null
          valor_mensalidade?: number | null
        }
        Relationships: [
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
      profiles: {
        Row: {
          ativo: boolean
          data_criacao: string
          id: string
          nome: string
          primeiro_acesso: boolean
          telefone: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean
          data_criacao?: string
          id?: string
          nome: string
          primeiro_acesso?: boolean
          telefone?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean
          data_criacao?: string
          id?: string
          nome?: string
          primeiro_acesso?: boolean
          telefone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reunioes: {
        Row: {
          created_at: string
          created_by: string
          data_reuniao: string
          google_event_id: string | null
          google_meet_link: string | null
          horario_reuniao: string
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
          data_reuniao: string
          google_event_id?: string | null
          google_meet_link?: string | null
          horario_reuniao: string
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
          data_reuniao?: string
          google_event_id?: string | null
          google_meet_link?: string | null
          horario_reuniao?: string
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
      [_ in never]: never
    }
    Functions: {
      complete_lead_by_token: {
        Args: { p_data: Json; p_lojas?: Json; p_token: string }
        Returns: Json
      }
      generate_partner_code: { Args: never; Returns: string }
      generate_slug: { Args: { name_input: string }; Returns: string }
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
      has_any_admin: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
      register_lead_public: {
        Args: {
          p_email_responsavel: string
          p_erp_utilizado: string
          p_nome_fantasia: string
          p_nome_responsavel: string
          p_origem?: string
          p_parceiro_id: string
          p_quantidade_lojas: number
          p_telefone_responsavel: string
          p_valor_campanhas?: number
        }
        Returns: string
      }
      register_parceiro: {
        Args: {
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
    },
  },
} as const
