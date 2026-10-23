import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { SunIcon, MoonIcon } from '../../lib/icons';

interface ThemeToggleProps {
  variant?: 'icon' | 'pill' | 'sidebar';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'icon', className = '' }) => {
  const { theme, isDark, toggleTheme } = useTheme();

  if (variant === 'sidebar') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
          isDark
            ? 'text-gray-300 hover:text-white hover:bg-brand-dark-800/60'
            : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
        } ${className}`}
        title={isDark ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
      >
        <div className="flex items-center gap-2.5">
          {isDark ? (
            <SunIcon className="h-4 w-4 text-amber-400 shrink-0 transition-transform hover:rotate-45" />
          ) : (
            <MoonIcon className="h-4 w-4 text-brand-blue-600 shrink-0 transition-transform hover:-rotate-12" />
          )}
          <span>{isDark ? 'Tema Claro' : 'Tema Escuro'}</span>
        </div>
        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border border-gray-700/50 text-gray-400">
          {isDark ? 'DARK' : 'LIGHT'}
        </span>
      </button>
    );
  }

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
          isDark
            ? 'bg-brand-dark-800/80 border-gray-700 text-gray-200 hover:bg-brand-dark-700 hover:text-white'
            : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-50 hover:text-gray-900 shadow-sm'
        } ${className}`}
        title={isDark ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
      >
        {isDark ? (
          <>
            <SunIcon className="h-3.5 w-3.5 text-amber-400" />
            <span>Modo Claro</span>
          </>
        ) : (
          <>
            <MoonIcon className="h-3.5 w-3.5 text-brand-blue-600" />
            <span>Modo Escuro</span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-all ${
        isDark
          ? 'bg-brand-dark-800/80 border-gray-700 text-amber-400 hover:bg-brand-dark-700 hover:text-amber-300'
          : 'bg-white border-gray-300 text-brand-blue-600 hover:bg-gray-100 shadow-sm'
      } ${className}`}
      title={isDark ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
      aria-label="Alternar tema"
    >
      {isDark ? (
        <SunIcon className="h-4 w-4 transition-transform hover:rotate-45" />
      ) : (
        <MoonIcon className="h-4 w-4 transition-transform hover:-rotate-12" />
      )}
    </button>
  );
};

export default ThemeToggle;
