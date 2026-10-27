export type CopilotErrorCode = 'IA_SOBRECARREGADA' | 'IA_LIMITE' | 'ERRO_INTERNO';
export type CopilotErrorOrigin = 'texto' | 'audio';

export interface ExtrairErroResult {
  codigo: CopilotErrorCode;
  detalhe?: string;
}

export const MSG_IA_SOBRECARREGADA =
  'A IA do Google está sobrecarregada agora. Tente de novo em alguns segundos.';
export const MSG_IA_LIMITE =
  'O limite de uso da IA foi atingido. Tente mais tarde.';
export const SUFIXO_AUDIO = 'Grave o áudio de novo.';

/**
 * Lê o corpo da resposta de erro retornada pela Edge Function processar-comando-voz.
 * No Supabase, respostas HTTP com status de erro chegam como FunctionsHttpError,
 * cujo corpo em JSON pode ser lido através de error.context.json().
 * Caso não haja corpo legível ou o JSON seja inválido, trata como ERRO_INTERNO.
 */
export async function extrairErroCopilot(error: unknown): Promise<ExtrairErroResult> {
  if (!error) {
    return { codigo: 'ERRO_INTERNO' };
  }

  try {
    const errObj = error as {
      context?: { json?: () => Promise<unknown> };
      message?: string;
    };

    if (errObj.context && typeof errObj.context.json === 'function') {
      const body = await errObj.context.json();
      if (body && typeof body === 'object') {
        const codigoRaw = (body as { codigo?: unknown }).codigo;
        const msgRaw = (body as { error?: unknown }).error;
        const detalhe = typeof msgRaw === 'string' ? msgRaw : errObj.message;

        if (
          codigoRaw === 'IA_SOBRECARREGADA' ||
          codigoRaw === 'IA_LIMITE' ||
          codigoRaw === 'ERRO_INTERNO'
        ) {
          return {
            codigo: codigoRaw,
            detalhe,
          };
        }
      }
    }
  } catch (_) {
    // Falha ao ler JSON do contexto -> trata como ERRO_INTERNO
  }

  const fallbackMsg = error instanceof Error ? error.message : undefined;
  return {
    codigo: 'ERRO_INTERNO',
    detalhe: fallbackMsg,
  };
}

/**
 * Formata a mensagem de erro amigável para exibição no chat do Copiloto:
 * - IA_SOBRECARREGADA: "A IA do Google está sobrecarregada agora. Tente de novo em alguns segundos."
 * - IA_LIMITE: "O limite de uso da IA foi atingido. Tente mais tarde."
 * - ERRO_INTERNO e falhas de rede: mantém mensagem de verificação de deploy / API_KEY.
 * - Para erros originados em áudio: a mensagem sempre termina com "Grave o áudio de novo."
 */
export function formatarMensagemErroCopilot(options: {
  codigo: CopilotErrorCode;
  origem: CopilotErrorOrigin;
  detalhe?: string;
}): string {
  const { codigo, origem, detalhe } = options;
  const msgText = detalhe || 'Erro na Edge Function';

  let base: string;
  if (codigo === 'IA_SOBRECARREGADA') {
    base = MSG_IA_SOBRECARREGADA;
  } else if (codigo === 'IA_LIMITE') {
    base = MSG_IA_LIMITE;
  } else {
    // ERRO_INTERNO e falha de rede: manter mensagem atual
    base =
      origem === 'texto'
        ? `⚠️ Não consegui concluir a ação: ${msgText}. Verifique o deploy de "processar-comando-voz" ou a API_KEY no Supabase.`
        : `⚠️ Não consegui transcrever o áudio: ${msgText}. Verifique o deploy de "processar-comando-voz" ou a API_KEY no Supabase.`;
  }

  if (origem === 'audio') {
    return `${base} ${SUFIXO_AUDIO}`;
  }

  return base;
}
