import { z } from 'zod';

// Interface para identificar erros nativos do Supabase/PostgreSQL
interface PostgrestError {
  code: string;
  details: string | null;
  hint: string | null;
  message: string;
}

function isPostgrestError(err: any): err is PostgrestError {
  return err && typeof err === 'object' && 'code' in err && 'message' in err;
}

// Tenta analisar um erro para uma mensagem legível por humanos.
export function formatApiError(error: unknown): string {
  try {
    // 1. Erros de Rede / Conexão (Offline)
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      return 'Erro de conexão: Verifique sua internet e tente novamente.';
    }

    // 2. Erros de Validação Zod (String JSON)
    if (typeof error === 'string') {
      const jsonMatch = error.match(/(\[.*\])/);
      if (jsonMatch && jsonMatch[0]) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) {
            const validationErrorSchema = z.array(z.object({ message: z.string() }));
            const validationResult = validationErrorSchema.safeParse(parsed);
            if (validationResult.success) {
              return validationResult.data.map(e => `• ${e.message}`).join('\n');
            }
          }
        } catch (e) { /* ignora erro de parse e segue para os próximos checks */ }
      }
    }

    // 3. Erros Nativos do Banco de Dados (Supabase / PostgreSQL)
    if (isPostgrestError(error)) {
      switch (error.code) {
        case '23505': // unique_violation
          return 'Este registro já existe no sistema (informação duplicada).';
        case '23503': // foreign_key_violation
          return 'Não é possível excluir este item pois ele está vinculado a outros registros (ex: uma obra com notas vinculadas).';
        case '22P02': // invalid_text_representation (geralmente erro de UUID)
          return 'Informação inválida. Verifique se todos os campos de seleção foram preenchidos corretamente.';
        case '42P01': // undefined_table
          return 'Erro interno: Tabela não encontrada. Contate o suporte.';
      }
    }

    // 4. Fallback: Busca por palavras-chave na mensagem de erro (String ou Error object)
    const msg = typeof error === 'string' ? error : (error instanceof Error ? error.message : (error as any)?.message || '');
    
    if (msg) {
      const lowerMsg = msg.toLowerCase();
      
      // Autenticação e Sessão
      if (lowerMsg.includes('jwt expired') || lowerMsg.includes('invalid jwt') || lowerMsg.includes('session missing') || lowerMsg.includes('not authenticated')) {
        return 'Sua sessão expirou. Por favor, atualize a página ou faça login novamente.';
      }
      
      // Rede
      if (lowerMsg.includes('network error') || lowerMsg.includes('failed to fetch')) {
        return 'Erro de conexão: Verifique sua internet e tente novamente.';
      }

      // Banco de dados (Fallback caso o código PostgREST não seja capturado)
      if (lowerMsg.includes('duplicate key value')) {
        return 'Este registro já existe no sistema (informação duplicada).';
      }
      if (lowerMsg.includes('foreign key constraint')) {
        return 'Não é possível excluir este item pois ele está sendo usado em outros registros.';
      }
      if (lowerMsg.includes('invalid input value for enum')) {
        return 'Opção inválida selecionada. Atualize a página e tente novamente.';
      }
      if (lowerMsg.includes('invalid input syntax for type uuid')) {
        return 'Referência inválida. Verifique se os campos de seleção estão preenchidos corretamente.';
      }
      
      // Segurança e Permissões (Row Level Security)
      if (lowerMsg.includes('row-level security') || lowerMsg.includes('rls') || lowerMsg.includes('new row violates')) {
        return 'Você não tem permissão para realizar esta ação neste registro.';
      }

      // Retorna a mensagem original se não houver tradução amigável
      return msg;
    }

    return 'Ocorreu um erro inesperado. Por favor, tente novamente.';

  } catch (e) {
    if (typeof error === 'string') return error;
    return 'Ocorreu um erro inesperado ao processar a resposta do servidor.';
  }
}