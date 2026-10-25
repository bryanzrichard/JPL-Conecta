// @ts-nocheck
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { GoogleGenAI } from 'npm:@google/genai@^1.29.0';

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
            console.error(`Tentativa ${attempt} falhou na chamada do Gemini: ${error.message}`);
            
            if (isLastAttempt) {
                throw error;
            }
            const delay = Math.pow(2, attempt) * 800 + Math.random() * 500;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error('Falha no Gemini após todas as tentativas.');
};

serve(async (req) => {
    // 1. Resposta aos pre-flights de CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const payload = await req.json();
        const geminiApiKey = Deno.env.get('API_KEY');
        if (!geminiApiKey) {
            throw new Error('A variável de ambiente API_KEY não está configurada nos segredos do Supabase.');
        }

        const genAI = new GoogleGenAI({ apiKey: geminiApiKey });
        const model = 'gemini-2.5-flash';

        const parts: any[] = [];

        // 2. Anexa o áudio gravado se houver
        if (payload.audioBase64) {
            parts.push({
                inlineData: {
                    data: payload.audioBase64,
                    mimeType: payload.audioMimeType || 'audio/webm',
                },
            });
        }

        const todayStr = new Date().toISOString().split('T')[0];

        // 3. Prompt especialista de Canteiro de Obras para o Gemini Flash
        const promptText = `Você é o Copiloto de Inteligência Artificial do JPL Conecta, sistema de gestão de obras e construção civil.
Sua missão é atuar como um assistente executivo no canteiro de obras através de mensagens de chat ou áudios gravados.
Você deve extrair com total precisão todas as ações solicitadas pelo usuário em uma lista chamada "acoes".

Contexto da Empresa:
- Obras cadastradas: ${JSON.stringify(payload.projectsList || [])}
- Colaboradores cadastrados: ${JSON.stringify(payload.collaboratorsList || [])}
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

4. "QUITAR_SERVICO":
   Ex: "Quitar medição de R$ 1.000 do eletricista no Mingone"
   Campos: { "servico_nome": string, "obra_id": string ou null, "obra_nome": string, "valor_pago": number }

5. "CONVERSA_GERAL":
   Para perguntas gerais ou recados operacionais.

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
  "resumo_ia": "mensagem amigável conversacional estilo WhatsApp confirmando detalhadamente cada ação realizada",
  "acoes": [
    {
      "tipo": "CADASTRAR_COLABORADOR" | "CRIAR_SERVICO" | "CRIAR_TAREFA" | "QUITAR_SERVICO" | "CONVERSA_GERAL",
      "dados": { ... }
    }
  ]
}

${payload.textCommand ? `Mensagem do usuário: "${payload.textCommand}"` : 'Analise o áudio anexado e preencha as ações conforme o schema.'}
`;
        parts.push({ text: promptText });

        // 4. Execução do Gemini Flash
        const aiResponse = await generateContentWithRetry(genAI, {
            model,
            contents: { parts },
            config: { responseMimeType: 'application/json' },
        });

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
