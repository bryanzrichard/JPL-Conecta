import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BuscaGlobalRow, BuscaGlobalTipo } from '../../lib/buscaGlobal';
import { Button } from '../ui/Button';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  XIcon,
  ExternalLinkIcon,
  BuildingIcon,
  UsersIcon,
  FileTextIcon,
  CalendarIcon,
  DollarSignIcon,
  PackageIcon,
} from '../../lib/icons';
import { formatCurrency, formatDateBR, openStorageFile } from '../../lib/utils';

export interface BuscaDetalheGenericoProps {
  item: BuscaGlobalRow;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  currentIndex: number;
  totalCount: number;
  onAuditFilter: (filtros: { q?: string; tipo?: BuscaGlobalTipo; obra?: string }) => void;
}

function getRotuloBotaoAbrir(tipo: BuscaGlobalTipo): string {
  switch (tipo) {
    case 'fornecedor':
    case 'colaborador':
    case 'obra':
      return 'Abrir em Cadastros';
    case 'cartorio':
      return 'Abrir em Cartório';
    case 'etapa':
    case 'orcamento_item':
      return 'Abrir no Orçamento';
    default:
      return 'Abrir registro';
  }
}

export const BuscaDetalheGenerico: React.FC<BuscaDetalheGenericoProps> = ({
  item,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  currentIndex,
  totalCount,
  onAuditFilter,
}) => {
  const navigate = useNavigate();
  const detalhes = (item.detalhes || {}) as Record<string, unknown>;

  const handleOpenFile = async (path: string) => {
    try {
      await openStorageFile(path);
    } catch (err) {
      console.error('Erro ao abrir anexo:', err);
    }
  };

  const arquivoUrl =
    typeof detalhes.arquivo_url === 'string'
      ? detalhes.arquivo_url
      : typeof detalhes.file_url === 'string'
      ? detalhes.file_url
      : null;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm select-text">
      {/* Topbar com navegação sequencial e botão de abertura externa */}
      <div className="p-3.5 sm:px-4 border-b border-[#E2E8F0] dark:border-[#1E293B] flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-[#111827] shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-slate-800 dark:text-[#F8FAFC] text-xs truncate max-w-[180px] sm:max-w-[240px]">
              {item.titulo}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
              {item.tipo}
            </span>
          </div>
          {item.subtitulo && (
            <p className="text-[10px] text-slate-500 dark:text-[#94A3B8] truncate">{item.subtitulo}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(item.rota)}
            className="h-7 px-2 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 gap-1 cursor-pointer"
            title={`Ir para a tela original (${item.rota})`}
          >
            <ExternalLinkIcon className="h-3 w-3" />
            <span className="hidden sm:inline">{getRotuloBotaoAbrir(item.tipo)}</span>
          </Button>

          <div className="inline-flex items-center bg-white dark:bg-brand-dark-800 rounded-lg p-0.5 border border-slate-200 dark:border-gray-700 shadow-xs">
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrev}
              disabled={!hasPrev}
              className="h-6 w-6 text-slate-600 dark:text-gray-300 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-brand-dark-700 rounded cursor-pointer"
              title="Anterior (Seta Cima)"
            >
              <ChevronUpIcon className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[10px] font-mono font-medium px-1.5 text-slate-500 dark:text-gray-400 select-none">
              {currentIndex + 1}/{totalCount}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNext}
              disabled={!hasNext}
              className="h-6 w-6 text-slate-600 dark:text-gray-300 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-brand-dark-700 rounded cursor-pointer"
              title="Próximo (Seta Baixo)"
            >
              <ChevronDownIcon className="h-3.5 w-3.5" />
            </Button>
          </div>

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

      {/* Corpo principal */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs">
        {/* Informações Resumidas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50/70 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
          {item.valor !== null && item.valor !== undefined && (
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center gap-1">
                <DollarSignIcon className="h-3 w-3 text-emerald-500" /> Valor
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                {formatCurrency(item.valor)}
              </span>
            </div>
          )}
          {item.data && (
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center gap-1">
                <CalendarIcon className="h-3 w-3 text-indigo-500" /> Data
              </span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {formatDateBR(item.data)}
              </span>
            </div>
          )}
          {item.obra && (
            <div className="sm:col-span-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center gap-1">
                <BuildingIcon className="h-3 w-3 text-blue-500" /> Obra / Projeto
              </span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{item.obra}</span>
            </div>
          )}
        </div>

        {/* Campos extras do registro */}
        {Object.keys(detalhes).length > 0 && (
          <div className="bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 p-3.5 rounded-xl space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Dados do Registro
            </span>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {Object.entries(detalhes).map(([key, val]) => {
                if (val === null || val === undefined || typeof val === 'object') return null;
                const isUrl = typeof val === 'string' && (val.startsWith('http') || val.includes('.pdf'));
                return (
                  <div key={key} className="space-y-0.5">
                    <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {key.replace(/_/g, ' ')}
                    </dt>
                    <dd className="font-medium text-slate-800 dark:text-slate-200 truncate" title={String(val)}>
                      {isUrl ? (
                        <button
                          type="button"
                          onClick={() => handleOpenFile(String(val))}
                          className="text-indigo-600 hover:underline flex items-center gap-1 text-xs"
                        >
                          <ExternalLinkIcon className="h-3 w-3" /> Ver anexo
                        </button>
                      ) : (
                        String(val)
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        )}

        {/* Anexo específico de cartório */}
        {item.tipo === 'cartorio' && arquivoUrl && (
          <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/50 p-3 rounded-xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileTextIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Documento anexado no cartório
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenFile(arquivoUrl)}
              className="h-7 text-xs font-semibold text-indigo-700 border-indigo-200 hover:bg-indigo-100"
            >
              Abrir Arquivo
            </Button>
          </div>
        )}

        {/* Atalhos de Auditoria */}
        <div className="bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 p-3.5 rounded-xl space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Atalhos de Auditoria
          </span>
          <div className="flex flex-wrap gap-2">
            {item.tipo === 'fornecedor' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAuditFilter({ q: item.titulo, tipo: 'nota' })}
                  className="h-7 text-xs font-semibold text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-700 hover:bg-slate-100"
                >
                  <FileTextIcon className="h-3 w-3 mr-1 text-indigo-500" /> Notas deste fornecedor
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAuditFilter({ q: item.titulo, tipo: 'item' })}
                  className="h-7 text-xs font-semibold text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-700 hover:bg-slate-100"
                >
                  <PackageIcon className="h-3 w-3 mr-1 text-emerald-500" /> Itens deste fornecedor
                </Button>
              </>
            )}

            {item.tipo === 'colaborador' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAuditFilter({ q: item.titulo, tipo: 'servico' })}
                  className="h-7 text-xs font-semibold text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-700 hover:bg-slate-100"
                >
                  <UsersIcon className="h-3 w-3 mr-1 text-blue-500" /> Serviços deste colaborador
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAuditFilter({ q: item.titulo, tipo: 'adiantamento' })}
                  className="h-7 text-xs font-semibold text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-700 hover:bg-slate-100"
                >
                  <DollarSignIcon className="h-3 w-3 mr-1 text-amber-500" /> Pagamentos deste colaborador
                </Button>
              </>
            )}

            {item.tipo === 'obra' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAuditFilter({ obra: item.id, tipo: 'nota' })}
                  className="h-7 text-xs font-semibold text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-700 hover:bg-slate-100"
                >
                  <FileTextIcon className="h-3 w-3 mr-1 text-indigo-500" /> Notas desta obra
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAuditFilter({ obra: item.id, tipo: 'servico' })}
                  className="h-7 text-xs font-semibold text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-700 hover:bg-slate-100"
                >
                  <BuildingIcon className="h-3 w-3 mr-1 text-blue-500" /> Serviços desta obra
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAuditFilter({ obra: item.id, tipo: 'adiantamento' })}
                  className="h-7 text-xs font-semibold text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-700 hover:bg-slate-100"
                >
                  <DollarSignIcon className="h-3 w-3 mr-1 text-amber-500" /> Pagamentos desta obra
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAuditFilter({ obra: item.id, tipo: 'tarefa' })}
                  className="h-7 text-xs font-semibold text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-700 hover:bg-slate-100"
                >
                  <FileTextIcon className="h-3 w-3 mr-1 text-emerald-500" /> Tarefas desta obra
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuscaDetalheGenerico;
