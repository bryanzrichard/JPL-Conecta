import { supabase } from '../../lib/supabaseClient';
import { logAuditAction } from '../../lib/auditLogger';
import { ServiceWithDetails, AdvanceWithDetails } from '../../types';

export interface DeleteServiceOptions {
  service: ServiceWithDetails;
  companyId?: string | null;
  userEmail?: string | null;
}

export interface DeleteAdvanceOptions {
  advance: AdvanceWithDetails;
  companyId?: string | null;
  userEmail?: string | null;
}

/**
 * Exclui um serviço garantindo a remoção de todos os comprovantes físicos (do serviço
 * e de todos os adiantamentos vinculados) no bucket 'jpl-conecta', removendo os adiantamentos
 * e o serviço no banco de dados e registrando o log de auditoria.
 */
export async function deleteServiceWithAttachments({
  service,
  companyId,
  userEmail,
}: DeleteServiceOptions): Promise<void> {
  // 1. Buscar comprovantes de todos os adiantamentos vinculados a este serviço
  const { data: advancesWithFiles, error: advancesFetchError } = await (supabase as any)
    .from('adiantamentos')
    .select('id, receipt_path')
    .eq('service_id', service.id);

  if (advancesFetchError) {
    console.error('Erro ao buscar adiantamentos para remoção de arquivos:', advancesFetchError);
  }

  const filesToRemove: string[] = [];
  if (service.receipt_path) {
    filesToRemove.push(service.receipt_path);
  }

  (advancesWithFiles || []).forEach((adv: { receipt_path?: string | null }) => {
    if (adv.receipt_path) {
      filesToRemove.push(adv.receipt_path);
    }
  });

  // 2. Remover arquivos físicos do Storage no bucket 'jpl-conecta'
  if (filesToRemove.length > 0) {
    const { error: storageError } = await supabase.storage
      .from('jpl-conecta')
      .remove(filesToRemove);

    if (storageError) {
      console.error('Erro ao remover arquivos físicos do bucket jpl-conecta:', storageError);
    }
  }

  // 3. Excluir explicitamente os adiantamentos vinculados (evita violação de FK caso cascade não esteja ativo)
  const { error: deleteAdvancesError } = await (supabase as any)
    .from('adiantamentos')
    .delete()
    .eq('service_id', service.id);

  if (deleteAdvancesError) {
    console.error('Erro ao excluir adiantamentos vinculados no banco:', deleteAdvancesError);
  }

  // 4. Excluir o serviço no banco de dados
  const { error: deleteServiceError } = await supabase
    .from('servicos')
    .delete()
    .eq('id', service.id);

  if (deleteServiceError) {
    throw deleteServiceError;
  }

  // 5. Registrar log de auditoria
  await logAuditAction(
    companyId || undefined,
    userEmail || undefined,
    'EXCLUIR',
    `Serviço: ${service.description || service.id}`,
    {
      id: service.id,
      amount: service.total_value,
      collaborator: service.collaborator_name,
      project: service.project_name,
      deleted_files_count: filesToRemove.length,
    }
  );
}

/**
 * Exclui um adiantamento garantindo a remoção do comprovante físico no bucket 'jpl-conecta',
 * reconciliando o status do serviço vinculado caso esteja 'Concluído' mas passe a ter saldo pendente,
 * e registrando o log de auditoria.
 */
export async function deleteAdvanceWithAttachment({
  advance,
  companyId,
  userEmail,
}: DeleteAdvanceOptions): Promise<void> {
  // 1. Remover comprovante físico se existir
  if (advance.receipt_path) {
    const { error: deleteFileError } = await supabase.storage
      .from('jpl-conecta')
      .remove([advance.receipt_path]);

    if (deleteFileError) {
      console.error('Erro ao remover comprovante do adiantamento:', deleteFileError);
    }
  }

  // 2. Excluir o registro de adiantamento
  const { error } = await supabase.from('adiantamentos').delete().eq('id', advance.id);
  if (error) throw error;

  // 3. Reconciliar integridade financeira de status do serviço
  // Se o serviço estava 'Concluído', verificar se ainda há saldo pendente após a exclusão deste adiantamento
  if (advance.service_id) {
    const { data: serviceData, error: serviceError } = await (supabase as any)
      .from('servicos')
      .select('id, total_value, status, adiantamentos(id, value)')
      .eq('id', advance.service_id)
      .maybeSingle();

    if (!serviceError && serviceData && serviceData.status === 'Concluído') {
      const remainingAdvances = (serviceData.adiantamentos || [])
        .filter((a: { id: string; value: number }) => a.id !== advance.id)
        .reduce((sum: number, a: { value: number }) => sum + Number(a.value || 0), 0);

      const hasDebt = Number(serviceData.total_value) - remainingAdvances > 0.009;
      if (hasDebt) {
        await (supabase as any)
          .from('servicos')
          .update({ status: 'Em Andamento' })
          .eq('id', advance.service_id);
      }
    }
  }

  // 4. Registrar auditoria
  await logAuditAction(
    companyId || undefined,
    userEmail || undefined,
    'EXCLUIR',
    `Adiantamento: ${advance.description || advance.id}`,
    { id: advance.id, amount: advance.value, service_id: advance.service_id }
  );
}
