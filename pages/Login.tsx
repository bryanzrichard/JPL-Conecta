
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { Card, CardHeader, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';

const LockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-white"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
);
const MailIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>);
const KeyIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>);

const Login: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { signOut, user } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Captura mensagens vindas do ProtectedRoute (ex: Chave Expirada)
    useEffect(() => {
        if (location.state?.message) {
            setError(location.state.message);
        }
    }, [location.state]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        
        if (signInError) {
            setError('Email ou senha inválidos.');
            setLoading(false);
        } else {
            navigate('/');
        }
    };

    const handleSwitchAccount = async () => {
        await signOut();
        setError(null);
        navigate('/login', { replace: true, state: {} });
    };

    return (
        <AuthLayout>
            <Card>
                <CardHeader>
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-blue-500">
                        <LockIcon />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">JPL Conecta</h1>
                    <p className="text-gray-500 dark:text-gray-400">Gestão de gastos empresariais</p>
                </CardHeader>
                <CardContent>
                    {error && (
                        <div className="mb-6 rounded-xl bg-red-500/10 p-4 border border-red-500/20 animate-in fade-in zoom-in-95">
                            <p className="text-sm text-red-500 text-center font-semibold">{error}</p>
                            {user && (
                                <button 
                                    onClick={handleSwitchAccount}
                                    className="mt-2 w-full text-xs text-red-400 underline hover:text-red-300 transition-colors"
                                >
                                    Tentar com outra conta
                                </button>
                            )}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required icon={<MailIcon />} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Senha</Label>
                            <Input id="password" type="password" placeholder="********" value={password} onChange={(e) => setPassword(e.target.value)} required icon={<KeyIcon />} />
                        </div>
                        <div className="text-right">
                             <Link to="/forgot-password" className="text-sm text-brand-blue-500 hover:underline">Esqueceu sua senha?</Link>
                        </div>
                        <Button type="submit" isLoading={loading}>Entrar</Button>
                    </form>
                </CardContent>
                <CardFooter>
                    Não tem uma conta?{' '}
                    <Link to="/register" className="font-semibold text-brand-blue-500 hover:underline">
                        Registre-se
                    </Link>
                </CardFooter>
            </Card>
        </AuthLayout>
    );
};

export default Login;
