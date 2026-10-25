# Regras de codigo do JPL Conecta

## Escopo
- Altere apenas o que foi pedido. Nao refatore, renomeie ou reformate partes nao relacionadas.
- Antes de editar, leia o arquivo inteiro e siga os padroes que ja existem nele.

## Tipagem
- Proibido usar any, as any, @ts-ignore e @ts-nocheck no front-end.
- Use os tipos do banco em types.ts. Para consultas com join, crie um tipo explicito e use .returns<Tipo>().
- Toda entrega deve passar em "npx tsc --noEmit" com 0 erros.

## Tamanho e organizacao
- Nenhum arquivo novo pode passar de 400 linhas. Ao adicionar funcionalidade em arquivos que ja passam disso (pages/Orcamentos.tsx, pages/Servicos.tsx, pages/Registros.tsx, pages/Tarefas.tsx, pages/Notas.tsx), coloque a logica nova em um hook em hooks/ ou em um componente em components/<modulo>/, e nao dentro da pagina.
- Acesso ao Supabase em codigo novo fica em hooks/ ou lib/, nunca direto no JSX da pagina.
- Antes de criar um componente, procure se ja existe um parecido em components/. Reaproveite em vez de duplicar.
- Formatacao de moeda e data: use funcoes de lib/utils.ts. Se nao existir, crie la uma unica vez.

## Seguranca
- Nunca coloque chaves, tokens ou senhas no codigo. Use variaveis de ambiente.
- Toda consulta deve respeitar o company_id do usuario; nao confie em company_id vindo do front em funcoes do banco com security definer.
- Edge Functions devem validar o usuario com auth.getUser antes de executar.

## Entrega
- Mostre o diff antes de salvar.
- Rode "npm run build" e informe o resultado.
- Commits no formato: tipo(modulo): descricao. Tipos: feat, fix, refactor, chore.
