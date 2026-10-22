import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { CheckCircleIcon, AlertTriangleIcon, ClockIcon, ActivityIcon, RefreshCwIcon } from '../../lib/icons';

type TestStatus = 'idle' | 'loading' | 'success' | 'error';

interface DiagnosticTest {
  id: string;
  name: string;
  description: string;
  status: TestStatus;
  message?: string;
  run: (companyId: string) => Promise<string | void>;
}

export const SystemHealthPanel: React.FC = () => {
  const { profile } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [tests, setTests] = useState<DiagnosticTest[]>([
    {
      id: 'conn',
      name: 'Conexão com o Banco',
      description: 'Verifica se o Supabase está respondendo.',
      status: 'idle',
      run: async () => {
        const { error } = await supabase.from('profiles').select('id').limit(1);
        if (error) throw new Error(error.message);
      }
    },
    {
      id: 'collab',
      name: 'Schema: Colaboradores',
      description: 'Verifica se as novas colunas (name, role, document) existem.',
      status: 'idle',
      run: async () => {
        const { data, error } = await supabase.from('collaborators').select('name').limit(1);
        if (error) throw new Error(error.message);
        return data && data.length > 0 ? `OK (Amostra: ${data[0].name})` : 'OK (Tabela vazia)';
      }
    },
    {
      id: 'supp',
      name: 'Schema: Fornecedores',
      description: 'Verifica se as novas colunas (name, cnpj, seller) existem.',
      status: 'idle',
      run: async () => {
        const { data, error } = await supabase.from('suppliers').select('name').limit(1);
        if (error) throw new Error(error.message);
        return data && data.length > 0 ? `OK (Amostra: ${data[0].name})` : 'OK (Tabela vazia)';
      }
    },
    {
      id: 'proj',
      name: 'Schema: Projetos',
      description: 'Verifica se as novas colunas (name, manager, address_city) existem.',
      status: 'idle',
      run: async () => {
        const { data, error } = await supabase.from('projects').select('name').limit(1);
        if (error) throw new Error(error.message);
        return data && data.length > 0 ? `OK (Amostra: ${data[0].name})` : 'OK (Tabela vazia)';
      }
    },
    {
      id: 'rls',
      name: 'Segurança (RLS)',
      description: 'Garante que as consultas retornam apenas dados da sua empresa.',
      status: 'idle',
      run: async (companyId) => {
        const { data, error } = await supabase.from('profiles').select('company_id').limit(10);
        if (error) throw new Error(error.message);
        if (data && data.length > 0) {
          const hasOtherCompany = data.some(d => d.company_id !== companyId);
          if (hasOtherCompany) throw new Error('Vazamento de dados detectado! RLS falhou.');
        }
      }
    }
  ]);

  const runDiagnostics = async () => {
    if (!profile?.company_id) return;
    
    setIsRunning(true);
    
    // Reset all to loading
    setTests(prev => prev.map(t => ({ ...t, status: 'loading', message: undefined })));

    // Run sequentially to not overwhelm and to show progress
    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      try {
        const result = await test.run(profile.company_id);
        setTests(prev => prev.map(t => t.id === test.id ? { ...t, status: 'success', message: result || 'OK' } : t));
      } catch (err: any) {
        setTests(prev => prev.map(t => t.id === test.id ? { ...t, status: 'error', message: err.message || 'Erro desconhecido' } : t));
      }
    }

    setIsRunning(false);
  };

  const getStatusIcon = (status: TestStatus) => {
    switch (status) {
      case 'idle': return <ClockIcon className="h-5 w-5 text-gray-500" />;
      case 'loading': return <RefreshCwIcon className="h-5 w-5 text-brand-blue-500 animate-spin" />;
      case 'success': return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'error': return <AlertTriangleIcon className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusColor = (status: TestStatus) => {
    switch (status) {
      case 'idle': return 'border-gray-800 bg-gray-900/50';
      case 'loading': return 'border-brand-blue-500/30 bg-brand-blue-900/10';
      case 'success': return 'border-green-500/30 bg-green-900/10';
      case 'error': return 'border-red-500/30 bg-red-900/10';
    }
  };

  return (
    <Card className="bg-brand-dark-900 border-gray-800 h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-lg text-white">
          <ActivityIcon className="h-5 w-5 text-brand-blue-500" />
          Painel de Saúde do Sistema
        </CardTitle>
        <Button 
          onClick={runDiagnostics} 
          disabled={isRunning}
          variant="outline"
          size="sm"
          className="border-gray-700 hover:bg-gray-800 text-gray-300"
        >
          {isRunning ? (
            <><RefreshCwIcon className="h-4 w-4 mr-2 animate-spin" /> Diagnosticando...</>
          ) : (
            <><ActivityIcon className="h-4 w-4 mr-2" /> Executar Diagnóstico</>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-400 mb-4">
          Este painel verifica se a estrutura do banco de dados está sincronizada com o aplicativo e se as regras de segurança (RLS) estão ativas.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tests.map((test) => (
            <div 
              key={test.id} 
              className={`p-3 rounded-lg border flex items-start gap-3 transition-colors ${getStatusColor(test.status)}`}
            >
              <div className="mt-0.5">
                {getStatusIcon(test.status)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-gray-200">{test.name}</h4>
                <p className="text-xs text-gray-500 mt-0.5">{test.description}</p>
                {test.message && (
                  <p className={`text-xs mt-1.5 font-mono truncate ${test.status === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                    {test.message}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
