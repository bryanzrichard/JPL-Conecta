
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { AlertTriangleIcon } from '../lib/icons';

const Header = () => {
    const { signOut } = useAuth();
    return (
        <header className="absolute top-0 left-0 right-0 p-4 bg-brand-dark-900/50 backdrop-blur-sm border-b border-gray-800/50">
            <div className="container mx-auto flex justify-between items-center">
                <h1 className="text-xl font-bold text-brand-blue-500">JPL Conecta</h1>
                <Button onClick={signOut} variant='ghost' className='text-gray-400 hover:text-white'>Logout</Button>
            </div>
        </header>
    );
};


const RegisterKey: React.FC = () => {
    const { user, refreshProfile } = useAuth();
    const location = useLocation();
    const [companyKey, setCompanyKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Captura mensagem de erro vinda do redirecionamento (ex: Chave Expirada)
    useEffect(() => {
        if (location.state?.message && location.state.message !== 'FIRST_ACCESS') {
            setError(location.state.message);
        }
    }, [location.state]);

    const handleRegisterKey = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            setError('Usuário não autenticado.');
            return;
        }
        setLoading(true);
        setError(null);

        try {
            const { data: result, error: rpcError } = await (supabase as any).rpc('sp_register_key_atomic', {
                in_user_id: user.id,
                in_plain_key: companyKey,
            });
    
            if (rpcError) {
                console.error('RPC Error:', rpcError);
                setError('Chave inválida ou já utilizada. Verifique os dados.');
                return;
            }
    
            if (!result) {
                setError('Chave empresarial inválida ou ocorreu um erro.');
            } else if ((result as any).status === 'error') {
                setError((result as any).message);
            } else if ((result as any).status === 'success') {
                // Sucesso! Atualiza o perfil e o ProtectedRoute nos levará para a Home
                await refreshProfile();
            } else {
                setError('Resposta inesperada do servidor.');
            }
        } catch (err) {
            console.error("Erro inesperado:", err);
            setError("Um erro inesperado aconteceu. Por favor, tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Header />
            <div className="flex min-h-screen flex-col items-center justify-center bg-brand-dark-950 p-4">
                <Card className="w-full max-w-lg shadow-2xl shadow-black/50 border-gray-800">
                    <CardHeader>
                        <h1 className="text-2xl font-bold text-white text-center">Configuração de Acesso</h1>
                        <p className="text-gray-400 text-center">Para acessar o painel, insira sua chave empresarial.</p>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        
                        {error && (
                            <div className="flex gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 animate-in fade-in zoom-in-95">
                                <AlertTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
                                <p className="text-sm text-red-400 font-medium">{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleRegisterKey} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="company-key" className="text-gray-300">Chave Empresarial</Label>
                                <Input 
                                    id="company-key" 
                                    type="text" 
                                    placeholder="Digite sua chave de acesso..." 
                                    value={companyKey} 
                                    onChange={(e) => setCompanyKey(e.target.value)} 
                                    required 
                                    className="h-12 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:ring-brand-blue-500 focus:border-brand-blue-500"
                                />
                            </div>
                            <Button type="submit" isLoading={loading} className="h-12 text-base font-bold shadow-lg shadow-brand-blue-500/20">
                                Validar e Entrar
                            </Button>
                        </form>
                        
                        <div className="pt-4 text-center">
                            <p className="text-xs text-gray-500">
                                Problemas com sua chave? Entre em contato com o suporte da sua empresa.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
};

export default RegisterKey;
