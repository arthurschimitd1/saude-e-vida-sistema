import assert from 'node:assert/strict';
import test from 'node:test';

import axios from 'axios';
import FocusResellerService from '../src/services/focus/FocusResellerService.js';
import focusInvoiceService from '../src/services/focus/FocusInvoiceService.js';
import NotaFiscalFocus from '../src/models/NotaFiscalFocus.js';

const withMocks = async (mocks, callback) => {
  const originals = mocks.map(([target, method]) => [target, method, target[method]]);
  for (const [target, method, replacement] of mocks) target[method] = replacement;
  try {
    await callback();
  } finally {
    for (const [target, method, original] of originals) target[method] = original;
  }
};

test('download de XML recebido preserva o conteúdo retornado pela Focus', async () => {
  const xml = Buffer.from('<nfeProc><NFe><infNFe /></NFe></nfeProc>');
  const client = {
    defaults: { baseURL: 'https://api.focusnfe.com.br' },
    get: async () => ({
      status: 200,
      data: xml,
      headers: { 'content-type': 'application/xml' }
    })
  };

  await withMocks([
    [FocusResellerService, 'getEmpresaClient', async () => ({ client })],
  ], async () => {
    const resultado = await focusInvoiceService.baixarXMLNFe(3, 'CHAVE');

    assert.equal(resultado.success, true);
    assert.equal(Buffer.from(resultado.data.xml, 'base64').toString(), xml.toString());
    assert.equal(resultado.data.contentType, 'application/xml');
  });
});

test('download de XML recebido usa a URL assinada da consulta completa quando necessário', async () => {
  const xml = Buffer.from('<nfeProc><NFe><infNFe>completa</infNFe></NFe></nfeProc>');
  const chamadas = [];
  const client = {
    defaults: { baseURL: 'https://api.focusnfe.com.br' },
    get: async (endpoint, config) => {
      chamadas.push({ endpoint, config });

      if (endpoint.endsWith('.xml')) {
        const erro = new Error('XML ainda não disponível');
        erro.response = { status: 404, data: { mensagem: 'aguarde' } };
        throw erro;
      }

      return {
        status: 200,
        data: { url_xml: 'https://arquivos.exemplo.com/nfe.xml' },
        headers: { 'content-type': 'application/json' }
      };
    }
  };
  let chamadaAssinada;

  await withMocks([
    [FocusResellerService, 'getEmpresaClient', async () => ({ client, cnpj: '12345678000199' })],
    [axios, 'get', async (url, config) => {
      chamadaAssinada = { url, config };
      return {
        status: 200,
        data: xml,
        headers: { 'content-type': 'application/xml' }
      };
    }],
  ], async () => {
    const resultado = await focusInvoiceService.baixarXMLNFe(3, 'CHAVE');

    assert.equal(resultado.success, true);
    assert.equal(Buffer.from(resultado.data.xml, 'base64').toString(), xml.toString());
    assert.equal(chamadaAssinada.url, 'https://arquivos.exemplo.com/nfe.xml');
    assert.equal(chamadas[1].endpoint, '/v2/nfes_recebidas/CHAVE');
    assert.deepEqual(chamadas[1].config.params, {
      cnpj: '12345678000199',
      completa: '1'
    });
  });
});

test('download de XML não trata resposta intermediária como NF-e válida', async () => {
  const chamadas = [];
  const client = {
    defaults: { baseURL: 'https://api.focusnfe.com.br' },
    get: async (endpoint) => {
      chamadas.push(endpoint);

      if (endpoint.endsWith('.xml')) {
        return {
          status: 200,
          data: Buffer.from('{"mensagem":"XML em processamento NFe"}'),
          headers: { 'content-type': 'application/json' }
        };
      }

      return {
        status: 200,
        data: { mensagem: 'XML ainda não disponível' },
        headers: { 'content-type': 'application/json' }
      };
    }
  };

  await withMocks([
    [FocusResellerService, 'getEmpresaClient', async () => ({
      client,
      cnpj: '12345678000199'
    })]
  ], async () => {
    const resultado = await focusInvoiceService.baixarXMLNFe(3, 'CHAVE');

    assert.equal(resultado.success, false);
    assert.equal(resultado.error.code, 'ERRO_XML_RECEBIDO');
    assert.deepEqual(chamadas, [
      '/v2/nfes_recebidas/CHAVE.xml',
      '/v2/nfes_recebidas/CHAVE',
      '/v2/nfes_recebidas/CHAVE.json'
    ]);
  });
});

test('download tenta a consulta .json quando a rota principal ainda não possui XML', async () => {
  const xml = '<nfeProc><NFe><infNFe>completa</infNFe></NFe></nfeProc>';
  const chamadas = [];
  const client = {
    defaults: { baseURL: 'https://api.focusnfe.com.br' },
    get: async (endpoint) => {
      chamadas.push(endpoint);

      if (endpoint.endsWith('.xml')) {
        return {
          status: 200,
          data: Buffer.from('{"mensagem":"processando"}'),
          headers: { 'content-type': 'application/json' }
        };
      }

      if (endpoint.endsWith('.json')) {
        return {
          status: 200,
          data: { xml },
          headers: { 'content-type': 'application/json' }
        };
      }

      return {
        status: 200,
        data: { mensagem: 'ainda indisponível' },
        headers: { 'content-type': 'application/json' }
      };
    }
  };

  await withMocks([
    [FocusResellerService, 'getEmpresaClient', async () => ({
      client,
      cnpj: '12345678000199'
    })]
  ], async () => {
    const resultado = await focusInvoiceService.baixarXMLNFe(3, 'CHAVE');

    assert.equal(resultado.success, true);
    assert.equal(Buffer.from(resultado.data.xml, 'base64').toString(), xml);
    assert.deepEqual(chamadas, [
      '/v2/nfes_recebidas/CHAVE.xml',
      '/v2/nfes_recebidas/CHAVE',
      '/v2/nfes_recebidas/CHAVE.json'
    ]);
  });
});

test('download de PDF segue URL assinada sem reutilizar autenticação da Focus', async () => {
  const pdf = Buffer.from('%PDF-1.4 teste');
  const client = {
    defaults: { baseURL: 'https://api.focusnfe.com.br' },
    get: async () => ({
      status: 302,
      data: Buffer.alloc(0),
      headers: { location: 'https://arquivos.exemplo.com/danfe-assinada' }
    })
  };
  let chamadaAssinada;

  await withMocks([
    [FocusResellerService, 'getEmpresaClient', async () => ({ client })],
    [axios, 'get', async (url, config) => {
      chamadaAssinada = { url, config };
      return {
        status: 200,
        data: pdf,
        headers: { 'content-type': 'application/pdf' }
      };
    }],
  ], async () => {
    const resultado = await focusInvoiceService.baixarPDFNFe(3, 'CHAVE');

    assert.equal(resultado.success, true);
    assert.equal(chamadaAssinada.url, 'https://arquivos.exemplo.com/danfe-assinada');
    assert.equal(Object.hasOwn(chamadaAssinada.config, 'auth'), false);
    assert.equal(Buffer.from(resultado.data.pdf, 'base64').toString(), pdf.toString());
  });
});

test('listagem reaplica manifestação persistida após novo carregamento', async () => {
  const notas = [
    {
      chave_nfe: 'CHAVE-CONFIRMADA',
      numero_nota: '123',
      data_emissao: '2026-08-20T12:00:00.000Z'
    }
  ];
  const manifestacao = {
    manifestacao_tipo: 'CONFIRMACAO',
    data_manifestacao: '2026-08-20T12:01:00.000Z'
  };

  await withMocks([
    [FocusResellerService, 'getEmpresaClient', async () => ({
      client: {}
    })],
    [focusInvoiceService, 'listarTodasPorVersao', async () => notas],
    [focusInvoiceService, 'buscarManifestacoesPersistidas', async () => (
      new Map([['CHAVE-CONFIRMADA', manifestacao]])
    )]
  ], async () => {
    const resultado = await focusInvoiceService.listarNFeRecebidas(
      3,
      undefined,
      undefined
    );

    assert.equal(resultado.success, true);
    assert.equal(resultado.data[0].manifestacao, 'CONFIRMACAO');
    assert.equal(
      resultado.data[0].data_manifestacao,
      manifestacao.data_manifestacao
    );
  });
});

test('manifestação aceita pela Focus é persistida antes da resposta', async () => {
  let persistida;

  await withMocks([
    [FocusResellerService, 'getEmpresaClient', async () => ({
      client: {
        post: async () => ({ data: { status: 'ok' } })
      }
    })],
    [focusInvoiceService, 'persistirManifestacao', async (...args) => {
      persistida = args;
    }]
  ], async () => {
    const resultado = await focusInvoiceService.manifestarNFe(
      3,
      'CHAVE-CONFIRMADA',
      'CONFIRMACAO'
    );

    assert.equal(resultado.success, true);
    assert.deepEqual(persistida, [3, 'CHAVE-CONFIRMADA', 'CONFIRMACAO']);
  });
});

test('manifestação persistida reencontra a nota mesmo com espaços na chave', async () => {
  let consulta;

  await withMocks([
    [NotaFiscalFocus, 'findAll', async (options) => {
      consulta = options;
      return [{
        chave_acesso: 'CHAVE-COM-ESPACO',
        manifestacao_tipo: 'CONFIRMACAO',
        data_manifestacao: '2026-08-20T12:01:00.000Z'
      }];
    }]
  ], async () => {
    const resultado = await focusInvoiceService.buscarManifestacoesPersistidas(
      3,
      [{ chave_nfe: ' CHAVE-COM-ESPACO ' }]
    );

    assert.deepEqual(
      consulta.where.chave_acesso[Object.getOwnPropertySymbols(consulta.where.chave_acesso)[0]],
      [' CHAVE-COM-ESPACO ', 'CHAVE-COM-ESPACO']
    );
    assert.equal(resultado.get('CHAVE-COM-ESPACO').manifestacao_tipo, 'CONFIRMACAO');
  });
});

test('persistência normaliza a chave e atualiza registro existente', async () => {
  let argumentos;
  let atualizacao;

  await withMocks([
    [NotaFiscalFocus, 'findOrCreate', async (options) => {
      argumentos = options;
      return [{
        update: async (payload) => {
          atualizacao = payload;
        }
      }, false];
    }]
  ], async () => {
    const resultado = await focusInvoiceService.persistirManifestacao(
      3,
      '  CHAVE-NORMALIZADA  ',
      'CONFIRMACAO'
    );

    assert.equal(resultado.persisted, true);
    assert.equal(argumentos.where.chave_acesso, 'CHAVE-NORMALIZADA');
    assert.equal(atualizacao.manifestacao_tipo, 'CONFIRMACAO');
    assert.equal(atualizacao.manifestada, true);
  });
});
