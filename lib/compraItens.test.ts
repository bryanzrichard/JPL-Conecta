import {
  parseCompraItens,
  formatCompraItem,
  formatCompraItemTexto,
  parseListaColada,
  localizarItens,
  CompraItem,
} from './compraItens';

function check(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('=== Iniciando testes de lib/compraItens.ts ===');

// -------------------------------------------------------------
// Teste 1: parseCompraItens
// -------------------------------------------------------------
const legacyData = [
  'Cimento CP II',
  { nome: 'Areia média' },
  { nome: 'Prego 17x21', quantidade: 2, unidade: 'kg', comprado: true },
  { nome: '' }, // deve ser ignorado
  null,
  123,
];

const parsedLegacy = parseCompraItens(legacyData);
check(parsedLegacy.length === 3, `Esperado 3 itens válidos, obteve ${parsedLegacy.length}`);
check(parsedLegacy[0].nome === 'Cimento CP II' && parsedLegacy[0].quantidade === null && parsedLegacy[0].comprado === false, 'Item 0 legado inválido');
check(parsedLegacy[1].nome === 'Areia média' && parsedLegacy[1].unidade === null, 'Item 1 legado inválido');
check(parsedLegacy[2].nome === 'Prego 17x21' && parsedLegacy[2].quantidade === 2 && parsedLegacy[2].unidade === 'kg' && parsedLegacy[2].comprado === true, 'Item 2 novo inválido');
console.log('✔ parseCompraItens passou nos testes!');

// -------------------------------------------------------------
// Teste 2: formatCompraItem & formatCompraItemTexto
// -------------------------------------------------------------
const item1: CompraItem = { nome: 'Cimento', quantidade: 10, unidade: 'saco', comprado: false };
const item2: CompraItem = { nome: 'Prego 17x21', quantidade: 1, unidade: 'kg', comprado: false };
const item3: CompraItem = { nome: 'Areia', quantidade: null, unidade: null, comprado: false };
const item4: CompraItem = { nome: 'Arame recozido', quantidade: 1.5, unidade: 'kg', comprado: false };

check(formatCompraItem(item1) === '10 saco · Cimento', `Format item1 falhou: ${formatCompraItem(item1)}`);
check(formatCompraItem(item2) === '1 kg · Prego 17x21', `Format item2 falhou: ${formatCompraItem(item2)}`);
check(formatCompraItem(item3) === 'Areia', `Format item3 falhou: ${formatCompraItem(item3)}`);
check(formatCompraItem(item4) === '1,5 kg · Arame recozido', `Format item4 falhou: ${formatCompraItem(item4)}`);

check(formatCompraItemTexto(item1) === '10 saco Cimento', `Format texto item1 falhou: ${formatCompraItemTexto(item1)}`);
check(formatCompraItemTexto(item3) === 'Areia', `Format texto item3 falhou: ${formatCompraItemTexto(item3)}`);
console.log('✔ formatCompraItem e formatCompraItemTexto passaram nos testes!');

// -------------------------------------------------------------
// Teste 3: parseListaColada (casos obrigatórios TAREFA 1)
// -------------------------------------------------------------

// 1. "10 sacos de cimento" -> {10, saco, Cimento}
const t1 = parseListaColada('10 sacos de cimento');
check(t1.length === 1 && t1[0].quantidade === 10 && t1[0].unidade === 'saco' && t1[0].nome === 'Cimento', 'Caso 1 falhou');

// 2. "10 sacos de cimento, 5 barras ferro 10, fita crepe" -> {10, saco, Cimento} {5, barra, Ferro 10} {null, null, Fita crepe}
const t2 = parseListaColada('10 sacos de cimento, 5 barras ferro 10, fita crepe');
check(t2.length === 3, 'Caso 2 tamanho inválido');
check(t2[0].quantidade === 10 && t2[0].unidade === 'saco' && t2[0].nome === 'Cimento', 'Caso 2 item 0 falhou');
check(t2[1].quantidade === 5 && t2[1].unidade === 'barra' && t2[1].nome === 'Ferro 10', 'Caso 2 item 1 falhou');
check(t2[2].quantidade === null && t2[2].unidade === null && t2[2].nome === 'Fita crepe', 'Caso 2 item 2 falhou');

// 3. "10 sacos cimento e 5 barras ferro 10" -> 2 itens
const t3 = parseListaColada('10 sacos cimento e 5 barras ferro 10');
check(t3.length === 2, 'Caso 3 esperava 2 itens');
check(t3[0].quantidade === 10 && t3[0].unidade === 'saco' && t3[0].nome === 'Cimento', 'Caso 3 item 0 falhou');
check(t3[1].quantidade === 5 && t3[1].unidade === 'barra' && t3[1].nome === 'Ferro 10', 'Caso 3 item 1 falhou');

// 4. "10 sacos cimento / 2 latas tinta + 1 kg prego" -> 3 itens
const t4 = parseListaColada('10 sacos cimento / 2 latas tinta + 1 kg prego');
check(t4.length === 3, 'Caso 4 esperava 3 itens');
check(t4[0].quantidade === 10 && t4[0].unidade === 'saco' && t4[0].nome === 'Cimento', 'Caso 4 item 0 falhou');
check(t4[1].quantidade === 2 && t4[1].unidade === 'lata' && t4[1].nome === 'Tinta', 'Caso 4 item 1 falhou');
check(t4[2].quantidade === 1 && t4[2].unidade === 'kg' && t4[2].nome === 'Prego', 'Caso 4 item 2 falhou');

// 5. "ferro e arame" -> 1 item {null, null, Ferro e arame}
const t5 = parseListaColada('ferro e arame');
check(t5.length === 1, 'Caso 5 esperava 1 item');
check(t5[0].quantidade === null && t5[0].unidade === null && t5[0].nome === 'Ferro e arame', 'Caso 5 falhou');

// 6. "10x cimento" -> {10, null, Cimento}
const t6 = parseListaColada('10x cimento');
check(t6.length === 1 && t6[0].quantidade === 10 && t6[0].unidade === null && t6[0].nome === 'Cimento', 'Caso 6 falhou');

// 7. "cimento 10 sacos" -> {10, saco, Cimento}
const t7 = parseListaColada('cimento 10 sacos');
check(t7.length === 1 && t7[0].quantidade === 10 && t7[0].unidade === 'saco' && t7[0].nome === 'Cimento', 'Caso 7 falhou');

// 8. "dez sacos de cimento" -> {10, saco, Cimento}
const t8 = parseListaColada('dez sacos de cimento');
check(t8.length === 1 && t8[0].quantidade === 10 && t8[0].unidade === 'saco' && t8[0].nome === 'Cimento', 'Caso 8 falhou');

// 9. "meio metro de brita" -> {0.5, m³, Brita}
const t9 = parseListaColada('meio metro de brita');
check(t9.length === 1 && t9[0].quantidade === 0.5 && t9[0].unidade === 'm³' && t9[0].nome === 'Brita', 'Caso 9 falhou');

// 10. "2 metros areia" -> {2, m³, Areia}
const t10 = parseListaColada('2 metros areia');
check(t10.length === 1 && t10[0].quantidade === 2 && t10[0].unidade === 'm³' && t10[0].nome === 'Areia', 'Caso 10 falhou');

// 11. "10 SACOS CIMENTO" -> {10, saco, Cimento}
const t11 = parseListaColada('10 SACOS CIMENTO');
check(t11.length === 1 && t11[0].quantidade === 10 && t11[0].unidade === 'saco' && t11[0].nome === 'Cimento', 'Caso 11 falhou');

// 12. "2 galões tinta" e "2 galoes tinta" -> {2, galão, Tinta}
const t12a = parseListaColada('2 galões tinta');
check(t12a.length === 1 && t12a[0].quantidade === 2 && t12a[0].unidade === 'galão' && t12a[0].nome === 'Tinta', 'Caso 12a falhou');
const t12b = parseListaColada('2 galoes tinta');
check(t12b.length === 1 && t12b[0].quantidade === 2 && t12b[0].unidade === 'galão' && t12b[0].nome === 'Tinta', 'Caso 12b falhou');

// 13. "1,5 m3 de brita 1; 2 latas da tinta branca" -> {1.5, m³, Brita 1} {2, lata, Tinta branca}
const t13 = parseListaColada('1,5 m3 de brita 1; 2 latas da tinta branca');
check(t13.length === 2, 'Caso 13 tamanho inválido');
check(t13[0].quantidade === 1.5 && t13[0].unidade === 'm³' && t13[0].nome === 'Brita 1', 'Caso 13 item 0 falhou');
check(t13[1].quantidade === 2 && t13[1].unidade === 'lata' && t13[1].nome === 'Tinta branca', 'Caso 13 item 1 falhou');

// 14. "joelho 25mm" -> {null, null, Joelho 25mm}
const t14 = parseListaColada('joelho 25mm');
check(t14.length === 1 && t14[0].quantidade === null && t14[0].unidade === null && t14[0].nome === 'Joelho 25mm', 'Caso 14 falhou');

// 15. Medidas que não são quantidade (bitolas/especificações de materiais)
// "parafuso 6, bucha 6" -> {null, null, Parafuso 6} {null, null, Bucha 6}
const t15 = parseListaColada('parafuso 6, bucha 6');
check(t15.length === 2, 'Caso 15 esperava 2 itens');
check(t15[0].quantidade === null && t15[0].unidade === null && t15[0].nome === 'Parafuso 6', 'Caso 15 item 0 falhou');
check(t15[1].quantidade === null && t15[1].unidade === null && t15[1].nome === 'Bucha 6', 'Caso 15 item 1 falhou');

// "lixa 120" -> {null, null, Lixa 120}
const t16 = parseListaColada('lixa 120');
check(t16.length === 1 && t16[0].quantidade === null && t16[0].unidade === null && t16[0].nome === 'Lixa 120', 'Caso 16 falhou');

// "2 lixas 120" -> {2, null, Lixas 120}
const t17 = parseListaColada('2 lixas 120');
check(t17.length === 1 && t17[0].quantidade === 2 && t17[0].unidade === null && t17[0].nome === 'Lixas 120', 'Caso 17 falhou');

// Casos complementares já existentes mantidos
const ex1 = parseListaColada('10 sacos cimento');
check(ex1.length === 1 && ex1[0].quantidade === 10 && ex1[0].unidade === 'saco' && ex1[0].nome === 'Cimento', `Ex1 falhou: ${JSON.stringify(ex1)}`);

const ex2 = parseListaColada('1 kg prego 17x21');
check(ex2.length === 1 && ex2[0].quantidade === 1 && ex2[0].unidade === 'kg' && ex2[0].nome === 'Prego 17x21', `Ex2 falhou: ${JSON.stringify(ex2)}`);

const ex3 = parseListaColada('2 m3 areia media');
check(ex3.length === 1 && ex3[0].quantidade === 2 && ex3[0].unidade === 'm³' && ex3[0].nome === 'Areia media', `Ex3 falhou: ${JSON.stringify(ex3)}`);

const ex4 = parseListaColada('fita crepe');
check(ex4.length === 1 && ex4[0].quantidade === null && ex4[0].unidade === null && ex4[0].nome === 'Fita crepe', `Ex4 falhou: ${JSON.stringify(ex4)}`);

// Multilinha
const multi = parseListaColada('10 sacos cimento\n1 kg prego 17x21\n2 m3 areia media');
check(multi.length === 3, `Multilinha esperava 3 itens, obteve ${multi.length}`);
check(multi[0].nome === 'Cimento' && multi[0].quantidade === 10 && multi[0].unidade === 'saco', 'Multi item 0');
check(multi[1].nome === 'Prego 17x21' && multi[1].quantidade === 1 && multi[1].unidade === 'kg', 'Multi item 1');
check(multi[2].nome === 'Areia media' && multi[2].quantidade === 2 && multi[2].unidade === 'm³', 'Multi item 2');

// Linha com marcadores de texto (ex: hífen ou bullet)
const bulletList = parseListaColada('- 10 sacos cimento\n• 1 kg prego 17x21\n* fita crepe');
check(bulletList.length === 3, `Lista com marcadores esperava 3 itens, obteve ${bulletList.length}`);
check(bulletList[0].nome === 'Cimento' && bulletList[1].nome === 'Prego 17x21' && bulletList[2].nome === 'Fita crepe', 'Marcadores de lista');

console.log('✔ parseListaColada passou em todos os testes!');

// -------------------------------------------------------------
// Teste 4: localizarItens
// -------------------------------------------------------------
const baseCompra: CompraItem[] = [
  { nome: 'Cimento', quantidade: 10, unidade: 'saco', comprado: false },
  { nome: 'Ferro 8 mm', quantidade: 10, unidade: 'barra', comprado: false },
  { nome: 'Ferro 10 mm', quantidade: 5, unidade: 'barra', comprado: false },
];

// Marcar Cimento (1 item)
const res1 = localizarItens(baseCompra, ['Cimento']);
check(res1.encontrados.length === 1 && res1.encontrados[0].nome === 'Cimento', 'Localizar Cimento falhou');
check(res1.pendentesApos === 2, `Esperado 2 pendentes, obteve ${res1.pendentesApos}`);
check(res1.todosComprados === false, 'Não deveria estar todos comprados');

// Marcar Ferro 8 mm e Ferro 10 mm sobre a lista resultante
const res2 = localizarItens(res1.itensAtualizados, ['Ferro 8 mm', 'Ferro 10 mm']);
check(res2.encontrados.length === 2, 'Localizar 2 ferros falhou');
check(res2.pendentesApos === 0, `Esperado 0 pendentes, obteve ${res2.pendentesApos}`);
check(res2.todosComprados === true, 'Deveria estar todos comprados');

// Item não localizado
const res3 = localizarItens(baseCompra, ['Tinta Suvinil']);
check(res3.encontrados.length === 0, 'Não deveria encontrar Tinta');
check(res3.naoLocalizados.length === 1 && res3.naoLocalizados[0] === 'Tinta Suvinil', 'Deveria listar Tinta em naoLocalizados');

// Termo ambíguo ("Ferro" tem 2 candidatos)
const resAmbiguo = localizarItens(baseCompra, ['Ferro']);
check(resAmbiguo.encontrados.length === 0, 'Termo ambíguo não deve marcar nenhum');
check(resAmbiguo.naoLocalizados.includes('Ferro'), 'Termo ambíguo deve ficar em naoLocalizados');

console.log('✔ localizarItens passou em todos os testes!');
console.log('=== TODOS OS TESTES PASSARAM COM SUCESSO! ===');
