import assert from 'node:assert/strict';
import test from 'node:test';

import sequelize from '../src/config/database.js';
import EntradaInsumoSemNota from '../src/models/EntradaInsumoSemNota.js';
import Movimento from '../src/models/Movimento.js';
import Product from '../src/models/Product.js';
import RawMaterial from '../src/models/RawMaterial.js';
import entradaInsumoSemNotaService from '../src/services/EntradaInsumoSemNotaService.js';
import fiscalStockImportService from '../src/services/FiscalStockImportService.js';
import FiscalProductMapping from '../src/models/FiscalProductMapping.js';
import FiscalStockImport from '../src/models/FiscalStockImport.js';
import FiscalStockImportItem from '../src/models/FiscalStockImportItem.js';
import Fornecedor from '../src/models/Fornecedor.js';

const XML_NFE = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc><NFe><infNFe Id="NFe123"><ide><nNF>321</nNF><dhEmi>2026-09-21T10:00:00-03:00</dhEmi></ide><emit><CNPJ>12345678000190</CNPJ><xNome>Fornecedor NF</xNome></emit><det nItem="1"><prod><cProd>ABC-1</cProd><xProd>Leite</xProd><uCom>L</uCom><qCom>3</qCom><vUnCom>8.50</vUnCom><vProd>25.50</vProd></prod><imposto><ICMS><ICMS00><orig>0</orig><CST>00</CST></ICMS00></ICMS></imposto></det></infNFe></NFe></nfeProc>`;

const criarRegistro = (dados) => ({
  ...dados,
  atualizacoes: [],
  async update(valores) {
    this.atualizacoes.push(valores);
    Object.assign(this, valores);
  }
});

const executarComMocks = async ({ insumo, produto, dados }, verificar) => {
  const originais = {
    transaction: sequelize.transaction,
    rawMaterialFindOne: RawMaterial.findOne,
    productFindOne: Product.findOne,
    entradaCreate: EntradaInsumoSemNota.create,
    movimentoCreate: Movimento.create
  };
  const criadas = { entradas: [], movimentos: [] };
  const transacao = {
    LOCK: { UPDATE: 'UPDATE' },
    committed: false,
    rolledBack: false,
    async commit() { this.committed = true; },
    async rollback() { this.rolledBack = true; }
  };

  sequelize.transaction = async () => transacao;
  RawMaterial.findOne = async () => insumo;
  Product.findOne = async () => produto;
  EntradaInsumoSemNota.create = async (valores) => {
    const entrada = { id: 91, ...valores };
    criadas.entradas.push(entrada);
    return entrada;
  };
  Movimento.create = async (valores) => {
    criadas.movimentos.push(valores);
    return valores;
  };

  try {
    const resultado = await entradaInsumoSemNotaService.registrar(8, dados, { id: 4, empresa_id: 2 });
    await verificar({ resultado, criadas, transacao, insumo, produto });
  } finally {
    sequelize.transaction = originais.transaction;
    RawMaterial.findOne = originais.rawMaterialFindOne;
    Product.findOne = originais.productFindOne;
    EntradaInsumoSemNota.create = originais.entradaCreate;
    Movimento.create = originais.movimentoCreate;
  }
};

test('entrada sem NF soma o estoque e registra a troca de custo do insumo', async () => {
  const insumo = criarRegistro({ id: 8, empresa_id: 2, name: 'Leite', unit: 'L', currentQuantity: 10, price: 3.5, minQuantity: 1 });
  const produto = criarRegistro({ id: 17, empresa_id: 2, raw_material_id: 8, currentQuantity: 10, price: 3.5, preco_compra: 3.5 });

  await executarComMocks({
    insumo,
    produto,
    dados: { quantidade: 2.5, preco_unitario: 4.25, observacao: 'Compra no atacado' }
  }, ({ resultado, criadas, transacao }) => {
    assert.equal(resultado.estoque_anterior, 10);
    assert.equal(resultado.estoque_posterior, 12.5);
    assert.equal(resultado.preco_anterior, 3.5);
    assert.equal(resultado.preco_unitario, 4.25);
    assert.equal(produto.currentQuantity, 12.5);
    assert.equal(produto.price, 4.25);
    assert.equal(insumo.currentQuantity, 12.5);
    assert.equal(insumo.price, 4.25);
    assert.deepEqual(criadas.movimentos[0], {
      produto_id: 17,
      empresa_id: 2,
      usuario_id: 4,
      tipo: 'entrada',
      quantidade: 2.5,
      motivo: 'Entrada sem NF',
      origem_tipo: 'entrada_sem_nf',
      origem_id: 91,
      data: resultado.data_entrada
    });
    assert.equal(transacao.committed, true);
    assert.equal(transacao.rolledBack, false);
  });
});

test('entrada sem NF mantém o custo quando nenhum novo valor é informado', async () => {
  const insumo = criarRegistro({ id: 8, empresa_id: 2, name: 'Leite', unit: 'L', currentQuantity: 5, price: 7, minQuantity: 1 });
  const produto = criarRegistro({ id: 17, empresa_id: 2, raw_material_id: 8, currentQuantity: 5, price: 7, preco_compra: 7 });

  await executarComMocks({
    insumo,
    produto,
    dados: { quantidade: 1, preco_unitario: null, observacao: '' }
  }, ({ resultado, criadas }) => {
    assert.equal(resultado.preco_unitario, null);
    assert.equal(resultado.preco_anterior, 7);
    assert.equal(produto.currentQuantity, 6);
    assert.equal(produto.price, 7);
    assert.equal(produto.preco_compra, 7);
    assert.equal(insumo.currentQuantity, 6);
    assert.equal(insumo.price, 7);
    assert.equal(criadas.movimentos[0].quantidade, 1);
  });
});

test('importação por XML registra custo no histórico e atualiza o insumo vinculado', async () => {
  const originais = {
    transaction: sequelize.transaction,
    fiscalImportFindOne: FiscalStockImport.findOne,
    fiscalImportCreate: FiscalStockImport.create,
    fornecedorFindAll: Fornecedor.findAll,
    productFindOne: Product.findOne,
    rawMaterialFindOne: RawMaterial.findOne,
    movimentoCreate: Movimento.create,
    entradaCreate: EntradaInsumoSemNota.create,
    importItemCreate: FiscalStockImportItem.create,
    mappingFindOne: FiscalProductMapping.findOne,
    mappingCreate: FiscalProductMapping.create
  };
  const transacao = {
    LOCK: { UPDATE: 'UPDATE' },
    async commit() {},
    async rollback() {}
  };
  const produto = criarRegistro({
    id: 17, empresa_id: 2, raw_material_id: 8, currentQuantity: 5,
    price: 15, preco_compra: 7, fornecedor_id: null
  });
  const insumo = criarRegistro({ id: 8, empresa_id: 2, currentQuantity: 5, price: 7 });
  const historicos = [];

  sequelize.transaction = async () => transacao;
  FiscalStockImport.findOne = async () => null;
  FiscalStockImport.create = async valores => ({ id: 44, ...valores });
  Fornecedor.findAll = async () => [];
  Product.findOne = async () => produto;
  RawMaterial.findOne = async () => insumo;
  Movimento.create = async () => ({});
  EntradaInsumoSemNota.create = async valores => {
    historicos.push(valores);
    return { id: 99, ...valores };
  };
  FiscalStockImportItem.create = async () => ({});
  FiscalProductMapping.findOne = async () => null;
  FiscalProductMapping.create = async () => ({});

  try {
    await fiscalStockImportService.apply(
      XML_NFE,
      [{ item_key: '1', action: 'link', product_id: 17 }],
      { id: 4, empresa_id: 2 }
    );

    assert.equal(produto.currentQuantity, 8);
    assert.equal(produto.preco_compra, 8.5);
    assert.equal(insumo.currentQuantity, 8);
    assert.equal(insumo.price, 8.5);
    assert.deepEqual(historicos[0], {
      empresa_id: 2,
      raw_material_id: 8,
      produto_id: 17,
      usuario_id: 4,
      quantidade: 3,
      preco_unitario: 8.5,
      preco_anterior: 7,
      estoque_anterior: 5,
      estoque_posterior: 8,
      data_entrada: '2026-09-21T10:00:00-03:00',
      observacao: 'Fornecedor: Fornecedor NF',
      origem_tipo: 'nota_fiscal_entrada',
      origem_id: 44,
      documento: 'NF-e 321'
    });
  } finally {
    sequelize.transaction = originais.transaction;
    FiscalStockImport.findOne = originais.fiscalImportFindOne;
    FiscalStockImport.create = originais.fiscalImportCreate;
    Fornecedor.findAll = originais.fornecedorFindAll;
    Product.findOne = originais.productFindOne;
    RawMaterial.findOne = originais.rawMaterialFindOne;
    Movimento.create = originais.movimentoCreate;
    EntradaInsumoSemNota.create = originais.entradaCreate;
    FiscalStockImportItem.create = originais.importItemCreate;
    FiscalProductMapping.findOne = originais.mappingFindOne;
    FiscalProductMapping.create = originais.mappingCreate;
  }
});
