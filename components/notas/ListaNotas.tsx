import React from 'react';
import { NotaFiscal } from '../../types';
import NotaCard from './NotaCard';
import { FileTextIcon, PlusIcon } from '../../lib/icons';
import { Button } from '../ui/Button';

interface ListaNotasProps {
    notas: NotaFiscal[];
    loading: boolean;
    onSelectNota: (nota: NotaFiscal) => void;
    onAddNew: () => void;
}

const ListaNotas: React.FC<ListaNotasProps> = ({ notas, loading, onSelectNota, onAddNew }) => {
    if (loading) {
        return <p className="text-center text-gray-400 py-8">Carregando notas...</p>;
    }

    if (notas.length === 0) {
        return (
            <div className="text-center py-12 px-6 bg-brand-dark-900/50 rounded-2xl border-2 border-dashed border-gray-700">
                <div className="mx-auto p-3 bg-gray-800 rounded-full w-fit mb-4">
                    <FileTextIcon className="h-8 w-8 text-brand-blue-500" />
                </div>
                <h3 className="text-lg font-semibold text-white">Nenhuma nota fiscal encontrada</h3>
                <p className="mt-1 text-sm text-gray-400">Você ainda não tem registros. Adicione uma nota manualmente ou use a IA.</p>
                <div className="mt-6">
                    <Button onClick={onAddNew}>
                        <PlusIcon className="h-4 w-4 mr-2"/>
                        Novo Registro
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {notas.map(nota => (
                <NotaCard key={nota.id} nota={nota} onSelect={onSelectNota} />
            ))}
        </div>
    );
};

export default ListaNotas;