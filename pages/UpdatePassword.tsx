import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { supabase } from '../lib/supabaseClient';

// FIX: Use self-closing tags for SVG elements to be compliant with JSX syntax.
const KeyIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>);

const UpdatePassword = () => {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [hasToken, setHasToken] = useState(false);
    
    useEffect(() => {
        // Supabase password recovery link includes type=recovery in the hash
        const hash = window.location.hash;
        if (hash.includes('type=recovery')) {
            setHasToken(true);
            
            // Because HashRouter puts its own hash before the tokens, Supabase may not parse them automatically.
            // Let's parse them manually if present.
            try {
                const parts = hash.split('#');
                for (const part of parts) {
                    if (part.includes('access_token=') && part.includes('refresh_token=')) {
                        const params = new URLSearchParams(part);
                        const access_token = params.get('access_token');
                        const refresh_token = params.get('refresh_token');
                        
                        if (access_token && refresh_token) {
                            supabase.auth.setSession({ access_token, refresh_token });
                            break;
                        }
                    }
                }
            } catch (err) {
                console.error("Erro ao analisar hash da URL:", err);
            }
        }
    }, []);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!hasToken) {
            setError("Token de recuperação inválido ou ausente.");
            return;
        }
        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }
        
        const hasUpperCase = /[A-Z]/.test(password);
        const hasNumber = /\d/.test(password);
        const hasMinLength = password.length >= 8;

        if (!hasMinLength || !hasUpperCase || !hasNumber) {
            setError('A senha deve ter no mínimo 8 caracteres, incluindo uma letra maiúscula e um número.');
            return;
        }

        setLoading(true);
        setMessage('');

        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
            setError(error.message);
        } else {
            setMessage('Sua senha foi atualizada com sucesso! Redirecionando para o login...');
            setTimeout(() => navigate('/login'), 3000);
        }
        setLoading(false);
    };
    
    if (!hasToken) {
        return (
             <AuthLayout>
                <Card>
                    <CardHeader><h1 className="text-2xl font-bold text-white">Token Inválido</h1></CardHeader>
                    <CardContent className="text-center text-red-400">
                        <p>O link de recuperação de senha é inválido ou expirou. Por favor, solicite um novo link.</p>
                    </CardContent>
                </Card>
            </AuthLayout>
        )
    }

    return (
        <AuthLayout>
            <Card>
                <CardHeader>
                    <h1 className="text-2xl font-bold text-white">Definir Nova Senha</h1>
                    <p className="text-gray-400">Crie uma nova senha para sua conta.</p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">Nova Senha</Label>
                            <Input id="password" type="password" placeholder="********" value={password} onChange={(e) => setPassword(e.target.value)} required icon={<KeyIcon />} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                            <Input id="confirm-password" type="password" placeholder="********" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required icon={<KeyIcon />} />
                        </div>
                        
                        {message && <p className="text-sm text-green-400 text-center">{message}</p>}
                        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                        <Button type="submit" isLoading={loading} disabled={!!message}>Atualizar Senha</Button>
                    </form>
                </CardContent>
            </Card>
        </AuthLayout>
    );
};

export default UpdatePassword;