import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NotaWithItemCount, NotaFiscal, ItemNotaFiscal, PAYMENT_METHODS } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { 
  FileTextIcon, 
  BuildingIcon, 
  ConstructionIcon, 
  CreditCardIcon, 
  DollarSignIcon, 
  PaperclipIcon, 
  ExternalLinkIcon,
  PackageIcon,
  CalendarIcon,
  CheckCircle2Icon,
  EditIcon,
  Trash2Icon,
  ChevronUpIcon,
  ChevronDownIcon,
  XIcon
} from '../../lib/icons';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency, openStorageFile } from '../../lib/utils';

interface NotaDetailPanelProps {
  nota: NotaWithItemCount | NotaFiscal;
  onClose: () => void;
  onEdit: (nota: NotaWithItemCount | NotaFiscal) => void;
  onDelete: (nota: NotaWithItemCount | NotaFiscal) => void;
  onPrevNota: () => void;
  onNextNota: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  currentIndex: number;
  totalCount: number;
  highlightItemId?: string | null;
}

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return 'N/A';
  try {
    const [year, month, day] = dateStr.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

const isReceipt = (invoiceNumber?: string | null) => {
  if (!invoiceNumber) return false;
  return invoiceNumber.toUpperCase().startsWith('RECIBO');
};

const getCategoryBadgeClass = (category: string) => {
  switch (category) {
    case 'Serviços Preliminares e Terraplenagem':
      return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/[0.12] dark:text-amber-300 dark:border-amber-500/20';
    case 'Estrutura':
    case 'Estrutura e Fundação':
      return 'bg-[#EEF2FF] text-[#4338CA] border-indigo-200/80 dark:bg-indigo-500/[0.12] dark:text-[#818CF8] dark:border-indigo-500/20';
    case 'Carpintaria e Marcenaria':
      return 'bg-amber-100/60 text-amber-900 border-amber-300/80 dark:bg-amber-600/[0.15] dark:text-amber-200 dark:border-amber-500/30';
    case 'Alvenaria':
    case 'Alvenaria e Vedação':
    case 'Alvenaria e Vedações':
      return 'bg-[#FFFBEB] text-[#B45309] border-amber-200/80 dark:bg-amber-500/[0.12] dark:text-[#FBBF24] dark:border-amber-500/20';
    case 'Cobertura e Impermeabilização':
      return 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-500/[0.12] dark:text-teal-300 dark:border-teal-500/20';
    case 'Hidráulica':
    case 'Instalação Hidráulica':
    case 'Instalações Hidrossanitárias':
      return 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-500/[0.12] dark:text-cyan-400 dark:border-cyan-500/20';
    case 'Elétrica':
    case 'Instalação Elétrica':
    case 'Instalações Elétricas':
      return 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-500/[0.12] dark:text-yellow-400 dark:border-yellow-500/20';
    case 'Acabamento':
    case 'Acabamento e Revestimento':
    case 'Acabamentos e Revestimentos':
      return 'bg-[#ECFDF5] text-[#047857] border-emerald-200/80 dark:bg-emerald-500/[0.12] dark:text-[#34D399] dark:border-emerald-500/20';
    case 'Esquadrias e Vidros':
      return 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-500/[0.12] dark:text-sky-300 dark:border-sky-500/20';
    case 'Pintura':
      return 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-500/[0.12] dark:text-purple-400 dark:border-purple-500/20';
    case 'Gastos Gerais':
    case 'Ferramentas':
    case 'Ferramentas e Equipamentos':
    default:
      return 'bg-[#F1F5F9] text-[#475569] border-slate-200 dark:bg-[#1E293B] dark:text-[#94A3B8] dark:border-slate-700/60';
  }
};

export const NotaDetailPanel: React.FC<NotaDetailPanelProps> = ({
  nota,
  onClose,
  onEdit,
  onDelete,
  onPrevNota,
  onNextNota,
  hasPrev,
  hasNext,
  currentIndex,
  totalCount,
  highlightItemId,
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'detalhes' | 'anexo'>('detalhes');
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(highlightItemId || null);

  useEffect(() => {
    if (highlightItemId) {
      setActiveHighlightId(highlightItemId);
      const timer = setTimeout(() => {
        setActiveHighlightId(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightItemId]);

  // Buscar itens da nota fiscal via React Query
  const { data: items = [], isLoading: loadingItems, isError, error: itemsError } = useQuery({
    queryKey: ['nota_itens', nota?.id],
    queryFn: async (): Promise<ItemNotaFiscal[]> => {
      const { data, error } = await supabase
        .from('itens_nota_fiscal')
        .select('*')
        .eq('nota_fiscal_id', nota.id)
        .order('description', { ascending: true });
      if (error) {
        console.error('Erro ao buscar itens da nota fiscal:', error);
        throw error;
      }
      return (data || []) as ItemNotaFiscal[];
    },
    enabled: !!nota?.id,
    staleTime: 30000,
  });

  // Scroll automatico ate o item destacado quando a lista de itens carregar
  useEffect(() => {
    if (highlightItemId && items.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`nota-panel-item-row-${highlightItemId}`);
        if (el) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }, 150);
    }
  }, [highlightItemId, items]);

  const handleViewFile = async (path: string) => {
    try {
      await openStorageFile(path);
    } catch {
      toast({ 
        title: 'Erro ao abrir anexo', 
        description: 'Não foi possível gerar um link para o arquivo armazenado.', 
        variant: 'destructive' 
      });
    }
  };

  const isRec = isReceipt(nota.invoice_number);
  const paymentLabel = (PAYMENT_METHODS as any)[nota.payment_method] || nota.payment_method || 'Não especificado';

  // Verificar se o anexo é imagem
  const isImageFile = nota.file_url ? /\.(png|jpe?g|webp|gif)$/i.test(nota.file_url) : false;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-brand-dark-900 overflow-hidden select-text">
      
      {/* ========================================================= */}
      {/* 1. TOPBAR DE CONTROLE E NAVEGAÇÃO SEQUENCIAL              */}
      {/* ========================================================= */}
      <div className="p-3.5 sm:px-4 border-b border-[#E2E8F0] dark:border-[#1E293B] flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-[#111827] shrink-0">
        
        {/* Esquerda: Identificador da Nota */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <FileTextIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-slate-800 dark:text-[#F8FAFC] text-xs truncate max-w-[160px] sm:max-w-[200px]" title={nota.invoice_number || 'Sem Número'}>
                {nota.invoice_number || 'Sem Número'}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider ${
                isRec
                  ? 'bg-[#FFFBEB] text-[#B45309] border-amber-200/80 dark:bg-amber-500/[0.12] dark:text-[#FBBF24] dark:border-amber-500/20'
                  : 'bg-[#F1F5F9] text-[#475569] border-slate-200 dark:bg-[#1E293B] dark:text-[#94A3B8] dark:border-slate-700/60'
              }`}>
                {isRec ? 'RECIBO' : 'NF-e'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-[#94A3B8] truncate">
              {formatDate(nota.issue_date)} • {nota.projects?.name || 'Geral'}
            </p>
          </div>
        </div>

        {/* Centro / Direita: Controles de Navegação e Ações */}
        <div className="flex items-center gap-1.5 shrink-0">
          
          {/* Navegação Sequencial: ↑ Anterior e ↓ Próxima */}
          <div className="inline-flex items-center bg-white dark:bg-brand-dark-800 rounded-lg p-0.5 border border-slate-200 dark:border-gray-700 shadow-xs">
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrevNota}
              disabled={!hasPrev}
              className="h-6 w-6 text-slate-600 dark:text-gray-300 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-brand-dark-700 rounded cursor-pointer"
              title="Nota Anterior (Seta Cima / Esquerda)"
            >
              <ChevronUpIcon className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[10px] font-mono font-medium px-1.5 text-slate-500 dark:text-gray-400 select-none">
              {currentIndex + 1}/{totalCount}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNextNota}
              disabled={!hasNext}
              className="h-6 w-6 text-slate-600 dark:text-gray-300 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-brand-dark-700 rounded cursor-pointer"
              title="Próxima Nota (Seta Baixo / Direita)"
            >
              <ChevronDownIcon className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-gray-800 mx-0.5 hidden sm:block" />

          {/* Botões de Ação Rápida: Editar, Excluir e Fechar */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(nota)}
            className="h-7 px-2 text-[11px] font-semibold text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-brand-dark-800 gap-1 cursor-pointer"
            title="Editar Nota Fiscal"
          >
            <EditIcon className="h-3 w-3" />
            <span className="hidden sm:inline">Editar</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(nota)}
            className="h-7 px-2 text-[11px] font-semibold text-[#E11D48] hover:bg-[#FFF1F2] border-rose-200/80 dark:text-[#FB7185] dark:hover:bg-rose-500/[0.12] dark:border-rose-900/40 gap-1 cursor-pointer"
            title="Excluir Nota Fiscal"
          >
            <Trash2Icon className="h-3 w-3" />
            <span className="hidden sm:inline">Excluir</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-7 w-7 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer ml-1"
            title="Fechar Detalhe (Esc)"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>

      </div>

      {/* ========================================================= */}
      {/* 2. SUB-BARRA DE ABAS (DETALHES vs COMPROVANTE)             */}
      {/* ========================================================= */}
      {nota.file_url && (
        <div className="flex items-center gap-1 px-4 pt-2 pb-2 border-b border-slate-100 dark:border-gray-800 bg-white dark:bg-brand-dark-900 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('detalhes')}
            className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
              activeTab === 'detalhes'
                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-gray-200'
            }`}
          >
            Resumo & Itens ({items.length || (nota as NotaWithItemCount).item_count || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('anexo')}
            className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'anexo'
                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-gray-200'
            }`}
          >
            <PaperclipIcon className="h-3 w-3" />
            Comprovante Digitalizado
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. CORPO ROLÁVEL COM CONTEÚDO INTEGRAL DA NOTA            */}
      {/* ========================================================= */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar bg-slate-50/40 dark:bg-brand-dark-950/30">
        
        {activeTab === 'anexo' && nota.file_url ? (
          /* Aba: Visualização Direta do Anexo */
          <div className="bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-gray-800">
              <span className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <PaperclipIcon className="h-3.5 w-3.5 text-indigo-600" />
                Documento Escaneado
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleViewFile(nota.file_url!)}
                className="h-7 text-xs font-semibold gap-1 text-indigo-600 dark:text-indigo-400 border-indigo-200 hover:bg-indigo-50"
              >
                <ExternalLinkIcon className="h-3.5 w-3.5" />
                <span>Abrir Original</span>
              </Button>
            </div>

            {isImageFile ? (
              <div className="flex justify-center bg-slate-100 dark:bg-brand-dark-950 rounded-lg p-2 overflow-hidden max-h-[450px]">
                <img 
                  src={nota.file_url} 
                  alt="Comprovante da Nota" 
                  className="object-contain max-h-[430px] rounded border border-slate-200 dark:border-gray-800 cursor-pointer shadow-sm hover:scale-[1.01] transition-transform"
                  onClick={() => handleViewFile(nota.file_url!)}
                />
              </div>
            ) : (
              <div className="py-12 px-4 text-center border-2 border-dashed border-slate-200 dark:border-gray-800 rounded-lg">
                <FileTextIcon className="h-10 w-10 text-indigo-500 mx-auto mb-2 opacity-80" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Arquivo PDF / Documento</h4>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">
                  Clique no botão abaixo para abrir o documento na íntegra em nova aba.
                </p>
                <Button
                  onClick={() => handleViewFile(nota.file_url!)}
                  className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs h-8 px-4"
                >
                  <ExternalLinkIcon className="h-3.5 w-3.5 mr-1.5" />
                  Visualizar PDF Completo
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* Aba: Resumo Financeiro, Metadados e Tabela de Itens */
          <>
            {/* Banner de Valor e Destaque Financeiro */}
            <div className="bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-gray-800">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Valor Total da Nota
                  </span>
                  <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                    {formatCurrency(nota.total_value)}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Forma de Pagamento
                  </span>
                  <Badge variant="outline" className="mt-1 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
                    <CreditCardIcon className="h-3 w-3 mr-1" />
                    {paymentLabel}
                  </Badge>
                </div>
              </div>

              {/* Grid de 4 Metadados da Nota */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs">
                
                {/* Fornecedor */}
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <BuildingIcon className="h-3 w-3 text-indigo-500" /> Fornecedor
                  </span>
                  <p className="font-semibold text-slate-900 dark:text-white truncate" title={nota.suppliers?.name || 'Não informado'}>
                    {nota.suppliers?.name || 'Não informado'}
                  </p>
                  {nota.suppliers?.cnpj && (
                    <p className="text-[10px] font-mono text-slate-400 truncate">
                      {nota.suppliers.cnpj}
                    </p>
                  )}
                </div>

                {/* Obra */}
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <ConstructionIcon className="h-3 w-3 text-indigo-500" /> Obra / Canteiro
                  </span>
                  <p className="font-semibold text-slate-900 dark:text-white truncate" title={nota.projects?.name || 'Geral / Matriz'}>
                    {nota.projects?.name || 'Geral / Matriz'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Centro de Custo
                  </p>
                </div>

                {/* Emissão */}
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3 text-indigo-500" /> Emissão
                  </span>
                  <p className="font-semibold font-mono text-slate-900 dark:text-white">
                    {formatDate(nota.issue_date)}
                  </p>
                  {Number(nota.shipping_value) > 0 && (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Frete: {formatCurrency(nota.shipping_value)}
                    </p>
                  )}
                </div>

                {/* Comprovante Link */}
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <PaperclipIcon className="h-3 w-3 text-indigo-500" /> Anexo Digital
                  </span>
                  {nota.file_url ? (
                    <button
                      type="button"
                      onClick={() => handleViewFile(nota.file_url!)}
                      className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 text-xs truncate cursor-pointer"
                    >
                      <ExternalLinkIcon className="h-3 w-3 shrink-0" />
                      <span>Ver Documento</span>
                    </button>
                  ) : (
                    <p className="text-slate-400 italic">Sem anexo</p>
                  )}
                </div>

              </div>
            </div>

            {/* Observações da Nota (se houver) */}
            {nota.observations && (
              <div className="bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 p-3.5 rounded-xl shadow-xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Observações e Termos
                </span>
                <p className="text-xs text-slate-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {nota.observations}
                </p>
              </div>
            )}

            {/* Itens e Discriminação de Materiais */}
            <div className="bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 rounded-xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <PackageIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-gray-200">
                    Discriminação de Insumos & Itens
                  </h3>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-brand-dark-800 text-slate-600 dark:text-gray-300">
                  {items.length} {items.length === 1 ? 'item' : 'itens'}
                </span>
              </div>

              {loadingItems ? (
                <div className="py-8 flex flex-col items-center justify-center space-y-2">
                  <div className="w-6 h-6 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                  <p className="text-xs text-slate-400">Carregando itens da nota...</p>
                </div>
              ) : isError ? (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-lg text-xs text-rose-600">
                  Não foi possível carregar os itens desta nota fiscal.
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-200 dark:border-gray-800 rounded-lg text-xs text-slate-400">
                  Nenhum item individual discriminado para esta nota fiscal.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-gray-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="py-2 px-2 font-semibold">Descrição do Material</th>
                        <th className="py-2 px-2 font-semibold">Categoria</th>
                        <th className="py-2 px-2 font-semibold text-right">Qtd</th>
                        <th className="py-2 px-2 font-semibold text-right">Unitário</th>
                        <th className="py-2 px-2 font-semibold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-gray-800/80">
                      {items.map((item) => {
                        const isHighlighted = activeHighlightId === item.id;
                        return (
                          <tr 
                            key={item.id} 
                            id={`nota-panel-item-row-${item.id}`}
                            className={
                              isHighlighted
                                ? 'bg-amber-100/90 dark:bg-amber-950/70 ring-2 ring-amber-400 dark:ring-amber-500 font-medium transition-all'
                                : 'hover:bg-slate-50/60 dark:hover:bg-brand-dark-800/40 transition-colors'
                            }
                          >
                            <td className="py-2 px-2 font-medium text-slate-900 dark:text-white max-w-[180px] truncate" title={item.description}>
                              {item.description}
                            </td>
                            <td className="py-2 px-2 whitespace-nowrap">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${getCategoryBadgeClass(item.category)}`}>
                                {item.category || 'Geral'}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-gray-300 whitespace-nowrap">
                              {item.quantity} {item.unit_of_measure ? item.unit_of_measure : ''}
                            </td>
                            <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-gray-300 whitespace-nowrap">
                              {formatCurrency(item.unit_price)}
                            </td>
                            <td className="py-2 px-2 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              {formatCurrency(item.total_price)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
};
export default NotaDetailPanel;
