import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { Card, CardHeader, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { supabase } from '../lib/supabaseClient';

// FIX: Use self-closing tags for SVG elements to be compliant with JSX syntax.
const UserPlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-white"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" x2="19" y1="8" y2="14" /><line x1="22" x2="16" y1="11" y2="11" /></svg>
);
const MailIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>);
const KeyIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>);


const Register: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [passwordValidations, setPasswordValidations] = useState({
        minLength: false,
        upperCase: false,
        number: false,
    });

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newPassword = e.target.value;
        setPassword(newPassword);
        setPasswordValidations({
            minLength: newPassword.length >= 8,
            upperCase: /[A-Z]/.test(newPassword),
            number: /\d/.test(newPassword),
        });
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

        const { minLength, upperCase, number } = passwordValidations;
        if (!minLength || !upperCase || !number) {
            setError('A senha deve atender a todos os requisitos de segurança.');
            return;
        }

        setLoading(true);
        setError(null);
        
        const { error } = await supabase.auth.signUp({ email, password });
        
        if (error) {
            setError(error.message);
        } else {
            navigate('/verify-email');
        }
        setLoading(false);
    };
    
    // FIX: Use self-closing tag for SVG element to be compliant with JSX syntax.
    const CheckIcon = ({isValid}: {isValid: boolean}) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`mr-2 transition-colors ${isValid ? 'text-green-400' : 'text-gray-500'}`}>
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );

    return (
        <AuthLayout>
            <Card>
                <CardHeader>
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-blue-500">
                        <UserPlusIcon />
                    </div>
                    <h1 className="text-3xl font-bold text-white">Registre-se</h1>
                    <p className="text-gray-400">Crie sua conta no JPL Conecta</p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleRegister} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required icon={<MailIcon />} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Senha</Label>
                            <Input id="password" type="password" placeholder="Crie sua senha" value={password} onChange={handlePasswordChange} required icon={<KeyIcon />} />
                            <div className="pt-2 pl-1 space-y-1">
                                <p className={`flex items-center text-xs transition-colors ${passwordValidations.minLength ? 'text-green-400' : 'text-gray-400'}`}>
                                    <CheckIcon isValid={passwordValidations.minLength} /> Mínimo 8 caracteres
                                </p>
                                <p className={`flex items-center text-xs transition-colors ${passwordValidations.upperCase ? 'text-green-400' : 'text-gray-400'}`}>
                                    <CheckIcon isValid={passwordValidations.upperCase} /> Pelo menos 1 letra maiúscula
                                </p>
                                <p className={`flex items-center text-xs transition-colors ${passwordValidations.number ? 'text-green-400' : 'text-gray-400'}`}>
                                    <CheckIcon isValid={passwordValidations.number} /> Pelo menos 1 número
                                </p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirmar Senha</Label>
                            <Input id="confirm-password" type="password" placeholder="Digite a senha novamente" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required icon={<KeyIcon />} />
                        </div>
                        {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                        <Button type="submit" isLoading={loading}>Registrar</Button>
                    </form>
                </CardContent>
                <CardFooter>
                    Já tem uma conta?{' '}
                    <Link to="/login" className="font-semibold text-brand-blue-500 hover:underline">
                        Fazer login
                    </Link>
                </CardFooter>
            </Card>
        </AuthLayout>
    );
};

export default Register;