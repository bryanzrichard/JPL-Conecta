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
        <Skeleton className="h-5 w-24" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
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
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300">
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
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300">
          Hoje
        </h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          const isZero = item.value === 0;

          let iconStyle = 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400';
          let valueStyle = 'text-slate-800 dark:text-[#F8FAFC]';

          if (isZero) {
            iconStyle = 'bg-slate-500/10 border-slate-500/20 text-slate-400 dark:text-slate-500';
            valueStyle = 'text-slate-400 dark:text-slate-500';
          } else if (item.colorType === 'danger') {
            iconStyle = 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400';
            valueStyle = 'text-rose-600 dark:text-rose-400';
          } else if (item.colorType === 'warning') {
            iconStyle = 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400';
            valueStyle = 'text-amber-600 dark:text-amber-400';
          }

          return (
            <button
              type="button"
              key={item.id}
              onClick={() => navigate(item.href)}
              className="bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-3.5 rounded-xl shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer text-left flex flex-col justify-between gap-3 group"
            >
              <div className="flex items-center justify-between w-full">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${iconStyle}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className={`text-xl font-bold font-mono ${valueStyle}`}>
                  {item.value}
                </span>
              </div>

              <div>
                <p className="text-xs text-slate-500 dark:text-[#94A3B8] font-medium leading-tight">
                  {item.label}
                </p>
                {item.sublabel && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
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
