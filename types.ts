

export const PAYMENT_METHODS: { [key: string]: string } = {
  pix: 'PIX',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  dinheiro: 'Dinheiro',
  boleto: 'Boleto',
  transferencia: 'Transferência',
};

// !!! IMPORTANTE !!!
// Esta lista de categorias DEVE ser um reflexo exato do ENUM `categoria_nota_enum`
// no seu banco de dados Supabase (em public.categoria_nota_enum).
// Qualquer inconsistência causará erros ao salvar notas fiscais.
export const CATEGORIA_NOTA_ENUM = [
  'Serviços Preliminares e Terraplenagem',
  'Estrutura e Fundação',
  'Carpintaria e Marcenaria',
  'Alvenaria e Vedação',
  'Cobertura e Impermeabilização',
  'Instalação Hidráulica',
  'Instalação Elétrica',
  'Acabamento e Revestimento',
  'Esquadrias e Vidros',
  'Pintura',
  'Gastos Gerais'
] as const;

export type CategoriaNota = typeof CATEGORIA_NOTA_ENUM[number];

export const ORCAMENTO_ETAPA_STATUSES = ['Planejado', 'Em Execução', 'Concluído'] as const;
export type OrcamentoEtapaStatus = typeof ORCAMENTO_ETAPA_STATUSES[number];

export const ORCAMENTO_ITEM_TIPOS = ['material', 'mao_de_obra'] as const;
export type OrcamentoItemTipo = typeof ORCAMENTO_ITEM_TIPOS[number];

export type OrcamentoEtapa = {
  id: string;
  company_id: string;
  project_id: string;
  parent_id?: string | null;
  nome: string;
  ordem: number;
  status: OrcamentoEtapaStatus;
  observacoes?: string | null;
  created_by?: string | null;
  created_at: string;
  sub_etapas?: OrcamentoEtapa[];
};

export type OrcamentoItem = {
  id: string;
  company_id: string;
  project_id: string;
  etapa_id: string;
  descricao: string;
  tipo: OrcamentoItemTipo;
  categoria: CategoriaNota;
  collaborator_id?: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  created_at: string;
};

export interface OrcamentoEtapaWithDetails extends OrcamentoEtapa {
  itens_count?: number;
  total_previsto?: number;
  total_material?: number;
  total_mao_de_obra?: number;
  categorias?: CategoriaNota[];
  itens?: OrcamentoItem[];
}

export type OrcamentoCategorySummary = {
  categoria: CategoriaNota;
  orcado_material: number;
  orcado_mao_de_obra: number;
  orcado_total: number;
  realizado_notas: number;
};

export const PROJECT_STATUSES = ['Planejamento', 'Em Andamento', 'Concluído'] as const;
export type ProjectStatus = typeof PROJECT_STATUSES[number];

export const SERVICE_STATUSES = ['Em Andamento', 'Concluído'] as const;
export type ServiceStatus = typeof SERVICE_STATUSES[number];

export const AI_JOB_STATUSES = ['pending', 'processing', 'completed', 'failed', 'archived'] as const;
export type AIJobStatus = typeof AI_JOB_STATUSES[number];

export const TASK_STATUSES = ['Planejada', 'Em Execução', 'Concluída', 'Atrasada'] as const;
export type TaskStatus = typeof TASK_STATUSES[number];

export const TASK_PRIORITIES = ['Baixa', 'Média', 'Alta'] as const;
export type TaskPriority = typeof TASK_PRIORITIES[number];


// --- Interfaces based on usage ---

export type CartorioRecord = {
  id: string;
  company_id: string;
  project_id: string | null;
  description: string;
  amount: number;
  issue_date: string;
  file_url: string | null;
  document_file_url: string | null;
  created_at: string;
  created_by: string;
};

export type Profile = {
  id: string;
  company_id: string;
  company_key_id: string;
  company_keys: {
    expires_at: string;
    is_active: boolean;
  } | null;
  companies: {
    name: string;
  } | null;
}

export type Supplier = {
  id: string;
  name: string;
  cnpj: string | null;
  seller?: string | null;
  seller_contact?: string | null;
  service_rating: number;
  delivery_rating: number;
  company_id: string;
  created_by: string;
  created_at: string;
}

export type Project = {
  id: string;
  name: string;
  status: ProjectStatus;
  manager?: string | null;
  area_m2?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_district?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
  company_id: string;
  created_by: string;
  created_at: string;
}

export type Collaborator = {
    id: string;
    name: string;
    role?: string | null;
    phone?: string | null;
    document?: string | null;
    rating: number;
    observations?: string | null;
    company_id: string;
    created_by: string;
    created_at: string;
}

export type Task = {
  id: string;
  title: string; // Added Title to match DB Constraint
  description: string;
  project_id: string; // Foreign Key
  company_id: string;
  data_inicio_prevista: string | null;
  data_fim_prevista: string | null;
  status: TaskStatus;
  prioridade: TaskPriority;
  responsavel_execucao_id: string | null; // Foreign Key
  created_by: string;
  materiais_previstos: Json | null;
  equipamentos_utilizados: Json | null;
  observacoes: string | null;
  custo_real: number | null;
  created_at: string;

  // Relational data from joins (Supabase returns these nested)
  projects?: { name: string } | null;
  collaborators?: { name: string } | null;
}


export type ItemNotaFiscal = {
  id: string;
  nota_fiscal_id: string;
  description: string;
  manufacturer: string | null;
  unit_of_measure: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  category: typeof CATEGORIA_NOTA_ENUM[number];
}

export type NotaFiscal = {
  id: string;
  company_id: string;
  supplier_id: string;
  project_id: string;
  invoice_number: string;
  issue_date: string;
  total_value: number;
  shipping_value: number;
  payment_method: keyof typeof PAYMENT_METHODS;
  observations: string | null;
  file_url: string | null;
  created_at: string;
  created_by: string;
  // Relational data
  suppliers: { name: string } | null;
  projects: { name: string } | null;
}

export interface NotaWithItemCount extends NotaFiscal {
  item_count: number;
}

export type Service = {
    id: string;
    company_id: string;
    collaborator_id: string | null;
    project_id: string | null;
    description: string;
    status: ServiceStatus;
    start_date: string;
    end_date: string;
    total_value: number;
    observations: string | null;
    receipt_path?: string | null;
    created_at: string;
    created_by: string;
}

export interface ServiceWithDetails extends Service {
    collaborator_name: string | null;
    project_name: string | null;
    total_advances: number;
    remaining_value: number;
}

export type Advance = {
    id: string;
    company_id: string;
    service_id: string;
    value: number;
    payment_date: string;
    description: string | null;
    receipt_path?: string | null;
    created_at: string;
    created_by: string;
}

export interface AdvanceWithDetails extends Advance {
    service_description: string;
    collaborator_name: string | null;
    project_name: string | null;
}

export type AIProcessJob = {
    id: string;
    user_id: string;
    file_hash: string;
    storage_path: string;
    status: AIJobStatus;
    result_json: Json | null;
    error_message: string | null;
    retry_count: number;
    processing_started_at: string | null;
    processing_completed_at: string | null;
    created_at: string;
}

export type AuditLog = {
    id: string;
    company_id: string;
    user_email: string | null;
    action: string;
    resource: string;
    details: Json | null;
    created_at: string;
}

// --- Dashboard Types ---
export interface SpendingByCategory {
    category: string;
    total: number;
}

export interface ProjectHealth {
    id: string;
    name: string;
    total_tasks: number;
    completed_tasks: number;
    delayed_tasks: number;
}

export type AdvancedDashboardStats = {
    monthly_spending: number;
    delayed_tasks: number;
    pending_ai: number;
    spending_by_category: SpendingByCategory[];
    project_health: ProjectHealth[];
}

export type SummaryRpcRow = {
    total_value: number;
    total_count: number;
};

export type DashboardSpendingRow = {
    categoria: string;
    obra: string;
    total: number;
};

export type PainelHojeRow = {
  tarefas_atrasadas: number;
  tarefas_hoje: number;
  compras_pendentes: number;
  empreitadas_vencendo: number;
  empreitadas_vencidas: number;
  notas_para_revisar: number;
};

export type ObraResumoRow = {
  project_id: string;
  nome: string;
  status: string;
  area_m2: number | null;
  orcado_total: number;
  orcado_material: number;
  orcado_mao_de_obra: number;
  gasto_material: number;
  gasto_mao_de_obra: number;
  gasto_cartorio: number;
  gasto_total: number;
  a_pagar: number;
  comprometido: number;
  pct_gasto: number | null;
  pct_comprometido: number | null;
  pct_avanco: number | null;
  etapas_total: number;
  etapas_concluidas: number;
  custo_m2: number | null;
  orcado_m2: number | null;
  comprometido_m2: number | null;
};

export type ObraCategoriaRow = {
  project_id: string;
  obra: string;
  categoria: string;
  orcado_material: number;
  realizado_material: number;
  desvio_valor: number;
  desvio_pct: number | null;
  pct_do_realizado_obra: number | null;
};

export type GastoMensalRow = {
  ano?: number;
  mes?: number | string;
  ano_mes?: string;
  mes_ano?: string;
  gasto_material?: number;
  gasto_mao_de_obra?: number;
  gasto_cartorio?: number;
  gasto_total?: number;
  total?: number;
};

// --- Supabase Database Definition (Inferred) ---

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      tasks: {
        Row: Task;
        Insert: Omit<Task, 'id' | 'created_at' | 'projects' | 'collaborators'>;
        Update: Partial<Omit<Task, 'id' | 'created_at' | 'projects' | 'collaborators'>>;
        Relationships: [];
      };
      companies: {
        Row: { id: string; name: string; created_at: string };
        Insert: { id?: string; name: string; created_at?: string };
        Update: { id?: string; name?: string; created_at?: string };
        Relationships: [];
      };
      company_keys: {
        Row: { id: string; key: string; company_id: string; is_active: boolean; expires_at: string | null; created_at: string };
        Insert: { id?: string; key: string; company_id: string; is_active?: boolean; expires_at?: string | null; created_at?: string };
        Update: Partial<{ id: string; key: string; company_id: string; is_active: boolean; expires_at: string | null; created_at: string }>;
        Relationships: [];
      };
      projects: { Row: Project; Insert: Partial<Omit<Project, 'id' | 'created_at'>> & { name: string; company_id: string }; Update: Partial<Omit<Project, 'id' | 'created_at'>>; Relationships: []; };
      collaborators: { Row: Collaborator; Insert: Partial<Omit<Collaborator, 'id' | 'created_at'>> & { name: string; company_id: string }; Update: Partial<Omit<Collaborator, 'id' | 'created_at'>>; Relationships: []; };
      suppliers: { Row: Supplier; Insert: Partial<Omit<Supplier, 'id' | 'created_at'>> & { name: string; company_id: string }; Update: Partial<Omit<Supplier, 'id' | 'created_at'>>; Relationships: []; };
      servicos: { Row: Service; Insert: Partial<Omit<Service, 'id' | 'created_at'>>; Update: Partial<Omit<Service, 'id' | 'created_at'>>; Relationships: []; };
      adiantamentos: { Row: Advance; Insert: Partial<Omit<Advance, 'id' | 'created_at'>>; Update: Partial<Omit<Advance, 'id' | 'created_at'>>; Relationships: []; };
      notas_fiscais: { Row: NotaFiscal; Insert: Partial<Omit<NotaFiscal, 'id' | 'created_at' | 'suppliers' | 'projects'>>; Update: Partial<Omit<NotaFiscal, 'id' | 'created_at' | 'suppliers' | 'projects'>>; Relationships: []; };
      itens_nota_fiscal: { Row: ItemNotaFiscal; Insert: Partial<Omit<ItemNotaFiscal, 'id'>>; Update: Partial<Omit<ItemNotaFiscal, 'id'>>; Relationships: []; };
      orcamento_etapas: { Row: OrcamentoEtapa; Insert: Partial<Omit<OrcamentoEtapa, 'id' | 'created_at' | 'sub_etapas'>> & { company_id: string; project_id: string; nome: string }; Update: Partial<Omit<OrcamentoEtapa, 'id' | 'created_at' | 'sub_etapas'>>; Relationships: []; };
      orcamento_itens: { Row: OrcamentoItem; Insert: Partial<Omit<OrcamentoItem, 'id' | 'created_at' | 'valor_total'>> & { company_id: string; project_id: string; etapa_id: string; descricao: string; tipo: OrcamentoItemTipo; categoria: CategoriaNota }; Update: Partial<Omit<OrcamentoItem, 'id' | 'created_at' | 'valor_total'>>; Relationships: []; };
      ai_process_jobs: { Row: AIProcessJob; Insert: Partial<Omit<AIProcessJob, 'id' | 'created_at'>>; Update: Partial<Omit<AIProcessJob, 'id' | 'created_at'>>; Relationships: []; };
      profiles: { Row: Profile; Insert: Partial<Omit<Profile, 'id' | 'company_keys' | 'companies'>>; Update: Partial<Omit<Profile, 'id' | 'company_keys' | 'companies'>>; Relationships: []; };
      cartorio_records: { Row: CartorioRecord; Insert: Partial<Omit<CartorioRecord, 'id' | 'created_at'>>; Update: Partial<Omit<CartorioRecord, 'id' | 'created_at'>>; Relationships: []; };
      audit_logs: { Row: AuditLog; Insert: Partial<Omit<AuditLog, 'id' | 'created_at'>> & { company_id: string; action: string; resource: string }; Update: Partial<Omit<AuditLog, 'id' | 'created_at'>>; Relationships: []; };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_advanced_dashboard_stats: {
        Args: { p_company_id: string };
        Returns: AdvancedDashboardStats;
      };
      sp_update_nota_with_items: {
        Args: { p_nota_id: string; p_nota_data: Record<string, unknown>; p_itens_json?: unknown[]; p_items_data?: unknown[] };
        Returns: unknown;
      };
      fn_create_nota_with_items: {
        Args: Record<string, unknown>;
        Returns: string;
      };
      fn_get_notas_with_item_count: {
        Args: Record<string, unknown>;
        Returns: NotaWithItemCount[];
      };
      fn_get_advances_with_details: {
        Args: Record<string, unknown>;
        Returns: AdvanceWithDetails[];
      };
      get_notas_summary: {
        Args: {
          p_company_id: string;
          p_invoice_number?: string | null;
          p_supplier_id?: string | null;
          p_project_id?: string | null;
          p_payment_method?: string | null;
          p_start_date?: string | null;
          p_end_date?: string | null;
        };
        Returns: SummaryRpcRow | SummaryRpcRow[];
      };
      get_cartorio_summary: {
        Args: {
          p_company_id: string;
          p_search?: string | null;
          p_project_id?: string | null;
          p_start_date?: string | null;
          p_end_date?: string | null;
        };
        Returns: SummaryRpcRow | SummaryRpcRow[];
      };
      get_dashboard_spending: {
        Args: { p_company_id: string };
        Returns: DashboardSpendingRow[];
      };
      register_company_key: {
        Args: { p_key: string; p_company_name: string; p_user_id: string };
        Returns: boolean;
      };
      get_project_budget_by_category: {
        Args: { p_company_id: string; p_project_id: string };
        Returns: OrcamentoCategorySummary[];
      };
      get_painel_hoje: {
        Args: { p_company_id: string; p_hoje: string };
        Returns: PainelHojeRow[];
      };
      get_obras_resumo: {
        Args: { p_company_id: string };
        Returns: ObraResumoRow[];
      };
      get_obras_categorias: {
        Args: { p_company_id: string };
        Returns: ObraCategoriaRow[];
      };
      get_gasto_mensal: {
        Args: { p_company_id: string; p_meses: number };
        Returns: GastoMensalRow[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}