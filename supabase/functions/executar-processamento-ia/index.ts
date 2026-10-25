// @ts-nocheck
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenAI, Type } from 'npm:@google/genai@^1.29.0';
import { encode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to create a Supabase admin client
const createAdminClient = () => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Supabase environment variables are not set.');
    }
    return createClient(supabaseUrl, serviceRoleKey);
};

// Helper for logging within the function
const logToDb = async (supabase: SupabaseClient, jobId: string, message: string, metadata: object = {}) => {
    const { error } = await supabase.from('ai_process_logs').insert({ job_id: jobId, message, metadata });
    if (error) {
        console.error("Failed to log to DB:", error.message);
    }
};

// Helper function to handle API calls with retries and exponential backoff.
const generateContentWithRetry = async (
    genAI: GoogleGenAI,
    request: any,
    maxRetries = 3,
    jobId?: string,
    supabase?: SupabaseClient
) => {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            const response = await genAI.models.generateContent(request);
            return response;
        } catch (error) {
            attempt++;
            const isLastAttempt = attempt >= maxRetries;
            const errorMessage = `Attempt ${attempt} failed for Gemini API call: ${error.message}`;
            
            console.error(errorMessage);
            if (jobId && supabase) {
                await logToDb(supabase, jobId, errorMessage);
            }

            if (isLastAttempt) {
                console.error("All retry attempts failed.");
                throw error;
            }
            
            const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
            const waitMessage = `Waiting ${delay.toFixed(0)}ms before retrying...`;

            console.log(waitMessage);
            if (jobId && supabase) {
                await logToDb(supabase, jobId, waitMessage);
            }

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error("Function failed after all retries.");
};

const CATEGORIAS_NOTA_ENUM_STRING = `'Serviços Preliminares e Terraplenagem', 'Estrutura e Fundação', 'Carpintaria e Marcenaria', 'Alvenaria e Vedação', 'Cobertura e Impermeabilização', 'Instalação Hidráulica', 'Instalação Elétrica', 'Acabamento e Revestimento', 'Esquadrias e Vidros', 'Pintura', 'Gastos Gerais'`;

const quickExtractSchema = {
    type: Type.OBJECT,
    properties: {
        is_valid_invoice: { type: Type.BOOLEAN },
        fornecedor_cnpj: { type: Type.STRING },
        invoice_number: { type: Type.STRING }
    },
    required: ['is_valid_invoice', 'fornecedor_cnpj', 'invoice_number']
};

const fullExtractSchema = {
    type: Type.OBJECT,
    properties: {
        is_valid_invoice: { type: Type.BOOLEAN, description: 'Deve ser true se o documento for uma nota fiscal válida e os campos essenciais (CNPJ e número) forem extraídos, caso contrário, false.' },
        fornecedor_nome: { type: Type.STRING, description: 'O nome/razão social do fornecedor da nota. Retornar null se não encontrado.' },
        fornecedor_cnpj: { type: Type.STRING, description: 'O CNPJ do fornecedor da nota, formatado como XX.XXX.XXX/XXXX-XX. Retornar null se não encontrado.' },
        invoice_number: { type: Type.STRING, description: 'O número da nota fiscal. Retornar null se não encontrado.' },
        issue_date: { type: Type.STRING, description: 'A data de emissão no formato YYYY-MM-DD. Retornar null se não encontrado.' },
        total_value: { type: Type.NUMBER, description: 'O valor TOTAL FINAL da nota fiscal (geralmente encontrado no final). Usar 0 se não encontrado.' },
        shipping_value: { type: Type.NUMBER, description: 'O valor do frete da nota. Procure por "Frete" ou "Valor do Frete". Retornar 0 se não for explicitamente encontrado.' },
        payment_method: {
            type: Type.STRING,
            description: `A forma de pagamento. O valor DEVE SER EXATAMENTE uma das seguintes opções: 'pix', 'cartao_credito', 'cartao_debito', 'dinheiro', 'boleto', 'transferencia'. Se não for encontrada, use 'pix' como padrão.`
        },
        items: {
            type: Type.ARRAY,
            description: 'Lista de itens da nota fiscal.',
            items: {
                type: Type.OBJECT,
                properties: {
                    description: { type: Type.STRING, description: 'Descrição completa do item.' },
                    quantity: { type: Type.NUMBER, description: 'A quantidade do item. Usar 0 se não encontrado.' },
                    unit_price: { type: Type.NUMBER, description: 'O preço unitário do item. Usar 0 se não encontrado.' },
                    manufacturer: { type: Type.STRING, description: 'O fabricante do item. Se nenhum for encontrado, retornar "Generico".' },
                    unit_of_measure: { type: Type.STRING, description: 'A unidade de medida (ex: Un, Sc, Kg). Retornar null se não encontrado.' },
                    category: { 
                        type: Type.STRING, 
                        description: `A categoria do item, classificada com base nas diretrizes do prompt. O valor DEVE SER EXATAMENTE uma das seguintes opções: ${CATEGORIAS_NOTA_ENUM_STRING}.`
                    }
                },
                required: ['description', 'quantity', 'unit_price', 'category', 'manufacturer']
            }
        }
    },
    required: ['is_valid_invoice', 'invoice_number', 'issue_date', 'total_value', 'items', 'fornecedor_nome', 'fornecedor_cnpj', 'shipping_value', 'payment_method']
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let job;
    const supabaseAdmin = createAdminClient();

    try {
        const payload = await req.json();
        const geminiApiKey = Deno.env.get('API_KEY');
        if (!geminiApiKey) {
            throw new Error('API_KEY environment variable is not configured in your Supabase project secrets.');
        }
        const genAI = new GoogleGenAI({ apiKey: geminiApiKey });
        const model = 'gemini-3.1-flash-lite';

        // --- Flow 1: Direct Invocation for Verification ---
        if (payload.fileBase64) {
            const authHeader = req.headers.get('Authorization');
            if (!authHeader) throw new Error('Missing authorization header.');
            
            const jwt = authHeader.replace('Bearer ', '');
            const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
            if (userError || !user) throw new Error('Invalid JWT.');

            const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('company_id').eq('id', user.id).single();
            if (profileError || !profile?.company_id) throw new Error('Could not determine company for user.');

            const filePart = { inlineData: { data: payload.fileBase64, mimeType: payload.fileType } };

            const quickResponse = await generateContentWithRetry(genAI, {
                model,
                contents: { parts: [filePart, { text: "Extraia o CNPJ do fornecedor (fornecedor_cnpj) e o número da nota fiscal (invoice_number). Verifique se é uma nota fiscal válida (is_valid_invoice: boolean)." }] },
                config: { responseMimeType: "application/json", responseSchema: quickExtractSchema }
            });

            const quickResult = JSON.parse(quickResponse.text);

            if (!quickResult.is_valid_invoice || !quickResult.fornecedor_cnpj || !quickResult.invoice_number) {
                throw new Error("O documento não é uma nota válida ou os dados essenciais (CNPJ/Nº da Nota) não puderam ser lidos.");
            }

            const cnpj = quickResult.fornecedor_cnpj.replace(/\D/g, '');
            const cnpjFormatted = cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
            const { data: supplier } = await supabaseAdmin
                .from('suppliers')
                .select('id')
                .in('cnpj', [cnpj, cnpjFormatted])
                .eq('company_id', profile.company_id)
                .limit(1)
                .maybeSingle();

            if (supplier) {
                const { data: existingInvoice } = await supabaseAdmin
                    .from('notas_fiscais')
                    .select('id')
                    .eq('company_id', profile.company_id)
                    .eq('supplier_id', supplier.id)
                    .eq('invoice_number', quickResult.invoice_number)
                    .limit(1)
                    .maybeSingle();

                if (existingInvoice) {
                    return new Response(JSON.stringify({ status: 'duplicate', message: `Esta nota fiscal (Nº ${quickResult.invoice_number}) já foi cadastrada para este fornecedor.` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }
            }
            
            return new Response(JSON.stringify({ status: 'ok' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // --- Flow 2: DB Trigger for Full Processing ---
        else if (payload.record) {
            const triggerToken = (req.headers.get('Authorization') || '').replace('Bearer ', '');
            let triggerRole = null;
            try {
                const b64 = triggerToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
                triggerRole = JSON.parse(atob(b64.padEnd(b64.length + (4 - b64.length % 4) % 4, '='))).role;
            } catch (_) { triggerRole = null; }
            if (triggerRole !== 'service_role') {
                return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            if (!payload.record.id) throw new Error('Invalid payload: missing job record or ID.');
            const { data: dbJob, error: dbJobError } = await supabaseAdmin.from('ai_process_jobs').select('*').eq('id', payload.record.id).single();
            if (dbJobError || !dbJob) throw new Error('Job not found.');
            job = dbJob;
            
            const { data: initialJob } = await supabaseAdmin.from('ai_process_jobs').select('status').eq('id', job.id).single();
            if (initialJob && initialJob.status === 'archived') {
                await logToDb(supabaseAdmin, job.id, 'Job was archived before processing started. Aborting.');
                return new Response(JSON.stringify({ success: true, message: 'Job archived.' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
            }

            await logToDb(supabaseAdmin, job.id, 'Processing started.');
            await supabaseAdmin.from('ai_process_jobs').update({ status: 'processing', processing_started_at: new Date().toISOString() }).eq('id', job.id).throwOnError();
            
            const { data: fileData, error: downloadError } = await supabaseAdmin.storage.from('jpl-conecta').download(job.storage_path);
            if (downloadError) throw new Error(`Storage download error: ${downloadError.message}`);
            
            const fileBase64 = encode(await fileData.arrayBuffer());
            const filePart = { inlineData: { data: fileBase64, mimeType: fileData.type } };

            await logToDb(supabaseAdmin, job.id, 'Cache miss assumed (verification is frontend-driven). Performing full extraction.');

            const response = await generateContentWithRetry(genAI, {
                model,
                contents: { parts: [filePart, { text: `Sua tarefa é analisar o documento com alta precisão.
1. **Validação Inicial**: Primeiro, verifique se o documento é uma Nota Fiscal brasileira válida (NF-e ou similar). Se não for, retorne um JSON com 'is_valid_invoice' como false.
2. **Extração Essencial**: Se for uma nota fiscal válida, é OBRIGATÓRIO extrair 'fornecedor_cnpj' e 'invoice_number'. Se não conseguir extrair AMBOS os campos, considere a análise uma falha e retorne 'is_valid_invoice' como false.
3. **Extração Completa**: Para notas válidas com os campos obrigatórios encontrados, defina 'is_valid_invoice' como true e extraia os demais dados conforme o schema.
   - **Valor Total**: Para o campo 'total_value', procure pelo valor total final da nota fiscal. Se não encontrado, retorne 0.
   - **Valor do Frete**: Para o campo 'shipping_value', procure com atenção por termos como 'Frete', 'Valor do Frete', 'Custo de Entrega' ou similares no corpo da nota. Extraia o valor numérico correspondente. Se nenhum valor de frete for explicitamente encontrado, retorne 0.
   - **Forma de Pagamento**: Para o campo 'payment_method', identifique a forma de pagamento (ex: PIX, Boleto, Duplicata, Cartão). Retorne o valor correspondente do schema ('pix', 'boleto', 'cartao_credito', etc.). Se não encontrar, use 'pix'.
4. **Detalhes dos Itens**: Para cada item na nota:
   - **Fabricante**: Para o campo 'manufacturer', extraia o nome do fabricante do produto. Se nenhum fabricante for claramente mencionado para um item, use o valor padrão "Generico".
   - **Categorização**: Para o campo 'category' de cada item, classifique-o com MUITA ATENÇÃO de acordo com sua finalidade na construção civil, usando EXATAMENTE um dos seguintes valores. Siga estas diretrizes:
    - **'Estrutura e Fundação'**: Para materiais de base e sustentação. Exemplos: cimento, aço, vergalhões, areia, brita, vigas, concreto.
    - **'Instalação Hidráulica'**: Para sistemas de água e esgoto. Exemplos: tubos de PVC, canos, registros, conexões, torneiras, caixas d'água, vasos sanitários.
    - **'Instalação Elétrica'**: Para a rede elétrica. Exemplos: fios, cabos, disjuntores, tomadas, interruptores, conduítes, lâmpadas.
    - **'Alvenaria e Vedação'**: Para levantar paredes e muros. Exemplos: tijolos, blocos cerâmicos, blocos de concreto, argamassa de assentamento.
    - **'Acabamento e Revestimento'**: Para revestimentos e acabamentos de piso e parede, exceto pintura. Exemplos: pisos, porcelanatos, azulejos, rejunte, argamassa colante, gesso, forro, soleiras.
    - **'Carpintaria e Marcenaria'**: Para itens de madeira. Exemplos: portas de madeira, janelas de madeira, batentes, rodapés, fechaduras, dobradiças, tábuas, caibros, compensado.
    - **'Serviços Preliminares e Terraplenagem'**: Para preparo do terreno e início da obra. Exemplos: limpeza de terreno, terraplenagem, escavação, aterro, locação de obra, tapumes, caçambas de entulho, sondagem.
    - **'Esquadrias e Vidros'**: Para esquadrias não feitas de madeira e vidros. Exemplos: janelas e portas de alumínio, PVC ou ferro, portões metálicos, vidros, box de banheiro, espelhos, guarda-corpos.
    - **'Pintura'**: Para pintura e seu preparo. Exemplos: tintas, selador, massa corrida, massa acrílica, textura, verniz, lixas, rolos, pincéis, fita crepe, solventes.
    - **'Cobertura e Impermeabilização'**: Para telhados e proteção contra umidade. Exemplos: telhas, mantas asfálticas, impermeabilizantes, calhas, rufos.
    - **'Gastos Gerais'**: Para itens de consumo, escritório, descartáveis, alimentação ou outros itens gerais de pequenos comércios. Exemplos: papel ofício, copos descartáveis, produtos de limpeza, marmitas, EPIs.` }] },
                config: { responseMimeType: "application/json", responseSchema: fullExtractSchema },
            }, 3, job.id, supabaseAdmin);

            let resultJson;
            try {
                resultJson = JSON.parse(response.text.trim());
            } catch (e) {
                console.error("Failed to parse JSON response from Gemini:", response.text);
                throw new Error("A resposta da IA não pôde ser interpretada como um JSON válido.");
            }

            if (!resultJson.is_valid_invoice) {
                throw new Error("O documento analisado não é uma nota fiscal válida ou não contém dados legíveis.");
            }
            
            await supabaseAdmin.from('ai_process_jobs').update({
                status: 'completed',
                result_json: resultJson,
                processing_completed_at: new Date().toISOString()
            }).eq('id', job.id).throwOnError();

            await logToDb(supabaseAdmin, job.id, 'Processing finished successfully.');
            return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }

        return new Response(JSON.stringify({ error: 'Invalid payload structure.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) {
        console.error('Error processing AI job:', error);
        if (job && job.id) {
            await logToDb(supabaseAdmin, job.id, `Processing failed: ${error.message}`, { error: error.stack });
            await supabaseAdmin.from('ai_process_jobs').update({
                status: 'failed',
                error_message: error.message,
                processing_completed_at: new Date().toISOString()
            }).eq('id', job.id);
        }

        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
