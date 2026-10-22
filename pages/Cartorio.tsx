import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { SearchIcon, PlusIcon, BuildingIcon, FileTextIcon, MoreVerticalIcon, EditIcon, Trash2Icon, DollarSignIcon } from '../lib/icons';
import { useToast } from '../contexts/ToastContext';
import { CartorioRecord } from '../types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/DropdownMenu';
import { Skeleton } from '../components/ui/Skeleton';
import ConfirmationModal from '../components/historico/ConfirmationModal';
import CartorioModal from '../components/cartorio/CartorioModal';
import { formatApiError } from '../lib/handleError';
import { logAuditAction } from '../lib/auditLogger';
import { formatCurrency, openStorageFile } from '../lib/utils';

const PAGE_SIZE = 10;

const Cartorio: React.FC = () => {
    const { user, profile } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [page, setPage] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<CartorioRecord | null>(null);

    React.useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(0);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    // Fetch Projects using a double query to get only those actually used
    const { data: projectsData } = useQuery({
        queryKey: ['filter_projects', profile?.company_id],
        queryFn: async () => {
            if (!profile?.company_id) return [];
            
            const { data: records, error: recordsError } = await supabase
                .from('cartorio_records')
                .select('project_id')
                .eq('company_id', profile.company_id)
                .not('project_id', 'is', null);
                
            if (recordsError) throw recordsError;
            
            const projectIds = [...new Set(records?.map(r => r.project_id).filter(Boolean))];
            
            if (projectIds.length === 0) return [];

            const { data, error } = await supabase
                .from('projects')
                .select('id, name')
                .in('id', projectIds)
                .order('name');
                
            if (error) throw error;
            return data || [];
        },
        enabled: !!profile?.company_id
    });

    // Fetch Summary
    const { data: summaryData, isLoading: isLoadingSummary } = useQuery({
        queryKey: ['cartorioSummary', profile?.company_id, debouncedSearch, selectedProjectId],
        queryFn: async () => {
            let query = supabase.from('cartorio_records').select('amount', { count: 'exact' }).eq('company_id', profile!.company_id!);
            if (debouncedSearch) {
                query = query.ilike('description', `%${debouncedSearch}%`);
            }
            if (selectedProjectId !== 'all') {
                query = query.eq('project_id', selectedProjectId);
            }
            const { data, count, error } = await query.range(0, 9999);
            if (error) throw error;
            const totalValue = (data || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
            return { count: count || 0, totalValue };
        },
        enabled: !!profile?.company_id,
        placeholderData: (prev) => prev
    });

    // Fetch List
    const { data, isLoading, isError, error } = useQuery<{ data: CartorioRecord[], count: number }>({
        queryKey: ['cartorio_records', profile?.company_id, page, debouncedSearch, selectedProjectId],
        queryFn: async () => {
            let query = supabase.from('cartorio_records').select('*', { count: 'exact' }).eq('company_id', profile!.company_id!);
            if (debouncedSearch) {
                query = query.ilike('description', `%${debouncedSearch}%`);
            }
            if (selectedProjectId !== 'all') {
                query = query.eq('project_id', selectedProjectId);
            }
            const from = page * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;
            const res = await query.order('issue_date', { ascending: false }).range(from, to);
            if (res.error) throw res.error;
            return { data: res.data as CartorioRecord[], count: res.count ?? 0 };
        },
        enabled: !!profile?.company_id,
        placeholderData: (prev) => prev
    });

    const totalPages = useMemo(() => (data?.count ? Math.ceil(data.count / PAGE_SIZE) : 0), [data?.count]);

    const deleteMutation = useMutation({
        mutationFn: async (record: CartorioRecord) => {
            const filesToDelete = [];
            if (record.file_url) filesToDelete.push(record.file_url);
            if (record.document_file_url) filesToDelete.push(record.document_file_url);
            
            if (filesToDelete.length > 0) {
                const { error: storageError } = await supabase.storage.from('cartorio_docs').remove(filesToDelete);
                if (storageError && !storageError.message.toLowerCase().includes('not found') && !storageError.message.toLowerCase().includes('bucket not found')) {
                     console.error("Storage error on delete:", storageError);
                }
            }

            const { error } = await supabase.from('cartorio_records').delete().eq('id', record.id);
            if (error) throw error;
            
            await logAuditAction(
                profile?.company_id,
                user?.email,
                'EXCLUIR',
                `Cartório/Imóvel: ${record.description}`,
                { id: record.id, amount: record.amount }
            );
            
            return record.id;
        },
        onSuccess: () => {
            toast({ title: 'Sucesso', description: 'Registro excluído.' });
            queryClient.invalidateQueries({ queryKey: ['cartorio_records'] });
            queryClient.invalidateQueries({ queryKey: ['cartorioSummary'] });
            queryClient.invalidateQueries({ queryKey: ['cartorio_records_dashboard'] });
        },
        onError: (err) => {
            toast({ title: 'Erro', description: formatApiError(err), variant: 'destructive' });
        },
        onSettled: () => {
            setIsDeleteModalOpen(false);
            setSelectedRecord(null);
        }
    });

    const handleViewFile = async (path: string) => {
        try {
            await openStorageFile(path, 'cartorio_docs');
        } catch (err) {
            toast({ 
                title: 'Erro ao acessar arquivo', 
                description: 'Verifique se o bucket "cartorio_docs" é privado e tem as políticas de RLS.', 
                variant: 'destructive' 
            });
        }
    };

    const handleCreate = () => {
        setSelectedRecord(null);
        setIsEditModalOpen(true);
    };

    const handleEdit = (record: CartorioRecord) => {
        setSelectedRecord(record);
        setIsEditModalOpen(true);
    };

    const handleDelete = (record: CartorioRecord) => {
        setSelectedRecord(record);
        setIsDeleteModalOpen(true);
    };

    return (
        <div className="space-y-6 animate-in fade-in-50">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-center md:justify-between gap-4 text-center md:text-left">
                <div className='flex flex-col sm:flex-row items-center gap-3'>
                    <BuildingIcon className="h-8 w-8 text-brand-blue-500" />
                    <div>
                        <h1 className="text-2xl font-bold text-white">Cartório e Imóveis</h1>
                        <p className="text-gray-400 text-sm">Registre gastos com documentação e imóveis.</p>
                    </div>
                </div>
                <Button onClick={handleCreate} className="w-full sm:w-auto bg-brand-blue-600 hover:bg-brand-blue-700 text-white">
                    <PlusIcon className="h-4 w-4 mr-2" /> Novo Registro
                </Button>
            </div>

            {/* Resumo & Filtro Desktop */}
            <div className="flex flex-col md:flex-row justify-between items-center md:items-center gap-4">
                <div className="bg-brand-dark-900 p-5 rounded-2xl shadow-2xl shadow-black/50 flex items-center gap-4 w-full md:w-auto justify-center md:justify-start">
                    <div className="flex-shrink-0 p-3 rounded-full bg-brand-blue-500/10">
                        <DollarSignIcon className="h-6 w-6 text-brand-blue-500" />
                    </div>
                    <div className="text-center md:text-left">
                        <p className="text-sm text-gray-400">Total (Filtro)</p>
                        {isLoadingSummary ? (
                            <Skeleton className="h-8 w-32 mt-1" />
                        ) : (
                            <p className="text-2xl font-bold text-white truncate">{formatCurrency(summaryData?.totalValue || 0)}</p>
                        )}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-[60%] lg:w-[40%]">
                    <div className="w-full sm:w-1/2">
                        <select
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            className="w-full bg-brand-dark-900 border-gray-800 text-white h-10 px-3 py-2 rounded-md font-medium text-sm focus:border-brand-blue-500 focus:outline-none"
                        >
                            <option value="all">Todas as Obras</option>
                            {projectsData?.map(project => (
                                <option key={project.id} value={project.id}>
                                    {project.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="relative flex-grow w-full sm:w-1/2">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Buscar por descrição..."
                            className="bg-brand-dark-900 border-gray-800 text-white pl-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Conteúdo */}
            {isLoading && !data ? (
                <div className="space-y-4">
                    <Skeleton className="h-20 w-full rounded-2xl" />
                    <Skeleton className="h-20 w-full rounded-2xl" />
                    <Skeleton className="h-20 w-full rounded-2xl" />
                </div>
            ) : isError ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8 text-center text-red-400">
                    <p className="font-medium">Erro ao carregar registros.</p>
                    <p className="text-sm mt-1">{(error as Error)?.message || 'Tente novamente.'}</p>
                </div>
            ) : !data || data.data.length === 0 ? (
                <div className="text-center py-16 px-6 bg-brand-dark-900/50 rounded-2xl border border-dashed border-gray-700">
                    <div className="mx-auto p-4 bg-gray-800/50 rounded-full w-fit mb-4">
                        <DocumentOutlineIcon className="h-10 w-10 text-brand-blue-500 opacity-80" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">Nenhum registro encontrado</h3>
                    <p className="text-sm text-gray-400 max-w-md mx-auto">
                        {debouncedSearch 
                            ? "Nenhum resultado corresponde à sua busca." 
                            : "Você ainda não cadastrou nenhum documento de cartório ou imóvel."
                        }
                    </p>
                     {!debouncedSearch && (
                        <div className="mt-6">
                            <Button onClick={handleCreate}>
                                <PlusIcon className="h-4 w-4 mr-2"/>
                                Cadastrar Primeiro Registro
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-brand-dark-900 border border-gray-800 rounded-2xl shadow-xl overflow-hidden">
                    {/* View Desktop - Tabela */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-400">
                            <thead className="text-xs text-gray-400 uppercase bg-gray-800/50 border-b border-gray-800">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Descrição</th>
                                    <th className="px-6 py-4 font-semibold">Data</th>
                                    <th className="px-6 py-4 font-semibold text-center">Documento</th>
                                    <th className="px-6 py-4 font-semibold text-center">Comprovante</th>
                                    <th className="px-6 py-4 font-semibold text-right">Valor</th>
                                    <th className="px-6 py-4 font-semibold text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {data.data.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-800/40 transition-colors">
                                        <td className="px-6 py-4">
                                            <p className="font-medium text-white truncate max-w-[300px]" title={item.description}>{item.description}</p>
                                        </td>
                                        <td className="px-6 py-4 text-gray-300">
                                            {new Date(item.issue_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {item.document_file_url ? (
                                                <Button 
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => { e.stopPropagation(); handleViewFile(item.document_file_url!); }}
                                                    className="w-full min-w-[90px] mx-auto text-brand-blue-400 hover:text-brand-blue-300 hover:bg-brand-blue-900/20"
                                                >
                                                    <FileTextIcon className="h-4 w-4 mr-1.5" /> Ver Doc
                                                </Button>
                                            ) : (
                                                <span className="text-gray-500 italic text-xs block text-center">Sem anexo</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {item.file_url ? (
                                                <Button 
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => { e.stopPropagation(); handleViewFile(item.file_url!); }}
                                                    className="w-full min-w-[90px] mx-auto text-brand-blue-400 hover:text-brand-blue-300 hover:bg-brand-blue-900/20"
                                                >
                                                    <FileTextIcon className="h-4 w-4 mr-1.5" /> Ver Recibo
                                                </Button>
                                            ) : (
                                                <span className="text-gray-500 italic text-xs block text-center">Sem anexo</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right font-semibold text-white">
                                            {formatCurrency(item.amount)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-700">
                                                        <MoreVerticalIcon className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-32 bg-brand-dark-900 border-gray-800">
                                                    <DropdownMenuItem onSelect={() => handleEdit(item)} className="cursor-pointer hover:bg-brand-dark-800">
                                                        <EditIcon className="h-4 w-4 mr-2" /> Editar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => handleDelete(item)} className="cursor-pointer text-red-400 hover:text-red-300 hover:bg-red-900/20">
                                                        <Trash2Icon className="h-4 w-4 mr-2" /> Excluir
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* View Mobile - Cards */}
                    <div className="md:hidden flex flex-col divide-y divide-gray-800">
                        {data.data.map(item => (
                            <div key={item.id} className="p-4 flex flex-col gap-3 hover:bg-gray-800/40 transition-colors">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="flex-grow">
                                        <h3 className="font-medium text-white text-base leading-tight break-words">{item.description}</h3>
                                        <p className="text-gray-400 text-xs mt-1">
                                            {new Date(item.issue_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                    <div className="text-right flex flex-col items-end gap-1 flex-shrink-0">
                                         <p className="font-semibold text-white">{formatCurrency(item.amount)}</p>
                                         <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-700">
                                                    <MoreVerticalIcon className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-32 bg-brand-dark-900 border-gray-800">
                                                <DropdownMenuItem onSelect={() => handleEdit(item)} className="cursor-pointer hover:bg-brand-dark-800">
                                                    <EditIcon className="h-4 w-4 mr-2" /> Editar
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => handleDelete(item)} className="cursor-pointer text-red-400 hover:text-red-300 hover:bg-red-900/20">
                                                    <Trash2Icon className="h-4 w-4 mr-2" /> Excluir
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                                
                                {/* Anexos mobile */}
                                <div className="flex gap-2 pt-2 w-full">
                                    {item.document_file_url && (
                                        <Button 
                                            variant="outline" 
                                            onClick={(e) => { e.stopPropagation(); handleViewFile(item.document_file_url!); }}
                                            className="flex-1 border-gray-700 bg-brand-dark-800 hover:bg-brand-dark-700 text-gray-300 h-10 text-xs font-normal"
                                        >
                                            <FileTextIcon className="h-4 w-4 mr-2" /> Ver Doc
                                        </Button>
                                    )}
                                    {item.file_url && (
                                        <Button 
                                            variant="outline" 
                                            onClick={(e) => { e.stopPropagation(); handleViewFile(item.file_url!); }}
                                            className="flex-1 border-gray-700 bg-brand-dark-800 hover:bg-brand-dark-700 text-gray-300 h-10 text-xs font-normal"
                                        >
                                            <FileTextIcon className="h-4 w-4 mr-2" /> Ver Recibo
                                        </Button>
                                    )}
                                    {!item.document_file_url && !item.file_url && (
                                        <p className="text-gray-500 italic text-xs w-full text-center py-1">Sem anexos</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 pb-24 md:pb-2 relative z-10">
                    <p className="text-sm text-gray-400 hidden sm:block">
                        Mostrando página <span className="font-medium text-white">{page + 1}</span> de <span className="font-medium text-white">{totalPages}</span>
                    </p>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                        <Button
                            variant="outline"
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="bg-brand-dark-900 border-gray-700 hover:bg-brand-dark-800 w-auto"
                        >
                            Anterior
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="bg-brand-dark-900 border-gray-700 hover:bg-brand-dark-800 w-auto"
                        >
                            Próxima
                        </Button>
                    </div>
                </div>
            )}

            {/* Modals */}
            {isEditModalOpen && (
                <CartorioModal 
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    record={selectedRecord}
                />
            )}
            
             <ConfirmationModal 
                isOpen={isDeleteModalOpen} 
                onClose={() => setIsDeleteModalOpen(false)} 
                onConfirm={() => selectedRecord && deleteMutation.mutate(selectedRecord)}
                title={`Confirmar Exclusão`}
                description={<>Você tem certeza que deseja excluir o registro de <strong>{selectedRecord?.description}</strong>?</>} 
                confirmText="Excluir"
                isLoading={deleteMutation.isPending}
            />
        </div>
    );
};

// Generic placeholder icon if one string fails
const DocumentOutlineIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
);

export default Cartorio;
