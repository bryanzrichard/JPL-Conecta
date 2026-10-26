import { z } from 'zod';
import { CATEGORIA_NOTA_ENUM, PAYMENT_METHODS, SERVICE_STATUSES, PROJECT_STATUSES, TASK_STATUSES, TASK_PRIORITIES } from '../types';

// --- Shared Zod Resolver Factory (DRY Principle) ---
export const createZodResolver = <T>(schema: z.ZodType<T>) => {
    return async (values: T) => {
        try {
            const result = await schema.safeParseAsync(values);
            if (result.success) {
                return { values: result.data, errors: {} };
            }

            const errors: Record<string, any> = {};
            for (const issue of result.error.issues) {
                const path = issue.path;
                if (path.length === 0) continue;
                let current = errors;
                for (let i = 0; i < path.length; i++) {
                    const key = String(path[i]);
                    if (i === path.length - 1) {
                        current[key] = { type: issue.code, message: issue.message };
                    } else {
                        const nextKey = path[i + 1];
                        if (!current[key]) {
                            current[key] = typeof nextKey === 'number' ? [] : {};
                        }
                        current = current[key];
                    }
                }
            }
            return { values: {}, errors };
        } catch (err) {
            console.error("Resolver Error:", err);
            return { values: {}, errors: { root: { message: "Erro na validação interna." } } };
        }
    };
};

// --- Shared Helpers ---
// This preprocessor handles converting strings (including Brazilian currency format) to numbers.
const stringToNumberPreprocessor = (val: unknown) => {
    if (typeof val === 'string') {
        // FIX: Return NaN for empty strings instead of undefined to prevent Zod from inferring the type as 'unknown' in some cases, which causes issues with react-hook-form's resolver.
        if (val.trim() === '') return NaN;
        // This logic handles Brazilian currency format (e.g., "1.234,56") by removing thousand separators (.)
        // and replacing the decimal comma (,) with a dot.
        const cleaned = val.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        // FIX: Return NaN for invalid numbers.
        return isNaN(num) ? NaN : num;
    }
    return val;
};

// --- CNPJ Validation Helper ---
function isValidCNPJ(cnpj: string): boolean {
    if (!cnpj) return false;
    
    // Remove non-digits
    const numbers = cnpj.replace(/[^\d]+/g, '');

    if (numbers.length !== 14) return false;

    // Eliminate known invalid CNPJs (e.g. 00000000000000, 11111111111111...)
    if (/^(\d)\1+$/.test(numbers)) return false;

    // Validation algorithm
    let size = numbers.length - 2;
    let nums = numbers.substring(0, size);
    const digits = numbers.substring(size);
    let sum = 0;
    let pos = size - 7;

    for (let i = size; i >= 1; i--) {
        sum += parseInt(nums.charAt(size - i)) * pos--;
        if (pos < 2) pos = 9;
    }

    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) return false;

    size = size + 1;
    nums = numbers.substring(0, size);
    sum = 0;
    pos = size - 7;

    for (let i = size; i >= 1; i--) {
        sum += parseInt(nums.charAt(size - i)) * pos--;
        if (pos < 2) pos = 9;
    }

    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(1))) return false;

    return true;
}

// --- Nota Fiscal ---
const itemNotaSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  description: z.string({ message: "A descrição é obrigatória." }).min(3, "A descrição deve ter pelo menos 3 caracteres."),
  manufacturer: z.string().optional().nullable(),
  unit_of_measure: z.string().optional().nullable(),
  // FIX: Using a preprocessor that returns NaN for invalid inputs helps resolve type inference issues with react-hook-form's resolver.
  quantity: z.preprocess(stringToNumberPreprocessor, z.number({ message: "A quantidade deve ser um número." }).gt(0, "A quantidade deve ser maior que zero.")),
  // FIX: Using a preprocessor that returns NaN for invalid inputs helps resolve type inference issues with react-hook-form's resolver.
  unit_price: z.preprocess(stringToNumberPreprocessor, z.number({ message: "O preço unitário deve ser um número." }).gt(0, "O preço unitário deve ser maior que zero.")),
  category: z.enum(CATEGORIA_NOTA_ENUM, { message: "A categoria é obrigatória." }),
});

export const manualNotaSchema = z.object({
  supplier_id: z.string({ message: "O fornecedor é obrigatório." }).uuid("Fornecedor inválido."),
  project_id: z.string({ message: "A obra é obrigatória." }).uuid("Obra inválida."),
  invoice_number: z.string().optional(),
  issue_date: z.string({ message: "A data de emissão é obrigatória." }).min(1, "A data de emissão é obrigatória."),
  // FIX: Using a preprocessor that returns NaN for invalid inputs helps resolve type inference issues with react-hook-form's resolver.
  shipping_value: z.preprocess(stringToNumberPreprocessor, z.number({ message: "O frete deve ser um número." }).min(0, "O frete deve ser um valor positivo.")).optional(),
  total_value: z.preprocess(stringToNumberPreprocessor, z.number({ message: "O valor total deve ser um número." }).min(0, "O valor total deve ser um valor positivo.")),
  // FIX: Corrected the type assertion for `Object.keys` to `[string, ...string[]]` to satisfy Zod's `z.enum` requirement for a non-empty array of strings.
  payment_method: z.enum(Object.keys(PAYMENT_METHODS) as [string, ...string[]], { message: "A forma de pagamento é obrigatória." }),
  observations: z.string().optional(),
  items: z.array(itemNotaSchema).min(1, "A nota deve ter pelo menos um item."),
});
export type ManualNotaFormValues = z.infer<typeof manualNotaSchema>;

export const editNotaSchema = manualNotaSchema; // Can be the same for edit
export type EditNotaFormValues = z.infer<typeof editNotaSchema>;


// --- Serviço ---
export const servicoSchema = z.object({
  description: z.string({ message: "A descrição é obrigatória." }).min(5, "A descrição deve ter pelo menos 5 caracteres."),
  collaborator_id: z.string({ message: "O colaborador é obrigatório." }).uuid("Colaborador inválido.").nullable(),
  project_id: z.string({ message: "A obra é obrigatória." }).uuid("Obra inválida.").nullable(),
  status: z.enum(SERVICE_STATUSES, { message: "O status é obrigatório." }),
  start_date: z.string({ message: "A data de início é obrigatória." }).min(1, "A data de início é obrigatória."),
  end_date: z.string({ message: "A data de fim é obrigatória." }).min(1, "A data de fim é obrigatória."),
  // FIX: Using a preprocessor that returns NaN for invalid inputs helps resolve type inference issues with react-hook-form's resolver.
  total_value: z.preprocess(stringToNumberPreprocessor, z.number({ message: "O valor total deve ser um número." }).gt(0, "O valor total deve ser maior que zero.")),
  observations: z.string().optional().nullable(),
  receipt_file: z.any().optional().nullable(),
});
export type ServicoFormValues = z.infer<typeof servicoSchema>;


// --- Adiantamento ---
export const adiantamentoSchema = z.object({
  // FIX: Using a preprocessor that returns NaN for invalid inputs helps resolve type inference issues with react-hook-form's resolver.
  value: z.preprocess(stringToNumberPreprocessor, z.number({ message: "O valor deve ser um número." }).gt(0, "O valor deve ser maior que zero.")),
  payment_date: z.string({ message: "A data de pagamento é obrigatória." }).min(1, "A data de pagamento é obrigatória."),
  description: z.string().optional(),
  receipt_file: z.any().optional().nullable(),
});
export type AdiantamentoFormValues = z.infer<typeof adiantamentoSchema>;


// --- Task ---
export const taskSchema = z.object({
  // FIX: Changed 'descricao' to 'title' and 'description' to separate concerns and match DB `title` column properly.
  title: z.string({ message: "O título da tarefa é obrigatório." }).min(3, "O título da tarefa deve ter pelo menos 3 caracteres."),
  description: z.string().optional(),
  // FIX: Added required_error and invalid_type_error to handle undefined/null inputs gracefully
  project_id: z.string({ message: "A obra é obrigatória." }).uuid("Selecione uma obra válida."),
  data_inicio_prevista: z.string().optional().nullable(),
  data_fim_prevista: z.string().optional().nullable(),
  status: z.enum(TASK_STATUSES, { message: "O status é obrigatório." }),
  prioridade: z.enum(TASK_PRIORITIES, { message: "A prioridade é obrigatória." }),
  responsavel_execucao_id: z.string().uuid("Selecione um responsável válido.").optional().nullable(),
  materiais_previstos: z.array(z.object({
    nome: z.string({ message: "O nome do material é obrigatório." }).min(1, "O nome do material é obrigatório.")
  })).optional(),
  equipamentos_utilizados: z.array(z.object({
    nome: z.string({ message: "O nome do equipamento é obrigatório." }).min(1, "O nome do equipamento é obrigatório.")
  })).optional(),
  custo_real: z.preprocess(stringToNumberPreprocessor, z.number({ message: "O custo deve ser um número." }).min(0).optional().nullable()),
  
  // UI ONLY field - merged into description on submit or kept separate if DB supports it. 
  // For now, we will map this to `observacoes` in the DB if it exists, or append to description.
  // Actually, tasks table has `observacoes` column.
  observacoes: z.string().optional(), 
});
export type TaskFormValues = z.infer<typeof taskSchema>;


// --- Registros ---
export const supplierSchema = z.object({
  name: z.string({ message: "O Nome do Fornecedor é obrigatório." })
    .min(1, "O Nome do Fornecedor é obrigatório.")
    .min(3, "O Nome deve ter no mínimo 3 caracteres.")
    .max(150, "O Nome excedeu o limite de 150 caracteres.")
    .regex(/^[a-zA-Z0-9\s.,\-\u00C0-\u00FF]+$/, "O Nome contém caracteres inválidos."),
  cnpj: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        const digits = val.replace(/\D/g, '');
        if (digits.length === 14) {
          return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
        }
      }
      return val;
    },
    z.string({ message: "O CNPJ é obrigatório." })
      .min(1, "O CNPJ é obrigatório.")
      .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}\-\d{2}$/, "O formato do CNPJ está incorreto.")
      .refine(isValidCNPJ, "O CNPJ é inválido.")
  ),
  seller: z.string()
    .max(100, "O nome do Vendedor excedeu o limite de 100 caracteres.")
    .optional()
    .nullable(),
  seller_contact: z.string()
    .refine((val) => {
        if (!val) return true;
        // Simple regex for phone or email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        // Accepts basic phone formats like (11) 99999-9999 or 11999999999
        const phoneRegex = /^[0-9+\-()\s]{8,}$/; 
        return emailRegex.test(val) || phoneRegex.test(val);
    }, "O Contato do Vendedor está em um formato inválido (use telefone ou e-mail).")
    .optional()
    .nullable(),
  service_rating: z.number({ message: "A avaliação deve ser um número." }).min(0).max(5, "A avaliação deve ser entre 1 e 5 estrelas.").optional().default(0),
  delivery_rating: z.number({ message: "A avaliação deve ser um número." }).min(0).max(5, "A avaliação deve ser entre 1 e 5 estrelas.").optional().default(0),
});
export type SupplierFormValues = z.infer<typeof supplierSchema>;

export const projectSchema = z.object({
    name: z.string({ message: "O Nome da Obra é obrigatório." }).min(1, "O Nome da Obra é obrigatório.").min(3, "O nome deve ter pelo menos 3 caracteres."),
    status: z.enum(PROJECT_STATUSES, { message: "O status é obrigatório." }),
    manager: z.string().optional().nullable(),
    area_m2: z.preprocess(
      (val) => (val === '' || val === null || val === undefined ? null : stringToNumberPreprocessor(val)),
      z.number({ message: "A área deve ser um número." }).gt(0, "A área construída deve ser maior que zero.").optional().nullable()
    ),
    start_date: z.string({ message: "A data de início é obrigatória." }).min(1, "A data de início é obrigatória."),
    end_date: z.string().optional().nullable(),
    address_street: z.string().optional().nullable(),
    address_number: z.string().optional().nullable(),
    address_district: z.string().optional().nullable(),
    address_city: z.string().optional().nullable(),
    address_state: z.string().optional().nullable(),
    address_zip: z.string().optional().nullable().refine(val => !val || /^\d{5}-?\d{3}$/.test(val), "O formato do CEP é inválido."),
});
export type ProjectFormValues = z.infer<typeof projectSchema>;

export const collaboratorSchema = z.object({
    name: z.string({ message: "O nome é obrigatório." }).min(3, "O nome deve ter pelo menos 3 caracteres."),
    role: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    document: z.string().optional().nullable(),
    // FIX: Make rating optional in schema and provide a default to fix type mismatch with react-hook-form.
    rating: z.number({ message: "A avaliação deve ser um número." }).min(0).max(5).optional().default(0),
    observations: z.string().optional().nullable(),
});
export type CollaboratorFormValues = z.infer<typeof collaboratorSchema>;

// --- Orçamento ---
export const orcamentoEtapaSchema = z.object({
  nome: z.string({ message: "O nome da etapa é obrigatório." }).min(2, "O nome deve ter pelo menos 2 caracteres."),
  status: z.enum(['Planejado', 'Em Execução', 'Concluído'] as const, { message: "Status inválido." }).default('Planejado'),
  ordem: z.number().int().min(1).default(1),
});
export type OrcamentoEtapaFormValues = z.infer<typeof orcamentoEtapaSchema>;

export const orcamentoItemSchema = z.object({
  descricao: z.string({ message: "A descrição é obrigatória." }).min(2, "A descrição deve ter pelo menos 2 caracteres."),
  tipo: z.enum(['material', 'mao_de_obra'] as const, { message: "O tipo deve ser material ou mão de obra." }),
  categoria: z.enum(CATEGORIA_NOTA_ENUM, { message: "A categoria é obrigatória." }),
  quantidade: z.preprocess(stringToNumberPreprocessor, z.number({ message: "A quantidade deve ser um número." }).gt(0, "A quantidade deve ser maior que zero.")),
  valor_unitario: z.preprocess(stringToNumberPreprocessor, z.number({ message: "O valor unitário deve ser um número." }).min(0, "O valor não pode ser negativo.")),
});
export type OrcamentoItemFormValues = z.infer<typeof orcamentoItemSchema>;