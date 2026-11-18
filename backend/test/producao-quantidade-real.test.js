import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import migration from '../migrations/20260916203000-add-production-actual-quantity.cjs';
import consumoMigration from '../migrations/20260923150000-add-production-consumption-snapshot.cjs';

test('migration adiciona e preenche a quantidade realmente produzida sem alterar movimentos', async () => {
  const consultas = [];
  let commits = 0;
  const transaction = {
    async commit() { commits += 1; },
    async rollback() { throw new Error('rollback inesperado'); },
  };
  const queryInterface = {
    sequelize: {
      async transaction() { return transaction; },
      async query(sql) { consultas.push(String(sql).replace(/\s+/g, ' ').trim()); },
    },
  };

  await migration.up(queryInterface);

  assert.equal(commits, 1);
  assert.ok(consultas.some((sql) => sql.includes('ADD COLUMN IF NOT EXISTS quantidade_produzida')));
  assert.ok(consultas.some((sql) => sql.includes("origem_tipo = 'producao'") && sql.includes("tipo = 'entrada'")));
  assert.equal(consultas.some((sql) => /UPDATE movimentos|DELETE FROM movimentos|TRUNCATE/i.test(sql)), false);
});

test('produção persiste quantidade real e exige confirmação para divergência extrema', () => {
  const source = fs.readFileSync(new URL('../src/routes/producaoRoutes.js', import.meta.url), 'utf8');

  assert.match(source, /quantidade_produzida:\s*qtdProduzida/);
  assert.match(source, /QUANTIDADE_PRODUZIDA_DIVERGENTE/);
  assert.match(source, /confirmar_divergencia_quantidade/);
  assert.match(source, /quantidadeEsperadaDaReceita\(receita, qtdReceitas/);
});

test('migration adiciona o snapshot do consumo sem apagar o histórico', async () => {
  const consultas = [];
  let commits = 0;
  const transaction = {
    async commit() { commits += 1; },
    async rollback() { throw new Error('rollback inesperado'); },
  };
  const queryInterface = {
    sequelize: {
      async transaction() { return transaction; },
      async query(sql) { consultas.push(String(sql).replace(/\s+/g, ' ').trim()); },
    },
  };

  await consumoMigration.up(queryInterface);

  assert.equal(commits, 1);
  assert.ok(consultas.some((sql) => sql.includes('ADD COLUMN IF NOT EXISTS itens_consumidos JSONB')));
  assert.equal(consultas.some((sql) => /DELETE FROM movimentos|TRUNCATE/i.test(sql)), false);
});

test('produção registra consumo, oferece consulta e desfaz por movimentos compensatórios', () => {
  const source = fs.readFileSync(new URL('../src/routes/producaoRoutes.js', import.meta.url), 'utf8');

  assert.match(source, /itens_consumidos:\s*itensConsumidos/);
  assert.match(source, /router\.get\('\/ordens\/:id\/consumo'/);
  assert.match(source, /router\.post\('\/ordens\/:id\/desfazer'/);
  assert.match(source, /producao_desfazimento/);
  assert.match(source, /status: 'desfeita'/);
});

test('tela de produção permite consultar o consumo e desfazer somente ordens concluídas', () => {
  const source = fs.readFileSync(new URL('../../frontend/app/(main)/uikit/producao/page.tsx', import.meta.url), 'utf8');

  assert.match(source, /Ver insumos utilizados/);
  assert.match(source, /desfazerOrdem/);
  assert.match(source, /\/producao\/ordens\/\$\{o\.id\}\/desfazer/);
  assert.match(source, /Desperdício \/ excedente/);
});

test('histórico de produção usa quantidade produzida em vez do número de receitas', () => {
  const source = fs.readFileSync(new URL('../../frontend/app/(main)/uikit/producao/page.tsx', import.meta.url), 'utf8');

  assert.match(source, /o\.quantidade_produzida \?\? o\.quantidade_final \?\? o\.quantidade/);
  assert.doesNotMatch(source, /Total produzido[\s\S]{0,180}acc \+ Number\(o\.quantidade\)/);
});

test('histórico ignora movimentos zerados e usa fim de período inclusivo', () => {
  const source = fs.readFileSync(new URL('../src/services/MovimentoService.js', import.meta.url), 'utf8');

  assert.match(source, /quantidade:\s*\{\s*\[Op\.gt\]:\s*0\s*\}/);
  assert.match(source, /filtroDataInclusivo\(filters\.dataInicio, filters\.dataFim, Op\)/);
  assert.doesNotMatch(source, /Op\.lte\]\s*=\s*new Date\(filters\.dataFim\)/);
});

test('edição com o mesmo saldo não cria movimento zerado', () => {
  const source = fs.readFileSync(new URL('../src/services/ProductService.js', import.meta.url), 'utf8');

  assert.match(source, /Math\.abs\(diff\) >= 0\.0005/);
  assert.match(source, /const qtdAntes = Number\(product\.currentQuantity\)/);
});

test('giro de estoque desconsidera vendas canceladas', () => {
  const source = fs.readFileSync(new URL('../../frontend/app/(main)/uikit/formlayout/page.tsx', import.meta.url), 'utf8');

  assert.match(source, /m\.origem_tipo === 'venda_cancelada'/);
  assert.match(source, /m\.tipo === 'saida' && !vendaFoiCancelada/);
});
