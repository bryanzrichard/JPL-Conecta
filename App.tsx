import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Busca from './pages/Busca';
import RegisterKey from './pages/RegisterKey';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import UpdatePassword from './pages/UpdatePassword';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import { useAuth } from './hooks/useAuth';
import MainLayout from './components/MainLayout';
import Notas from './pages/Notas';
import Servicos from './pages/Servicos';
import Orcamentos from './pages/Orcamentos';
import Registros from './pages/Registros';
import Cartorio from './pages/Cartorio';
import Tarefas from './pages/Tarefas';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Toaster } from './components/ui/Toaster';

function App() {
  const { loading, error, signOut } = useAuth();
  
  // Display a loading indicator while the auth state is being determined
  if (loading) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-brand-dark-950 text-white">
            Carregando...
        </div>
    );
  }

  // Display a global error screen if something went wrong during profile fetch
  if (error) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-brand-dark-950 text-white p-4 text-center">
            <h1 className="text-2xl font-bold text-red-500 mb-4">Ocorreu um Erro</h1>
            <p className="max-w-md text-gray-300 mb-6">{error}</p>
            <button
                onClick={() => signOut()}
                className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors bg-brand-blue-500 text-white hover:bg-brand-blue-600"
            >
                Voltar para o Login
            </button>
        </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <HashRouter>
            <Routes>
              {/* Public routes accessible only when not logged in */}
              <Route element={<PublicRoute />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/update-password" element={<UpdatePassword />} />
              </Route>

              {/* Protected routes that require authentication */}
              <Route element={<ProtectedRoute />}>
                {/* Standalone page for users without a company key */}
                <Route path="/register-key" element={<RegisterKey />} />
                
                {/* Main application layout for users with a valid company key */}
                <Route element={<MainLayout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/busca" element={<Busca />} />
                  <Route path="/notas" element={<Notas />} />
                  <Route path="/orcamentos" element={<Orcamentos />} />
                  <Route path="/orcamento" element={<Navigate to="/orcamentos" replace />} />
                  <Route path="/servicos" element={<Servicos />} />
                  <Route path="/historico" element={<Navigate to="/notas" replace />} />
                  <Route path="/registro" element={<Registros />} />
                  <Route path="/registros" element={<Navigate to="/registro" replace />} />
                  <Route path="/cartorio" element={<Cartorio />} />
                  <Route path="/tarefas" element={<Tarefas />} />
                  {/* Catch-all for authenticated users, redirects to home */}
                  <Route path="*" element={<Navigate to="/" />} />
                </Route>
              </Route>
              
              {/* Fallback for any other route, redirects to login */}
              <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
          </HashRouter>
          <Toaster />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;