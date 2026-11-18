import assert from 'node:assert/strict';
import test from 'node:test';

import sequelize from '../src/config/database.js';
import Fornecedor from '../src/models/Fornecedor.js';
import Movimento from '../src/models/Movimento.js';
import Product from '../src/models/Product.js';
import productService from '../src/services/ProductService.js';

const withModelMocks = async (mocks, callback) => {
  const originals = [];
  for (const [target, method, replacement] of mocks) {
    originals.push([target, method, target[method]]);
    target[method] = replacement;
  }
  try {
    await callback();
  } finally {
    for (const [target, method, original] of originals) target[method] = original;
  }
};

test('produto pode ser cadastrado sem fornecedor', async () => {
  const transaction = {
    commit: async () => {},
    rollback: async () => {},
  };
  let dadosCriados;

  await withModelMocks([
    [sequelize, 'transaction', async () => transaction],
    [Fornecedor, 'findOne', async () => {
      throw new Error('Fornecedor não deve ser consultado quando não foi informado');
    }],
    [Product, 'create', async dados => {
      dadosCriados = { ...dados };
      return { id: 21, ...dados };
    }],
    [Movimento, 'create', async () => {
      throw new Error('Não deve criar movimento para produto sem estoque inicial');
    }],
  ], async () => {
    const produto = await productService.createProduct({
      name: 'Produto sem fornecedor',
      fornecedor_id: null,
      price: 10,
      currentQuantity: 0,
    }, { id: 4, empresa_id: 3 });

    assert.equal(produto.id, 21);
    assert.equal(dadosCriados.fornecedor_id, null);
    assert.equal(dadosCriados.empresa_id, 3);
  });
});

test('produto unitário usa custo da caixa e começa sem duplicar estoque', async () => {
  const transaction = {
    commit: async () => {},
    rollback: async () => {},
  };
  const caixa = {
    id: 10,
    empresa_id: 3,
    unidade_medida: 'CX',
    unidades_por_caixa: 12,
    preco_compra: 120,
    price: 180,
    is_materia_prima: false,
    fornecedor_id: 8,
    origem: 1,
    ncm: '19059090',
    cfop: '5102',
    cest: '1706400',
    cst_csosn: '102',
    cst_pis: '07',
    cst_cofins: '07',
    aliquota_icms: '18.00',
    aliquota_pis: '1.65',
    aliquota_cofins: '7.60',
    aliquota_ipi: '5.00',
    ibs_cbs_situacao_tributaria: '000',
    ibs_cbs_classificacao_tributaria: '000001',
  };
  let dadosCriados;
  let buscaProduto = 0;

  await withModelMocks([
    [sequelize, 'transaction', async () => transaction],
    [Product, 'findOne', async () => {
      buscaProduto += 1;
      return buscaProduto === 1 ? caixa : null;
    }],
    [Fornecedor, 'findOne', async () => ({ id: 8 })],
    [Product, 'create', async dados => {
      dadosCriados = { ...dados };
      return { id: 20, ...dados };
    }],
    [Movimento, 'create', async () => {
      throw new Error('Não deve criar movimento para produto unitário com estoque zero');
    }],
  ], async () => {
    const produto = await productService.createProduct({
      name: 'Produto unitário',
      fornecedor_id: 999,
      caixa_origem_id: 10,
      unidade_medida: 'KG',
      unidades_por_caixa: 5,
      preco_compra: 999,
      price: 15,
      currentQuantity: 144,
      ncm: 'NCM-INCORRETO',
      cfop: '9999',
      cst_csosn: '999',
    }, { id: 4, empresa_id: 3 });

    assert.equal(produto.id, 20);
    assert.equal(dadosCriados.preco_compra, 10);
    assert.equal(dadosCriados.currentQuantity, 0);
    assert.equal(dadosCriados.unidade_medida, 'UN');
    assert.equal(dadosCriados.unidade_comercial, 'UN');
    assert.equal(dadosCriados.unidade_tributavel, 'UN');
    assert.equal(dadosCriados.unidades_por_caixa, null);
    assert.equal(dadosCriados.fornecedor_id, 8);
    assert.equal(dadosCriados.empresa_id, 3);
    assert.equal(dadosCriados.origem, caixa.origem);
    assert.equal(dadosCriados.ncm, caixa.ncm);
    assert.equal(dadosCriados.cfop, caixa.cfop);
    assert.equal(dadosCriados.cest, caixa.cest);
    assert.equal(dadosCriados.cst_csosn, caixa.cst_csosn);
    assert.equal(dadosCriados.cst_pis, caixa.cst_pis);
    assert.equal(dadosCriados.cst_cofins, caixa.cst_cofins);
    assert.equal(dadosCriados.aliquota_icms, caixa.aliquota_icms);
    assert.equal(dadosCriados.aliquota_pis, caixa.aliquota_pis);
    assert.equal(dadosCriados.aliquota_cofins, caixa.aliquota_cofins);
    assert.equal(dadosCriados.aliquota_ipi, caixa.aliquota_ipi);
    assert.equal(dadosCriados.ibs_cbs_situacao_tributaria, caixa.ibs_cbs_situacao_tributaria);
    assert.equal(dadosCriados.ibs_cbs_classificacao_tributaria, caixa.ibs_cbs_classificacao_tributaria);
  });
});

test('produto unitário usa custo do pacote e começa com estoque zero', async () => {
  const transaction = {
    commit: async () => {},
    rollback: async () => {},
  };
  const pacote = {
    id: 30,
    empresa_id: 3,
    unidade_medida: 'PCT',
    unidades_por_caixa: 6,
    preco_compra: 48,
    price: 72,
    is_materia_prima: false,
    fornecedor_id: null,
    origem: 0,
    ncm: '22021000',
    cfop: '5405',
    cest: '0301100',
    cst_csosn: '500',
    cst_pis: '04',
    cst_cofins: '04',
    aliquota_icms: '0.00',
    aliquota_pis: '0.00',
    aliquota_cofins: '0.00',
    aliquota_ipi: '0.00',
    ibs_cbs_situacao_tributaria: '200',
    ibs_cbs_classificacao_tributaria: '200001',
  };
  let dadosCriados;
  let buscaProduto = 0;

  await withModelMocks([
    [sequelize, 'transaction', async () => transaction],
    [Product, 'findOne', async () => (buscaProduto++ === 0 ? pacote : null)],
    [Product, 'create', async dados => {
      dadosCriados = { ...dados };
      return { id: 31, ...dados };
    }],
    [Movimento, 'create', async () => {
      throw new Error('Não deve criar movimento para produto unitário com estoque zero');
    }],
  ], async () => {
    await productService.createProduct({
      name: 'Unidade do pacote',
      caixa_origem_id: pacote.id,
      price: 12,
      currentQuantity: 60,
    }, { id: 4, empresa_id: 3 });

    assert.equal(dadosCriados.preco_compra, 8);
    assert.equal(dadosCriados.currentQuantity, 0);
    assert.equal(dadosCriados.unidade_medida, 'UN');
    assert.equal(dadosCriados.caixa_origem_id, pacote.id);
    assert.equal(dadosCriados.ncm, pacote.ncm);
    assert.equal(dadosCriados.cfop, pacote.cfop);
    assert.equal(dadosCriados.cest, pacote.cest);
    assert.equal(dadosCriados.cst_csosn, pacote.cst_csosn);
    assert.equal(dadosCriados.ibs_cbs_situacao_tributaria, pacote.ibs_cbs_situacao_tributaria);
    assert.equal(dadosCriados.ibs_cbs_classificacao_tributaria, pacote.ibs_cbs_classificacao_tributaria);
  });
});

test('produto a granel herda dados fiscais no backend mesmo com payload divergente', async () => {
  const transaction = {
    commit: async () => {},
    rollback: async () => {},
  };
  const origem = {
    id: 40,
    empresa_id: 3,
    fornecedor_id: 8,
    origem: 2,
    ncm: '21069090',
    cfop: '5102',
    cest: '1709900',
    cst_csosn: '102',
    cst_pis: '07',
    cst_cofins: '07',
    aliquota_icms: '12.00',
    aliquota_pis: '1.65',
    aliquota_cofins: '7.60',
    aliquota_ipi: '0.00',
    ibs_cbs_situacao_tributaria: '000',
    ibs_cbs_classificacao_tributaria: '000002',
  };
  let dadosCriados;

  await withModelMocks([
    [sequelize, 'transaction', async () => transaction],
    [Product, 'findOne', async () => origem],
    [Fornecedor, 'findOne', async () => ({ id: 8 })],
    [Product, 'create', async dados => {
      dadosCriados = { ...dados };
      return { id: 41, ...dados };
    }],
    [Movimento, 'create', async () => {
      throw new Error('Não deve criar movimento para produto a granel sem estoque inicial');
    }],
  ], async () => {
    await productService.createProduct({
      name: 'Produto a granel',
      granel_origem_id: origem.id,
      fornecedor_id: null,
      unidade_medida: 'KG',
      price: 45,
      currentQuantity: 0,
      ncm: 'NCM-INCORRETO',
      cfop: '9999',
      cst_csosn: '999',
    }, { id: 4, empresa_id: 3 });

    assert.equal(dadosCriados.fornecedor_id, origem.fornecedor_id);
    for (const campo of [
      'origem', 'ncm', 'cfop', 'cest', 'cst_csosn', 'cst_pis', 'cst_cofins',
      'aliquota_icms', 'aliquota_pis', 'aliquota_cofins', 'aliquota_ipi',
      'ibs_cbs_situacao_tributaria', 'ibs_cbs_classificacao_tributaria',
    ]) {
      assert.equal(dadosCriados[campo], origem[campo], `campo ${campo} não foi herdado`);
    }
    assert.equal(dadosCriados.unidade_medida, 'KG');
    assert.equal(dadosCriados.price, 45);
  });
});

test('origem do granel é limitada à empresa selecionada', async () => {
  const transaction = {
    commit: async () => {},
    rollbackCalled: false,
    async rollback() { this.rollbackCalled = true; },
  };
  let whereConsultado;

  await withModelMocks([
    [sequelize, 'transaction', async () => transaction],
    [Product, 'findOne', async ({ where }) => {
      whereConsultado = where;
      return null;
    }],
  ], async () => {
    await assert.rejects(
      () => productService.createProduct({
        name: 'Granel inválido',
        granel_origem_id: 999,
        price: 10,
        currentQuantity: 0,
      }, { id: 4, empresa_id: 3 }),
      /Produto de origem do granel não encontrado para esta empresa/,
    );
    assert.deepEqual(whereConsultado, { id: 999, empresa_id: 3 });
    assert.equal(transaction.rollbackCalled, true);
  });
});

test('produto unitário duplicado para a mesma caixa é rejeitado', async () => {
  const transaction = {
    commit: async () => {},
    rollback: async () => {},
  };
  const caixa = {
    id: 10,
    empresa_id: 3,
    name: 'Caixa com 12',
    unidade_medida: 'CX',
    unidades_por_caixa: 12,
    preco_compra: 120,
    is_materia_prima: false,
    fornecedor_id: null,
  };
  let buscaProduto = 0;

  await withModelMocks([
    [sequelize, 'transaction', async () => transaction],
    [Product, 'findOne', async () => {
      buscaProduto += 1;
      return buscaProduto === 1
        ? caixa
        : { id: 20, name: 'Unidade já existente', caixa_origem_id: caixa.id };
    }],
    [Product, 'create', async () => {
      throw new Error('Não deve criar uma segunda unidade para a caixa');
    }],
  ], async () => {
    await assert.rejects(
      () => productService.createProduct({
        name: 'Outra unidade',
        caixa_origem_id: caixa.id,
        price: 15,
        currentQuantity: 0,
      }, { id: 4, empresa_id: 3 }),
      /Já existe um produto unitário vinculado a esta caixa/,
    );
  });
});

test('transferência de caixa atualiza os dois saldos e registra os dois movimentos', async () => {
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    commitCalled: false,
    rollbackCalled: false,
    async commit() { this.commitCalled = true; },
    async rollback() { this.rollbackCalled = true; },
  };
  const atualizacoes = [];
  const caixa = {
    id: 10,
    name: 'Caixa com 12',
    unidade_medida: 'CX',
    unidades_por_caixa: 12,
    currentQuantity: 5,
    async update(values) {
      atualizacoes.push(['caixa', values.currentQuantity]);
    },
  };
  const unidade = {
    id: 20,
    name: 'Produto unitário',
    caixa_origem_id: 10,
    currentQuantity: 7,
    async update(values) {
      atualizacoes.push(['unidade', values.currentQuantity]);
    },
  };
  const movimentos = [];
  let busca = 0;

  await withModelMocks([
    [sequelize, 'transaction', async () => transaction],
    [Product, 'findOne', async () => (busca++ === 0 ? caixa : unidade)],
    [Movimento, 'create', async dados => movimentos.push(dados)],
  ], async () => {
    const resultado = await productService.transferBoxes({
      origem_id: 10,
      unidade_id: 20,
      quantidade_caixas: 2,
    }, { id: 4, empresa_id: 3 });

    assert.equal(resultado.quantidade_unidades, 24);
    assert.deepEqual(atualizacoes, [['caixa', 3], ['unidade', 31]]);
    assert.equal(movimentos.length, 2);
    assert.equal(movimentos[0].tipo, 'saida');
    assert.equal(movimentos[0].quantidade, 2);
    assert.equal(movimentos[1].tipo, 'entrada');
    assert.equal(movimentos[1].quantidade, 24);
    assert.equal(transaction.commitCalled, true);
    assert.equal(transaction.rollbackCalled, false);
  });
});

test('transferência de pacote atualiza os dois saldos e respeita a quantidade por pacote', async () => {
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    async commit() {},
    async rollback() {},
  };
  const atualizacoes = [];
  const pacote = {
    id: 30,
    name: 'Pacote com 6',
    unidade_medida: 'PCT',
    unidades_por_caixa: 6,
    currentQuantity: 4,
    async update(values) {
      atualizacoes.push(['pacote', values.currentQuantity]);
    },
  };
  const unidade = {
    id: 31,
    name: 'Produto unitário',
    caixa_origem_id: 30,
    currentQuantity: 2,
    async update(values) {
      atualizacoes.push(['unidade', values.currentQuantity]);
    },
  };
  let busca = 0;

  await withModelMocks([
    [sequelize, 'transaction', async () => transaction],
    [Product, 'findOne', async () => (busca++ === 0 ? pacote : unidade)],
    [Movimento, 'create', async () => {}],
  ], async () => {
    const resultado = await productService.transferBoxes({
      origem_id: pacote.id,
      unidade_id: unidade.id,
      quantidade_caixas: 3,
    }, { id: 4, empresa_id: 3 });

    assert.equal(resultado.tipo_origem, 'pacote');
    assert.equal(resultado.quantidade_unidades, 18);
    assert.deepEqual(atualizacoes, [['pacote', 1], ['unidade', 20]]);
  });
});

test('transferência não permite usar produto unitário de outra caixa', async () => {
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    async commit() {},
    rollbackCalled: false,
    async rollback() { this.rollbackCalled = true; },
  };
  let busca = 0;

  await withModelMocks([
    [sequelize, 'transaction', async () => transaction],
    [Product, 'findOne', async () => (
      busca++ === 0
        ? { id: 10, unidade_medida: 'CX', unidades_por_caixa: 12, currentQuantity: 5 }
        : { id: 20, caixa_origem_id: 99, currentQuantity: 0 }
    )],
  ], async () => {
    await assert.rejects(
      productService.transferBoxes({
        origem_id: 10,
        unidade_id: 20,
        quantidade_caixas: 1,
      }, { id: 4, empresa_id: 3 }),
      /não pertence a esta caixa/
    );
    assert.equal(transaction.rollbackCalled, true);
  });
});

test('vínculo legado preserva estoque e recalcula somente o custo unitário', async () => {
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    async commit() {},
    async rollback() {},
  };
  const caixa = {
    id: 10,
    code: 'CX-10',
    unidade_medida: 'CX',
    unidades_por_caixa: 10,
    preco_compra: 90,
    is_materia_prima: false,
  };
  let atualizacao;
  const unidade = {
    id: 20,
    code: 'CX-10-UN',
    currentQuantity: 37,
    caixa_origem_id: null,
    async update(values) {
      atualizacao = values;
      Object.assign(this, values);
    },
  };
  let busca = 0;

  await withModelMocks([
    [sequelize, 'transaction', async () => transaction],
    [Product, 'findOne', async () => (busca++ === 0 ? caixa : unidade)],
  ], async () => {
    const resultado = await productService.linkLegacyBoxUnit({
      origem_id: 10,
      unidade_id: 20,
    }, { id: 4, empresa_id: 3 });

    assert.equal(resultado.currentQuantity, 37);
    assert.equal(atualizacao.caixa_origem_id, 10);
    assert.equal(atualizacao.preco_compra, 9);
    assert.equal(Object.hasOwn(atualizacao, 'currentQuantity'), false);
  });
});
