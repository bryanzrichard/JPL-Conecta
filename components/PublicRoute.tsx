
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const PublicRoute = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-brand-dark-950 text-white">Verificando...</div>;
  }

  if (user && location.pathname !== '/update-password') {
    return <Navigate to="/" />;
  }

  return <Outlet />;
};

export default PublicRoute;
