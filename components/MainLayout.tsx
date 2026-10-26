import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDashboardAlerts } from '../hooks/useDashboardAlerts';
import { Button } from './ui/Button';
import { ThemeToggle } from './ui/ThemeToggle';
import { GlobalSearchModal } from './GlobalSearchModal';
import ConfirmationModal from './ui/ConfirmationModal';
import { 
    MenuIcon, XIcon, ClipboardListIcon, FileTextIcon, 
    LayoutIcon, ConstructionIcon, ActivityIcon, BuildingIcon,
    LogOutIcon, ChevronRightIcon, UploadCloudIcon, SearchIcon,
    KeyRoundIcon, MoreVerticalIcon, CalculatorIcon
} from '../lib/icons';
import { formatDateBR } from '../lib/utils';

const MainLayout: React.FC = () => {
    const { signOut, user, profile } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const accountMenuRef = useRef<HTMLDivElement>(null);
    const accountButtonRef = useRef<HTMLButtonElement>(null);

    // Global shortcut Ctrl+K / Cmd+K to open Search Modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setIsSearchOpen((prev) => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Close account menu on click outside or escape key
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                accountMenuRef.current && 
                !accountMenuRef.current.contains(e.target as Node) &&
                accountButtonRef.current &&
                !accountButtonRef.current.contains(e.target as Node)
            ) {
                setIsAccountMenuOpen(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsAccountMenuOpen(false);
            }
        };
        if (isAccountMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isAccountMenuOpen]);

    // Realtime alerts for navigation badges
    const { delayedTasks, pendingAi } = useDashboardAlerts(profile?.company_id, user?.id);

    // Close menus on route change
    useEffect(() => {
        setIsMenuOpen(false);
        setIsAccountMenuOpen(false);
    }, [location.pathname]);

    const navLinks = [
        { name: 'Visão Geral', path: '/', icon: LayoutIcon, badge: null },
        { 
            name: 'Notas Fiscais', 
            path: '/notas', 
            icon: FileTextIcon, 
            badge: pendingAi > 0 ? { count: pendingAi, color: 'bg-amber-500/20 text-amber-500 border-amber-500/30' } : null 
        },
        { name: 'Serviços', path: '/servicos', icon: ConstructionIcon, badge: null },
        { name: 'Orçamentos', path: '/orcamentos', icon: CalculatorIcon, badge: null },
        { 
            name: 'Tarefas', 
            path: '/tarefas', 
            icon: ClipboardListIcon, 
            badge: delayedTasks > 0 ? { count: delayedTasks, color: 'bg-red-500/20 text-red-500 border-red-500/30' } : null 
        },
        { name: 'Cartório', path: '/cartorio', icon: BuildingIcon, badge: null },
        { name: 'Cadastros', path: '/registro', icon: ActivityIcon, badge: null },
    ];

    const getRouteTitle = (pathname: string): { module: string; description: string } => {
        switch (pathname) {
            case '/':
                return { module: 'Visão Geral & Indicadores', description: 'Métricas financeiras e auditoria' };
            case '/notas':
                return { module: 'Gestão de Notas Fiscais', description: 'Lançamentos, IA e conciliação' };
            case '/orcamentos':
            case '/orcamento':
                return { module: 'Orçamentos & Planejamento', description: 'Etapas executivas e controle previsto vs realizado' };
            case '/servicos':
                return { module: 'Ordem de Serviços', description: 'Medições e prestadores' };
            case '/cartorio':
                return { module: 'Despesas de Cartório', description: 'Registro de emolumentos' };
            case '/tarefas':
                return { module: 'Gerenciador de Tarefas', description: 'Status de obras e cronogramas' };
            case '/registro':
            case '/registros':
                return { module: 'Cadastros Gerais', description: 'Fornecedores, obras e colaboradores' };
            default:
                return { module: 'JPL Conecta', description: 'Sistema de Gestão Operacional' };
        }
    };

    const currentRoute = getRouteTitle(location.pathname);
    const companyName = profile?.companies?.name || 'JPL Construtora';
    const userEmail = user?.email || 'bryanrichardjpl@icloud.com';
    const userInitial = userEmail.charAt(0).toUpperCase();
    const isFullBleedRoute = false;
    const isCompactTopRoute = ['/servicos', '/notas', '/registro', '/registros', '/orcamentos', '/orcamento'].includes(location.pathname);

    const formattedKeyExpiry = profile?.company_keys?.expires_at 
        ? formatDateBR(profile.company_keys.expires_at)
        : '30/12/2028';

    // Mobile Bottom Navigation Item Component
    const BottomNavItem = ({ to, icon: Icon, label, end = false, badgeCount }: any) => (
        <NavLink
            to={to}
            end={end}
            className={({ isActive }) =>
                `relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                    isActive ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200'
                }`
            }
        >
            <div className="relative">
                <Icon className="h-5 w-5" />
                {badgeCount && badgeCount > 0 ? (
                    <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-brand-dark-900" />
                ) : null}
            </div>
            <span className="text-[10px] font-medium">{label}</span>
        </NavLink>
    );

    return (
        <div className="h-screen w-screen overflow-hidden bg-[#F8FAFC] dark:bg-[#090D16] text-[#334155] dark:text-[#F8FAFC] flex flex-col md:flex-row">
            {/* ========================================================= */}
            {/* 1. SIDEBAR ESQUERDA (Desktop Full-Bleed Fixa)              */}
            {/* ========================================================= */}
            <aside className="hidden md:flex w-60 shrink-0 bg-white dark:bg-[#111827] border-r border-[#E2E8F0] dark:border-[#1E293B] flex-col justify-between h-full z-30">
                {/* Topo: Logo + Workspace Switcher */}
                <div className="p-4 border-b border-[#E2E8F0] dark:border-[#1E293B] space-y-3">
                    <NavLink to="/" className="flex items-center gap-2.5 text-slate-900 dark:text-white font-bold text-base tracking-tight">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30 shrink-0">
                            <LayoutIcon className="h-5 w-5" />
                        </div>
                        <span className="font-bold text-slate-800 dark:text-white">
                            JPL Conecta
                        </span>
                    </NavLink>

                    {/* Workspace Switcher */}
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-brand-dark-800/80 border border-slate-200 dark:border-gray-700/60 text-xs">
                        <span className="text-base leading-none">🏢</span>
                        <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-700 dark:text-gray-200 truncate leading-tight">{companyName}</p>
                            <p className="text-[10px] text-slate-400 dark:text-gray-400 truncate">Workspace Ativo</p>
                        </div>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    </div>
                </div>

                {/* Menu de Navegação */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
                    {navLinks.map((link) => (
                        <NavLink
                            key={link.path}
                            to={link.path}
                            end={link.path === '/'}
                            className={({ isActive }) =>
                                `group flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                                    isActive
                                        ? 'bg-[#F5F3FF] text-[#4F46E5] font-semibold border-l-4 border-[#818CF8] dark:bg-indigo-500/[0.12] dark:text-[#818CF8] dark:border-[#6366F1]'
                                        : 'bg-transparent text-slate-600 dark:text-[#94A3B8] hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:text-slate-800 dark:hover:text-[#F8FAFC] font-medium'
                                }`
                            }
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <link.icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-105" />
                                <span className="truncate">{link.name}</span>
                            </div>
                            {link.badge && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${link.badge.color}`}>
                                    {link.badge.count}
                                </span>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Rodapé: Badge ONLINE • v1.2 + Card de Perfil Interativo com Popover Upward */}
                <div className="relative p-3 border-t border-slate-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900 space-y-2">
                    {/* Popover da Conta (Upward Floating - Garantido Dentro da Sidebar) */}
                    {isAccountMenuOpen && (
                        <div
                            ref={accountMenuRef}
                            className="absolute bottom-full left-2 right-2 mb-2 bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
                        >
                            {/* Cabeçalho do Perfil */}
                            <div className="p-3.5 bg-slate-50 dark:bg-brand-dark-800/80 border-b border-slate-100 dark:border-gray-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-md shadow-indigo-600/30 shrink-0">
                                        {userInitial}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                            {userEmail.split('@')[0]}
                                        </p>
                                        <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate font-mono">
                                            {userEmail}
                                        </p>
                                        <div className="flex items-center gap-1 mt-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 truncate">
                                            <span>🏢</span>
                                            <span className="truncate">{companyName}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Validade da Chave & Status da Licença */}
                            <div className="p-3 border-b border-slate-100 dark:border-gray-800 space-y-2">
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-slate-500 dark:text-gray-400 font-medium">Status da Licença</span>
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        LICENÇA ATIVA
                                    </span>
                                </div>
                                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 text-[11px]">
                                    <KeyRoundIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider leading-none">
                                            Validade da Chave
                                        </p>
                                        <p className="font-semibold text-slate-900 dark:text-white mt-1 text-xs whitespace-nowrap">
                                            Ativa até {formattedKeyExpiry}
                                        </p>
                                        <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5">
                                            Acesso liberado a todos os módulos
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Ações e Preferências */}
                            <div className="p-2 space-y-1">
                                {/* Alternar Tema */}
                                <div className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-brand-dark-800/60 transition-colors">
                                    <span className="font-medium">Tema do Sistema</span>
                                    <ThemeToggle variant="icon" />
                                </div>

                                {/* Link Cadastros & Configurações */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsAccountMenuOpen(false);
                                        navigate('/registro');
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-brand-dark-800 hover:text-slate-900 dark:hover:text-white transition-colors text-left cursor-pointer"
                                >
                                    <BuildingIcon className="h-4 w-4 text-slate-400 shrink-0" />
                                    <span>Configurações da Conta</span>
                                </button>

                                <div className="h-px bg-slate-100 dark:bg-gray-800 my-1" />

                                {/* Sair da Conta */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsAccountMenuOpen(false);
                                        setIsLogoutModalOpen(true);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors text-left cursor-pointer"
                                >
                                    <LogOutIcon className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                                    <span>Sair da Conta</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Badge ONLINE */}
                    <div className="flex items-center justify-between px-2.5 py-1 rounded-md bg-slate-50 dark:bg-brand-dark-800/50 border border-slate-200 dark:border-gray-800 text-[10px] text-slate-500 dark:text-gray-400">
                        <span className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            ONLINE
                        </span>
                        <span className="font-mono">v1.2</span>
                    </div>

                    {/* Botão de Perfil Interativo */}
                    <button
                        ref={accountButtonRef}
                        type="button"
                        onClick={() => setIsAccountMenuOpen((prev) => !prev)}
                        className={`w-full flex items-center justify-between p-2 rounded-xl transition-all text-left cursor-pointer border ${
                            isAccountMenuOpen
                                ? 'bg-indigo-50/80 dark:bg-brand-dark-800 border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
                                : 'bg-slate-50 hover:bg-slate-100 dark:bg-brand-dark-800/60 dark:hover:bg-brand-dark-800 border-slate-200 dark:border-gray-700/60'
                        }`}
                        title="Ver dados da conta, validade da chave e configurações"
                        aria-label="Menu da conta"
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-sm shrink-0">
                                {userInitial}
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate leading-tight">
                                    {userEmail.split('@')[0]}
                                </p>
                                <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate leading-tight font-mono">
                                    {userEmail}
                                </p>
                            </div>
                        </div>
                        <MoreVerticalIcon className="h-4 w-4 text-slate-400 group-hover:text-slate-600 dark:hover:text-white shrink-0 ml-1" />
                    </button>
                </div>
            </aside>

            {/* ========================================================= */}
            {/* 2. TOPBAR GLOBAL & ÁREA OPERACIONAL FULL-BLEED            */}
            {/* ========================================================= */}
            <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-slate-50 dark:bg-brand-dark-950">
                {/* TOPBAR GLOBAL */}
                <header className="hidden md:flex h-14 shrink-0 bg-white dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#1E293B] px-6 items-center justify-between z-20">
                    {/* Esquerda: Breadcrumb */}
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-semibold text-slate-500 dark:text-gray-400">JPL Gestão</span>
                        <ChevronRightIcon className="h-3.5 w-3.5 text-slate-400 dark:text-gray-600" />
                        <span className="text-xs font-bold text-slate-800 dark:text-white">{currentRoute.module}</span>
                    </div>

                    {/* Centro: Busca Global ⌘K */}
                    <div className="flex-1 flex justify-center px-4">
                        <button
                            type="button"
                            onClick={() => setIsSearchOpen(true)}
                            className="w-96 flex items-center justify-between px-3.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-brand-dark-800/80 dark:hover:bg-brand-dark-800 border border-slate-200 dark:border-gray-700/80 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-all text-xs group shadow-sm"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <SearchIcon className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
                                <span className="truncate">Buscar insumos, preços, obras, tarefas...</span>
                            </div>
                            <kbd className="inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-700 text-slate-500 dark:text-gray-400 shrink-0">
                                <span>⌘</span>K
                            </kbd>
                        </button>
                    </div>

                    {/* Direita: Tema + Registrar IA */}
                    <div className="flex items-center gap-2.5 shrink-0">
                        <ThemeToggle variant="icon" />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate('/notas', { state: { action: 'newAiNota' } })}
                            className="h-8 text-xs font-semibold border border-indigo-200/80 bg-indigo-50/60 hover:bg-indigo-100/60 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 dark:text-indigo-300 gap-1.5"
                        >
                            <UploadCloudIcon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>Registrar c/ IA</span>
                        </Button>
                    </div>
                </header>

                {/* Mobile Top Header (Fixed on Mobile only) */}
                <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-b border-[#E2E8F0] dark:border-[#1E293B] h-14 px-4 flex items-center justify-between">
                    <NavLink to="/" className="text-base font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                        <LayoutIcon className="h-5 w-5" />
                        JPL Conecta
                    </NavLink>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsSearchOpen(true)}
                            title="Buscar em todo o sistema (Ctrl + K)"
                            className="p-1.5 rounded-lg text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                        >
                            <SearchIcon className="h-4 w-4" />
                        </button>
                        <ThemeToggle variant="icon" />
                        <button
                            type="button"
                            onClick={() => setIsAccountMenuOpen(true)}
                            className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-sm cursor-pointer"
                            title="Abrir menu da conta"
                            aria-label="Abrir menu da conta"
                        >
                            {userInitial}
                        </button>
                    </div>
                </header>

                {/* CONTAINER OPERACIONAL: Full-Bleed Split-View para Cadastros, Compact-Top para Serviços, e Scroll Vertical Completo para as demais páginas */}
                <main
                    className={`flex-1 min-w-0 pt-14 md:pt-0 ${
                        isFullBleedRoute
                            ? 'h-full flex flex-col overflow-hidden'
                            : isCompactTopRoute
                            ? 'h-full overflow-y-auto custom-scrollbar px-3 sm:px-5 lg:px-6 pt-2 sm:pt-2.5 lg:pt-3 pb-20 md:pb-6'
                            : 'h-full overflow-y-auto custom-scrollbar p-4 sm:p-6 lg:p-8 pb-24 md:pb-8'
                    }`}
                >
                    <Outlet />
                </main>
            </div>

            {/* ========================================================= */}
            {/* MOBILE BOTTOM NAVIGATION (Mobile Only)                    */}
            {/* ========================================================= */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-brand-dark-900/95 backdrop-blur-md border-t border-slate-200 dark:border-gray-800 pb-safe">
                <div className="flex items-center justify-around h-14 px-2">
                    <BottomNavItem to="/" end icon={LayoutIcon} label="Home" />
                    <BottomNavItem to="/cartorio" icon={BuildingIcon} label="Cartório" />
                    <BottomNavItem to="/notas" icon={FileTextIcon} label="Notas" badgeCount={pendingAi} />
                    <BottomNavItem to="/servicos" icon={ConstructionIcon} label="Serviços" />
                    
                    {/* More Menu Toggle */}
                    <button 
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className={`flex flex-col items-center justify-center w-full h-full space-y-0.5 transition-colors ${
                            isMenuOpen ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200'
                        }`}
                    >
                        {isMenuOpen ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
                        <span className="text-[10px] font-medium">Mais</span>
                    </button>
                </div>
            </div>

            {/* Mobile "Mais" Menu Overlay */}
            {isMenuOpen && (
                <div className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}>
                    <div 
                        className="absolute left-0 right-0 bg-white dark:bg-brand-dark-900 border-t border-slate-200 dark:border-gray-800 rounded-t-2xl p-4 animate-in slide-in-from-bottom-8 duration-200 bottom-[calc(3.5rem+env(safe-area-inset-bottom))]"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex flex-col space-y-2">
                            <div className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider flex justify-between items-center">
                                <span>Mais Opções</span>
                                <button onClick={() => signOut()} className="text-rose-600 text-xs flex items-center gap-1 font-semibold hover:underline">
                                    <LogOutIcon className="h-3.5 w-3.5" /> Sair
                                </button>
                            </div>
                            <NavLink
                                to="/orcamentos"
                                className={({ isActive }) => `flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-indigo-50 dark:bg-brand-dark-800 text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-brand-dark-800'}`}
                            >
                                <CalculatorIcon className="h-5 w-5" />
                                <span className="font-medium text-sm">Orçamentos</span>
                            </NavLink>
                            <NavLink
                                to="/tarefas"
                                className={({ isActive }) => `flex items-center justify-between px-4 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-indigo-50 dark:bg-brand-dark-800 text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-brand-dark-800'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <ClipboardListIcon className="h-5 w-5" />
                                    <span className="font-medium text-sm">Tarefas</span>
                                </div>
                                {delayedTasks > 0 && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-500 border border-red-500/30">
                                        {delayedTasks} atrasadas
                                    </span>
                                )}
                            </NavLink>
                            <NavLink
                                to="/registro"
                                className={({ isActive }) => `flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors ${isActive ? 'bg-indigo-50 dark:bg-brand-dark-800 text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-brand-dark-800'}`}
                            >
                                <ActivityIcon className="h-5 w-5" />
                                <span className="font-medium text-sm">Cadastros</span>
                            </NavLink>
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile Account Bottom Sheet */}
            {isAccountMenuOpen && (
                <div 
                    className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                    onClick={() => setIsAccountMenuOpen(false)}
                >
                    <div 
                        className="absolute left-0 right-0 bottom-0 bg-white dark:bg-brand-dark-900 border-t border-slate-200 dark:border-gray-800 rounded-t-2xl p-5 animate-in slide-in-from-bottom-8 duration-200 max-h-[85vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-gray-800">
                            <span className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Conta & Licença</span>
                            <button
                                type="button"
                                onClick={() => setIsAccountMenuOpen(false)}
                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                            >
                                <XIcon className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Informações da Conta */}
                        <div className="py-4 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white font-bold text-base flex items-center justify-center shadow-md shrink-0">
                                    {userInitial}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                        {userEmail.split('@')[0]}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-gray-400 font-mono truncate">
                                        {userEmail}
                                    </p>
                                    <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5 truncate">
                                        🏢 {companyName}
                                    </p>
                                </div>
                            </div>

                            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">🔑 Status da Licença</span>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                                        ATIVA
                                    </span>
                                </div>
                                <p className="text-xs text-emerald-900 dark:text-emerald-200 font-semibold">
                                    Validade da Chave: Ativa até {formattedKeyExpiry}
                                </p>
                            </div>

                            <div className="space-y-1 pt-2">
                                <NavLink
                                    to="/registro"
                                    onClick={() => setIsAccountMenuOpen(false)}
                                    className="flex items-center gap-3 p-3 rounded-xl text-sm font-medium text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-brand-dark-800"
                                >
                                    <BuildingIcon className="h-5 w-5 text-slate-400 shrink-0" />
                                    <span>Configurações & Cadastros</span>
                                </NavLink>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsAccountMenuOpen(false);
                                        setIsLogoutModalOpen(true);
                                    }}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                >
                                    <LogOutIcon className="h-5 w-5 shrink-0" />
                                    <span>Sair da Conta</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Busca Global e Inteligência de Preços (Ctrl + K) */}
            <GlobalSearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
            />

            {/* Modal de Confirmação de Logout */}
            <ConfirmationModal
                isOpen={isLogoutModalOpen}
                onClose={() => setIsLogoutModalOpen(false)}
                onConfirm={async () => {
                    setIsLogoutModalOpen(false);
                    await signOut();
                }}
                title="Sair da Conta"
                description="Tem certeza que deseja sair do sistema? Suas alterações salvas não serão perdidas."
                confirmText="Sim, Sair"
            />
        </div>
    );
};

export default MainLayout;
