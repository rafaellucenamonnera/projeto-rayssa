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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      leads: {
        Row: {
          cidade: string
          cnpj: string
          data_cadastro: string
          descricao_necessidade: string | null
          email_responsavel: string
          erp_utilizado: string
          id: string
          nome_fantasia: string
          nome_responsavel: string
          parceiro_id: string
          parcelas_pagas: number | null
          percentual_consultor: number | null
          qtd_parcelas: number | null
          quantidade_funcionarios: number | null
          quantidade_lojas: number
          razao_social: string
          status: string
          status_lead: Database["public"]["Enums"]["lead_status"]
          telefone_responsavel: string
          valor_campanhas: number | null
          valor_mensalidade: number | null
        }
        Insert: {
          cidade: string
          cnpj: string
          data_cadastro?: string
          descricao_necessidade?: string | null
          email_responsavel: string
          erp_utilizado: string
          id?: string
          nome_fantasia: string
          nome_responsavel: string
          parceiro_id: string
          parcelas_pagas?: number | null
          percentual_consultor?: number | null
          qtd_parcelas?: number | null
          quantidade_funcionarios?: number | null
          quantidade_lojas: number
          razao_social: string
          status?: string
          status_lead?: Database["public"]["Enums"]["lead_status"]
          telefone_responsavel: string
          valor_campanhas?: number | null
          valor_mensalidade?: number | null
        }
        Update: {
          cidade?: string
          cnpj?: string
          data_cadastro?: string
          descricao_necessidade?: string | null
          email_responsavel?: string
          erp_utilizado?: string
          id?: string
          nome_fantasia?: string
          nome_responsavel?: string
          parceiro_id?: string
          parcelas_pagas?: number | null
          percentual_consultor?: number | null
          qtd_parcelas?: number | null
          quantidade_funcionarios?: number | null
          quantidade_lojas?: number
          razao_social?: string
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
      generate_partner_code: { Args: never; Returns: string }
      generate_slug: { Args: { name_input: string }; Returns: string }
      get_financeiro_consultores:
        | { Args: never; Returns: Json }
        | { Args: { p_ano?: number; p_mes?: number }; Returns: Json }
      get_financeiro_dashboard:
        | { Args: never; Returns: Json }
        | { Args: { p_ano?: number; p_mes?: number }; Returns: Json }
      has_any_admin: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
    }
    Enums: {
      app_role: "admin" | "gestor_conta"
      lead_status:
        | "novo_lead"
        | "reuniao_agendada"
        | "proposta_comercial"
        | "lead_convertido"
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
      ],
    },
  },
} as const
