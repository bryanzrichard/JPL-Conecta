// @ts-nocheck
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { GoogleGenAI } from 'npm:@google/genai@^1.29.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Retry helper com exponential backoff para resiliência na API do Gemini
const generateContentWithRetry = async (genAI: GoogleGenAI, request: any, maxRetries = 3) => {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            const response = await genAI.models.generateContent(request);
            return response;
        } catch (error: any) {
            attempt++;
            const isLastAttempt = attempt >= maxRetries;
            console.error(`Tentativa ${attempt} falhou no Gemini: ${error.message}`);
            
            if (isLastAttempt) {
                throw error;
            }
            const delay = Math.pow(2, attempt) * 800 + Math.random() * 500;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error('Falha no Gemini após tentativas.');
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
        const authClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'));
        const { data: { user }, error: userError } = await authClient.auth.getUser(jwt);
        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'Usuario nao autenticado.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const payload = await req.json();
        
        const geminiApiKey = 
            Deno.env.get('API_KEY') || 
            Deno.env.get('GEMINI_API_KEY') || 
            Deno.env.get('GOOGLE_API_KEY') || 
            Deno.env.get('GOOGLE_AI_API_KEY');

        if (!geminiApiKey) {
            throw new Error('A variável de ambiente API_KEY (ou GEMINI_API_KEY) não está configurada nos segredos do Supabase.');
        }

        const genAI = new GoogleGenAI({ apiKey: geminiApiKey });
        const parts: any[] = [];

        if (payload.audioBase64) {
            const rawMime = payload.audioMimeType || 'audio/webm';
            const cleanMime = rawMime.split(';')[0].trim();
            parts.push({
                inlineData: {
                    data: payload.audioBase64,
                    mimeType: cleanMime,
                },
            });
        }

        // Data de hoje no fuso de Brasilia (toISOString usa UTC e vira o dia seguinte apos as 21h)
        const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

        const promptText = `Você é o Copiloto de Inteligência Artificial do JPL Conecta, sistema de gestão de obras e construção civil.
Sua missão é atuar como um assistente executivo no canteiro de obras através de mensagens de chat ou áudios gravados.
Você deve extrair com total precisão todas as ações solicitadas pelo usuário em uma lista chamada "acoes".

Contexto da Empresa:
- Obras cadastradas: ${JSON.stringify(payload.projectsList || [])}
- Colaboradores cadastrados: ${JSON.stringify(payload.collaboratorsList || [])}
- Tarefas e Compras Pendentes no Sistema: ${JSON.stringify(payload.pendingTasksList || [])}
- Data de hoje: ${todayStr}

Ações Suportadas:
1. "CADASTRAR_COLABORADOR":
   Ex: "Cadastre esse cara aqui: José da Silva, telefone (61) 98888-7777, CPF 123.456.789-00, função pedreiro"
   Campos: { "nome": string, "role": string (ex: Pedreiro, Eletricista, Ajudante), "phone": string, "document": string (CPF ou CNPJ) }

2. "CRIAR_SERVICO":
   Ex: "Cria um serviço de terraplanagem no Estrela Dalva, o cara cobrou R$ 5.000 e vou fazer um adiantamento de R$ 1.000 agora e deixar R$ 4.000 para pagar depois"
   Campos: {
     "descricao": string,
     "obra_id": string (UUID da obra correspondente no contexto) ou null,
     "obra_nome": string,
     "colaborador_id": string (UUID do colaborador se mencionado) ou null,
     "colaborador_nome": string ou null,
     "valor_total": number,
     "valor_adiantamento": number (ou 0 se não houver),
     "saldo_restante": number (valor_total - valor_adiantamento),
     "observacoes": string
   }

3. "CRIAR_TAREFA":
   Ex: "Lázaro conferir nível da viga no Estrela Dalva amanhã" ou "Adiciona na lista de compras 30 sacos de cimento pro Mingone"
   Campos: {
     "titulo": string,
     "obra_id": string (UUID da obra correspondente) ou null,
     "obra_nome": string,
     "responsavel_id": string (UUID do colaborador) ou null,
     "responsavel_nome": string ou null,
     "data_prevista": string (YYYY-MM-DD),
     "is_compra": boolean,
     "observacoes": string
   }

4. "CONCLUIR_TAREFA":
   Use SEMPRE que o usuário disser que já fez, já comprou, já realizou, já terminou, ou pedir para "dar como concluído", "dar baixa" ou "marcar como feito" uma pendência ou compra existente.
   Exemplos:
   - "Eu já fiz a compra da tinta da Maza" -> Procura na lista de pendências a tarefa correspondente à tinta da Maza e gera CONCLUIR_TAREFA.
   - "Já entrei em contato pra fazer o orçamento que era pro dia 29, pode dar como concluído" -> Gera CONCLUIR_TAREFA para o orçamento.
   - "O Lázaro já comprou o Vedapren" -> Gera CONCLUIR_TAREFA para a compra do Vedapren.
   IMPORTANTE: Se a fala do usuário contiver múltiplos pedidos de conclusão, gere UMA AÇÃO "CONCLUIR_TAREFA" PARA CADA UMA DELAS!
   Campos: {
     "tarefa_id": string (UUID correspondente encontrado na lista "Tarefas e Compras Pendentes no Sistema") ou null,
     "tarefa_titulo": string (título correspondente da tarefa),
     "observacoes": string
   }

5. "QUITAR_SERVICO":
   Ex: "Quitar medição de R$ 1.000 do eletricista no Mingone"
   Campos: { "servico_nome": string, "obra_id": string ou null, "obra_nome": string, "valor_pago": number }

6. "CONVERSA_GERAL":
   Para perguntas gerais ou recados operacionais sem ação prática no banco de dados.

Instruções para datas:
- Se falar "amanhã", calcule a data correta (+1 dia a partir de ${todayStr}).
- Se falar "depois de amanhã", calcule +2 dias.
- Se falar um dia específico do mês (ex: "dia 30", "dia 30/10", "no dia 5"), calcule a data exata YYYY-MM-DD correspondente no calendário considerando o ano e mês atual a partir de ${todayStr}. Se o dia já tiver passado no mês atual, jogue para o mês seguinte.
- Se falar dia da semana (ex: "segunda-feira", "sexta"), calcule a data da próxima ocorrência.
- Se nenhuma data for mencionada para uma tarefa, o padrão é a data de hoje (${todayStr}).
- O formato DEVE ser SEMPRE YYYY-MM-DD.

Retorne ESTRITAMENTE um JSON estruturado com o seguinte formato:
{
  "transcricao": "texto completo falado ou digitado pelo usuário",
  "resumo_ia": "mensagem amigável conversacional estilo WhatsApp confirmando detalhadamente cada ação realizada (ex: informando quais tarefas foram concluídas, compras registradas ou serviços criados)",
  "acoes": [
    {
      "tipo": "CADASTRAR_COLABORADOR" | "CRIAR_SERVICO" | "CRIAR_TAREFA" | "CONCLUIR_TAREFA" | "QUITAR_SERVICO" | "CONVERSA_GERAL",
      "dados": { ... }
    }
  ]
}

${payload.textCommand ? `Mensagem do usuário: "${payload.textCommand}"` : 'Analise o áudio anexado e preencha as ações conforme o schema.'}
`;
        parts.push({ text: promptText });

        const candidateModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-3.1-flash-lite'];
        let aiResponse: any = null;
        let lastModelError: any = null;

        for (const candidate of candidateModels) {
            try {
                aiResponse = await generateContentWithRetry(genAI, {
                    model: candidate,
                    contents: { parts },
                    config: { responseMimeType: 'application/json' },
                });
                if (aiResponse) break;
            } catch (err: any) {
                lastModelError = err;
                console.warn(`Modelo ${candidate} falhou, tentando próximo modelo... ${err?.message}`);
            }
        }

        if (!aiResponse) {
            throw lastModelError || new Error('Não foi possível obter resposta de nenhum dos modelos Gemini Flash.');
        }

        const parsedResult = JSON.parse(aiResponse.text.trim());

        return new Response(JSON.stringify({ success: true, result: parsedResult }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (e: any) {
        console.error('Erro na Edge Function processar-comando-voz:', e);
        const errorMessage = e instanceof Error ? e.message : 'Ocorreu um erro desconhecido.';
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
