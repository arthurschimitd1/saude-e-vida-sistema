// src/builders/fiscal/NfcePayloadBuilder.js

import { fiscalDateTime } from '../../utils/businessTime.js';

export default class NfcePayloadBuilder {
  static build({
    venda,
    cliente,
    configuracaoFiscal,
    itens
  }) {
    const aliquotasIbsCbs = {
      cbs: 0.9,
      ibsUf: 0.1,
      ibsMunicipio: 0
    };

    const items = this.items({
      venda,
      configuracaoFiscal,
      itens,
      descontoTotal: this.calcularDescontoAbsoluto(
        venda,
        itens
      ),
      aliquotasIbsCbs
    });

    const totaisIbsCbs =
      this.calcularTotaisIbsCbs(items);

    const payload = {
      cnpj_emitente:
        this.onlyNumbers(configuracaoFiscal.cnpj),

      data_emissao:
        fiscalDateTime(),

      natureza_operacao:
        'VENDA AO CONSUMIDOR',

      modalidade_frete: '9',

      local_destino:
        cliente?.estado &&
        cliente.estado !== configuracaoFiscal.uf
          ? '2'
          : '1',

      presenca_comprador:
        venda.endereco_entrega &&
        venda.endereco_entrega.trim()
          ? '4'
          : '1',

      informacoes_adicionais_contribuinte:
        venda.observacao || undefined,

      items,

      ...totaisIbsCbs,

      formas_pagamento:
        (venda.pagamentos || []).map(
          pagamento => ({
            forma_pagamento:
              this.mapFormaPagamento(
                pagamento.forma
              ),

            valor_pagamento:
              Number(pagamento.valor)
          })
        )
    };

    if (cliente) {
      payload.nome_destinatario =
        cliente.nomeCompleto;

      if (cliente.cpf) {
        payload.cpf_destinatario =
          this.onlyNumbers(cliente.cpf);
      } else if (cliente.cnpj) {
        throw new Error(
          'NFC-e não deve ser emitida para cliente CNPJ. Emita NF-e para pessoa jurídica.'
        );
      }

      if (
        venda.endereco_entrega &&
        venda.endereco_entrega.trim()
      ) {
        if (cliente.rua) {
          payload.logradouro_destinatario =
            cliente.rua;

          payload.numero_destinatario =
            cliente.numero || 'S/N';

          payload.bairro_destinatario =
            cliente.bairro || 'N/I';

          payload.municipio_destinatario =
            cliente.cidade;

          payload.uf_destinatario =
            cliente.estado;

          if (cliente.cep) {
            payload.cep_destinatario =
              this.onlyNumbers(cliente.cep);
          }
        }
      }
    }

    return this.removeUndefined(payload);
  }

  static calcularDescontoAbsoluto(
    venda,
    itens
  ) {
    const desc =
      Number(venda.desconto || 0);

    if (!desc) {
      return 0;
    }

    if (
      venda.tipo_desconto === 'percent'
    ) {
      const subtotal = itens.reduce(
        (soma, item) =>
          soma + Number(item.valor_total || 0),
        0
      );

      return this.arredondar(
        (subtotal * desc) / 100
      );
    }

    return this.arredondar(desc);
  }

  static items({
    venda,
    configuracaoFiscal,
    itens,
    descontoTotal,
    aliquotasIbsCbs
  }) {
    const valorProdutosTotal =
      itens.reduce(
        (soma, item) =>
          soma + Number(item.valor_total || 0),
        0
      );

    let descontoDistribuido = 0;

    const produtos = itens.map(
      (item, index) => {
        const produto = item.produto;

        const valorBruto =
          this.arredondar(
            item.valor_total
          );

        const isUltimo =
          index === itens.length - 1;

        let valorDescontoItem = 0;

        if (
          descontoTotal > 0 &&
          valorProdutosTotal > 0
        ) {
          if (isUltimo) {
            valorDescontoItem =
              this.arredondar(
                descontoTotal -
                descontoDistribuido
              );
          } else {
            valorDescontoItem =
              this.arredondar(
                (
                  valorBruto /
                  valorProdutosTotal
                ) *
                descontoTotal
              );

            descontoDistribuido =
              this.arredondar(
                descontoDistribuido +
                valorDescontoItem
              );
          }
        }

        const valorTotalItem =
          this.arredondar(
            valorBruto -
            valorDescontoItem
          );

        const dadosIbsCbs =
          this.dadosIbsCbsItem({
            produto,
            baseCalculo: valorTotalItem,
            aliquotasIbsCbs
          });

        return {
          numero_item:
            String(index + 1),

          codigo_produto:
            produto.code ??
            String(produto.id),

          descricao:
            produto.name,

          codigo_ncm:
            produto.ncm,

          cfop:
            this.cfopVenda(venda) || produto.cfop,

          ...(produto.cest
            ? {
                cest:
                  produto.cest
              }
            : {}),

          quantidade_comercial:
            Number(item.quantidade),

          quantidade_tributavel:
            Number(item.quantidade),

          unidade_comercial:
            produto.unidade_comercial ||
            'UN',

          unidade_tributavel:
            produto.unidade_tributavel ||
            'UN',

          valor_unitario_comercial:
            Number(item.valor_unitario),

          valor_unitario_tributavel:
            Number(item.valor_unitario),

          valor_bruto:
            valorBruto,

          valor_desconto:
            valorDescontoItem,

          inclui_no_total: 1,

          icms_origem:
            produto.origem,

          icms_situacao_tributaria:
            this.cstCsosnVenda(venda, configuracaoFiscal) || produto.cst_csosn,

          pis_situacao_tributaria:
            produto.cst_pis,

          cofins_situacao_tributaria:
            produto.cst_cofins,

          ...dadosIbsCbs,

          valor_total_item:
            valorTotalItem
        };
      }
    );

    const taxaEntrega =
      Number(venda.taxa_entrega || 0);

    if (taxaEntrega > 0) {
      produtos.push({
        numero_item:
          String(produtos.length + 1),

        codigo_produto:
          'TAXA_ENTREGA',

        descricao:
          'Taxa de entrega',

        codigo_ncm:
          '00000000',

        cfop:
          this.cfopVenda(venda) || '5102',

        quantidade_comercial: 1,
        quantidade_tributavel: 1,

        unidade_comercial:
          'UN',

        unidade_tributavel:
          'UN',

        valor_unitario_comercial:
          taxaEntrega,

        valor_unitario_tributavel:
          taxaEntrega,

        valor_bruto:
          taxaEntrega,

        valor_desconto: 0,

        inclui_no_total: 1,

        icms_origem: '0',

        icms_situacao_tributaria:
          this.cstCsosnVenda(venda, configuracaoFiscal) ||
          ([1, 2, 4].includes(Number(configuracaoFiscal.regime_tributario))
            ? '102'
            : '40'),

        valor_total_item:
          taxaEntrega
      });
    }

    return produtos;
  }

  static cstCsosnVenda(venda, configuracaoFiscal) {
    const cst = String(venda?.cst_csosn || '').trim();
    if (!cst) return null;

    const regime = Number(configuracaoFiscal?.regime_tributario);
    if ([1, 2, 4].includes(regime) && !/^\d{3}$/.test(cst)) {
      throw new Error('Para empresas do Simples Nacional, informe um CSOSN com 3 dígitos.');
    }
    if (regime === 3 && !/^\d{2}$/.test(cst)) {
      throw new Error('Para empresas do regime normal, informe um CST com 2 dígitos.');
    }

    return /^\d{2,3}$/.test(cst) ? cst : null;
  }

  static cfopVenda(venda) {
    const cfop = String(venda?.cfop || '').trim();
    return /^\d{4}$/.test(cfop) ? cfop : null;
  }

  static dadosIbsCbsItem({
    produto,
    baseCalculo,
    aliquotasIbsCbs
  }) {
    const situacaoTributaria =
      produto
        ?.ibs_cbs_situacao_tributaria;

    const classificacaoTributaria =
      produto
        ?.ibs_cbs_classificacao_tributaria;

    /*
     * Não envia grupo incompleto.
     * A ausência pode ser registrada
     * pela Inteligência Fiscal.
     */
    if (
      !situacaoTributaria ||
      !classificacaoTributaria
    ) {
      return {};
    }

    const cbsAliquota =
      aliquotasIbsCbs.cbs;

    const ibsUfAliquota =
      aliquotasIbsCbs.ibsUf;

    const ibsMunAliquota =
      aliquotasIbsCbs.ibsMunicipio;

    const cbsValor =
      this.calcularPercentual(
        baseCalculo,
        cbsAliquota
      );

    const ibsUfValor =
      this.calcularPercentual(
        baseCalculo,
        ibsUfAliquota
      );

    const ibsMunValor =
      this.calcularPercentual(
        baseCalculo,
        ibsMunAliquota
      );

    const ibsValorTotal =
      this.arredondar(
        ibsUfValor +
        ibsMunValor
      );

    return {
      ibs_cbs_situacao_tributaria:
        situacaoTributaria,

      ibs_cbs_classificacao_tributaria:
        classificacaoTributaria,

      ibs_cbs_base_calculo:
        baseCalculo,

      cbs_aliquota:
        cbsAliquota,

      cbs_valor:
        cbsValor,

      ibs_uf_aliquota:
        ibsUfAliquota,

      ibs_uf_valor:
        ibsUfValor,

      ibs_mun_aliquota:
        ibsMunAliquota,

      ibs_mun_valor:
        ibsMunValor,

      ibs_valor_total:
        ibsValorTotal
    };
  }

  static calcularTotaisIbsCbs(
    items
  ) {
    const itemsComIbsCbs =
      items.filter(
        item =>
          item.ibs_cbs_base_calculo !==
          undefined
      );

    if (!itemsComIbsCbs.length) {
      return {};
    }

    const baseCalculo =
      this.somarCampo(
        itemsComIbsCbs,
        'ibs_cbs_base_calculo'
      );

    const cbs =
      this.somarCampo(
        itemsComIbsCbs,
        'cbs_valor'
      );

    const ibsUf =
      this.somarCampo(
        itemsComIbsCbs,
        'ibs_uf_valor'
      );

    const ibsMun =
      this.somarCampo(
        itemsComIbsCbs,
        'ibs_mun_valor'
      );

    const ibs =
      this.somarCampo(
        itemsComIbsCbs,
        'ibs_valor_total'
      );

    return {
      ibs_cbs_base_calculo:
        baseCalculo,

      cbs_valor_total:
        cbs,

      ibs_uf_valor_total:
        ibsUf,

      ibs_mun_valor_total:
        ibsMun,

      ibs_valor_total:
        ibs,

      ibs_cbs_is_valor_total:
        this.arredondar(
          cbs + ibs
        )
    };
  }

  static somarCampo(
    items,
    campo
  ) {
    return this.arredondar(
      items.reduce(
        (total, item) =>
          total +
          Number(item[campo] || 0),
        0
      )
    );
  }

  static calcularPercentual(
    baseCalculo,
    aliquota
  ) {
    return this.arredondar(
      (
        Number(baseCalculo) *
        Number(aliquota)
      ) / 100
    );
  }

  static arredondar(
    valor,
    casas = 2
  ) {
    const fator =
      10 ** casas;

    return (
      Math.round(
        (
          Number(valor || 0) +
          Number.EPSILON
        ) *
        fator
      ) / fator
    );
  }

  static mapFormaPagamento(
    forma
  ) {
    const mapa = {
      DINHEIRO: '01',
      CHEQUE: '02',

      CREDITO: '03',
      CARTAO_CREDITO: '03',

      DEBITO: '04',
      CARTAO_DEBITO: '04',

      PIX: '17',

      BOLETO: '15',
      CREDIARIO: '05',

      OUTROS: '99'
    };

    return mapa[forma] ?? '99';
  }

  static onlyNumbers(value) {
    if (!value) {
      return undefined;
    }

    return String(value)
      .replace(/\D/g, '');
  }

  static removeUndefined(obj) {
    return Object.fromEntries(
      Object.entries(obj).filter(
        ([, value]) =>
          value !== undefined &&
          value !== null &&
          value !== ''
      )
    );
  }
}
