
import React from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const VerifyEmail: React.FC = () => {
    return (
        <AuthLayout>
            <Card>
                <CardHeader>
                    <h1 className="text-2xl font-bold text-white">Verifique seu Email</h1>
                </CardHeader>
                <CardContent className="text-center text-gray-300">
                    <p className="mb-6">
                        Um link de verificação foi enviado para o seu endereço de email. Por favor, clique no link para ativar sua conta.
                    </p>
                    <Link to="/login">
                        <Button>Ir para o Login</Button>
                    </Link>
                </CardContent>
            </Card>
        </AuthLayout>
    );
};

export default VerifyEmail;
