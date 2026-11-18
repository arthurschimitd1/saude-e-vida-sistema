// src/builders/NFSePayloadBuilder.js

import { fiscalDateTime } from '../../utils/businessTime.js';

export default class NFSePayloadBuilder {
    constructor({ servico, cliente, configuracaoFiscal, dadosEmissao = {} }) {
        this.servico = servico;
        this.cliente = cliente;
        this.configuracaoFiscal = configuracaoFiscal;
        this.dadosEmissao = dadosEmissao;
    }

    static build(params) {
        return new NFSePayloadBuilder(params).build();
    }

    build() {
        this.validar();

        return this.removerVazios({
            data_emissao: this.dadosEmissao.data_emissao || fiscalDateTime(),
            natureza_operacao: this.naturezaOperacao(),
            regime_especial_tributacao: this.regimeEspecialTributacao(),
            optante_simples_nacional: this.optanteSimplesNacional(),
            incentivador_cultural: this.booleano(this.configuracaoFiscal.incentivador_cultural),
            prestador: this.prestador(),
            tomador: this.tomador(),
            servico: this.dadosServico()
        });
    }

    prestador() {
        const configuracao = this.configuracaoFiscal;

        return this.removerVazios({
            cnpj: this.numeros(configuracao.cnpj || configuracao.cnpj_emitente),
            inscricao_municipal: this.texto(configuracao.inscricao_municipal),
            codigo_municipio: this.texto(configuracao.codigo_municipio)
        });
    }

    tomador() {
        const cliente = this.cliente;
        const documento = this.documentoCliente();

        const tomador = {
            razao_social: this.texto(cliente.nomeCompleto),
            email: this.texto(cliente.email),
            telefone: this.numeros(cliente.telefone),
            inscricao_municipal: this.texto(cliente.inscricao_municipal),
            endereco: this.enderecoTomador()
        };

        if (documento.tipo === 'cpf') tomador.cpf = documento.valor;
        if (documento.tipo === 'cnpj') tomador.cnpj = documento.valor;

        return this.removerVazios(tomador);
    }

    enderecoTomador() {
        const cliente = this.cliente;

        const endereco = this.removerVazios({
            logradouro: this.texto(cliente.rua),
            numero: this.texto(cliente.numero),
            complemento: this.texto(cliente.complemento),
            bairro: this.texto(cliente.bairro),
            codigo_municipio: this.texto(cliente.codigo_municipio),
            uf: this.texto(cliente.estado)?.toUpperCase(),
            cep: this.numeros(cliente.cep)
        });

        return Object.keys(endereco).length ? endereco : undefined;
    }

    dadosServico() {
        return this.removerVazios({
            nome: this.texto(this.servico.name),
            aliquota: this.aliquotaFocus(),
            base_calculo: this.baseCalculo(),
            discriminacao: this.discriminacao(),
            iss_retido: this.issRetido(),
            item_lista_servico: this.texto(this.servico.item_lista_servico),
            codigo_cnae: this.texto(this.servico.codigo_cnae),
            codigo_tributario_municipio: this.codigoTributarioMunicipio(),
            codigo_indicador_operacao: this.texto(this.servico.codigo_indicador_operacao),
            ibs_cbs_situacao_tributaria: this.texto(this.servico.ibs_cbs_situacao_tributaria),
            ibs_cbs_classificacao_tributaria: this.texto(this.servico.ibs_cbs_classificacao_tributaria),
            valor_servicos: this.valorServicos(),
            valor_iss: this.valorIss(),
            valor_liquido: this.valorLiquido(),
            deducoes: this.deducoes(),
            desconto_incondicionado: this.descontoIncondicionado(),
            desconto_condicionado: this.descontoCondicionado(),
            outras_retencoes: this.outrasRetencoes(),
            pis: this.pis(),
            cofins: this.cofins(),
            inss: this.inss(),
            irrf: this.irrf(),
            csll: this.csll()
        });
    }

    documentoCliente() {
        const cpf = this.numeros(this.cliente.cpf);
        const cnpj = this.numeros(this.cliente.cnpj);

        if (cnpj) return { tipo: 'cnpj', valor: cnpj };
        if (cpf) return { tipo: 'cpf', valor: cpf };

        return { tipo: null, valor: null };
    }

    codigoTributarioMunicipio() {
        return this.texto(
            this.servico.codigo_tributacao_municipio ||
            this.servico.item_lista_servico
        );
    }

    valorServicos() {
        return this.arredondar(
            this.numero(this.dadosEmissao.valor_total ?? this.servico.value, 0)
        );
    }

    aliquotaPercentual() {
        return this.numero(this.servico.aliquota, 0);
    }

    aliquotaFocus() {
        return this.arredondar(this.aliquotaPercentual() / 100, 4);
    }

    deducoes() {
        return this.valorMonetario(this.dadosEmissao.deducoes);
    }

    descontoIncondicionado() {
        return this.valorMonetario(
            this.dadosEmissao.desconto ?? this.dadosEmissao.desconto_incondicionado
        );
    }

    descontoCondicionado() {
        return this.valorMonetario(this.dadosEmissao.desconto_condicionado);
    }

    baseCalculo() {
        const base = this.valorServicos() - this.deducoes() - this.descontoIncondicionado();
        return this.arredondar(Math.max(base, 0));
    }

    valorIss() {
        const valorInformado = this.dadosEmissao.iss ?? this.dadosEmissao.valor_iss;

        if (this.foiInformado(valorInformado)) {
            return this.valorMonetario(valorInformado);
        }

        return this.arredondar(
            this.baseCalculo() * this.aliquotaPercentual() / 100
        );
    }

    valorLiquido() {
        const valorInformado = this.dadosEmissao.valor_liquido;

        if (this.foiInformado(valorInformado)) {
            return this.valorMonetario(valorInformado);
        }

        const retencoes =
            this.pis() +
            this.cofins() +
            this.inss() +
            this.irrf() +
            this.csll() +
            this.outrasRetencoes() +
            (this.issRetido() ? this.valorIss() : 0);

        const valorCalculado =
            this.valorServicos() -
            this.deducoes() -
            this.descontoIncondicionado() -
            this.descontoCondicionado() -
            retencoes;

        return this.arredondar(Math.max(valorCalculado, 0));
    }

    discriminacao() {
        return (
            this.texto(this.dadosEmissao.servico_descricao) ||
            this.texto(this.servico.discriminacao_padrao) ||
            this.texto(this.servico.description) ||
            this.texto(this.servico.name)
        );
    }

    naturezaOperacao() {
        return this.numero(
            this.servico.natureza_operacao ?? this.dadosEmissao.natureza_operacao,
            1
        );
    }

    regimeEspecialTributacao() {
        const regime =
            this.configuracaoFiscal.regime_especial_tributacao;

        return this.foiInformado(regime)
            ? this.numero(regime)
            : undefined;
    }

    optanteSimplesNacional() {
        return this.numero(
            this.configuracaoFiscal.regime_tributario
        ) === 1;
    }

    issRetido() {
        return this.booleano(this.dadosEmissao.iss_retido);
    }

    pis() {
        return this.valorMonetario(this.dadosEmissao.pis);
    }

    cofins() {
        return this.valorMonetario(this.dadosEmissao.cofins);
    }

    inss() {
        return this.valorMonetario(this.dadosEmissao.inss);
    }

    irrf() {
        return this.valorMonetario(this.dadosEmissao.irrf);
    }

    csll() {
        return this.valorMonetario(this.dadosEmissao.csll);
    }

    outrasRetencoes() {
        return this.valorMonetario(this.dadosEmissao.outras_retencoes);
    }

    validar() {
        if (!this.servico) throw new Error('Serviço não encontrado.');
        if (!this.cliente) throw new Error('Cliente não encontrado.');
        if (!this.configuracaoFiscal) throw new Error('Configuração fiscal não encontrada.');

        this.validarPrestador();
        this.validarCliente();
        this.validarServico();
        this.validarValores();
    }

    validarPrestador() {
        const configuracao = this.configuracaoFiscal;
        const cnpj = this.numeros(configuracao.cnpj || configuracao.cnpj_emitente);
        const codigoMunicipio = this.texto(configuracao.codigo_municipio);

        if (!cnpj) throw new Error('CNPJ do prestador não configurado.');
        if (cnpj.length !== 14) throw new Error('CNPJ do prestador inválido.');

        if (!this.texto(configuracao.inscricao_municipal)) {
            throw new Error('Inscrição Municipal do prestador não configurada.');
        }

        if (!codigoMunicipio) {
            throw new Error('Código IBGE do município do prestador não configurado.');
        }

        if (!/^\d{7}$/.test(codigoMunicipio)) {
            throw new Error('Código IBGE do município do prestador deve possuir 7 dígitos.');
        }
    }

    validarCliente() {
        const documento = this.documentoCliente();
        const codigoMunicipio = this.texto(this.cliente.codigo_municipio);

        if (!this.texto(this.cliente.nomeCompleto)) {
            throw new Error('Nome do cliente não informado.');
        }

        if (!documento.valor) {
            throw new Error('O cliente precisa possuir CPF ou CNPJ.');
        }

        if (documento.tipo === 'cpf' && documento.valor.length !== 11) {
            throw new Error('CPF do cliente inválido.');
        }

        if (documento.tipo === 'cnpj' && documento.valor.length !== 14) {
            throw new Error('CNPJ do cliente inválido.');
        }

        const camposObrigatorios = [
            ['CEP', this.cliente.cep],
            ['logradouro', this.cliente.rua],
            ['número', this.cliente.numero],
            ['bairro', this.cliente.bairro],
            ['cidade', this.cliente.cidade],
            ['UF', this.cliente.estado],
            ['código do município', codigoMunicipio]
        ];

        const campoAusente = camposObrigatorios.find(([, valor]) => !this.texto(valor));

        if (campoAusente) {
            throw new Error(`O cliente não possui ${campoAusente[0]} cadastrado.`);
        }

        if (!/^\d{7}$/.test(codigoMunicipio)) {
            throw new Error('Código IBGE do município do cliente deve possuir 7 dígitos.');
        }

        const uf = this.texto(this.cliente.estado);

        if (uf?.length !== 2) {
            throw new Error('UF do cliente inválida.');
        }
    }

    validarServico() {
        if (this.servico.ativo === false) {
            throw new Error(
                'O serviço selecionado está inativo.'
            );
        }

        if (!this.texto(this.servico.item_lista_servico)) {
            throw new Error(
                'Item da lista de serviço não configurado.'
            );
        }

        if (
            !this.texto(
                this.servico.codigo_indicador_operacao
            )
        ) {
            throw new Error(
                'Código indicador da operação não configurado no serviço.'
            );
        }

        if (
            !this.texto(
                this.servico.ibs_cbs_situacao_tributaria
            )
        ) {
            throw new Error(
                'Situação tributária IBS/CBS não configurada no serviço.'
            );
        }

        if (
            !this.texto(
                this.servico.ibs_cbs_classificacao_tributaria
            )
        ) {
            throw new Error(
                'Classificação tributária IBS/CBS não configurada no serviço.'
            );
        }

        if (!this.discriminacao()) {
            throw new Error(
                'Descrição do serviço não configurada.'
            );
        }

        if (this.aliquotaPercentual() < 0) {
            throw new Error(
                'A alíquota do serviço não pode ser negativa.'
            );
        }

        if (this.aliquotaPercentual() > 100) {
            throw new Error(
                'A alíquota do serviço não pode ser maior que 100%.'
            );
        }
    }

    validarValores() {
        if (this.valorServicos() <= 0) {
            throw new Error('O valor do serviço deve ser maior que zero.');
        }

        if (this.deducoes() < 0) {
            throw new Error('O valor das deduções não pode ser negativo.');
        }

        if (this.descontoIncondicionado() < 0) {
            throw new Error('O desconto não pode ser negativo.');
        }

        if (this.descontoCondicionado() < 0) {
            throw new Error('O desconto condicionado não pode ser negativo.');
        }

        if (this.deducoes() + this.descontoIncondicionado() > this.valorServicos()) {
            throw new Error('Deduções e desconto não podem superar o valor do serviço.');
        }

        const retencoes = [
            ['PIS', this.pis()],
            ['COFINS', this.cofins()],
            ['INSS', this.inss()],
            ['IRRF', this.irrf()],
            ['CSLL', this.csll()],
            ['outras retenções', this.outrasRetencoes()]
        ];

        const retencaoNegativa = retencoes.find(([, valor]) => valor < 0);

        if (retencaoNegativa) {
            throw new Error(`O valor de ${retencaoNegativa[0]} não pode ser negativo.`);
        }

        if (![1, 2, 3, 4, 5, 6].includes(this.naturezaOperacao())) {
            throw new Error('Natureza da operação inválida.');
        }
    }

    numero(valor, padrao = 0) {
        if (!this.foiInformado(valor)) return padrao;

        const convertido = Number(valor);
        return Number.isFinite(convertido) ? convertido : padrao;
    }

    valorMonetario(valor) {
        return this.arredondar(this.numero(valor, 0));
    }

    numeros(valor) {
        if (!this.foiInformado(valor)) return undefined;

        const resultado = String(valor).replace(/\D/g, '');
        return resultado || undefined;
    }

    texto(valor) {
        if (!this.foiInformado(valor)) return undefined;

        const resultado = String(valor).trim();
        return resultado || undefined;
    }

    booleano(valor) {
        return valor === true || valor === 'true' || valor === 1 || valor === '1';
    }

    foiInformado(valor) {
        return valor !== undefined && valor !== null && valor !== '';
    }

    arredondar(valor, casas = 2) {
        const fator = 10 ** casas;
        return Math.round((Number(valor) + Number.EPSILON) * fator) / fator;
    }

    removerVazios(objeto) {
        return Object.fromEntries(
            Object.entries(objeto).filter(
                ([, valor]) => valor !== undefined && valor !== null && valor !== ''
            )
        );
    }
}
