import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDashboardAlerts } from '../hooks/useDashboardAlerts';
import { Button } from './ui/Button';
import { ThemeToggle } from './ui/ThemeToggle';
import { GlobalSearchModal } from './GlobalSearchModal';
import { 
    MenuIcon, XIcon, PlusIcon, ClipboardListIcon, FileTextIcon, 
    LayoutIcon, ConstructionIcon, HistoryIcon, ActivityIcon, BuildingIcon,
    LogOutIcon, ChevronRightIcon, UploadCloudIcon, SearchIcon
} from '../lib/icons';

const MainLayout: React.FC = () => {
    const { signOut, user, profile } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isQuickAddOpen, setQuickAddOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);

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

    // Realtime alerts for navigation badges
    const { delayedTasks, pendingAi } = useDashboardAlerts(profile?.company_id, user?.id);

    // Close menus on route change
    useEffect(() => {
        setIsMenuOpen(false);
        setQuickAddOpen(false);
    }, [location.pathname]);

    const navLinks = [
        { name: 'Visão Geral', path: '/', icon: LayoutIcon, badge: null },
        { 
            name: 'Notas Fiscais', 
            path: '/notas', 
            icon: FileTextIcon, 
            badge: pendingAi > 0 ? { count: pendingAi, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' } : null 
        },
        { name: 'Serviços', path: '/servicos', icon: ConstructionIcon, badge: null },
        { name: 'Cartório', path: '/cartorio', icon: BuildingIcon, badge: null },
        { 
            name: 'Tarefas', 
            path: '/tarefas', 
            icon: ClipboardListIcon, 
            badge: delayedTasks > 0 ? { count: delayedTasks, color: 'bg-red-500/20 text-red-400 border-red-500/30' } : null 
        },
        { name: 'Histórico', path: '/historico', icon: HistoryIcon, badge: null },
        { name: 'Cadastros', path: '/registro', icon: ActivityIcon, badge: null },
    ];

    const getRouteTitle = (pathname: string): { module: string; description: string } => {
        switch (pathname) {
            case '/':
                return { module: 'Visão Geral & Indicadores', description: 'Métricas financeiras e auditoria' };
            case '/notas':
                return { module: 'Gestão de Notas Fiscais', description: 'Lançamentos, IA e conciliação' };
            case '/servicos':
                return { module: 'Ordem de Serviços', description: 'Medições e prestadores' };
            case '/cartorio':
                return { module: 'Despesas de Cartório', description: 'Registro de emolumentos' };
            case '/tarefas':
                return { module: 'Gerenciador de Tarefas', description: 'Status de obras e cronogramas' };
            case '/historico':
                return { module: 'Histórico & Extratos', description: 'Consulta de registros passados' };
            case '/registro':
                return { module: 'Cadastros Gerais', description: 'Fornecedores, obras e colaboradores' };
            default:
                return { module: 'JPL Conecta', description: 'Sistema de Gestão Operacional' };
        }
    };

    const currentRoute = getRouteTitle(location.pathname);

    const handleQuickAddAction = (path: string, action: string) => {
        setQuickAddOpen(false);
        navigate(path, { state: { action } });
    };

    // Mobile Bottom Navigation Item Component
    const BottomNavItem = ({ to, icon: Icon, label, end = false, badgeCount }: any) => (
        <NavLink
            to={to}
            end={end}
            className={({ isActive }) =>
                `relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                    isActive ? 'text-brand-blue-500' : 'text-gray-400 hover:text-gray-200'
                }`
            }
        >
            <div className="relative">
                <Icon className="h-5 w-5" />
                {badgeCount && badgeCount > 0 ? (
                    <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-red-500 ring-2 ring-brand-dark-900" />
                ) : null}
            </div>
            <span className="text-[10px] font-medium">{label}</span>
        </NavLink>
    );

    const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'U';

    return (
        <div className="min-h-screen bg-brand-dark-950 text-white flex flex-col md:flex-row">
            {/* ========================================================= */}
            {/* DESKTOP APP SHELL SIDEBAR (Hidden on mobile)               */}
            {/* ========================================================= */}
            <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-30 bg-brand-dark-900 border-r border-gray-800">
                {/* Brand Logo & Context */}
                <div className="h-16 px-6 flex items-center justify-between border-b border-gray-800">
                    <NavLink to="/" className="flex items-center gap-2.5 text-white font-bold text-lg tracking-tight">
                        <div className="w-8 h-8 rounded-lg bg-brand-blue-600 flex items-center justify-center text-white shadow-md shadow-brand-blue-600/30">
                            <LayoutIcon className="h-5 w-5" />
                        </div>
                        <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                            JPL Conecta
                        </span>
                    </NavLink>
                </div>

                {/* Company Status Pill */}
                <div className="px-4 py-3 border-b border-gray-800/60 bg-brand-dark-950/40">
                    <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-brand-dark-800/60 border border-gray-800 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                            <span className="font-medium text-gray-300 truncate">
                                {profile?.role ? `${profile.role.toUpperCase()}` : 'ONLINE'}
                            </span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono">v1.2</span>
                    </div>
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
                    {navLinks.map((link) => (
                        <NavLink
                            key={link.path}
                            to={link.path}
                            end={link.path === '/'}
                            className={({ isActive }) =>
                                `group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                                    isActive
                                        ? 'bg-brand-blue-600/15 text-brand-blue-400 border border-brand-blue-500/30 shadow-sm font-semibold'
                                        : 'text-gray-400 hover:text-gray-200 hover:bg-brand-dark-800/60'
                                }`
                            }
                        >
                            <div className="flex items-center gap-3">
                                <link.icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                                <span>{link.name}</span>
                            </div>
                            {link.badge && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${link.badge.color}`}>
                                    {link.badge.count}
                                </span>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Desktop Sidebar Footer: Profile & Logout */}
                <div className="p-3 border-t border-gray-800 bg-brand-dark-950/50 space-y-2">
                    <ThemeToggle variant="sidebar" />
                    <div className="flex items-center justify-between p-2 rounded-xl bg-brand-dark-800/40 border border-gray-800">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-brand-blue-500/20 border border-brand-blue-500/30 flex items-center justify-center text-brand-blue-400 font-bold text-xs shrink-0">
                                {userInitial}
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-200 truncate leading-tight">
                                    {user?.email?.split('@')[0] || 'Usuário'}
                                </p>
                                <p className="text-[10px] text-gray-500 truncate leading-tight">
                                    {user?.email || 'Conectado'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => signOut()}
                            title="Encerrar Sessão"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                        >
                            <LogOutIcon className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* ========================================================= */}
            {/* MAIN CONTENT AREA (Offset on desktop by md:pl-64)          */}
            {/* ========================================================= */}
            <div className="flex-1 flex flex-col md:pl-64 min-w-0">
                {/* Desktop Topbar Header */}
                <header className="hidden md:flex sticky top-0 z-20 h-16 shrink-0 items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-brand-dark-900/80 backdrop-blur-md px-6 lg:px-8">
                    {/* Breadcrumbs Context */}
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-medium text-gray-500">JPL Gestão</span>
                        <ChevronRightIcon className="h-3.5 w-3.5 text-gray-400 dark:text-gray-600" />
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{currentRoute.module}</span>
                    </div>

                    {/* Global Search Trigger Input (Desktop) */}
                    <div className="flex-1 max-w-md mx-4 lg:mx-8">
                        <button
                            type="button"
                            onClick={() => setIsSearchOpen(true)}
                            className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200/70 dark:bg-brand-dark-800/60 dark:hover:bg-brand-dark-800 border border-gray-200 dark:border-gray-700/60 hover:border-brand-blue-500/50 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-all text-xs group shadow-sm"
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <SearchIcon className="h-4 w-4 text-gray-400 group-hover:text-brand-blue-500 transition-colors shrink-0" />
                                <span className="truncate">Buscar insumos, preços, obras, tarefas...</span>
                            </div>
                            <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-brand-dark-900 border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 shrink-0">
                                <span className="text-[9px]">⌘</span>K
                            </kbd>
                        </button>
                    </div>

                    {/* Quick Desktop Actions */}
                    <div className="flex items-center gap-3 shrink-0">
                        <ThemeToggle variant="icon" />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate('/notas', { state: { action: 'newAiNota' } })}
                            className="border-gray-300 dark:border-gray-700 bg-white dark:bg-brand-dark-800/80 hover:bg-gray-50 dark:hover:bg-brand-dark-700 text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white text-xs h-9 px-3 gap-2"
                        >
                            <UploadCloudIcon className="h-3.5 w-3.5 text-brand-blue-500 dark:text-brand-blue-400" />
                            <span>Registrar c/ IA</span>
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => navigate('/tarefas', { state: { action: 'newTask' } })}
                            className="bg-brand-blue-600 hover:bg-brand-blue-500 text-white text-xs h-9 px-3.5 gap-2 shadow-sm"
                        >
                            <PlusIcon className="h-4 w-4" />
                            <span>Nova Tarefa</span>
                        </Button>
                    </div>
                </header>

                {/* Mobile Top Header (Fixed on Mobile only) */}
                <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white/90 dark:bg-brand-dark-900/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 h-16 px-4 flex items-center justify-between">
                    <NavLink to="/" className="text-lg font-bold text-brand-blue-500 flex items-center gap-2">
                        <LayoutIcon className="h-5 w-5" />
                        JPL Conecta
                    </NavLink>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsSearchOpen(true)}
                            title="Buscar em todo o sistema (Ctrl + K)"
                            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-brand-dark-800 transition-colors"
                        >
                            <SearchIcon className="h-5 w-5" />
                        </button>
                        <ThemeToggle variant="icon" />
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-brand-dark-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-xs font-bold text-gray-700 dark:text-gray-300">
                            {userInitial}
                        </div>
                    </div>
                </header>

                {/* Main Dynamic View Content */}
                <main className="flex-1 pt-16 md:pt-0 pb-32 md:pb-8">
                    <div className="w-full mx-auto p-4 md:p-6 lg:p-8 max-w-7xl">
                        <div className="animate-in fade-in-50 duration-200">
                            <Outlet />
                        </div>
                    </div>
                </main>
            </div>

            {/* ========================================================= */}
            {/* FLOATING ACTION BUTTON (Mobile Only)                      */}
            {/* ========================================================= */}
            <div className="md:hidden fixed right-4 z-40 bottom-[calc(5rem+env(safe-area-inset-bottom))]">
                <div className="relative flex flex-col items-end gap-3">
                    {/* Sub-buttons */}
                    <div
                        className={`transition-all duration-300 ease-in-out flex flex-col items-end gap-3 ${
                            isQuickAddOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <span className="bg-brand-dark-800 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg border border-gray-700 font-medium">Nova Tarefa</span>
                            <Button size="icon" className="rounded-full bg-gray-700 hover:bg-gray-600 w-12 h-12 shadow-lg" onClick={() => handleQuickAddAction('/tarefas', 'newTask')}>
                                <ClipboardListIcon className="h-5 w-5" />
                            </Button>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="bg-brand-dark-800 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg border border-gray-700 font-medium">Registrar IA</span>
                            <Button size="icon" className="rounded-full bg-gray-700 hover:bg-gray-600 w-12 h-12 shadow-lg" onClick={() => handleQuickAddAction('/notas', 'newAiNota')}>
                                <FileTextIcon className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>

                    {/* Main FAB */}
                    <Button
                        size="icon"
                        className="rounded-full w-14 h-14 shadow-xl shadow-black/50 bg-brand-blue-600 hover:bg-brand-blue-500"
                        onClick={() => setQuickAddOpen(!isQuickAddOpen)}
                    >
                        <PlusIcon className={`h-7 w-7 transition-transform duration-300 ${isQuickAddOpen ? 'rotate-45' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* ========================================================= */}
            {/* MOBILE BOTTOM NAVIGATION (Mobile Only)                    */}
            {/* ========================================================= */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-brand-dark-900/95 backdrop-blur-md border-t border-gray-800 pb-safe">
                <div className="flex items-center justify-around h-16 px-2">
                    <BottomNavItem to="/" end icon={LayoutIcon} label="Home" />
                    <BottomNavItem to="/cartorio" icon={BuildingIcon} label="Cartório" />
                    <BottomNavItem to="/notas" icon={FileTextIcon} label="Notas" badgeCount={pendingAi} />
                    <BottomNavItem to="/servicos" icon={ConstructionIcon} label="Serviços" />
                    
                    {/* More Menu Toggle */}
                    <button 
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                            isMenuOpen ? 'text-brand-blue-500' : 'text-gray-400 hover:text-gray-200'
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
                        className="absolute left-0 right-0 bg-brand-dark-900 border-t border-gray-800 rounded-t-2xl p-4 animate-in slide-in-from-bottom-8 duration-200 bottom-[calc(4rem+env(safe-area-inset-bottom))]"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex flex-col space-y-2">
                            <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider flex justify-between items-center">
                                <span>Mais Opções</span>
                                <button onClick={() => signOut()} className="text-red-400 text-xs flex items-center gap-1 hover:underline">
                                    <LogOutIcon className="h-3.5 w-3.5" /> Sair
                                </button>
                            </div>
                            <NavLink
                                to="/tarefas"
                                className={({ isActive }) => `flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${isActive ? 'bg-brand-dark-800 text-brand-blue-500' : 'text-gray-200 hover:bg-brand-dark-800'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <ClipboardListIcon className="h-5 w-5" />
                                    <span className="font-medium">Tarefas</span>
                                </div>
                                {delayedTasks > 0 && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                                        {delayedTasks} atrasadas
                                    </span>
                                )}
                            </NavLink>
                            <NavLink
                                to="/historico"
                                className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isActive ? 'bg-brand-dark-800 text-brand-blue-500' : 'text-gray-200 hover:bg-brand-dark-800'}`}
                            >
                                <HistoryIcon className="h-5 w-5" />
                                <span className="font-medium">Histórico</span>
                            </NavLink>
                            <NavLink
                                to="/registro"
                                className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isActive ? 'bg-brand-dark-800 text-brand-blue-500' : 'text-gray-200 hover:bg-brand-dark-800'}`}
                            >
                                <ActivityIcon className="h-5 w-5" />
                                <span className="font-medium">Registro</span>
                            </NavLink>
                            <div className="pt-2 px-1">
                                <ThemeToggle variant="sidebar" />
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
        </div>
    );
};

export default MainLayout;
