import {
  parseCompraItens,
  formatCompraItem,
  formatCompraItemTexto,
  parseListaColada,
  CompraItem,
} from './compraItens';

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
console.assert(parsedLegacy.length === 3, `Esperado 3 itens válidos, obteve ${parsedLegacy.length}`);
console.assert(parsedLegacy[0].nome === 'Cimento CP II' && parsedLegacy[0].quantidade === null && parsedLegacy[0].comprado === false, 'Item 0 legado inválido');
console.assert(parsedLegacy[1].nome === 'Areia média' && parsedLegacy[1].unidade === null, 'Item 1 legado inválido');
console.assert(parsedLegacy[2].nome === 'Prego 17x21' && parsedLegacy[2].quantidade === 2 && parsedLegacy[2].unidade === 'kg' && parsedLegacy[2].comprado === true, 'Item 2 novo inválido');
console.log('✔ parseCompraItens passou nos testes!');

// -------------------------------------------------------------
// Teste 2: formatCompraItem & formatCompraItemTexto
// -------------------------------------------------------------
const item1: CompraItem = { nome: 'Cimento', quantidade: 10, unidade: 'saco', comprado: false };
const item2: CompraItem = { nome: 'Prego 17x21', quantidade: 1, unidade: 'kg', comprado: false };
const item3: CompraItem = { nome: 'Areia', quantidade: null, unidade: null, comprado: false };
const item4: CompraItem = { nome: 'Arame recozido', quantidade: 1.5, unidade: 'kg', comprado: false };

console.assert(formatCompraItem(item1) === '10 saco · Cimento', `Format item1 falhou: ${formatCompraItem(item1)}`);
console.assert(formatCompraItem(item2) === '1 kg · Prego 17x21', `Format item2 falhou: ${formatCompraItem(item2)}`);
console.assert(formatCompraItem(item3) === 'Areia', `Format item3 falhou: ${formatCompraItem(item3)}`);
console.assert(formatCompraItem(item4) === '1,5 kg · Arame recozido', `Format item4 falhou: ${formatCompraItem(item4)}`);

console.assert(formatCompraItemTexto(item1) === '10 saco Cimento', `Format texto item1 falhou: ${formatCompraItemTexto(item1)}`);
console.assert(formatCompraItemTexto(item3) === 'Areia', `Format texto item3 falhou: ${formatCompraItemTexto(item3)}`);
console.log('✔ formatCompraItem e formatCompraItemTexto passaram nos testes!');

// -------------------------------------------------------------
// Teste 3: parseListaColada (exemplos obrigatórios)
// -------------------------------------------------------------
const ex1 = parseListaColada('10 sacos cimento');
console.assert(ex1.length === 1 && ex1[0].quantidade === 10 && ex1[0].unidade === 'saco' && ex1[0].nome === 'Cimento', `Ex1 falhou: ${JSON.stringify(ex1)}`);

const ex2 = parseListaColada('1 kg prego 17x21');
console.assert(ex2.length === 1 && ex2[0].quantidade === 1 && ex2[0].unidade === 'kg' && ex2[0].nome === 'Prego 17x21', `Ex2 falhou: ${JSON.stringify(ex2)}`);

const ex3 = parseListaColada('2 m3 areia media');
console.assert(ex3.length === 1 && ex3[0].quantidade === 2 && ex3[0].unidade === 'm³' && ex3[0].nome === 'Areia media', `Ex3 falhou: ${JSON.stringify(ex3)}`);

const ex4 = parseListaColada('fita crepe');
console.assert(ex4.length === 1 && ex4[0].quantidade === null && ex4[0].unidade === null && ex4[0].nome === 'Fita crepe', `Ex4 falhou: ${JSON.stringify(ex4)}`);

// Multilinha
const multi = parseListaColada('10 sacos cimento\n1 kg prego 17x21\n2 m3 areia media');
console.assert(multi.length === 3, `Multilinha esperava 3 itens, obteve ${multi.length}`);
console.assert(multi[0].nome === 'Cimento' && multi[0].quantidade === 10 && multi[0].unidade === 'saco', 'Multi item 0');
console.assert(multi[1].nome === 'Prego 17x21' && multi[1].quantidade === 1 && multi[1].unidade === 'kg', 'Multi item 1');
console.assert(multi[2].nome === 'Areia media' && multi[2].quantidade === 2 && multi[2].unidade === 'm³', 'Multi item 2');

// Linha única separada por vírgula ou ponto e vírgula
const commaSeparated = parseListaColada('10 sacos cimento, 1 kg prego 17x21; fita crepe');
console.assert(commaSeparated.length === 3, `Linha com vírgulas esperava 3 itens, obteve ${commaSeparated.length}`);
console.assert(commaSeparated[2].nome === 'Fita crepe' && commaSeparated[2].quantidade === null, 'Vírgula item 2');

// Decimal com vírgula (ex: 1,5 kg)
const decimalComma = parseListaColada('1,5 kg arame');
console.assert(decimalComma.length === 1 && decimalComma[0].quantidade === 1.5 && decimalComma[0].unidade === 'kg' && decimalComma[0].nome === 'Arame', `Decimal com vírgula falhou: ${JSON.stringify(decimalComma)}`);

// Lista com vírgula contendo número decimal
const mixedList = parseListaColada('10 sacos cimento, 1,5 kg arame, 2 m3 areia media');
console.assert(mixedList.length === 3, `Lista mista esperava 3 itens, obteve ${mixedList.length}`);
console.assert(mixedList[1].quantidade === 1.5 && mixedList[1].unidade === 'kg' && mixedList[1].nome === 'Arame', 'Decimal em lista mista');

// Lista com marcadores de texto (ex: hífen ou bullet)
const bulletList = parseListaColada('- 10 sacos cimento\n• 1 kg prego 17x21\n* fita crepe');
console.assert(bulletList.length === 3, `Lista com marcadores esperava 3 itens, obteve ${bulletList.length}`);
console.assert(bulletList[0].nome === 'Cimento' && bulletList[1].nome === 'Prego 17x21' && bulletList[2].nome === 'Fita crepe', 'Marcadores de lista');

console.log('✔ parseListaColada passou em todos os testes!');
console.log('=== TODOS OS TESTES PASSARAM COM SUCESSO! ===');
