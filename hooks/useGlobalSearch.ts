import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './useAuth';
import { ServiceStatus, TaskStatus, TaskPriority, ProjectStatus } from '../types';

// ============================================================================
// Tipos de Retorno Fortemente Tipados para Resultados da Busca Global
// Com IDs explícitos para Deep Linking e Edição Direta
// ============================================================================

export interface GlobalSearchInvoiceItem {
  id: string;
  item_id: string;
  nota_id: string;
  nota_fiscal_id: string;
  description: string;
  manufacturer: string | null;
  unit_of_measure: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  category: string;
  issue_date: string;
  invoice_number: string;
  supplier_name: string;
  supplier_id: string | null;
  project_name: string | null;
  project_id: string | null;
}

export interface GlobalSearchNotaFiscal {
  id: string;
  nota_id: string;
  invoice_number: string;
  issue_date: string;
  total_value: number;
  supplier_name: string | null;
  project_name: string | null;
}

export interface GlobalSearchService {
  id: string;
  servico_id: string;
  description: string;
  status: ServiceStatus;
  start_date: string;
  end_date: string;
  total_value: number;
  collaborator_id: string | null;
  collaborator_name: string | null;
  project_id: string | null;
  project_name: string | null;
  observations: string | null;
  created_at: string;
}

export interface GlobalSearchAdvance {
  id: string;
  adiantamento_id: string;
  service_id: string;
  servico_id: string;
  value: number;
  payment_date: string;
  description: string | null;
  receipt_path: string | null;
  service_description: string | null;
  collaborator_name: string | null;
  project_name: string | null;
  created_at: string;
}

export interface GlobalSearchTask {
  id: string;
  tarefa_id: string;
  title: string;
  description: string;
  project_id: string;
  project_name: string | null;
  status: TaskStatus;
  prioridade: TaskPriority;
  responsavel_id: string | null;
  responsavel_name: string | null;
  data_inicio_prevista: string | null;
  data_fim_prevista: string | null;
  custo_real: number | null;
  created_at: string;
}

export interface GlobalSearchSupplier {
  id: string;
  fornecedor_id: string;
  name: string;
  cnpj: string | null;
  seller: string | null;
  seller_contact: string | null;
  service_rating: number;
  delivery_rating: number;
}

export interface GlobalSearchCollaborator {
  id: string;
  colaborador_id: string;
  name: string;
  role: string | null;
  phone: string | null;
  document: string | null;
  rating: number;
}

export interface GlobalSearchProject {
  id: string;
  projeto_id: string;
  name: string;
  status: ProjectStatus;
  manager: string | null;
  address_city: string | null;
  address_state: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface GlobalSearchCartorio {
  id: string;
  cartorio_id: string;
  description: string;
  amount: number;
  issue_date: string;
  project_id: string | null;
  project_name: string | null;
  file_url: string | null;
  document_file_url: string | null;
  created_at: string;
}

export interface GlobalSearchResults {
  items: GlobalSearchInvoiceItem[];
  notas: GlobalSearchNotaFiscal[];
  servicos: GlobalSearchService[];
  adiantamentos: GlobalSearchAdvance[];
  tasks: GlobalSearchTask[];
  suppliers: GlobalSearchSupplier[];
  collaborators: GlobalSearchCollaborator[];
  projects: GlobalSearchProject[];
  cartorio: GlobalSearchCartorio[];
  totalCount: number;
}

// ============================================================================
// Tipos para Inteligência de Preços (Price Intelligence)
// ============================================================================

export interface PriceRecord {
  unitPrice: number;
  date: string;
  totalPrice?: number;
  quantity?: number;
  unitOfMeasure?: string | null;
  supplierName?: string;
  projectName?: string;
  invoiceNumber?: string;
  description?: string;
  nota_id?: string;
}

export interface PriceStats {
  hasData: boolean;
  totalOccurrences: number;
  lastPurchase: PriceRecord | null;
  lowestPrice: PriceRecord | null;
  highestPrice: PriceRecord | null;
  averagePrice: number;
  weightedAveragePrice: number;
  priceTrend: 'alta' | 'baixa' | 'estavel';
  variancePercent: number;
}

// ============================================================================
// Opções de Configuração e Retorno do Hook
// ============================================================================

export interface UseGlobalSearchOptions {
  debounceMs?: number;
  minChars?: number;
  companyId?: string;
  enabled?: boolean;
}

export interface UseGlobalSearchResult {
  searchTerm: string;
  debouncedTerm: string;
  setSearchTerm: (term: string) => void;
  clearSearch: () => void;
  results: GlobalSearchResults;
  priceStats: PriceStats | null;
  isLoading: boolean;
  isDebouncing: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  hasSearched: boolean;
}

const INITIAL_RESULTS: GlobalSearchResults = {
  items: [],
  notas: [],
  servicos: [],
  adiantamentos: [],
  tasks: [],
  suppliers: [],
  collaborators: [],
  projects: [],
  cartorio: [],
  totalCount: 0,
};

// ============================================================================
// Função Utilitária para Calcular Inteligência de Preços
// ============================================================================

function calculatePriceStats(items: GlobalSearchInvoiceItem[]): PriceStats | null {
  const validItems = items.filter(
    (item) => typeof item.unit_price === 'number' && item.unit_price > 0 && !isNaN(item.unit_price)
  );

  if (validItems.length === 0) {
    return null;
  }

  // Ordenar por data decrescente (mais recente primeiro) para lastPurchase
  const sortedByDateDesc = [...validItems].sort((a, b) => {
    const timeA = a.issue_date ? new Date(a.issue_date).getTime() : 0;
    const timeB = b.issue_date ? new Date(b.issue_date).getTime() : 0;
    return timeB - timeA;
  });

  const latest = sortedByDateDesc[0];
  const lastPurchase: PriceRecord = {
    unitPrice: latest.unit_price,
    date: latest.issue_date || '',
    totalPrice: latest.total_price,
    quantity: latest.quantity,
    unitOfMeasure: latest.unit_of_measure,
    supplierName: latest.supplier_name,
    projectName: latest.project_name || undefined,
    invoiceNumber: latest.invoice_number,
    description: latest.description,
    nota_id: latest.nota_id,
  };

  // Ordenar por valor unitário crescente para lowestPrice e highestPrice
  const sortedByPriceAsc = [...validItems].sort((a, b) => a.unit_price - b.unit_price);
  const lowest = sortedByPriceAsc[0];
  const highest = sortedByPriceAsc[sortedByPriceAsc.length - 1];

  const lowestPrice: PriceRecord = {
    unitPrice: lowest.unit_price,
    date: lowest.issue_date || '',
    totalPrice: lowest.total_price,
    quantity: lowest.quantity,
    unitOfMeasure: lowest.unit_of_measure,
    supplierName: lowest.supplier_name,
    projectName: lowest.project_name || undefined,
    invoiceNumber: lowest.invoice_number,
    description: lowest.description,
    nota_id: lowest.nota_id,
  };

  const highestPrice: PriceRecord = {
    unitPrice: highest.unit_price,
    date: highest.issue_date || '',
    totalPrice: highest.total_price,
    quantity: highest.quantity,
    unitOfMeasure: highest.unit_of_measure,
    supplierName: highest.supplier_name,
    projectName: highest.project_name || undefined,
    invoiceNumber: highest.invoice_number,
    description: highest.description,
    nota_id: highest.nota_id,
  };

  // Média Simples dos Preços Unitários
  const sumUnitPrices = validItems.reduce((acc, curr) => acc + curr.unit_price, 0);
  const averagePrice = Number((sumUnitPrices / validItems.length).toFixed(2));

  // Média Ponderada por Quantidade
  const totalSpend = validItems.reduce(
    (acc, curr) => acc + (curr.total_price || curr.unit_price * (curr.quantity || 1)),
    0
  );
  const totalQty = validItems.reduce((acc, curr) => acc + (curr.quantity || 1), 0);
  const weightedAveragePrice = totalQty > 0 ? Number((totalSpend / totalQty).toFixed(2)) : averagePrice;

  // Variação percentual entre maior e menor preço
  const variancePercent =
    lowestPrice.unitPrice > 0
      ? Number((((highestPrice.unitPrice - lowestPrice.unitPrice) / lowestPrice.unitPrice) * 100).toFixed(1))
      : 0;

  // Tendência de Preço (última compra vs média)
  let priceTrend: 'alta' | 'baixa' | 'estavel' = 'estavel';
  if (lastPurchase.unitPrice > averagePrice * 1.03) {
    priceTrend = 'alta';
  } else if (lastPurchase.unitPrice < averagePrice * 0.97) {
    priceTrend = 'baixa';
  }

  return {
    hasData: true,
    totalOccurrences: validItems.length,
    lastPurchase,
    lowestPrice,
    highestPrice,
    averagePrice,
    weightedAveragePrice,
    priceTrend,
    variancePercent,
  };
}

// ============================================================================
// Hook useGlobalSearch
// ============================================================================

export function useGlobalSearch(
  initialTerm: string = '',
  options: UseGlobalSearchOptions = {}
): UseGlobalSearchResult {
  const { debounceMs = 300, minChars = 2, companyId: customCompanyId, enabled = true } = options;

  const { profile } = useAuth();
  const effectiveCompanyId = customCompanyId || profile?.company_id;

  const [searchTerm, setSearchTerm] = useState<string>(initialTerm);
  const [debouncedTerm, setDebouncedTerm] = useState<string>(initialTerm);
  const [isDebouncing, setIsDebouncing] = useState<boolean>(false);
  const [results, setResults] = useState<GlobalSearchResults>(INITIAL_RESULTS);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  // Contador de requisições para evitar race conditions
  const requestIdRef = useRef<number>(0);

  // Sincronizar se o initialTerm mudar externamente
  useEffect(() => {
    if (initialTerm !== undefined && initialTerm !== searchTerm) {
      setSearchTerm(initialTerm);
    }
  }, [initialTerm]);

  // 1. Debounce de 300ms sobre o termo de busca
  useEffect(() => {
    if (searchTerm === debouncedTerm) {
      setIsDebouncing(false);
      return;
    }

    setIsDebouncing(true);
    const handler = setTimeout(() => {
      setDebouncedTerm(searchTerm);
      setIsDebouncing(false);
    }, debounceMs);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm, debounceMs, debouncedTerm]);

  // Limpeza de busca
  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setDebouncedTerm('');
    setResults(INITIAL_RESULTS);
    setError(null);
    setHasSearched(false);
    setIsLoading(false);
  }, []);

  // 2. Execução da Busca Global com Promise.all e Ordenação Cronológica Recente
  const executeSearch = useCallback(
    async (termToSearch: string) => {
      const cleanTerm = termToSearch.trim();

      if (!enabled || !effectiveCompanyId || cleanTerm.length < minChars) {
        setResults(INITIAL_RESULTS);
        setIsLoading(false);
        setHasSearched(false);
        return;
      }

      // Sanitizar caracteres especiais para PostgREST
      const sanitizedTerm = cleanTerm.replace(/[,()]/g, ' ').trim();
      if (!sanitizedTerm) return;

      const currentRequestId = ++requestIdRef.current;
      setIsLoading(true);
      setError(null);

      try {
        // Disparar buscas simultâneas em todas as entidades com ordenação decrescente
        const [
          itemsResponse,
          notasResponse,
          servicosResponse,
          adiantamentosResponse,
          tasksResponse,
          suppliersResponse,
          collaboratorsResponse,
          projectsResponse,
          cartorioResponse,
        ] = await Promise.all([
          // 1. Itens de Notas Fiscais (JOIN com notas_fiscais e fornecedores)
          supabase
            .from('itens_nota_fiscal')
            .select(`
              id,
              nota_fiscal_id,
              description,
              manufacturer,
              unit_of_measure,
              quantity,
              unit_price,
              total_price,
              category,
              notas_fiscais!inner (
                id,
                invoice_number,
                issue_date,
                company_id,
                suppliers ( id, name ),
                projects ( id, name )
              )
            `)
            .eq('notas_fiscais.company_id', effectiveCompanyId)
            .ilike('description', `%${sanitizedTerm}%`)
            .order('id', { ascending: false })
            .limit(50),

          // 2. Notas Fiscais (Busca direta por número ou observações)
          supabase
            .from('notas_fiscais')
            .select(`
              id,
              invoice_number,
              issue_date,
              total_value,
              company_id,
              suppliers ( id, name ),
              projects ( id, name )
            `)
            .eq('company_id', effectiveCompanyId)
            .or(`invoice_number.ilike.%${sanitizedTerm}%,observations.ilike.%${sanitizedTerm}%`)
            .order('issue_date', { ascending: false })
            .limit(30),

          // 3. Serviços (ordenação por start_date mais recente)
          supabase
            .from('servicos')
            .select(`
              id,
              company_id,
              collaborator_id,
              project_id,
              description,
              status,
              start_date,
              end_date,
              total_value,
              observations,
              created_at,
              collaborators ( id, name ),
              projects ( id, name )
            `)
            .eq('company_id', effectiveCompanyId)
            .ilike('description', `%${sanitizedTerm}%`)
            .order('start_date', { ascending: false })
            .limit(30),

          // 4. Adiantamentos (tabela de adiantamentos com ordenação por payment_date mais recente)
          supabase
            .from('adiantamentos')
            .select(`
              id,
              company_id,
              service_id,
              value,
              payment_date,
              description,
              receipt_path,
              created_at,
              servicos (
                id,
                description,
                collaborators ( id, name ),
                projects ( id, name )
              )
            `)
            .eq('company_id', effectiveCompanyId)
            .ilike('description', `%${sanitizedTerm}%`)
            .order('payment_date', { ascending: false })
            .limit(30),

          // 5. Tarefas (ordenação por created_at mais recente)
          supabase
            .from('tasks')
            .select(`
              id,
              title,
              description,
              project_id,
              company_id,
              data_inicio_prevista,
              data_fim_prevista,
              status,
              prioridade,
              responsavel_execucao_id,
              custo_real,
              created_at,
              projects ( id, name ),
              collaborators:responsavel_execucao_id ( id, name )
            `)
            .eq('company_id', effectiveCompanyId)
            .or(`title.ilike.%${sanitizedTerm}%,description.ilike.%${sanitizedTerm}%`)
            .order('created_at', { ascending: false })
            .limit(30),

          // 6. Cadastros: Fornecedores (ordenação por created_at mais recente)
          supabase
            .from('suppliers')
            .select(`
              id,
              name,
              cnpj,
              seller,
              seller_contact,
              service_rating,
              delivery_rating,
              company_id,
              created_at
            `)
            .eq('company_id', effectiveCompanyId)
            .or(`name.ilike.%${sanitizedTerm}%,cnpj.ilike.%${sanitizedTerm}%,seller.ilike.%${sanitizedTerm}%`)
            .order('created_at', { ascending: false })
            .limit(30),

          // 7. Cadastros: Colaboradores (ordenação por created_at mais recente)
          supabase
            .from('collaborators')
            .select(`
              id,
              name,
              role,
              phone,
              document,
              rating,
              company_id,
              created_at
            `)
            .eq('company_id', effectiveCompanyId)
            .or(`name.ilike.%${sanitizedTerm}%,role.ilike.%${sanitizedTerm}%,document.ilike.%${sanitizedTerm}%`)
            .order('created_at', { ascending: false })
            .limit(30),

          // 8. Cadastros: Obras / Projetos (ordenação por created_at mais recente)
          supabase
            .from('projects')
            .select(`
              id,
              name,
              status,
              manager,
              start_date,
              end_date,
              address_city,
              address_state,
              company_id,
              created_at
            `)
            .eq('company_id', effectiveCompanyId)
            .or(`name.ilike.%${sanitizedTerm}%,manager.ilike.%${sanitizedTerm}%`)
            .order('created_at', { ascending: false })
            .limit(30),

          // 9. Cartório (ordenação por issue_date mais recente)
          supabase
            .from('cartorio_records')
            .select(`
              id,
              company_id,
              project_id,
              description,
              amount,
              issue_date,
              file_url,
              document_file_url,
              created_at,
              projects ( id, name )
            `)
            .eq('company_id', effectiveCompanyId)
            .ilike('description', `%${sanitizedTerm}%`)
            .order('issue_date', { ascending: false })
            .limit(30),
        ]);

        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        // 1. Mapear Itens de Notas Fiscais
        const mappedItems: GlobalSearchInvoiceItem[] = (itemsResponse.data || []).map((raw: any) => {
          const nota = raw.notas_fiscais || {};
          const supplier = nota.suppliers || null;
          const project = nota.projects || null;
          const notaId = raw.nota_fiscal_id || nota.id || raw.id;

          return {
            id: raw.id,
            item_id: raw.id,
            nota_id: notaId,
            nota_fiscal_id: notaId,
            description: raw.description,
            manufacturer: raw.manufacturer || null,
            unit_of_measure: raw.unit_of_measure || null,
            quantity: Number(raw.quantity) || 0,
            unit_price: Number(raw.unit_price) || 0,
            total_price: Number(raw.total_price) || 0,
            category: raw.category || 'Gastos Gerais',
            issue_date: nota.issue_date || '',
            invoice_number: nota.invoice_number || '',
            supplier_name: supplier?.name || 'Fornecedor não identificado',
            supplier_id: supplier?.id || null,
            project_name: project?.name || null,
            project_id: project?.id || null,
          };
        });

        // 2. Mapear Notas Fiscais
        const mappedNotas: GlobalSearchNotaFiscal[] = (notasResponse.data || []).map((raw: any) => ({
          id: raw.id,
          nota_id: raw.id,
          invoice_number: raw.invoice_number,
          issue_date: raw.issue_date,
          total_value: Number(raw.total_value) || 0,
          supplier_name: raw.suppliers?.name || null,
          project_name: raw.projects?.name || null,
        }));

        // 3. Mapear Serviços
        const mappedServicos: GlobalSearchService[] = (servicosResponse.data || []).map((raw: any) => ({
          id: raw.id,
          servico_id: raw.id,
          description: raw.description,
          status: raw.status,
          start_date: raw.start_date,
          end_date: raw.end_date,
          total_value: Number(raw.total_value) || 0,
          collaborator_id: raw.collaborator_id || null,
          collaborator_name: raw.collaborators?.name || null,
          project_id: raw.project_id || null,
          project_name: raw.projects?.name || null,
          observations: raw.observations || null,
          created_at: raw.created_at,
        }));

        // 4. Mapear Adiantamentos
        const mappedAdiantamentos: GlobalSearchAdvance[] = (adiantamentosResponse.data || []).map((raw: any) => {
          const servico = raw.servicos || {};
          return {
            id: raw.id,
            adiantamento_id: raw.id,
            service_id: raw.service_id,
            servico_id: raw.service_id,
            value: Number(raw.value) || 0,
            payment_date: raw.payment_date,
            description: raw.description || null,
            receipt_path: raw.receipt_path || null,
            service_description: servico.description || null,
            collaborator_name: servico.collaborators?.name || null,
            project_name: servico.projects?.name || null,
            created_at: raw.created_at,
          };
        });

        // 5. Mapear Tarefas
        const mappedTasks: GlobalSearchTask[] = (tasksResponse.data || []).map((raw: any) => ({
          id: raw.id,
          tarefa_id: raw.id,
          title: raw.title,
          description: raw.description,
          project_id: raw.project_id,
          project_name: raw.projects?.name || null,
          status: raw.status,
          prioridade: raw.prioridade,
          responsavel_id: raw.responsavel_execucao_id || null,
          responsavel_name: raw.collaborators?.name || null,
          data_inicio_prevista: raw.data_inicio_prevista || null,
          data_fim_prevista: raw.data_fim_prevista || null,
          custo_real: raw.custo_real !== null ? Number(raw.custo_real) : null,
          created_at: raw.created_at,
        }));

        // 6. Mapear Fornecedores
        const mappedSuppliers: GlobalSearchSupplier[] = (suppliersResponse.data || []).map((raw: any) => ({
          id: raw.id,
          fornecedor_id: raw.id,
          name: raw.name,
          cnpj: raw.cnpj || null,
          seller: raw.seller || null,
          seller_contact: raw.seller_contact || null,
          service_rating: Number(raw.service_rating) || 0,
          delivery_rating: Number(raw.delivery_rating) || 0,
        }));

        // 7. Mapear Colaboradores
        const mappedCollaborators: GlobalSearchCollaborator[] = (collaboratorsResponse.data || []).map((raw: any) => ({
          id: raw.id,
          colaborador_id: raw.id,
          name: raw.name,
          role: raw.role || null,
          phone: raw.phone || null,
          document: raw.document || null,
          rating: Number(raw.rating) || 0,
        }));

        // 8. Mapear Projetos / Obras
        const mappedProjects: GlobalSearchProject[] = (projectsResponse.data || []).map((raw: any) => ({
          id: raw.id,
          projeto_id: raw.id,
          name: raw.name,
          status: raw.status,
          manager: raw.manager || null,
          address_city: raw.address_city || null,
          address_state: raw.address_state || null,
          start_date: raw.start_date || null,
          end_date: raw.end_date || null,
        }));

        // 9. Mapear Cartório
        const mappedCartorio: GlobalSearchCartorio[] = (cartorioResponse.data || []).map((raw: any) => ({
          id: raw.id,
          cartorio_id: raw.id,
          description: raw.description,
          amount: Number(raw.amount) || 0,
          issue_date: raw.issue_date,
          project_id: raw.project_id || null,
          project_name: raw.projects?.name || null,
          file_url: raw.file_url || null,
          document_file_url: raw.document_file_url || null,
          created_at: raw.created_at,
        }));

        const totalCount =
          mappedItems.length +
          mappedNotas.length +
          mappedServicos.length +
          mappedAdiantamentos.length +
          mappedTasks.length +
          mappedSuppliers.length +
          mappedCollaborators.length +
          mappedProjects.length +
          mappedCartorio.length;

        setResults({
          items: mappedItems,
          notas: mappedNotas,
          servicos: mappedServicos,
          adiantamentos: mappedAdiantamentos,
          tasks: mappedTasks,
          suppliers: mappedSuppliers,
          collaborators: mappedCollaborators,
          projects: mappedProjects,
          cartorio: mappedCartorio,
          totalCount,
        });

        setHasSearched(true);
      } catch (err: any) {
        if (currentRequestId === requestIdRef.current) {
          setError(err instanceof Error ? err : new Error(err?.message || 'Erro durante a busca global'));
        }
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [enabled, effectiveCompanyId, minChars]
  );

  // Efeito disparado pelo termo debounced
  useEffect(() => {
    executeSearch(debouncedTerm);
  }, [debouncedTerm, executeSearch]);

  // Função manual para refetch
  const refetch = useCallback(async () => {
    await executeSearch(debouncedTerm);
  }, [debouncedTerm, executeSearch]);

  // 3. Inteligência de Preços calculada sobre os itens de notas fiscais
  const priceStats = useMemo(() => {
    return calculatePriceStats(results.items);
  }, [results.items]);

  return {
    searchTerm,
    debouncedTerm,
    setSearchTerm,
    clearSearch,
    results,
    priceStats,
    isLoading,
    isDebouncing,
    error,
    refetch,
    hasSearched,
  };
}
