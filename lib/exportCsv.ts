import { BuscaGlobalRow } from '../types';
import { ROTULOS_BUSCA } from './buscaGlobal';
import { extrairDadosItem } from './precos';

/**
 * Exporta linhas da busca para arquivo CSV:
 * - Inicia com UTF-8 Byte Order Mark (\uFEFF) para compatibilidade perfeita com Excel no Windows
 * - Delimitador ponto e vírgula (;)
 * - Formatação monetária com vírgula decimal brasileira
 */
export function exportCsvBusca(
  rows: BuscaGlobalRow[],
  filenamePrefix = 'busca_jpl'
): void {
  if (!rows || rows.length === 0) return;

  const header = [
    'Tipo',
    'Título',
    'Obra',
    'Fornecedor / Responsável / Subtítulo',
    'Data',
    'Qtd',
    'Unidade',
    'Preço Unitário (R$)',
    'Valor Total (R$)',
  ];

  let csv = '\uFEFF' + header.join(';') + '\r\n';

  for (const row of rows) {
    const tipoRotulo = ROTULOS_BUSCA[row.tipo] || row.tipo;
    const titulo = (row.titulo || '').replace(/"/g, '""');
    const obra = (row.obra || '').replace(/"/g, '""');
    const subtitulo = (row.subtitulo || '').replace(/"/g, '""');

    // Data no formato DD/MM/AAAA
    let dataFormatada = '';
    if (row.data) {
      const parts = row.data.split('T')[0].split('-');
      if (parts.length === 3) {
        dataFormatada = `${parts[2]}/${parts[1]}/${parts[0]}`;
      } else {
        dataFormatada = row.data;
      }
    }

    let qtd = '';
    let unidade = '';
    let precoUnit = '';

    if (row.tipo === 'item') {
      const itemData = extrairDadosItem(row);
      qtd = itemData.quantity.toString().replace('.', ',');
      unidade = itemData.unidade;
      precoUnit = itemData.unitPrice > 0
        ? itemData.unitPrice.toFixed(2).replace('.', ',')
        : '';
    }

    const valorTotal =
      row.valor !== null && row.valor !== undefined
        ? Number(row.valor).toFixed(2).replace('.', ',')
        : '';

    const line = [
      `"${tipoRotulo}"`,
      `"${titulo}"`,
      `"${obra}"`,
      `"${subtitulo}"`,
      `"${dataFormatada}"`,
      `"${qtd}"`,
      `"${unidade}"`,
      `"${precoUnit}"`,
      `"${valorTotal}"`,
    ];

    csv += line.join(';') + '\r\n';
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');

  link.setAttribute('href', url);
  link.setAttribute('download', `${filenamePrefix}_${y}-${m}-${d}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
