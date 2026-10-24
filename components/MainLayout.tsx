import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDashboardAlerts } from '../hooks/useDashboardAlerts';
import { Button } from './ui/Button';
import { ThemeToggle } from './ui/ThemeToggle';
import { GlobalSearchModal } from './GlobalSearchModal';
import { 
    MenuIcon, XIcon, PlusIcon, ClipboardListIcon, FileTextIcon, 
    LayoutIcon, ConstructionIcon, ActivityIcon, BuildingIcon,
    LogOutIcon, ChevronRightIcon, UploadCloudIcon, SearchIcon,
    KeyRoundIcon, MoreVerticalIcon
} from '../lib/icons';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from './ui/DropdownMenu';
import { formatDateBR } from '../lib/utils';

const MainLayout: React.FC = () => {
    const { signOut, user, profile } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
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
        { name: 'Cartório', path: '/cartorio', icon: BuildingIcon, badge: null },
        { 
            name: 'Tarefas', 
            path: '/tarefas', 
            icon: ClipboardListIcon, 
            badge: delayedTasks > 0 ? { count: delayedTasks, color: 'bg-red-500/20 text-red-500 border-red-500/30' } : null 
        },
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
        <div className="h-screen w-screen overflow-hidden bg-slate-50 dark:bg-brand-dark-950 text-slate-900 dark:text-white flex flex-col md:flex-row">
            {/* ========================================================= */}
            {/* 1. SIDEBAR ESQUERDA (Desktop Full-Bleed Fixa)              */}
            {/* ========================================================= */}
            <aside className="hidden md:flex w-60 shrink-0 bg-white dark:bg-brand-dark-900 border-r border-slate-200 dark:border-gray-800 flex-col justify-between h-full z-30">
                {/* Topo: Logo + Workspace Switcher */}
                <div className="p-4 border-b border-slate-200 dark:border-gray-800 space-y-3">
                    <NavLink to="/" className="flex items-center gap-2.5 text-slate-900 dark:text-white font-bold text-base tracking-tight">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30 shrink-0">
                            <LayoutIcon className="h-5 w-5" />
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white">
                            JPL Conecta
                        </span>
                    </NavLink>

                    {/* Workspace Switcher */}
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-brand-dark-800/80 border border-slate-200 dark:border-gray-700/60 text-xs">
                        <span className="text-base leading-none">🏢</span>
                        <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-800 dark:text-gray-200 truncate leading-tight">{companyName}</p>
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
                                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold border-l-4 border-indigo-600'
                                        : 'bg-transparent text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-brand-dark-800 hover:text-slate-900 dark:hover:text-white font-medium'
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

                {/* Rodapé: Badge ONLINE • v1.2 + Card de Perfil Interativo com Popover */}
                <div className="p-3 border-t border-slate-200 dark:border-gray-800 bg-white dark:bg-brand-dark-900 space-y-2">
                    {/* Badge ONLINE */}
                    <div className="flex items-center justify-between px-2.5 py-1 rounded-md bg-slate-50 dark:bg-brand-dark-800/50 border border-slate-200 dark:border-gray-800 text-[10px] text-slate-500 dark:text-gray-400">
                        <span className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            ONLINE
                        </span>
                        <span className="font-mono">v1.2</span>
                    </div>

                    {/* Card de Perfil Interativo com DropdownMenu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-brand-dark-800/60 dark:hover:bg-brand-dark-800 border border-slate-200 dark:border-gray-700/60 transition-all text-left group cursor-pointer"
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
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-72 p-2 bg-white dark:bg-brand-dark-900 border border-slate-200 dark:border-gray-800 shadow-xl rounded-xl space-y-1">
                            <div className="px-3 py-2 border-b border-slate-100 dark:border-gray-800">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{companyName}</p>
                                <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate font-mono">{userEmail}</p>
                            </div>
                            
                            <div className="px-3 py-2">
                                <div className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 w-full">
                                    <span>🔑</span>
                                    <span className="truncate">Validade da Chave: Ativa até {formattedKeyExpiry}</span>
                                </div>
                            </div>

                            <DropdownMenuItem onSelect={() => navigate('/registro')} className="text-xs py-2 px-3 rounded-lg cursor-pointer">
                                <KeyRoundIcon className="h-3.5 w-3.5 mr-2 text-slate-500" /> Configurações da Conta
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem 
                                onSelect={() => signOut()}
                                className="text-xs py-2 px-3 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer font-semibold"
                            >
                                <LogOutIcon className="h-3.5 w-3.5 mr-2 text-rose-600" /> Sair da Conta
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </aside>

            {/* ========================================================= */}
            {/* 2. TOPBAR GLOBAL & ÁREA OPERACIONAL FULL-BLEED            */}
            {/* ========================================================= */}
            <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-slate-50 dark:bg-brand-dark-950">
                {/* TOPBAR GLOBAL */}
                <header className="hidden md:flex h-14 shrink-0 bg-white dark:bg-brand-dark-900 border-b border-slate-200 dark:border-gray-800 px-6 items-center justify-between z-20">
                    {/* Esquerda: Breadcrumb */}
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-semibold text-slate-500 dark:text-gray-400">JPL Gestão</span>
                        <ChevronRightIcon className="h-3.5 w-3.5 text-slate-400 dark:text-gray-600" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{currentRoute.module}</span>
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

                    {/* Direita: Tema + Registrar IA + Nova Tarefa */}
                    <div className="flex items-center gap-2.5 shrink-0">
                        <ThemeToggle variant="icon" />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate('/notas', { state: { action: 'newAiNota' } })}
                            className="h-8 text-xs font-semibold border-slate-200 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-brand-dark-800 gap-1.5"
                        >
                            <UploadCloudIcon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>Registrar c/ IA</span>
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => navigate('/tarefas', { state: { action: 'newTask' } })}
                            className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5 shadow-sm"
                        >
                            <PlusIcon className="h-3.5 w-3.5" />
                            <span>+ Nova Tarefa</span>
                        </Button>
                    </div>
                </header>

                {/* Mobile Top Header (Fixed on Mobile only) */}
                <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white/95 dark:bg-brand-dark-900/95 backdrop-blur-md border-b border-slate-200 dark:border-gray-800 h-14 px-4 flex items-center justify-between">
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
                        <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                            {userInitial}
                        </div>
                    </div>
                </header>

                {/* CONTAINER FULL-BLEED OPERACIONAL (Sem max-w, sem mx-auto, 100% altura e largura) */}
                <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden pt-14 md:pt-0">
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

            {/* Modal de Busca Global e Inteligência de Preços (Ctrl + K) */}
            <GlobalSearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
            />
        </div>
    );
};

export default MainLayout;
