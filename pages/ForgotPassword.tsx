import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { Card, CardHeader, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { supabase } from '../lib/supabaseClient';

// FIX: Use self-closing tags for SVG elements to be compliant with JSX syntax.
const MailIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>);

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');

        // Use a more robust redirectTo URL that is not dependent on the current pathname.
        const redirectTo = `${window.location.origin}/#/update-password`;

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: redirectTo,
        });

        if (error) {
            setError('Ocorreu um erro ao enviar o email de recuperação.');
        } else {
            setMessage('Se uma conta com este email existir, um link de recuperação foi enviado.');
        }
        setLoading(false);
    };

    return (
        <AuthLayout>
            <Card>
                <CardHeader>
                    <h1 className="text-2xl font-bold text-white">Recuperação de Senha</h1>
                    <p className="text-gray-400">Insira seu email para receber o link de recuperação.</p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handlePasswordReset} className="space-y-4">
                         <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required icon={<MailIcon />} />
                        </div>
                        {message && <p className="text-sm text-green-400 text-center">{message}</p>}
                        {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                        <Button type="submit" isLoading={loading} disabled={!!message}>Enviar Link</Button>
                    </form>
                </CardContent>
                 <CardFooter>
                    Lembrou sua senha?{' '}
                    <Link to="/login" className="font-semibold text-brand-blue-500 hover:underline">
                        Fazer login
                    </Link>
                </CardFooter>
            </Card>
        </AuthLayout>
    );
};

export default ForgotPassword;