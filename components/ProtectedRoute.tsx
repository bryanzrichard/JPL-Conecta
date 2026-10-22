
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ProtectedRoute = () => {
  const { user, profile, loading, profileLoading, isRecoverySession } = useAuth();
  const location = useLocation();

  // Verifica se a chave é inválida ou expirada
  const getKeyError = () => {
    if (!profile) return null;
    
    // Se não tem chave vinculada
    if (!profile.company_key_id) return 'FIRST_ACCESS';
    
    // Se a chave existe mas está inativa
    if (profile.company_keys?.is_active === false) {
      return 'Sua chave empresarial está inativa. Por favor, insira uma nova chave válida.';
    }

    // Se a chave existe mas expirou
    if (profile.company_keys?.expires_at) {
      const expiryDate = new Date(profile.company_keys.expires_at);
      const now = new Date();
      if (expiryDate <= now) {
        return `Sua chave empresarial expirou em ${expiryDate.toLocaleDateString('pt-BR')}. Por favor, insira uma nova chave.`;
      }
    }

    return null;
  };

  // 1. Aguarda carregamento inicial
  if (loading || (user && profileLoading && !profile)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-brand-dark-950 text-white">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-brand-blue-500 border-t-transparent"></div>
        <p className="text-gray-400">Validando acesso...</p>
      </div>
    );
  }
  
  // 2. Fluxo de Recuperação de Senha
  if (isRecoverySession && location.pathname !== '/update-password') {
    return <Navigate to="/update-password" replace />;
  }

  // 3. Usuário não logado
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 4. Usuário logado: Verificar integridade da Chave
  const keyErrorMessage = getKeyError();
  
  if (keyErrorMessage) {
    // Se o usuário está com erro de chave (não tem, expirou ou inativa)
    // e NÃO está na página de registrar chave, mandamos ele para lá.
    if (location.pathname !== '/register-key') {
      return <Navigate to="/register-key" state={{ message: keyErrorMessage }} replace />;
    }
    // Se ele JÁ ESTÁ na página de registrar chave, deixamos ele ver a tela (Outlet)
    return <Outlet />;
  }

  // 5. Chave Válida: Se ele tentar entrar na página de registro de chave, mandamos para a home
  if (!keyErrorMessage && location.pathname === '/register-key') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
