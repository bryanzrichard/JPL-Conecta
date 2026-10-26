// @ts-nocheck
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { GoogleGenAI, Type } from 'npm:@google/genai@^1.29.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Modelo unico: Flash-Lite (cota gratuita maior e resposta mais rapida).
// Pode ser trocado sem mexer no codigo pelo segredo GEMINI_MODEL no Supabase.
const MODELO_PADRAO = 'gemini-3.1-flash-lite';

// Erro temporario (cota por minuto, sobrecarga): vale tentar de novo uma vez
const isErroTemporario = (error: any) => {
    const msg = String(error?.message || '');
    const status = Number(error?.status || error?.code || 0);
    return status === 429 || status === 500 || status === 503 || /429|503|overloaded|unavailable|RESOURCE_EXHAUSTED/i.test(msg);
};

// Ate 2 tentativas, somente para erro temporario
const generateContentWithRetry = async (genAI: GoogleGenAI, request: any) => {
    try {
        return await genAI.models.generateContent(request);
    } catch (error: any) {
        console.error(`Gemini falhou (tentativa 1): ${error?.message}`);
        if (!isErroTemporario(error)) throw error;
        await new Promise(resolve => setTimeout(resolve, 900));
        return await genAI.models.generateContent(request);
    }
};

// Listas enxutas: menos texto enviado = resposta mais rapida e menos cota
const limitarContexto = (payload: any) => {
    const projetos = Array.isArray(payload.projectsList) ? payload.projectsList.slice(0, 60) : [];
    const colaboradores = Array.isArray(payload.collaboratorsList) ? payload.collaboratorsList.slice(0, 150) : [];
    const pendentes = Array.isArray(payload.pendingTasksList) ? [...payload.pendingTasksList] : [];
    pendentes.sort((a: any, b: any) => {
        const da = a?.data_prevista || '9999-12-31';
        const db = b?.data_prevista || '9999-12-31';
        return da.localeCompare(db);
    });
    const tarefas = pendentes.slice(0, 40).map((t: any) => {
        const limpo: any = { id: t.id, title: t.title, obra: t.obra };
        if (t.data_prevista) limpo.data_prevista = t.data_prevista;
        if (t.responsavel) limpo.responsavel = t.responsavel;
        if (t.isPurchase) limpo.isPurchase = true;
        if (Array.isArray(t.itens) && t.itens.length > 0) limpo.itens = t.itens;
        return limpo;
    });
    return { projetos, colaboradores, tarefas };
};

// Formato fixo da resposta: o Gemini devolve sempre este JSON
const campo = (type: any) => ({ type, nullable: true });
const SCHEMA_RESPOSTA = {
    type: Type.OBJECT,
    properties: {
        transcricao: campo(Type.STRING),
        resumo_ia: { type: Type.STRING },
        acoes: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    tipo: {
                        type: Type.STRING,
                        enum: ['CADASTRAR_COLABORADOR', 'CRIAR_SERVICO', 'CRIAR_TAREFA', 'CONCLUIR_TAREFA', 'QUITAR_SERVICO', 'MARCAR_ITENS_COMPRADOS', 'CONSULTAR', 'CONVERSA_GERAL'],
                    },
                    dados: {
                        type: Type.OBJECT,
                        properties: {
                            nome: campo(Type.STRING),
                            role: campo(Type.STRING),
                            phone: campo(Type.STRING),
                            document: campo(Type.STRING),
                            descricao: campo(Type.STRING),
                            obra_id: campo(Type.STRING),
                            obra_nome: campo(Type.STRING),
                            colaborador_id: campo(Type.STRING),
                            colaborador_nome: campo(Type.STRING),
                            valor_total: campo(Type.NUMBER),
                            valor_adiantamento: campo(Type.NUMBER),
                            saldo_restante: campo(Type.NUMBER),
                            observacoes: campo(Type.STRING),
                            titulo: campo(Type.STRING),
                            responsavel_id: campo(Type.STRING),
                            responsavel_nome: campo(Type.STRING),
                            data_prevista: campo(Type.STRING),
                            is_compra: campo(Type.BOOLEAN),
                            itens: {
                                type: Type.ARRAY,
                                nullable: true,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        nome: { type: Type.STRING },
                                        quantidade: campo(Type.NUMBER),
                                        unidade: campo(Type.STRING),
                                    },
                                    required: ['nome'],
                                },
                            },
                            tarefa_id: campo(Type.STRING),
                            tarefa_titulo: campo(Type.STRING),
                            servico_nome: campo(Type.STRING),
                            valor_pago: campo(Type.NUMBER),
                            itens_comprados: { type: Type.ARRAY, nullable: true, items: { type: Type.STRING } },
                            consulta: {
                                type: Type.OBJECT,
                                nullable: true,
                                properties: {
                                    tipo: { type: Type.STRING, enum: ['GASTOS', 'LISTAR_NOTAS'] },
                                    agrupar: { type: Type.STRING, nullable: true, enum: ['nenhum', 'origem', 'obra', 'categoria', 'mes', 'fornecedor', 'item'] },
                                    data_inicio: campo(Type.STRING),
                                    data_fim: campo(Type.STRING),
                                    periodo_texto: campo(Type.STRING),
                                    obra_id: campo(Type.STRING),
                                    obra_nome: campo(Type.STRING),
                                    categoria: campo(Type.STRING),
                                    termo: campo(Type.STRING),
                                    termo_exibicao: campo(Type.STRING),
                                },
                                required: ['tipo'],
                            },
                        },
                    },
                },
                required: ['tipo', 'dados'],
            },
        },
    },
    required: ['resumo_ia', 'acoes'],
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

        const ctx = limitarContexto(payload);

        const promptText = `Você é o Copiloto de Inteligência Artificial do JPL Conecta, sistema de gestão de obras e construção civil.
Sua missão é atuar como um assistente executivo no canteiro de obras através de mensagens de chat ou áudios gravados.
Você deve extrair com total precisão todas as ações solicitadas pelo usuário em uma lista chamada "acoes".

Contexto da Empresa:
- Obras cadastradas: ${JSON.stringify(ctx.projetos)}
- Colaboradores cadastrados: ${JSON.stringify(ctx.colaboradores)}
- Tarefas e Compras Pendentes no Sistema (as mais próximas do prazo): ${JSON.stringify(ctx.tarefas)}
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

8. "CONSULTAR":
   Use para PERGUNTAS sobre gastos, valores, compras já feitas, notas fiscais e preços. Esta ação NÃO grava nada.
   Você NÃO tem acesso aos valores: apenas descreva a consulta. O sistema calcula os números.
   Campos: { "consulta": {
     "tipo": "GASTOS" (quanto foi gasto, totais, comparações) ou "LISTAR_NOTAS" (quais compras ou notas foram feitas),
     "agrupar": "nenhum" | "origem" | "obra" | "categoria" | "mes" | "fornecedor" | "item",
     "data_inicio": "YYYY-MM-DD" ou null,
     "data_fim": "YYYY-MM-DD" ou null,
     "periodo_texto": o período como o usuário falou (ex: "julho", "dia 15", "2025") ou null,
     "obra_id": UUID da obra citada ou null,
     "obra_nome": nome da obra citada ou null,
     "categoria": uma destas, exatamente como escrita, ou null: Serviços Preliminares e Terraplenagem, Estrutura e Fundação, Carpintaria e Marcenaria, Alvenaria e Vedação, Cobertura e Impermeabilização, Instalação Hidráulica, Instalação Elétrica, Acabamento e Revestimento, Esquadrias e Vidros, Pintura, Gastos Gerais,
     "termo": material buscado, sem quantidade, sem acento e minúsculo, com sinônimos separados por "|" (ou null),
     "termo_exibicao": o material como o usuário falou (ex: "tubo PVC") ou null
   } }
   Regras de período (consultas olham para o PASSADO; hoje é ${todayStr}):
   - Mês sem ano ("julho"): do ano atual se o mês já começou; senão, do ano anterior. Do dia 1 ao último dia do mês.
   - "dia 15" sem mês: dia 15 do mês atual se já passou ou é hoje; senão, do mês anterior. data_inicio = data_fim.
   - "esse mês", "mês passado", "semana passada" (segunda a domingo), "este ano", "ano de 2025": calcule as datas.
   - Sem período citado: data_inicio e data_fim null (todo o histórico).
   Regras de agrupamento:
   - "quanto gastei em julho" ou "quanto gastei na obra X": "origem" (separa material, mão de obra e cartório).
   - "por obra", "em cada obra", "compara as obras": "obra".
   - "por categoria", "por etapa": "categoria". "por mês", "mês a mês": "mes". "por fornecedor", "por loja": "fornecedor".
   - Pergunta sobre um material ("quanto gastei de cimento"): "item" (mostra os itens encontrados, quantidade e valor).
   - Pergunta de total simples ("quanto deu tudo"): "nenhum".
   Regras do termo:
   - Inclua sinônimos comuns de nota fiscal: ferro → "ferro|vergalhao"; cano → "cano|tubo"; tubo pvc → "tubo pvc|cano pvc"; fio → "fio|cabo"; brita → "brita|pedra"; tijolo → "tijolo|bloco ceramico"; caixa d'agua → "caixa d agua|caixa dagua"; areia, cimento, prego, tinta, registro: só a palavra.
   - Vários materiais na mesma pergunta ("quanto gastei de tubo PVC, de ferro e de cimento no Mingone"): gere UMA ação CONSULTAR por material, cada uma com agrupar "item".
   - Pergunta por categoria ("quanto gastei de pintura"): use "categoria" e deixe "termo" null.
   Exemplos:
   - "Quais compras eu fiz dia 15?" → { "tipo": "LISTAR_NOTAS", "data_inicio": "<dia 15>", "data_fim": "<dia 15>", "periodo_texto": "dia 15" }
   - "Quanto gastei em julho?" → { "tipo": "GASTOS", "agrupar": "origem", "data_inicio": "<1 de julho>", "data_fim": "<31 de julho>", "periodo_texto": "julho" }
   - "Quanto gastei de ferro no Mingone?" → { "tipo": "GASTOS", "agrupar": "item", "obra_nome": "Mingone", "termo": "ferro|vergalhao", "termo_exibicao": "ferro" }
   No "resumo_ia" de uma consulta, diga em uma frase curta o que será consultado. NUNCA informe valores, totais ou quantidades: você não os conhece.

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
      "tipo": "CADASTRAR_COLABORADOR" | "CRIAR_SERVICO" | "CRIAR_TAREFA" | "CONCLUIR_TAREFA" | "QUITAR_SERVICO" | "MARCAR_ITENS_COMPRADOS" | "CONSULTAR" | "CONVERSA_GERAL",
      "dados": { ... }
    }
  ]
}

${payload.textCommand ? `Mensagem do usuário: "${payload.textCommand}"` : 'Analise o áudio anexado e preencha as ações conforme o schema.'}
`;
        parts.push({ text: promptText });

        const modelo = Deno.env.get('GEMINI_MODEL') || MODELO_PADRAO;
        const inicio = Date.now();
        let aiResponse: any = null;

        try {
            aiResponse = await generateContentWithRetry(genAI, {
                model: modelo,
                contents: { parts },
                config: { responseMimeType: 'application/json', responseSchema: SCHEMA_RESPOSTA, temperature: 0.1 },
            });
        } catch (err: any) {
            // Se o modelo recusar o formato fixo (erro 400), tenta uma vez sem ele
            const status = Number(err?.status || err?.code || 0);
            if (status !== 400 && !/schema|INVALID_ARGUMENT/i.test(String(err?.message || ''))) throw err;
            console.warn(`Formato fixo recusado pelo modelo ${modelo}; tentando sem ele. ${err?.message}`);
            aiResponse = await generateContentWithRetry(genAI, {
                model: modelo,
                contents: { parts },
                config: { responseMimeType: 'application/json', temperature: 0.1 },
            });
        }

        console.log(`Copiloto respondeu em ${Date.now() - inicio} ms (modelo ${modelo})`);
        const parsedResult = JSON.parse(String(aiResponse.text || '').trim());
        if (!Array.isArray(parsedResult.acoes)) parsedResult.acoes = [];

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
