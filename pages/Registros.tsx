
import React, { useState, useMemo, lazy, Suspense } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { Supplier, Project, Collaborator, CATEGORIA_NOTA_ENUM, PROJECT_STATUSES, SERVICE_STATUSES, TASK_STATUSES, TASK_PRIORITIES } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { PlusIcon, SearchIcon, BuildingIcon, ConstructionIcon, UsersIcon, PlusSquareIcon, UserCircleIcon, KeyRoundIcon, Trash2Icon, AlertTriangleIcon, ClipboardListIcon, FileTextIcon, MoreVerticalIcon, EditIcon, LogOutIcon } from '../lib/icons';
import { useToast } from '../contexts/ToastContext';
import SupplierCard from '../components/registros/SupplierCard';
import ProjectCard from '../components/registros/ProjectCard';
import CollaboratorCard from '../components/registros/CollaboratorCard';
import ConfirmationModal from '../components/historico/ConfirmationModal';
import { formatApiError } from '../lib/handleError';
import { logAuditAction } from '../lib/auditLogger';
import { formatCnpj } from '../lib/utils';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/DropdownMenu';
import { StarRating } from '../components/ui/StarRating';
import { Badge } from '../components/ui/Badge';


// Import skeletons
import SupplierCardSkeleton from '../components/registros/SupplierCardSkeleton';
import ProjectCardSkeleton from '../components/registros/ProjectCardSkeleton';
import CollaboratorCardSkeleton from '../components/registros/CollaboratorCardSkeleton';

const SupplierModal = lazy(() => import('../components/registros/SupplierModal'));
const ProjectModal = lazy(() => import('../components/registros/ProjectModal'));
const CollaboratorModal = lazy(() => import('../components/registros/CollaboratorModal'));


const PAGE_SIZE = 9;

// --- Generic Fetcher ---
const fetchData = async (tableName: string, companyId: string, page: number, searchTerm: string) => {
    let query = (supabase as any).from(tableName).select('*', { count: 'exact' }).eq('company_id', companyId);
    if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
    }
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error, count } = await query.order('name', { ascending: true }).range(from, to);
    if (error) throw error;
    return { data, count: count ?? 0 };
};


// --- Generic List Component ---
interface ListSectionProps<T extends { id: string; name: string }> {
  queryKey: string;
  tableName: string;
  CardComponent: React.FC<{ [key: string]: any; onEdit: (item: T) => void; onDelete: (item: T) => void }>;
  SkeletonComponent: React.FC;
  ModalComponent: React.FC<{ isOpen: boolean; onClose: () => void; [key: string]: any }>;
  entityName: string; 
  entityNamePlural: string;
  propName: string;
  IconComponent: React.FC<React.SVGProps<SVGSVGElement>>;
  tableHeaders: string[];
  renderTableRow: (item: T, onEdit: (item: T) => void, onDelete: (item: T) => void) => React.ReactNode;
}

const ListSection = <T extends { id: string; name: string }>({
  queryKey,
  tableName,
  CardComponent,
  SkeletonComponent,
  ModalComponent,
  entityName,
  entityNamePlural,
  propName,
  IconComponent,
  tableHeaders,
  renderTableRow
}: ListSectionProps<T>) => {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  const [isModalOpen, setModalOpen] = useState(false);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<T | null>(null);

  React.useEffect(() => {
      const handler = setTimeout(() => {
          setPage(0);
          setDebouncedSearchTerm(searchTerm);
      }, 500);
      return () => clearTimeout(handler);
  }, [searchTerm]);


  const { data, isLoading, isError, error } = useQuery<{ data: T[]; count: number }>({
    queryKey: [queryKey, profile?.company_id, page, debouncedSearchTerm],
    queryFn: () => fetchData(tableName, profile!.company_id!, page, debouncedSearchTerm),
    enabled: !!profile?.company_id,
    placeholderData: (previousData) => previousData,
  });

  const totalPages = useMemo(() => (data?.count ? Math.ceil(data.count / PAGE_SIZE) : 0), [data?.count]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
        const { error } = await (supabase as any).from(tableName).delete().eq('id', id);
        if (error) throw error;
        
        // Log action (using entityName from props to record which type of record was deleted)
        const recordName = selectedItem?.name || id;
        logAuditAction(
            profile?.company_id,
            user?.email,
            'EXCLUIR',
            `${entityName}: ${recordName}`,
            { id, entity: entityName }
        );
    },
    onSuccess: () => {
        toast({ title: "Sucesso!", description: `${entityName} excluído com sucesso.` });
        queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (err) => {
        const errorMessage = formatApiError(err);
        toast({ variant: 'destructive', title: 'Erro!', description: errorMessage });
    },
    onSettled: () => {
        setDeleteModalOpen(false);
        setSelectedItem(null);
    }
  });


  const handleEdit = (item: T) => {
    setSelectedItem(item);
    setModalOpen(true);
  };

  const handleDelete = (item: T) => {
    setSelectedItem(item);
    setDeleteModalOpen(true);
  };
  
  const handleCreate = () => {
    setSelectedItem(null);
    setModalOpen(true);
  };
  
  const cardProps = (item: T) => ({
    [propName]: item,
    onEdit: handleEdit,
    onDelete: handleDelete,
  });
  
  const modalProps = {
    isOpen: isModalOpen,
    onClose: () => setModalOpen(false),
    [propName]: selectedItem,
  };
  
  return (
    <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-grow">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                    placeholder={`Buscar ${entityNamePlural.toLowerCase()} por nome...`}
                    className="pl-9"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <Button onClick={handleCreate} className="w-full sm:w-auto">
                <PlusIcon className="h-4 w-4 mr-2"/>
                Novo(a) {entityName}
            </Button>
        </div>
        
        {isLoading && !data ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => <SkeletonComponent key={i} />)}
            </div>
        ) : 
         isError ? <p className="text-center text-red-500 py-8">Erro: {(error as Error)?.message}</p> :
         !data || data.data.length === 0 ? (
            <div className="text-center py-12 px-6 bg-brand-dark-900/50 rounded-2xl border-2 border-dashed border-gray-700 mt-4">
                <div className="mx-auto p-3 bg-gray-800 rounded-full w-fit mb-4">
                    <IconComponent className="h-8 w-8 text-brand-blue-500" />
                </div>
                <h3 className="text-lg font-semibold text-white">Nenhum(a) {entityName.toLowerCase()} encontrado(a)</h3>
                <p className="mt-1 text-sm text-gray-400">Comece cadastrando um(a) novo(a) {entityName.toLowerCase()}.</p>
                <div className="mt-6">
                    <Button onClick={handleCreate}>
                        <PlusIcon className="h-4 w-4 mr-2"/>
                        Novo(a) {entityName}
                    </Button>
                </div>
            </div>
         ) :
        <div className="space-y-4">
            {/* Mobile View: Cards */}
            <div className="md:hidden grid grid-cols-1 gap-4">
                {data.data.map(item => (
                    <CardComponent key={item.id} {...cardProps(item)} />
                ))}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block overflow-hidden rounded-xl border border-gray-800 bg-brand-dark-900 shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-800/50 border-b border-gray-800">
                            <tr>
                                {tableHeaders.map((header, idx) => (
                                    <th key={idx} className={`px-6 py-4 font-medium ${idx === tableHeaders.length - 1 ? 'text-center' : ''}`}>{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {data.data.map(item => renderTableRow(item, handleEdit, handleDelete))}
                        </tbody>
                    </table>
                </div>
            </div>

            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 pt-4 pb-20 md:pb-0 relative z-10">
                    <Button variant="outline" className="w-auto px-4" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Anterior</Button>
                    <span className="text-sm">Página {page + 1} de {totalPages}</span>
                    <Button variant="outline" className="w-auto px-4" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Próximo</Button>
                </div>
            )}
        </div>
        }
        
        <Suspense fallback={<div className="text-center p-8">Carregando...</div>}>
            {isModalOpen && <ModalComponent {...modalProps} />}
        </Suspense>
        <ConfirmationModal 
            isOpen={isDeleteModalOpen} 
            onClose={() => setDeleteModalOpen(false)} 
            onConfirm={() => selectedItem && deleteMutation.mutate(selectedItem.id)}
            title={`Confirmar Exclusão`}
            description={<>Tem certeza que deseja excluir <strong>{selectedItem?.name}</strong>? Esta ação não pode ser desfeita.</>} 
            confirmText="Excluir"
            isLoading={deleteMutation.isPending}
        />
    </div>
  );
};

// --- Helper for Table Rows ---
const ActionCell = ({ onEdit, onDelete }: { onEdit: () => void, onDelete: () => void }) => (
    <td className="px-6 py-4 whitespace-nowrap text-center">
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-8 w-8 border-gray-700 hover:bg-gray-700"
                >
                    <MoreVerticalIcon className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onEdit}>
                    <EditIcon className="h-4 w-4 mr-2" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onDelete} className="text-red-500 focus:text-red-500">
                    <Trash2Icon className="h-4 w-4 mr-2" /> Excluir
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    </td>
);

const InfoBox: React.FC<{icon: React.ReactNode, label: string, value: string}> = ({ icon, label, value }) => (
    <div className="flex items-center gap-4 p-4 bg-brand-dark-900 rounded-xl border border-gray-800 shadow-sm">
        <div className="flex-shrink-0 p-2.5 rounded-xl bg-brand-blue-500/10 border border-brand-blue-500/20">
            {icon}
        </div>
        <div className="min-w-0">
            <p className="text-xs text-gray-400">{label}</p>
            <p className="text-sm font-semibold text-white truncate" title={value}>{value}</p>
        </div>
    </div>
);


const Registros: React.FC = () => {
    const { user, profile, signOut } = useAuth();
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

    const formatDate = (dateString: string | null | undefined) => {
        if (!dateString) return 'Vitalícia';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Data inválida';
        return date.toLocaleDateString('pt-BR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
    };

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        icon={PlusSquareIcon}
        title="Cadastros Gerais"
        description="Gerencie fornecedores, obras e colaboradores."
        actions={
          <Button 
              variant="destructive" 
              onClick={() => setIsLogoutModalOpen(true)} 
              className="bg-red-900/50 hover:bg-red-800 border border-red-800 text-red-100"
          >
              <LogOutIcon className="h-4 w-4 mr-2" />
              Sair da Conta
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <InfoBox
          icon={<UserCircleIcon className="h-5 w-5 text-brand-blue-400" />}
          label="Email do Usuário"
          value={user?.email || 'N/A'}
        />
        <InfoBox
          icon={<BuildingIcon className="h-5 w-5 text-brand-blue-400" />}
          label="Empresa"
          value={profile?.companies?.name || 'Não definida'}
        />
        <InfoBox
          icon={<KeyRoundIcon className="h-5 w-5 text-brand-blue-400" />}
          label="Validade da Chave"
          value={formatDate(profile?.company_keys?.expires_at)}
        />
      </div>

      <Tabs defaultValue="suppliers" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 md:w-fit md:inline-grid md:min-w-[460px]">
          <TabsTrigger value="suppliers"><BuildingIcon className="w-4 h-4 mr-2 hidden sm:inline"/>Fornecedores</TabsTrigger>
          <TabsTrigger value="projects"><ConstructionIcon className="w-4 h-4 mr-2 hidden sm:inline"/>Obras</TabsTrigger>
          <TabsTrigger value="collaborators"><UsersIcon className="w-4 h-4 mr-2 hidden sm:inline"/>Colaboradores</TabsTrigger>
        </TabsList>
        
        <TabsContent value="suppliers">
            <ListSection<Supplier>
                queryKey="suppliers"
                tableName="suppliers"
                CardComponent={SupplierCard}
                SkeletonComponent={SupplierCardSkeleton}
                ModalComponent={SupplierModal}
                entityName="Fornecedor"
                entityNamePlural="Fornecedores"
                propName="supplier"
                IconComponent={BuildingIcon}
                tableHeaders={['Nome / Razão Social', 'CNPJ', 'Vendedor', 'Contato', 'Avaliação', 'Ações']}
                renderTableRow={(supplier, onEdit, onDelete) => (
                    <tr 
                        key={supplier.id} 
                        className="hover:bg-gray-800/30 transition-colors"
                    >
                        <td className="px-6 py-4 font-medium text-white">{supplier.name}</td>
                        <td className="px-6 py-4 text-gray-300">{formatCnpj(supplier.cnpj) || '-'}</td>
                        <td className="px-6 py-4 text-gray-300">{supplier.seller || '-'}</td>
                        <td className="px-6 py-4 text-gray-300">{supplier.seller_contact || '-'}</td>
                        <td className="px-6 py-4">
                            <div className="flex gap-4">
                                <div className="flex flex-col"><span className="text-[10px] text-gray-500 uppercase">Serviço</span><StarRating rating={supplier.service_rating} className="scale-75 origin-left"/></div>
                                <div className="flex flex-col"><span className="text-[10px] text-gray-500 uppercase">Entrega</span><StarRating rating={supplier.delivery_rating} className="scale-75 origin-left"/></div>
                            </div>
                        </td>
                        <ActionCell onEdit={() => onEdit(supplier)} onDelete={() => onDelete(supplier)} />
                    </tr>
                )}
            />
        </TabsContent>
        
        <TabsContent value="projects">
            <ListSection<Project>
                queryKey="projects"
                tableName="projects"
                CardComponent={ProjectCard}
                SkeletonComponent={ProjectCardSkeleton}
                ModalComponent={ProjectModal}
                entityName="Obra"
                entityNamePlural="Obras"
                propName="project"
                IconComponent={ConstructionIcon}
                tableHeaders={['Nome da Obra', 'Status', 'Mestre de Obra', 'Período', 'Localização', 'Ações']}
                renderTableRow={(project, onEdit, onDelete) => (
                    <tr 
                        key={project.id} 
                        className="hover:bg-gray-800/30 transition-colors"
                    >
                        <td className="px-6 py-4 font-medium text-white">{project.name}</td>
                        <td className="px-6 py-4">
                            <Badge variant="outline" className={
                                project.status === 'Concluído' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                                project.status === 'Em Andamento' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                            }>
                                {project.status}
                            </Badge>
                        </td>
                        <td className="px-6 py-4 text-gray-300">{project.manager || '-'}</td>
                        <td className="px-6 py-4 text-xs text-gray-400 whitespace-nowrap">
                            {project.start_date ? new Date(project.start_date).toLocaleDateString('pt-BR') : 'N/A'} - 
                            {project.end_date ? new Date(project.end_date).toLocaleDateString('pt-BR') : '...'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-400 max-w-xs truncate" title={`${project.address_city || ''} - ${project.address_state || ''}`}>
                            {project.address_city && project.address_state ? `${project.address_city} - ${project.address_state}` : '-'}
                        </td>
                        <ActionCell onEdit={() => onEdit(project)} onDelete={() => onDelete(project)} />
                    </tr>
                )}
            />
        </TabsContent>
        
        <TabsContent value="collaborators">
            <ListSection<Collaborator>
                queryKey="collaborators"
                tableName="collaborators"
                CardComponent={CollaboratorCard}
                SkeletonComponent={CollaboratorCardSkeleton}
                ModalComponent={CollaboratorModal}
                entityName="Colaborador"
                entityNamePlural="Colaboradores"
                propName="collaborator"
                IconComponent={UsersIcon}
                tableHeaders={['Nome', 'Função', 'Contato', 'Documento', 'Avaliação', 'Ações']}
                renderTableRow={(collab, onEdit, onDelete) => (
                    <tr 
                        key={collab.id} 
                        className="hover:bg-gray-800/30 transition-colors"
                    >
                        <td className="px-6 py-4 font-medium text-white">{collab.name}</td>
                        <td className="px-6 py-4 text-gray-300">{collab.role || '-'}</td>
                        <td className="px-6 py-4 text-gray-300">{collab.phone || '-'}</td>
                        <td className="px-6 py-4 text-gray-300">{collab.document || '-'}</td>
                        <td className="px-6 py-4"><StarRating rating={collab.rating} className="scale-75 origin-left"/></td>
                        <ActionCell onEdit={() => onEdit(collab)} onDelete={() => onDelete(collab)} />
                    </tr>
                )}
            />
        </TabsContent>
      </Tabs>
      
      <ConfirmationModal 
          isOpen={isLogoutModalOpen} 
          onClose={() => setIsLogoutModalOpen(false)} 
          onConfirm={signOut}
          title="Sair da Conta"
          description="Tem certeza que deseja sair da sua conta? Você precisará fazer login novamente para acessar o sistema." 
          confirmText="Sair da Conta"
      />
    </div>
  );
};

export default Registros;
