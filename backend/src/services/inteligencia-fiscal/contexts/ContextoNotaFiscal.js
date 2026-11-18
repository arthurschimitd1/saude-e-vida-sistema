// src/services/fiscal/inteligencia/contextos/ContextoNotaFiscal.js

import { Op } from 'sequelize';

import NotaFiscalEmitida from '../../../models/NotaFiscalEmitida.js';
import Venda from '../../../models/Venda.js';
import VendaItem from '../../../models/VendaItem.js';
import Product from '../../../models/Product.js';
import Cliente from '../../../models/Cliente.js';
import ConfiguracaoFiscal from '../../../models/ConfiguracaoFiscal.js';

/**
 * Transforma uma instância do Sequelize em um objeto simples.
 * Caso já seja um objeto comum, retorna o valor sem alteração.
 */
function normalizarModel(registro) {
  if (!registro) {
    return null;
  }

  if (typeof registro.toJSON === 'function') {
    return registro.toJSON();
  }

  return registro;
}

/**
 * Remove IDs vazios ou duplicados.
 * Também garante que os identificadores utilizados na consulta sejam números.
 */
function obterIdsUnicos(ids = []) {
  return [
    ...new Set(
      ids
        .filter(id => id !== null && id !== undefined)
        .map(Number)
        .filter(Number.isFinite),
    ),
  ];
}

/**
 * Responsável por carregar todos os dados relacionados a uma nota fiscal.
 * O contexto retornado será utilizado pelas regras da Inteligência Fiscal.
 */
class ContextoNotaFiscal {
  /**
   * Carrega uma nota fiscal específica e os registros relacionados.
   */
  async carregar({
    referenciaId,
    empresaId,
    transaction = null,
  }) {
    const notaFiscal = await NotaFiscalEmitida.findOne({
      where: {
        id: referenciaId,
        empresa_id: empresaId,
      },
      transaction,
    });

    if (!notaFiscal) {
      throw new Error(
        `Nota fiscal ${referenciaId} não encontrada para a empresa ${empresaId}.`,
      );
    }

    const nota = normalizarModel(notaFiscal);

    const venda = await this.carregarVenda({
      vendaId: nota.venda_id,
      empresaId,
      transaction,
    });

    const itens = await this.carregarItensVenda({
      vendaId: venda?.id,
      transaction,
    });

    const produtos = await this.carregarProdutos({
      itens,
      empresaId,
      transaction,
    });

    const produtosPorId = new Map(
      produtos.map(produto => [
        Number(produto.id),
        produto,
      ]),
    );

    const cliente = await this.carregarCliente({
      clienteId: venda?.cliente_id,
      empresaId,
      transaction,
    });

    const configuracaoFiscal =
      await this.carregarConfiguracaoFiscal({
        empresaId,
        transaction,
      });

    return {
      tipoContexto: 'NOTA_FISCAL',
      referenciaId: nota.id,
      empresaId,

      nota,
      venda,
      cliente,
      itens,
      produtos,
      produtosPorId,
      configuracaoFiscal,

      payloadEnviado: nota.payload_enviado ?? null,
      respostaProvedor: nota.resposta_provedor ?? null,
    };
  }

  /**
   * Carrega a venda relacionada à nota.
   * Algumas notas podem não possuir venda, por isso o retorno pode ser null.
   */
  async carregarVenda({
    vendaId,
    empresaId,
    transaction,
  }) {
    if (!vendaId) {
      return null;
    }

    const venda = await Venda.findOne({
      where: {
        id: vendaId,
        empresa_id: empresaId,
      },
      transaction,
    });

    if (!venda) {
      throw new Error(
        `Venda ${vendaId} vinculada à nota não foi encontrada.`,
      );
    }

    return normalizarModel(venda);
  }

  /**
   * Carrega todos os itens da venda relacionada à nota fiscal.
   * Quando a nota não possui venda vinculada, retorna uma lista vazia.
   */
  async carregarItensVenda({
    vendaId,
    transaction,
  }) {
    if (!vendaId) {
      return [];
    }

    const itens = await VendaItem.findAll({
      where: {
        venda_id: vendaId,
      },
      order: [['id', 'ASC']],
      transaction,
    });

    return itens.map(normalizarModel);
  }

  /**
   * Carrega os produtos utilizados nos itens da venda.
   * Itens sem produto_id, como roupas ou matérias-primas, são ignorados aqui.
   */
  async carregarProdutos({
    itens,
    empresaId,
    transaction,
  }) {
    const produtoIds = obterIdsUnicos(
      itens.map(item => item.produto_id),
    );

    if (produtoIds.length === 0) {
      return [];
    }

    const produtos = await Product.findAll({
      where: {
        id: {
          [Op.in]: produtoIds,
        },
        empresa_id: empresaId,
      },
      transaction,
    });

    return produtos.map(normalizarModel);
  }

  /**
   * Carrega o cliente vinculado à venda.
   * A venda pode não possuir cliente, especialmente em emissões de NFC-e.
   */
  async carregarCliente({
    clienteId,
    empresaId,
    transaction,
  }) {
    if (!clienteId) {
      return null;
    }

    const cliente = await Cliente.findOne({
      where: {
        id: clienteId,
        empresa_id: empresaId,
      },
      transaction,
    });

    if (!cliente) {
      throw new Error(
        `Cliente ${clienteId} vinculado à venda não foi encontrado.`,
      );
    }

    return normalizarModel(cliente);
  }

  /**
   * Carrega os dados fiscais da empresa emitente.
   * A configuração será utilizada por regras relacionadas ao regime tributário.
   */
  async carregarConfiguracaoFiscal({
    empresaId,
    transaction,
  }) {
    const configuracaoFiscal =
      await ConfiguracaoFiscal.findOne({
        where: {
          empresa_id: empresaId,
        },
        transaction,
      });

    return normalizarModel(configuracaoFiscal);
  }
}

export default new ContextoNotaFiscal();