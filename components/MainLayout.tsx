import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/Button';
import { 
    MenuIcon, XIcon, PlusIcon, ClipboardListIcon, FileTextIcon, 
    LayoutIcon, ConstructionIcon, HistoryIcon, ActivityIcon, UserIcon, BuildingIcon
} from '../lib/icons';

const MainLayout: React.FC = () => {
    const { signOut } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isQuickAddOpen, setQuickAddOpen] = useState(false);

    // Close menus on route change
    useEffect(() => {
        setIsMenuOpen(false);
        setQuickAddOpen(false);
    }, [location.pathname]);

    const navLinks = [
        { name: 'Home', path: '/', icon: LayoutIcon },
        { name: 'Notas', path: '/notas', icon: FileTextIcon },
        { name: 'Serviços', path: '/servicos', icon: ConstructionIcon },
        { name: 'Cartório', path: '/cartorio', icon: BuildingIcon },
        { name: 'Tarefas', path: '/tarefas', icon: ClipboardListIcon },
        { name: 'Histórico', path: '/historico', icon: HistoryIcon },
        { name: 'Registro', path: '/registro', icon: ActivityIcon },
    ];

    const activeLinkClass = 'text-brand-blue-500';
    const inactiveLinkClass = 'text-gray-300 hover:text-white';

    const NavLinksComponent = () => (
        <>
            {navLinks.map((link) => (
                <NavLink
                    key={link.path}
                    to={link.path}
                    end={link.path === '/'}
                    className={({ isActive }) =>
                        `${isActive ? activeLinkClass : inactiveLinkClass} text-sm font-medium transition-colors`
                    }
                >
                    {link.name}
                </NavLink>
            ))}
        </>
    );
    
    const handleQuickAddAction = (path: string, action: string) => {
        setQuickAddOpen(false);
        navigate(path, { state: { action } });
    }

    // Bottom Navigation Item Component
    const BottomNavItem = ({ to, icon: Icon, label, end = false, isActiveOverride }: any) => (
        <NavLink
            to={to}
            end={end}
            className={({ isActive }) =>
                `flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                    (isActiveOverride !== undefined ? isActiveOverride : isActive) 
                        ? 'text-brand-blue-500' 
                        : 'text-gray-400 hover:text-gray-200'
                }`
            }
        >
            <Icon className="h-6 w-6" />
            <span className="text-[10px] font-medium">{label}</span>
        </NavLink>
    );

    return (
        <div className="min-h-screen bg-brand-dark-950 text-white flex flex-col">
            {/* Top Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-brand-dark-900/80 backdrop-blur-md border-b border-gray-800">
                <div className="container mx-auto px-4 h-16 flex justify-between items-center">
                    <NavLink to="/" className="text-xl font-bold text-brand-blue-500 flex items-center gap-2">
                        <LayoutIcon className="h-6 w-6" />
                        JPL Conecta
                    </NavLink>
                    
                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center space-x-6">
                        <NavLinksComponent />
                    </nav>

                    {/* Mobile Top Right (Optional, e.g., Profile or Notifications) */}
                    <div className="md:hidden flex items-center">
                        {/* Empty for now, as navigation moved to bottom */}
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 pt-16 pb-36 md:pb-6">
                <div className="w-full mx-auto p-4 md:p-6">
                    <div className="animate-in fade-in-50 duration-300">
                        <Outlet />
                    </div>
                </div>
            </main>
            
            {/* Quick Add Button (FAB) */}
            <div 
                className="fixed right-4 md:right-6 z-40 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6"
            >
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

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-brand-dark-900/95 backdrop-blur-md border-t border-gray-800 pb-safe">
                <div className="flex items-center justify-around h-16 px-2">
                    <BottomNavItem to="/" end icon={LayoutIcon} label="Home" />
                    <BottomNavItem to="/cartorio" icon={BuildingIcon} label="Cartório" />
                    <BottomNavItem to="/notas" icon={FileTextIcon} label="Notas" />
                    <BottomNavItem to="/servicos" icon={ConstructionIcon} label="Serviços" />
                    
                    {/* More Menu Toggle */}
                    <button 
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                            isMenuOpen ? 'text-brand-blue-500' : 'text-gray-400 hover:text-gray-200'
                        }`}
                    >
                        {isMenuOpen ? <XIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
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
                            <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                Mais Opções
                            </div>
                            <NavLink
                                to="/tarefas"
                                className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isActive ? 'bg-brand-dark-800 text-brand-blue-500' : 'text-gray-200 hover:bg-brand-dark-800'}`}
                            >
                                <ClipboardListIcon className="h-5 w-5" />
                                <span className="font-medium">Tarefas</span>
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
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MainLayout;