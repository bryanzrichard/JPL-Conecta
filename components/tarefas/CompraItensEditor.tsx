import React, { useState, useRef, useEffect } from 'react';
import { CompraItem, UNIDADES_CONHECIDAS, parseListaColada, parseQuantidadeBR, formatQuantidadeBR } from '../../lib/compraItens';
import { PlusIcon, Trash2Icon, ClipboardListIcon, XIcon, CheckIcon } from '../../lib/icons';
import { Button } from '../ui/Button';

interface CompraItensEditorProps {
  items: CompraItem[];
  onChange: (items: CompraItem[]) => void;
  error?: string | null;
}

export const CompraItensEditor: React.FC<CompraItensEditorProps> = ({
  items,
  onChange,
  error,
}) => {
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const qtyRefs = useRef<(HTMLInputElement | null)[]>([]);
  const pendingFocusIndexRef = useRef<number | null>(null);

  // Focar no campo de quantidade quando um novo item é adicionado via Enter
  useEffect(() => {
    if (pendingFocusIndexRef.current !== null) {
      const idx = pendingFocusIndexRef.current;
      pendingFocusIndexRef.current = null;
      setTimeout(() => {
        qtyRefs.current[idx]?.focus();
      }, 50);
    }
  }, [items.length]);

  const handleAddItem = (autoFocus = true) => {
    const newItem: CompraItem = {
      nome: '',
      quantidade: null,
      unidade: null,
      comprado: false,
    };
    if (autoFocus) {
      pendingFocusIndexRef.current = items.length;
    }
    onChange([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    const next = items.filter((_, idx) => idx !== index);
    onChange(next);
  };

  const handleUpdateItem = (index: number, patch: Partial<CompraItem>) => {
    const next = items.map((it, idx) => (idx === index ? { ...it, ...patch } : it));
    onChange(next);
  };

  const handleConfirmPaste = () => {
    if (!pasteText.trim()) {
      setIsPasteOpen(false);
      return;
    }
    const parsed = parseListaColada(pasteText);
    if (parsed.length > 0) {
      // Remove linhas totalmente em branco se houver apenas uma
      const filteredExisting = items.filter((i) => i.nome.trim() !== '');
      onChange([...filteredExisting, ...parsed]);
    }
    setPasteText('');
    setIsPasteOpen(false);
  };

  return (
    <div className="space-y-3 p-3.5 rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/10">
      <div className="flex items-center justify-between gap-2">
        <div>
          <label className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
            <span>🛒</span> Itens da Lista de Compras <span className="text-rose-500">*</span>
          </label>
          <p className="text-[11px] text-slate-500 dark:text-gray-400">
            Cada insumo vira um item separado com quantidade e conferência na obra.
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsPasteOpen((prev) => !prev)}
            className="h-7 px-2 text-[11px] font-semibold border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 bg-white dark:bg-brand-dark-900 hover:bg-amber-100/60 dark:hover:bg-amber-900/30 gap-1 cursor-pointer"
          >
            <ClipboardListIcon className="h-3.5 w-3.5" />
            <span>Colar lista</span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => handleAddItem(true)}
            className="h-7 px-2 text-[11px] font-semibold bg-amber-600 hover:bg-amber-700 text-white gap-1 cursor-pointer shadow-xs"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            <span>Adicionar</span>
          </Button>
        </div>
      </div>

      {/* Caixa de Colar Lista */}
      {isPasteOpen && (
        <div className="p-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-brand-dark-900 space-y-2 animate-in fade-in-50 duration-150 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300">
              Cole a lista de materiais abaixo:
            </span>
            <button
              type="button"
              onClick={() => setIsPasteOpen(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={4}
            placeholder={`Exemplos aceitos:\n10 sacos cimento\n1 kg prego 17x21\n2 m3 areia media\nfita crepe`}
            className="w-full p-2 text-xs font-mono rounded-md border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-brand-dark-950 text-slate-800 dark:text-gray-100 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPasteOpen(false)}
              className="h-7 text-xs cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmPaste}
              className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1 cursor-pointer font-semibold"
            >
              <CheckIcon className="h-3.5 w-3.5" />
              <span>Inserir na lista</span>
            </Button>
          </div>
        </div>
      )}

      {/* Datalist para autocomplete de unidades */}
      <datalist id="unidades-sugestoes">
        {UNIDADES_CONHECIDAS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      {/* Lista de Itens */}
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="py-4 text-center rounded-lg border border-dashed border-amber-200 dark:border-amber-900/50 bg-white/60 dark:bg-brand-dark-900/40 text-xs text-amber-800/80 dark:text-amber-400">
            Nenhum material adicionado ainda. Clique em <strong>Adicionar</strong> ou <strong>Colar lista</strong>.
          </div>
        ) : (
          <div className="space-y-1.5">
            {items.map((item, index) => (
              <div key={index} className="flex items-center gap-1.5">
                {/* Quantidade */}
                <input
                  ref={(el) => {
                    qtyRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="decimal"
                  placeholder="Qtd"
                  defaultValue={item.quantidade !== null ? formatQuantidadeBR(item.quantidade) : ''}
                  key={`qty-${index}-${item.quantidade}`}
                  onBlur={(e) => {
                    const parsed = parseQuantidadeBR(e.target.value);
                    handleUpdateItem(index, { quantidade: parsed });
                  }}
                  className="w-16 sm:w-20 h-8 px-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-brand-dark-950 text-xs text-slate-800 dark:text-white font-mono text-center shrink-0 focus:border-amber-500 focus:outline-hidden"
                />

                {/* Unidade */}
                <input
                  type="text"
                  list="unidades-sugestoes"
                  placeholder="Unid."
                  value={item.unidade || ''}
                  onChange={(e) => handleUpdateItem(index, { unidade: e.target.value.trim() || null })}
                  className="w-20 sm:w-24 h-8 px-2 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-brand-dark-950 text-xs text-slate-800 dark:text-white shrink-0 focus:border-amber-500 focus:outline-hidden"
                />

                {/* Nome do Material */}
                <input
                  type="text"
                  placeholder="Nome do material (ex: Cimento CP II)"
                  value={item.nome}
                  onChange={(e) => handleUpdateItem(index, { nome: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddItem(true);
                    }
                  }}
                  className="flex-1 min-w-0 h-8 px-2.5 rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-brand-dark-950 text-xs text-slate-800 dark:text-white focus:border-amber-500 focus:outline-hidden"
                />

                {/* Botão Remover */}
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                  title="Remover item"
                >
                  <Trash2Icon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="text-[11px] text-rose-500 font-semibold">{error}</p>
      )}
    </div>
  );
};

export default CompraItensEditor;
