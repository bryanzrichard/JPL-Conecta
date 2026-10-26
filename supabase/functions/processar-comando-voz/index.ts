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
     "itens": [ { "nome": string, "quantidade": number ou null, "unidade": string ou null } ] (somente quando is_compra for true; senão lista vazia),
     "observacoes": string
   }

   REGRAS PARA COMPRAS (is_compra = true):
   - Cada material pedido vira UM item em "itens". Nunca coloque a lista de materiais no "titulo".
   - Todos os materiais pedidos na mesma fala para a MESMA obra formam UMA única ação CRIAR_TAREFA com vários itens. Se a fala citar obras diferentes, gere uma ação por obra.
   - "titulo": curto e genérico, sem quantidades. Use "Compra de materiais", ou "Compra de materiais para <finalidade>" se o usuário disser a finalidade (ex: "para a laje").
   - "quantidade": só o número (ex: 10). Se o usuário não disser quantidade, use null.
   - "unidade": a unidade dita pelo usuário, no singular e minúscula (saco, kg, m, m², m³, barra, lata, galão, litro, caixa, rolo, peça, unidade, milheiro, tonelada). Se não disser, use null, exceto nos casos óbvios: cimento, argamassa e cal sem unidade = "saco"; ferro ou vergalhão sem unidade = "barra".
   - "nome": o material com a primeira letra maiúscula, sem a quantidade e sem a unidade. Mantenha as especificações que o usuário falou (bitola, tipo, cor, medida). Não invente marca, tipo ou especificação que não foi dita.
   - Bitola de ferro ou vergalhão dita só como número ("ferro 8", "ferro 10", "ferro 3/8") vira "Ferro 8 mm", "Ferro 10 mm", "Ferro 3/8\"". O número da bitola NUNCA é a quantidade.
   - Exemplo: "quero que você compre 10 ferros 8, 5 ferros 10 e 10 sacos de cimento pro Mingone" vira UMA ação CRIAR_TAREFA:
     { "titulo": "Compra de materiais", "obra_nome": "Mingone", "is_compra": true, "itens": [
       { "nome": "Ferro 8 mm", "quantidade": 10, "unidade": "barra" },
       { "nome": "Ferro 10 mm", "quantidade": 5, "unidade": "barra" },
       { "nome": "Cimento", "quantidade": 10, "unidade": "saco" } ] }
   - Exemplo: "1 kg de prego 17 por 21 e 2 metros de areia média" vira itens { "nome": "Prego 17x21", "quantidade": 1, "unidade": "kg" } e { "nome": "Areia média", "quantidade": 2, "unidade": "m³" } (areia e brita em "metros" são m³).

4. "CONCLUIR_TAREFA":
   Use SEMPRE que o usuário disser que já fez, já comprou, já realizou, já terminou, ou pedir para "dar como concluído", "dar baixa" ou "marcar como feito" uma pendência ou compra existente.
   Exemplos:
   - "Eu já fiz a compra da tinta da Maza" -> Procura na lista de pendências a tarefa correspondente à tinta da Maza e gera CONCLUIR_TAREFA.
   - "Já entrei em contato pra fazer o orçamento que era pro dia 29, pode dar como concluído" -> Gera CONCLUIR_TAREFA para o orçamento.
   - "O Lázaro já comprou o Vedapren" -> Gera CONCLUIR_TAREFA para a compra do Vedapren.
   ATENÇÃO: se a compra tiver vários itens na lista "Tarefas e Compras Pendentes no Sistema" (campo "itens") e o usuário disser que comprou só ALGUNS deles, NÃO use CONCLUIR_TAREFA; use MARCAR_ITENS_COMPRADOS (ação 7). Use CONCLUIR_TAREFA para uma compra só quando o usuário disser que comprou tudo ou não citar itens.
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

7. "MARCAR_ITENS_COMPRADOS":
   Use quando o usuário disser que já comprou um ou mais itens de uma compra que aparece na lista de pendências com o campo "itens".
   Ex: "Já comprei o cimento e o ferro 8 do Mingone" -> MARCAR_ITENS_COMPRADOS na compra do Mingone que tem esses itens.
   Campos: {
     "tarefa_id": string (UUID da compra na lista de pendências) ou null,
     "tarefa_titulo": string,
     "obra_nome": string ou null,
     "itens_comprados": [ string ] (nomes dos itens exatamente como aparecem no campo "itens" da compra)
   }
   Se os itens citados estiverem em compras diferentes, gere uma ação por compra.

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
      "tipo": "CADASTRAR_COLABORADOR" | "CRIAR_SERVICO" | "CRIAR_TAREFA" | "CONCLUIR_TAREFA" | "QUITAR_SERVICO" | "MARCAR_ITENS_COMPRADOS" | "CONVERSA_GERAL",
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
