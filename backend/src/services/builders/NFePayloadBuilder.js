// src/builders/NFePayloadBuilder.js

import { fiscalDateTime } from '../../utils/businessTime.js';

const marcadoresSemIE = new Set(['ISENTO', 'ISENTA', 'NAO CONTRIBUINTE', 'NÃO CONTRIBUINTE']);
const inscricaoEstadualValida = (valor) => {
  const texto = String(valor ?? '').trim();
  return texto && !marcadoresSemIE.has(texto.toUpperCase()) ? texto : '';
};

export default class NFePayloadBuilder {
  constructor({
    venda,
    cliente,
    configuracaoFiscal,
    itens,
    destinatarioIsentoIE = false
  }) {
    this.venda = venda;
    this.cliente = cliente;
    this.configuracaoFiscal = configuracaoFiscal;
    this.itens = itens;
    this.destinatarioIsentoIE = destinatarioIsentoIE === true;

    /*
     * Alíquotas de transição utilizadas em 2026:
     * CBS: 0,9%
     * IBS estadual: 0,1%
     * IBS municipal: 0%
     */
    this.aliquotasIbsCbs = {
      cbs: 0.9,
      ibsUf: 0.1,
      ibsMunicipio: 0
    };
  }

  static build(params) {
    return new NFePayloadBuilder(params).build();
  }

  build() {
    const items = this.items();
    const totaisIbsCbs = this.calcularTotaisIbsCbs(items);

    return {
      natureza_operacao: 'Venda de mercadoria',
      data_emissao: fiscalDateTime(),
      tipo_documento: 1,
      finalidade_emissao: 1,
      consumidor_final: 1,
      presenca_comprador: 1,
      modalidade_frete: 9,

      valor_produtos: this.valorProdutos(),
      valor_total: this.valorTotal(),
      valor_desconto: this.valorDesconto(),
      valor_frete: this.valorFrete(),

      ...this.emitente(),
      ...this.destinatario(),
      ...this.entrega(),

      items,
      ...totaisIbsCbs
    };
  }

  emitente() {
    const e = this.configuracaoFiscal;

    return {
      cnpj_emitente: this.numeros(e.cnpj),
      nome_emitente: e.razao_social,
      nome_fantasia_emitente: e.nome_fantasia,

      logradouro_emitente: e.logradouro,
      numero_emitente: e.numero,
      bairro_emitente: e.bairro,
      municipio_emitente: e.municipio,
      uf_emitente: e.uf,
      cep_emitente: this.numeros(e.cep),

      inscricao_estadual_emitente: e.inscricao_estadual,
      regime_tributario_emitente: e.regime_tributario
    };
  }

  destinatario() {
    if (!this.cliente) return {};

    const c = this.cliente;
    const dados = {};

    if (c.cnpj) {
      dados.cnpj_destinatario = this.numeros(c.cnpj);
    } else if (c.cpf) {
      dados.cpf_destinatario = this.numeros(c.cpf);
    }

    dados.nome_destinatario = c.nomeCompleto;

    // A Focus usa o indicador 2 exclusivamente quando o destinatário declara
    // ser contribuinte isento. Sem essa escolha explícita, mantemos a regra
    // automática atual: IE preenchida = contribuinte; sem IE = não contribuinte.
    if (this.destinatarioIsentoIE) {
      dados.indicador_inscricao_estadual_destinatario = 2;
    } else if (inscricaoEstadualValida(c.inscricao_estadual)) {
      dados.inscricao_estadual_destinatario = inscricaoEstadualValida(c.inscricao_estadual);
      dados.indicador_inscricao_estadual_destinatario = 1;
    } else {
      dados.indicador_inscricao_estadual_destinatario = 9;
    }

    if (c.telefone) {
      dados.telefone_destinatario = this.numeros(c.telefone);
    }

    if (c.email) {
      dados.email_destinatario = c.email;
    }

    if (c.rua) {
      dados.logradouro_destinatario = c.rua;
      dados.numero_destinatario = c.numero;
      dados.bairro_destinatario = c.bairro;
      dados.municipio_destinatario = c.cidade;
      dados.uf_destinatario = c.estado;
      dados.cep_destinatario = this.numeros(c.cep);
      dados.pais_destinatario = c.pais || 'Brasil';

      if (c.complemento) {
        dados.complemento_destinatario = c.complemento;
      }
    }

    return dados;
  }

  entrega() {
    const end = this.venda.endereco_entrega;

    if (!end || !String(end).trim()) return {};

    const c = this.cliente;

    if (!c) return {};

    return {
      logradouro_entrega: c.rua || end,
      numero_entrega: c.numero || 'S/N',
      bairro_entrega: c.bairro || 'N/I',
      municipio_entrega: c.cidade,
      uf_entrega: c.estado,
      cep_entrega: this.numeros(c.cep),
      pais_entrega: 'Brasil',

      ...(c.cpf
        ? { cpf_entrega: this.numeros(c.cpf) }
        : {}),

      ...(c.cnpj
        ? { cnpj_entrega: this.numeros(c.cnpj) }
        : {})
    };
  }

  items() {
    const valorFreteTotal = this.valorFrete();
    const valorDescontoTotal = this.valorDesconto();
    const valorProdutosTotal = this.valorProdutos();

    let freteDistribuido = 0;
    let descontoDistribuido = 0;

    return this.itens.map((item, index) => {
      const produto = item.produto;
      const valorBruto = this.arredondar(item.valor_total);
      const isUltimoItem = index === this.itens.length - 1;

      let valorFreteItem = 0;
      let valorDescontoItem = 0;

      if (valorFreteTotal > 0 && valorProdutosTotal > 0) {
        if (isUltimoItem) {
          valorFreteItem = this.arredondar(
            valorFreteTotal - freteDistribuido
          );
        } else {
          valorFreteItem = this.arredondar(
            (valorBruto / valorProdutosTotal) * valorFreteTotal
          );

          freteDistribuido = this.arredondar(
            freteDistribuido + valorFreteItem
          );
        }
      }

      if (valorDescontoTotal > 0 && valorProdutosTotal > 0) {
        if (isUltimoItem) {
          valorDescontoItem = this.arredondar(
            valorDescontoTotal - descontoDistribuido
          );
        } else {
          valorDescontoItem = this.arredondar(
            (valorBruto / valorProdutosTotal) * valorDescontoTotal
          );

          descontoDistribuido = this.arredondar(
            descontoDistribuido + valorDescontoItem
          );
        }
      }

      const valorTotalItem = this.arredondar(
        valorBruto - valorDescontoItem + valorFreteItem
      );

      const dadosIbsCbs = this.dadosIbsCbsItem({
        produto,
        baseCalculo: valorTotalItem
      });

      return {
        numero_item: index + 1,
        codigo_produto: produto.code,
        descricao: produto.name,
        cfop: this.cfopVenda() || produto.cfop,
        codigo_ncm: produto.ncm,

        ...(produto.cest
          ? { cest: produto.cest }
          : {}),

        quantidade_comercial: Number(item.quantidade),
        quantidade_tributavel: Number(item.quantidade),

        unidade_comercial: produto.unidade_comercial || 'UN',
        unidade_tributavel: produto.unidade_tributavel || 'UN',

        valor_unitario_comercial: Number(item.valor_unitario),
        valor_unitario_tributavel: Number(item.valor_unitario),

        valor_bruto: valorBruto,
        valor_desconto: valorDescontoItem,
        valor_frete: valorFreteItem,
        inclui_no_total: 1,

        icms_origem: produto.origem,
        icms_situacao_tributaria: this.cstCsosnVenda() || produto.cst_csosn,
        pis_situacao_tributaria: produto.cst_pis,
        cofins_situacao_tributaria: produto.cst_cofins,

        ...dadosIbsCbs,

        valor_total_item: valorTotalItem
      };
    });
  }

  dadosIbsCbsItem({
    produto,
    baseCalculo
  }) {
    const situacaoTributaria =
      produto?.ibs_cbs_situacao_tributaria;

    const classificacaoTributaria =
      produto?.ibs_cbs_classificacao_tributaria;

    /*
     * Não envia um grupo incompleto.
     * A ausência poderá ser registrada pela Inteligência Fiscal.
     */
    if (!situacaoTributaria || !classificacaoTributaria) {
      return {};
    }

    const cbsAliquota = this.aliquotasIbsCbs.cbs;
    const ibsUfAliquota = this.aliquotasIbsCbs.ibsUf;
    const ibsMunAliquota = this.aliquotasIbsCbs.ibsMunicipio;

    const cbsValor = this.calcularPercentual(
      baseCalculo,
      cbsAliquota
    );

    const ibsUfValor = this.calcularPercentual(
      baseCalculo,
      ibsUfAliquota
    );

    const ibsMunValor = this.calcularPercentual(
      baseCalculo,
      ibsMunAliquota
    );

    const ibsValorTotal = this.arredondar(
      ibsUfValor + ibsMunValor
    );

    return {
      ibs_cbs_situacao_tributaria: situacaoTributaria,
      ibs_cbs_classificacao_tributaria: classificacaoTributaria,
      ibs_cbs_base_calculo: baseCalculo,

      cbs_aliquota: cbsAliquota,
      cbs_valor: cbsValor,

      ibs_uf_aliquota: ibsUfAliquota,
      ibs_uf_valor: ibsUfValor,

      ibs_mun_aliquota: ibsMunAliquota,
      ibs_mun_valor: ibsMunValor,

      ibs_valor_total: ibsValorTotal
    };
  }

  calcularTotaisIbsCbs(items) {
    const itemsComIbsCbs = items.filter(
      item => item.ibs_cbs_base_calculo !== undefined
    );

    if (!itemsComIbsCbs.length) return {};

    const totais = {
      baseCalculo: this.somarCampo(
        itemsComIbsCbs,
        'ibs_cbs_base_calculo'
      ),

      cbs: this.somarCampo(
        itemsComIbsCbs,
        'cbs_valor'
      ),

      ibsUf: this.somarCampo(
        itemsComIbsCbs,
        'ibs_uf_valor'
      ),

      ibsMun: this.somarCampo(
        itemsComIbsCbs,
        'ibs_mun_valor'
      ),

      ibs: this.somarCampo(
        itemsComIbsCbs,
        'ibs_valor_total'
      )
    };

    return {
      ibs_cbs_base_calculo: totais.baseCalculo,
      cbs_valor_total: totais.cbs,
      ibs_uf_valor_total: totais.ibsUf,
      ibs_mun_valor_total: totais.ibsMun,
      ibs_valor_total: totais.ibs,

      ibs_cbs_is_valor_total: this.arredondar(
        totais.cbs + totais.ibs
      )
    };
  }

  somarCampo(items, campo) {
    return this.arredondar(
      items.reduce(
        (total, item) => total + Number(item[campo] || 0),
        0
      )
    );
  }

  calcularPercentual(
    baseCalculo,
    aliquota
  ) {
    return this.arredondar(
      (Number(baseCalculo) * Number(aliquota)) / 100
    );
  }

  arredondar(valor, casas = 2) {
    const fator = 10 ** casas;

    return (
      Math.round(
        (Number(valor || 0) + Number.EPSILON) * fator
      ) / fator
    );
  }

  valorProdutos() {
    return this.arredondar(
      this.itens.reduce(
        (total, item) => total + Number(item.valor_total || 0),
        0
      )
    );
  }

  valorTotal() {
    return this.arredondar(
      this.venda.valor_total
    );
  }

  valorDesconto() {
    const desc = Number(this.venda.desconto || 0);

    if (!desc) return 0;

    if (this.venda.tipo_desconto === 'percent') {
      return this.arredondar(
        (this.valorProdutos() * desc) / 100
      );
    }

    return this.arredondar(desc);
  }

  valorFrete() {
    return this.arredondar(
      this.venda.taxa_entrega || 0
    );
  }

  cfopVenda() {
    const cfop = String(this.venda.cfop || '').trim();
    return /^\d{4}$/.test(cfop) ? cfop : null;
  }

  cstCsosnVenda() {
    const cst = String(this.venda.cst_csosn || '').trim();
    if (!cst) return null;

    const regime = Number(this.configuracaoFiscal?.regime_tributario);
    if ([1, 2, 4].includes(regime) && !/^\d{3}$/.test(cst)) {
      throw new Error('Para empresas do Simples Nacional, informe um CSOSN com 3 dígitos.');
    }
    if (regime === 3 && !/^\d{2}$/.test(cst)) {
      throw new Error('Para empresas do regime normal, informe um CST com 2 dígitos.');
    }

    return /^\d{2,3}$/.test(cst) ? cst : null;
  }

  numeros(valor) {
    if (!valor) return undefined;

    return String(valor).replace(/\D/g, '');
  }
}
