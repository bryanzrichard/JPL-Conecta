import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PainelHojeRow } from '../../types';
import { 
  AlertTriangleIcon, 
  CalendarIcon, 
  ShoppingBagIcon, 
  ClockIcon, 
  WrenchIcon, 
  FileTextIcon 
} from '../../lib/icons';
import { Skeleton } from '../ui/Skeleton';

interface PainelHojeProps {
  data?: PainelHojeRow | null;
  isLoading?: boolean;
  isError?: boolean;
}

interface ItemConfig {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  colorType: 'danger' | 'warning' | 'neutral';
}

export const PainelHoje: React.FC<PainelHojeProps> = ({ data, isLoading, isError }) => {
  const navigate = useNavigate();

  const items: ItemConfig[] = [
    {
      id: 'tarefas_atrasadas',
      label: 'Tarefas atrasadas',
      value: data?.tarefas_atrasadas ?? 0,
      href: '/tarefas',
      icon: AlertTriangleIcon,
      colorType: 'danger',
    },
    {
      id: 'tarefas_hoje',
      label: 'Tarefas de hoje',
      value: data?.tarefas_hoje ?? 0,
      href: '/tarefas',
      icon: CalendarIcon,
      colorType: 'neutral',
    },
    {
      id: 'compras_pendentes',
      label: 'Compras pendentes',
      value: data?.compras_pendentes ?? 0,
      href: '/tarefas',
      icon: ShoppingBagIcon,
      colorType: 'neutral',
    },
    {
      id: 'empreitadas_vencendo',
      label: 'Empreitadas vencendo',
      sublabel: 'em 3 dias',
      value: data?.empreitadas_vencendo ?? 0,
      href: '/servicos',
      icon: ClockIcon,
      colorType: 'warning',
    },
    {
      id: 'empreitadas_vencidas',
      label: 'Empreitadas vencidas',
      value: data?.empreitadas_vencidas ?? 0,
      href: '/servicos',
      icon: WrenchIcon,
      colorType: 'danger',
    },
    {
      id: 'notas_para_revisar',
      label: 'Notas para revisar',
      value: data?.notas_para_revisar ?? 0,
      href: '/notas',
      icon: FileTextIcon,
      colorType: 'neutral',
    },
  ];

  if (isLoading) {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300">
          Hoje
        </h2>
        <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300">
          Não foi possível carregar as pendências de hoje no momento.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-gray-200">
            Hoje
          </h2>
        </div>
        <span className="text-[11px] text-slate-500 dark:text-gray-400">
          Toque no card para abrir o módulo
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          const isZero = item.value === 0;

          let cardClasses = 'border-slate-200/80 dark:border-gray-800 bg-white dark:bg-[#111827] hover:border-slate-300 dark:hover:border-gray-700';
          let valueClasses = 'text-slate-900 dark:text-white';
          let iconWrapperClasses = 'text-slate-400 bg-slate-100 dark:bg-gray-800';

          if (isZero) {
            cardClasses = 'border-slate-200/60 dark:border-gray-800/80 bg-slate-50/50 dark:bg-brand-dark-900/40 hover:border-slate-300 dark:hover:border-gray-700';
            valueClasses = 'text-slate-400 dark:text-gray-500';
            iconWrapperClasses = 'text-slate-400/70 bg-slate-100/70 dark:bg-gray-800/60';
          } else if (item.colorType === 'danger') {
            cardClasses = 'border-rose-300/80 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/20 hover:border-rose-400 dark:hover:border-rose-800';
            valueClasses = 'text-rose-600 dark:text-rose-400';
            iconWrapperClasses = 'text-rose-600 dark:text-rose-400 bg-rose-100/80 dark:bg-rose-900/40';
          } else if (item.colorType === 'warning') {
            cardClasses = 'border-amber-300/80 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 hover:border-amber-400 dark:hover:border-amber-800';
            valueClasses = 'text-amber-600 dark:text-amber-400';
            iconWrapperClasses = 'text-amber-600 dark:text-amber-400 bg-amber-100/80 dark:bg-amber-900/40';
          }

          return (
            <button
              type="button"
              key={item.id}
              onClick={() => navigate(item.href)}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between gap-2.5 ${cardClasses}`}
            >
              <div className="flex items-center justify-between w-full">
                <span className={`p-1.5 rounded-lg ${iconWrapperClasses}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className={`text-2xl font-black tabular-nums tracking-tight ${valueClasses}`}>
                  {item.value}
                </span>
              </div>

              <div>
                <p className={`text-xs font-semibold leading-tight line-clamp-1 ${isZero ? 'text-slate-500 dark:text-gray-400' : 'text-slate-800 dark:text-gray-200'}`}>
                  {item.label}
                </p>
                {item.sublabel && (
                  <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-0.5 font-medium">
                    {item.sublabel}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default PainelHoje;
