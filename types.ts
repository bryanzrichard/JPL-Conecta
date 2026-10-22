

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
  'Estrutura e Fundação',
  'Instalação Hidráulica',
  'Instalação Elétrica',
  'Alvenaria e Vedação',
  'Acabamento e Revestimento',
  'Carpintaria e Marcenaria',
  'Cobertura e Impermeabilização',
  'Gastos Gerais'
] as const;

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
      fn_get_services_with_details: {
        Args: Record<string, unknown>;
        Returns: ServiceWithDetails[];
      };
      fn_get_advances_with_details: {
        Args: Record<string, unknown>;
        Returns: AdvanceWithDetails[];
      };
      register_company_key: {
        Args: { p_key: string; p_company_name: string; p_user_id: string };
        Returns: boolean;
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