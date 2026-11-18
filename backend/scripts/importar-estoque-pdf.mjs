import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import sequelize from '../src/config/database.js';
import Empresa from '../src/models/Empresa.js';
import Product from '../src/models/Product.js';
import Movimento from '../src/models/Movimento.js';
import FiscalStockImport from '../src/models/FiscalStockImport.js';
import FiscalStockImportItem from '../src/models/FiscalStockImportItem.js';

const defaultPdf = '/Users/arthurschimitd/Downloads/relatorio_estoque.pdf';
const pdfPath = path.resolve(process.argv[2] || defaultPdf);
const apply = process.argv.includes('--apply');
const empresaArg = process.argv.find(arg => arg.startsWith('--empresa='));
const empresaIdArg = empresaArg ? Number(empresaArg.split('=')[1]) : null;

const pythonParser = String.raw`
import json
import re
import sys
from pypdf import PdfReader

pdf_path = sys.argv[1]
reader = PdfReader(pdf_path)
blocks = []
for page_number, page in enumerate(reader.pages, 1):
    text = page.extract_text(extraction_mode='layout') or ''
    for block in [item for item in text.split('\n\n') if item.strip()]:
        lines = block.splitlines()
        first = lines[0][0:25].strip() if lines else ''
        if not (re.match(r'^PROD-\d+$', first) or re.match(r'^\d+$', first)):
            continue
        columns = [[] for _ in range(9)]
        for line in lines:
            bounds = [0, 25, 52, 64, 70, 80, 90, 98, 108, len(line)]
            for index in range(9):
                columns[index].append(line[bounds[index]:bounds[index + 1]].strip())
        values = [re.sub(r'\s+', ' ', ' '.join(part for part in column if part)).strip() for column in columns]
        blocks.append({'page': page_number, 'values': values})

records = []
for block in blocks:
    values = block['values']
    # Algumas linhas de produtos muito altas quebram na página seguinte.
    # Quando isso acontece, juntamos o fragmento ao registro anterior.
    incomplete = not values[5] or not values[7] or not values[8]
    if incomplete:
        if not records:
            raise RuntimeError('Fragmento de tabela sem registro anterior')
        previous = records[-1]
        previous['sku'] = re.sub(r'\s+', '', previous['sku'] + values[0])
        previous['name'] = (previous['name'] + ' ' + values[1]).strip()
        for index, field in [(2, 'category'), (3, 'unit'), (5, 'sale'), (7, 'current'), (8, 'status')]:
            if values[index] and not previous[field]:
                previous[field] = values[index]
        for index, field in [(4, 'buy'), (6, 'minimum')]:
            if values[index]:
                previous[field] = re.sub(r'\s+', '', previous[field] + values[index])
        continue

    records.append({
        'page': block['page'],
        'sku': re.sub(r'\s+', '', values[0]),
        'name': values[1],
        'category': values[2],
        'unit': values[3],
        'buy': values[4],
        'sale': values[5],
        'minimum': values[6],
        'current': values[7],
        'status': values[8]
    })

# Dois textos da tabela foram codificados de forma defeituosa no PDF.
# Os valores abaixo foram conferidos visualmente na página indicada.
for record in records:
    if record['sku'] == 'PROD-1787851566249':
        record.update({
            'name': 'Tônico capilar Cavalo de raça 30 ml Bio Instinto',
            'category': 'Outros',
            'unit': 'UN',
            'buy': 'R$ 0,00',
            'sale': 'R$ 25,00',
            'minimum': '3',
            'current': '10',
            'status': 'OK'
        })

print(json.dumps({'pages': len(reader.pages), 'records': records}, ensure_ascii=False))
`;

const asText = value => String(value ?? '').replace(/\u00a0/g, ' ').trim();
const normalized = value => asText(value).replace(/\s+/g, ' ').trim();
const numberFromReport = (value, fallback = 0) => {
  const compact = asText(value).replace(/R\$/gi, '').replace(/\s+/g, '').replace(/\./g, '').replace(',', '.');
  const number = Number(compact);
  return Number.isFinite(number) ? number : fallback;
};
const normalizedCategory = value => {
  const category = normalized(value);
  if (!category || category === '-') return null;
  return category.replace(/\s+s$/i, 's');
};
const normalizedUnit = value => {
  const unit = normalized(value).toUpperCase();
  if (unit === 'KG') return 'KG';
  if (unit === 'UN' || unit === 'UND' || unit === 'UNIDADE') return 'UN';
  return 'UN';
};
const normalizedName = value => normalized(value).replace(/\s+([,.;:])/g, '$1');

if (!fs.existsSync(pdfPath)) throw new Error(`PDF não encontrado: ${pdfPath}`);

const parsed = JSON.parse(execFileSync('python3', ['-c', pythonParser, pdfPath], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }));
const fileHash = crypto.createHash('sha256').update(fs.readFileSync(pdfPath)).digest('hex');
const records = parsed.records.map(record => ({
  page: record.page,
  sku: record.sku,
  name: normalizedName(record.name),
  category: normalizedCategory(record.category),
  unit: normalizedUnit(record.unit),
  buy: Number(numberFromReport(record.buy).toFixed(3)),
  sale: Number(numberFromReport(record.sale).toFixed(2)),
  minimum: Number(numberFromReport(record.minimum).toFixed(3)),
  current: Number(numberFromReport(record.current).toFixed(3)),
  status: normalized(record.status)
}));

const invalid = records.filter(item => !item.sku || !item.name || !Number.isFinite(item.sale) || !Number.isFinite(item.current));
if (invalid.length) throw new Error(`O PDF possui ${invalid.length} registro(s) inválido(s)`);
const duplicateSkus = records.filter((item, index) => records.findIndex(other => other.sku === item.sku) !== index);
if (duplicateSkus.length) throw new Error(`O PDF possui SKU(s) duplicado(s): ${[...new Set(duplicateSkus.map(item => item.sku))].join(', ')}`);

const empresa = empresaIdArg
  ? await Empresa.findByPk(empresaIdArg)
  : await Empresa.findOne({ where: { nome: 'Saúde e Vida' } });
if (!empresa) throw new Error('Empresa Saúde e Vida não encontrada');

const existing = await Product.findAll({
  where: { empresa_id: empresa.id },
  attributes: ['id', 'code', 'name', 'currentQuantity'],
  raw: true
});
const byCode = new Map(existing.filter(item => item.code).map(item => [String(item.code), item]));
const matches = records.filter(item => byCode.has(item.sku));
const creates = records.filter(item => !byCode.has(item.sku));
const categories = [...new Set(records.map(item => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
const units = [...new Set(records.map(item => item.unit))].sort();
const summary = {
  empresa: { id: empresa.id, nome: empresa.nome },
  pdf: pdfPath,
  paginas: parsed.pages,
  itens: records.length,
  novos: creates.length,
  existentesPorSku: matches.length,
  categorias: categories,
  unidades: units,
  estoqueTotalNumerico: Number(records.reduce((sum, item) => sum + item.current, 0).toFixed(3)),
  hash: fileHash
};

const alreadyImported = await FiscalStockImport.findOne({ where: { empresa_id: empresa.id, source_hash: fileHash }, attributes: ['id', 'imported_at'], raw: true });
if (alreadyImported) {
  console.log(JSON.stringify({ ...summary, status: 'already_imported', importId: alreadyImported.id, importedAt: alreadyImported.imported_at }, null, 2));
  await sequelize.close();
  process.exit(0);
}

if (!apply) {
  console.log(JSON.stringify({ ...summary, status: 'dry_run' }, null, 2));
  await sequelize.close();
  process.exit(0);
}

const transaction = await sequelize.transaction();
try {
  const stockImport = await FiscalStockImport.create({
    empresa_id: empresa.id,
    source_hash: fileHash,
    source_type: 'pdf_stock_report',
    supplier_name: null,
    supplier_snapshot: {
      arquivo: path.basename(pdfPath),
      paginas: parsed.pages,
      emitido_em: '13/10/2026 12:37:28',
      tipo: 'saldo de estoque importado de relatório PDF'
    },
    imported_at: new Date()
  }, { transaction });

  let created = 0;
  let updated = 0;
  let movements = 0;
  const productByCode = new Map();
  const itemsToCreate = records.filter(item => !byCode.has(item.sku));
  const itemsToUpdate = records.filter(item => byCode.has(item.sku));

  for (const item of itemsToUpdate) {
    const product = await Product.findOne({
      where: { id: byCode.get(item.sku).id, empresa_id: empresa.id },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!product) throw new Error(`Produto existente não encontrado para o SKU ${item.sku}`);
    const previousQuantity = Number(product.currentQuantity || 0);
    await product.update({
      name: item.name,
      category: item.category,
      unidade_medida: item.unit,
      unidade_comercial: item.unit,
      unidade_tributavel: item.unit,
      price: item.sale,
      preco_compra: item.buy,
      minQuantity: item.minimum,
      currentQuantity: item.current,
      loja_online_ativo: false
    }, { transaction });
    productByCode.set(item.sku, { product, item, previousQuantity, action: 'update' });
    updated += 1;
  }

  const newProducts = await Product.bulkCreate(itemsToCreate.map(item => ({
    empresa_id: empresa.id,
    name: item.name,
    code: item.sku,
    category: item.category,
    unidade_medida: item.unit,
    unidade_comercial: item.unit,
    unidade_tributavel: item.unit,
    price: item.sale,
    preco_compra: item.buy,
    minQuantity: item.minimum,
    currentQuantity: item.current,
    loja_online_ativo: false
  })), { transaction, returning: true });
  for (let index = 0; index < newProducts.length; index += 1) {
    const item = itemsToCreate[index];
    productByCode.set(item.sku, { product: newProducts[index], item, previousQuantity: 0, action: 'create' });
  }
  created = newProducts.length;

  const movementRows = [];
  const importItemRows = [];
  for (const item of records) {
    const entry = productByCode.get(item.sku);
    if (!entry) throw new Error(`Produto não preparado para o SKU ${item.sku}`);
    const { product, previousQuantity, action } = entry;
    const difference = Number((item.current - previousQuantity).toFixed(3));
    if (Math.abs(difference) >= 0.0005) {
      movementRows.push({
        produto_id: product.id,
        empresa_id: empresa.id,
        tipo: difference > 0 ? 'entrada' : 'saida',
        quantidade: Math.abs(difference),
        motivo: 'Importação/conferência do relatório de estoque PDF',
        origem_tipo: 'relatorio_estoque_pdf',
        origem_id: stockImport.id,
        data: new Date()
      });
    }
    importItemRows.push({
      import_id: stockImport.id,
      product_id: product.id,
      external_code: item.sku,
      description: item.name,
      quantity: item.current,
      unit_cost: item.buy,
      action
    });
  }

  if (movementRows.length) {
    await Movimento.bulkCreate(movementRows, { transaction });
    movements = movementRows.length;
  }
  await FiscalStockImportItem.bulkCreate(importItemRows, { transaction });
  await transaction.commit();
  console.log(JSON.stringify({ ...summary, status: 'imported', importId: stockImport.id, criados: created, atualizados: updated, movimentos: movements }, null, 2));
} catch (error) {
  await transaction.rollback();
  throw error;
} finally {
  await sequelize.close();
}
