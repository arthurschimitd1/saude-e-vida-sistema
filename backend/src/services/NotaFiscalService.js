import axios from 'axios';
import EmpresaConfigFiscal from '../models/EmpresaConfigFiscal.js';
import NotaFiscal from '../models/NotaFiscal.js';
import sequelize from '../config/database.js';
import { fiscalDateTime } from '../utils/businessTime.js';

class NotaFiscalService {
  getBaseUrl(ambiente) {
    if (ambiente === 'producao') {
      return 'https://api.focusnfe.com.br/v2';
    }
    return 'https://homologacao.focusnfe.com.br/v2';
  }

  validarDadosClienteParaNFe(cliente) {
    const camposObrigatorios = [
      { campo: 'nomeCompleto', label: 'Nome completo' },
      { campo: 'rua', label: 'Logradouro (Rua)' },
      { campo: 'numero', label: 'Número' },
      { campo: 'bairro', label: 'Bairro' },
      { campo: 'cidade', label: 'Cidade' },
      { campo: 'estado', label: 'UF (Estado)' },
      { campo: 'cep', label: 'CEP' },
      { campo: 'telefone', label: 'Telefone' }
    ];

    let cpfCnpj = cliente.cpf || cliente.cnpj;
    if (cpfCnpj) {
      cpfCnpj = cpfCnpj.replace(/\D/g, '');
    }
    const temCnpj = cpfCnpj && cpfCnpj.length === 14;
    
    const camposFaltando = [];
    
    for (const item of camposObrigatorios) {
      const valor = cliente[item.campo];
      if (!valor || (typeof valor === 'string' && valor.trim() === '')) {
        camposFaltando.push(item.label);
      }
    }
    
    if (temCnpj && (!cliente.inscricao_estadual || cliente.inscricao_estadual.trim() === '')) {
      camposFaltando.push('Inscrição Estadual (obrigatória para CNPJ)');
    }
    
    if (!cliente.cpf && !cliente.cnpj) {
      camposFaltando.push('CPF ou CNPJ');
    } else if (cpfCnpj && cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
      camposFaltando.push('CPF/CNPJ inválido (deve ter 11 ou 14 dígitos)');
    }
    
    return camposFaltando;
  }

  validarDadosEmitenteParaNFe(config) {
    const camposObrigatorios = [
      { campo: 'cnpj_emitente', label: 'CNPJ do emitente' },
      { campo: 'nome_emitente', label: 'Razão Social do emitente' },
      { campo: 'logradouro_emitente', label: 'Logradouro do emitente' },
      { campo: 'numero_emitente', label: 'Número do emitente' },
      { campo: 'bairro_emitente', label: 'Bairro do emitente' },
      { campo: 'municipio_emitente', label: 'Município do emitente' },
      { campo: 'uf_emitente', label: 'UF do emitente' },
      { campo: 'cep_emitente', label: 'CEP do emitente' },
      { campo: 'telefone_emitente', label: 'Telefone do emitente' },
    ];

    const camposFaltando = [];
    
    for (const item of camposObrigatorios) {
      const valor = config[item.campo];
      if (!valor || (typeof valor === 'string' && valor.trim() === '')) {
        camposFaltando.push(item.label);
      }
    }
    
    return camposFaltando;
  }

  validarDadosProdutosParaNFe(produtos) {
    const produtosInvalidos = [];
    
    for (const produto of produtos) {
      const erros = [];
      
      if (!produto.ncm || produto.ncm.trim() === '') {
        erros.push('NCM não informado');
      } else if (!/^\d{8}$/.test(produto.ncm.replace(/\D/g, ''))) {
        erros.push('NCM inválido (deve ter 8 dígitos)');
      }
      
      if (!produto.cfop || produto.cfop.trim() === '') {
        erros.push('CFOP não informado');
      } else if (!/^\d{4}$/.test(produto.cfop.replace(/\D/g, ''))) {
        erros.push('CFOP inválido (deve ter 4 dígitos)');
      }
      
      if (!produto.cst_pis || produto.cst_pis.trim() === '') {
        erros.push('CST PIS não informado');
      }
      
      if (!produto.cst_cofins || produto.cst_cofins.trim() === '') {
        erros.push('CST COFINS não informado');
      }
      
      if (erros.length > 0) {
        produtosInvalidos.push({
          nome: produto.name,
          erros: erros
        });
      }
    }
    
    return produtosInvalidos;
  }

  async emitirNFe(vendaId, currentUser) {
    try {
      // ============================================
      // 1. BUSCAR DADOS DA VENDA COM SQL PURO
      // ============================================
      const [venda] = await sequelize.query(
        `SELECT * FROM vendas WHERE id = $1`,
        { bind: [vendaId], type: sequelize.QueryTypes.SELECT }
      );
      
      if (!venda) throw new Error('Venda não encontrada');

      // Verificar se já existe nota
      const [notaExistente] = await sequelize.query(
        `SELECT * FROM notas_fiscais WHERE venda_id = $1 AND tipo = 'nfe'`,
        { bind: [vendaId], type: sequelize.QueryTypes.SELECT }
      );
      if (notaExistente) throw new Error('Já foi emitida NF-e para esta venda');

      // Buscar configuração fiscal
      const [config] = await sequelize.query(
        `SELECT * FROM empresa_config_fiscal WHERE empresa_id = $1`,
        { bind: [venda.empresa_id], type: sequelize.QueryTypes.SELECT }
      );
      if (!config) throw new Error('Empresa não possui configuração fiscal.');

      // Validar emitente
      const camposEmitenteFaltando = this.validarDadosEmitenteParaNFe(config);
      if (camposEmitenteFaltando.length > 0) {
        throw new Error(`Dados do emitente incompletos. Faltam: ${camposEmitenteFaltando.join(', ')}`);
      }

      // ============================================
      // 2. BUSCAR CLIENTE
      // ============================================
      let cliente = null;
      if (venda.cliente_id) {
        const [clienteData] = await sequelize.query(
          `SELECT * FROM clientes WHERE id = $1`,
          { bind: [venda.cliente_id], type: sequelize.QueryTypes.SELECT }
        );
        cliente = clienteData;
      }
      
      if (!cliente) {
        throw new Error('Para emitir NF-e é necessário selecionar um cliente com cadastro completo.');
      }

      // Validar cliente
      const camposClienteFaltando = this.validarDadosClienteParaNFe(cliente);
      if (camposClienteFaltando.length > 0) {
        throw new Error(`Dados do cliente incompletos. Faltam: ${camposClienteFaltando.join(', ')}`);
      }

      // ============================================
      // 3. BUSCAR ITENS E PRODUTOS
      // ============================================
      const itensVenda = await sequelize.query(
        `SELECT * FROM venda_itens WHERE venda_id = $1`,
        { bind: [vendaId], type: sequelize.QueryTypes.SELECT }
      );

      // Buscar produtos e validar
      const produtos = [];
      for (const item of itensVenda) {
        const [produto] = await sequelize.query(
          `SELECT * FROM "Products" WHERE id = $1`,
          { bind: [item.produto_id], type: sequelize.QueryTypes.SELECT }
        );
        if (!produto) throw new Error(`Produto ${item.produto_id} não encontrado`);
        produtos.push({ item, produto });
      }

      // Validar produtos
      const produtosParaValidar = produtos.map(p => p.produto);
      const produtosInvalidos = this.validarDadosProdutosParaNFe(produtosParaValidar);
      if (produtosInvalidos.length > 0) {
        const mensagemProdutos = produtosInvalidos.map(p => `${p.nome}: ${p.erros.join(', ')}`).join('; ');
        throw new Error(`Dados fiscais dos produtos incompletos. ${mensagemProdutos}`);
      }

      // ============================================
      // 4. MONTAR PAYLOAD
      // ============================================
      const itens = produtos.map(({ item, produto }, idx) => ({
        numero_item: (idx + 1).toString(),
        codigo_produto: produto.id.toString(),
        descricao: produto.name,
        codigo_ncm: produto.ncm,
        cfop: venda.cfop || produto.cfop,
        unidade_comercial: produto.unidade_comercial || 'UN',
        quantidade_comercial: item.quantidade,
        valor_unitario_comercial: Number(item.valor_unitario),
        valor_bruto: Number(item.valor_total),
        unidade_tributavel: produto.unidade_tributavel || 'UN',
        quantidade_tributavel: item.quantidade,
        valor_unitario_tributavel: Number(item.valor_unitario),
        icms_origem: produto.origem || 0,
        icms_situacao_tributaria: venda.cst_csosn || produto.cst_csosn || '102',
        inclui_no_total: 1,
        pis_situacao_tributaria: produto.cst_pis || '07',
        pis_base_calculo: 0,
        pis_aliquota_porcentual: 0,
        pis_valor: 0,
        cofins_situacao_tributaria: produto.cst_cofins || '07',
        cofins_base_calculo: 0,
        cofins_aliquota_porcentual: 0,
        cofins_valor: 0,
      }));

      // Dados do emitente
      const emitentePayload = {
        cnpj_emitente: config.cnpj_emitente,
        nome_emitente: config.nome_emitente,
        logradouro_emitente: config.logradouro_emitente,
        numero_emitente: config.numero_emitente,
        bairro_emitente: config.bairro_emitente,
        municipio_emitente: config.municipio_emitente,
        uf_emitente: config.uf_emitente,
        cep_emitente: config.cep_emitente,
        pais_emitente: 'Brasil',
        telefone_emitente: config.telefone_emitente,
        regime_tributario_emitente: config.regime_tributario_emitente || 1,
        inscricao_estadual_emitente: config.inscricao_estadual_emitente,
      };

      // Dados do cliente
      let cpfCnpj = cliente.cpf || cliente.cnpj;
      if (cpfCnpj) cpfCnpj = cpfCnpj.replace(/\D/g, '');
      const isPessoaFisica = cpfCnpj && cpfCnpj.length === 11;
      
      let documentoDestinatario = {};
      if (isPessoaFisica) {
        documentoDestinatario.cpf_destinatario = cpfCnpj;
      } else if (cpfCnpj && cpfCnpj.length === 14) {
        documentoDestinatario.cnpj_destinatario = cpfCnpj;
      } else {
        documentoDestinatario.cpf_destinatario = '99999999999';
      }

      const clientePayload = {
        ...documentoDestinatario,
        nome_destinatario: cliente.nomeCompleto,
        logradouro_destinatario: cliente.rua,
        numero_destinatario: cliente.numero,
        bairro_destinatario: cliente.bairro,
        municipio_destinatario: cliente.cidade,
        uf_destinatario: cliente.estado,
        cep_destinatario: cliente.cep?.replace(/\D/g, ''),
        pais_destinatario: cliente.pais || 'Brasil',
        telefone_destinatario: cliente.telefone?.replace(/\D/g, ''),
      };

      if (cliente.inscricao_estadual) {
        clientePayload.inscricao_estadual_destinatario = cliente.inscricao_estadual;
        clientePayload.indicador_inscricao_estadual_destinatario = 1;
      } else {
        clientePayload.indicador_inscricao_estadual_destinatario = 9;
      }

      // Payload final
      const payload = {
        natureza_operacao: 'VENDA DE MERCADORIA',
        data_emissao: fiscalDateTime(),
        tipo_documento: 1,
        finalidade_emissao: 1,
        local_destino: 1,
        consumidor_final: isPessoaFisica ? 1 : 0,
        presenca_comprador: 1,
        modalidade_frete: 9,
        ...emitentePayload,
        ...clientePayload,
        items: itens,
        valor_total: Number(venda.valor_total),
        valor_produtos: itens.reduce((s, i) => s + Number(i.valor_bruto || i.valor_unitario_comercial * i.quantidade_comercial), 0),
        valor_desconto: (() => {
          const desc = Number(venda.desconto || 0);
          if (!desc) return 0;
          if (venda.tipo_desconto === 'percent') {
            const subtotal = itens.reduce((s, i) => s + Number(i.valor_bruto || i.valor_unitario_comercial * i.quantidade_comercial), 0);
            return Number((subtotal * desc / 100).toFixed(2));
          }
          return desc;
        })(),
        valor_frete: Number(venda.taxa_entrega || 0),
        valor_outras_despesas: 0,
        valor_seguro: 0,
      };

      const baseUrl = this.getBaseUrl(config.ambiente);
      const referencia = `venda_${vendaId}_${Date.now()}`;

      console.log('Payload NFe enviado:', JSON.stringify(payload, null, 2));

      // Salvar nota no banco
      const [nota] = await sequelize.query(
        `INSERT INTO notas_fiscais (empresa_id, venda_id, referencia, tipo, status, payload_enviado, data_emissao, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'nfe', 'processando', $4, NOW(), NOW(), NOW())
         RETURNING *`,
        { 
          bind: [venda.empresa_id, vendaId, referencia, JSON.stringify(payload)],
          type: sequelize.QueryTypes.INSERT
        }
      );

      // Enviar para Focus
      const response = await axios.post(`${baseUrl}/nfe?ref=${referencia}`, payload, {
        auth: { username: config.focusnfe_token, password: '' },
        headers: { 'Content-Type': 'application/json' },
      });

      console.log('Resposta Focus NFe:', response.data);

      // Atualizar nota com resposta
      await sequelize.query(
        `UPDATE notas_fiscais 
         SET status = $1, resposta_api = $2, mensagem_sefaz = $3, chave_acesso = $4, numero = $5, serie = $6
         WHERE id = $7`,
        {
          bind: [
            response.data.status === 'autorizado' ? 'autorizada' : 'rejeitada',
            JSON.stringify(response.data),
            response.data.mensagem_sefaz || null,
            response.data.chave_nfe || null,
            response.data.numero || null,
            response.data.serie || null,
            nota[0]?.id
          ],
          type: sequelize.QueryTypes.UPDATE
        }
      );

      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`Focus API error: ${error.response.data.mensagem}`);
      }
      throw new Error(`Erro ao emitir NF-e: ${error.message}`);
    }
  }

  async emitirNFCe(vendaId, currentUser) {
    try {
      // Buscar venda
      const [venda] = await sequelize.query(
        `SELECT * FROM vendas WHERE id = $1`,
        { bind: [vendaId], type: sequelize.QueryTypes.SELECT }
      );
      if (!venda) throw new Error('Venda não encontrada');

      // Verificar se já existe nota
      const [notaExistente] = await sequelize.query(
        `SELECT * FROM notas_fiscais WHERE venda_id = $1 AND tipo = 'nfce'`,
        { bind: [vendaId], type: sequelize.QueryTypes.SELECT }
      );
      if (notaExistente) throw new Error('Já foi emitida nota fiscal para esta venda');

      // Buscar configuração fiscal
      const [config] = await sequelize.query(
        `SELECT * FROM empresa_config_fiscal WHERE empresa_id = $1`,
        { bind: [venda.empresa_id], type: sequelize.QueryTypes.SELECT }
      );
      if (!config) throw new Error('Empresa não possui configuração fiscal.');

      // Buscar cliente (opcional)
      let cliente = null;
      if (venda.cliente_id) {
        const [clienteData] = await sequelize.query(
          `SELECT * FROM clientes WHERE id = $1`,
          { bind: [venda.cliente_id], type: sequelize.QueryTypes.SELECT }
        );
        cliente = clienteData;
      }

      // Buscar itens e produtos
      const itensVenda = await sequelize.query(
        `SELECT * FROM venda_itens WHERE venda_id = $1`,
        { bind: [vendaId], type: sequelize.QueryTypes.SELECT }
      );

      const produtos = [];
      for (const item of itensVenda) {
        const [produto] = await sequelize.query(
          `SELECT * FROM "Products" WHERE id = $1`,
          { bind: [item.produto_id], type: sequelize.QueryTypes.SELECT }
        );
        produtos.push({ item, produto });
      }

      // Montar payload NFC-e
      const itens = produtos.map(({ item, produto }, idx) => ({
        numero_item: (idx + 1).toString(),
        codigo_produto: produto.id.toString(),
        descricao: produto.name,
        codigo_ncm: produto.ncm || '99999999',
        cfop: venda.cfop || produto.cfop || '5102',
        unidade_comercial: 'UN',
        quantidade_comercial: item.quantidade,
        valor_unitario_comercial: Number(item.valor_unitario),
        valor_bruto: Number(item.valor_total),
        unidade_tributavel: 'UN',
        quantidade_tributavel: item.quantidade,
        valor_unitario_tributavel: Number(item.valor_unitario),
        icms_origem: '0',
        icms_situacao_tributaria: venda.cst_csosn || produto.cst_csosn || '102',
      }));

      const pagamentos = venda.pagamentos.map(pag => {
        let forma = '';
        switch (pag.forma) {
          case 'DINHEIRO': forma = '01'; break;
          case 'CARTAO': forma = pag.tipoCartao === 'credito' ? '03' : '04'; break;
          case 'PIX': forma = '17'; break;
          default: forma = '99';
        }
        return { forma_pagamento: forma, valor_pagamento: Number(pag.valor) };
      });

      let clientePayload = {};
      if (cliente) {
        let cpfCnpj = cliente.cpf || cliente.cnpj;
        if (cpfCnpj) cpfCnpj = cpfCnpj.replace(/\D/g, '');
        if (cpfCnpj && cpfCnpj.length === 11) {
          clientePayload.cpf_destinatario = cpfCnpj;
        } else if (cpfCnpj && cpfCnpj.length === 14) {
          clientePayload.cnpj_destinatario = cpfCnpj;
        } else {
          clientePayload.cpf_destinatario = '99999999999';
        }
        clientePayload.nome_destinatario = cliente.nomeCompleto;
        clientePayload.indicador_inscricao_estadual_destinatario = '9';
      } else {
        clientePayload.nome_destinatario = 'CONSUMIDOR FINAL';
        clientePayload.cpf_destinatario = '99999999999';
        clientePayload.indicador_inscricao_estadual_destinatario = '9';
      }

      // Calcular desconto absoluto
      const descontoAbs = (() => {
        const desc = Number(venda.desconto || 0);
        if (!desc) return 0;
        if (venda.tipo_desconto === 'percent') {
          const subtotal = itens.reduce((s, i) => s + Number(i.valor_bruto), 0);
          return Number((subtotal * desc / 100).toFixed(2));
        }
        return desc;
      })();

      // Distribuir desconto por item
      if (descontoAbs > 0) {
        const subtotal = itens.reduce((s, i) => s + Number(i.valor_bruto), 0);
        let distribuido = 0;
        itens.forEach((item, idx) => {
          if (idx === itens.length - 1) {
            item.valor_desconto = Number((descontoAbs - distribuido).toFixed(2));
          } else {
            item.valor_desconto = Number(((Number(item.valor_bruto) / subtotal) * descontoAbs).toFixed(2));
            distribuido += item.valor_desconto;
          }
        });
      }

      // Tratar entrega
      const temEntrega = venda.endereco_entrega && venda.endereco_entrega.trim();

      // Endereço do cliente para entrega
      if (temEntrega && cliente && cliente.rua) {
        clientePayload.logradouro_destinatario = cliente.rua;
        clientePayload.numero_destinatario = cliente.numero || 'S/N';
        clientePayload.bairro_destinatario = cliente.bairro || 'N/I';
        clientePayload.municipio_destinatario = cliente.cidade;
        clientePayload.uf_destinatario = cliente.estado;
        if (cliente.cep) clientePayload.cep_destinatario = cliente.cep.replace(/\D/g, '');
      }

      // Taxa de entrega como item separado
      const taxaEntrega = Number(venda.taxa_entrega || 0);
      if (taxaEntrega > 0) {
        itens.push({
          numero_item: (itens.length + 1).toString(),
          codigo_produto: 'TAXA_ENTREGA',
          descricao: 'Taxa de entrega',
          codigo_ncm: '00000000',
          cfop: venda.cfop || '5102',
          unidade_comercial: 'UN',
          quantidade_comercial: 1,
          valor_unitario_comercial: taxaEntrega,
          valor_bruto: taxaEntrega,
          valor_desconto: 0,
          unidade_tributavel: 'UN',
          quantidade_tributavel: 1,
          valor_unitario_tributavel: taxaEntrega,
          icms_origem: '0',
          icms_situacao_tributaria: venda.cst_csosn || '102',
        });
      }

      const payload = {
        cnpj_emitente: config.cnpj_emitente,
        data_emissao: fiscalDateTime(),
        natureza_operacao: 'VENDA AO CONSUMIDOR',
        presenca_comprador: temEntrega ? '4' : '1',
        modalidade_frete: '9',
        local_destino: '1',
        items: itens,
        formas_pagamento: pagamentos,
        valor_total: Number(venda.valor_total),
        ...clientePayload,
      };

      const baseUrl = this.getBaseUrl(config.ambiente);
      const referencia = `venda_${vendaId}_${Date.now()}`;

      console.log('Payload NFC-e enviado:', JSON.stringify(payload, null, 2));

      const response = await axios.post(`${baseUrl}/nfce?ref=${referencia}`, payload, {
        auth: { username: config.focusnfe_token, password: '' },
        headers: { 'Content-Type': 'application/json' },
      });

      console.log('Resposta Focus NFC-e:', response.data);

      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`Focus API error: ${error.response.data.mensagem}`);
      }
      throw new Error(`Erro ao emitir NFC-e: ${error.message}`);
    }
  }

  async consultarStatus(notaId, currentUser) {
    const [nota] = await sequelize.query(
      `SELECT * FROM notas_fiscais WHERE id = $1`,
      { bind: [notaId], type: sequelize.QueryTypes.SELECT }
    );
    if (!nota) throw new Error('Nota fiscal não encontrada');

    if (nota.empresa_id !== currentUser.empresa_id && currentUser.tipo !== 'MASTER') {
      throw new Error('Acesso negado');
    }

    const [config] = await sequelize.query(
      `SELECT * FROM empresa_config_fiscal WHERE empresa_id = $1`,
      { bind: [nota.empresa_id], type: sequelize.QueryTypes.SELECT }
    );
    if (!config) throw new Error('Configuração fiscal não encontrada');

    const baseUrl = this.getBaseUrl(config.ambiente);
    const endpoint = nota.tipo === 'nfce' ? 'nfce' : 'nfe';
    const url = `${baseUrl}/${endpoint}/${nota.referencia}`;

    const response = await axios.get(url, {
      auth: { username: config.focusnfe_token, password: '' },
    });

    const data = response.data;
    
    await sequelize.query(
      `UPDATE notas_fiscais 
       SET status = $1, resposta_api = $2, mensagem_sefaz = $3, chave_acesso = $4, numero = $5, serie = $6
       WHERE id = $7`,
      {
        bind: [
          data.status === 'autorizado' ? 'autorizada' : (data.status === 'cancelado' ? 'cancelada' : 'rejeitada'),
          JSON.stringify(data),
          data.mensagem_sefaz || null,
          data.chave_nfe || null,
          data.numero || null,
          data.serie || null,
          nota.id
        ],
        type: sequelize.QueryTypes.UPDATE
      }
    );

    return data;
  }

  async cancelarNota(notaId, justificativa, currentUser) {
    if (!justificativa || justificativa.length < 15) {
      throw new Error('Justificativa deve ter no mínimo 15 caracteres');
    }

    const [nota] = await sequelize.query(
      `SELECT * FROM notas_fiscais WHERE id = $1`,
      { bind: [notaId], type: sequelize.QueryTypes.SELECT }
    );
    if (!nota) throw new Error('Nota fiscal não encontrada');
    if (nota.status !== 'autorizada') throw new Error('Apenas notas autorizadas podem ser canceladas');

    if (nota.empresa_id !== currentUser.empresa_id && currentUser.tipo !== 'MASTER') {
      throw new Error('Acesso negado');
    }

    const [config] = await sequelize.query(
      `SELECT * FROM empresa_config_fiscal WHERE empresa_id = $1`,
      { bind: [nota.empresa_id], type: sequelize.QueryTypes.SELECT }
    );
    if (!config) throw new Error('Configuração fiscal não encontrada');

    const baseUrl = this.getBaseUrl(config.ambiente);
    const endpoint = nota.tipo === 'nfce' ? 'nfce' : 'nfe';
    const url = `${baseUrl}/${endpoint}/${nota.referencia}`;

    const response = await axios.delete(url, {
      auth: { username: config.focusnfe_token, password: '' },
      data: { justificativa },
    });

    await sequelize.query(
      `UPDATE notas_fiscais SET status = 'cancelada', resposta_api = $1, mensagem_sefaz = $2 WHERE id = $3`,
      { bind: [JSON.stringify(response.data), response.data.mensagem_sefaz, nota.id], type: sequelize.QueryTypes.UPDATE }
    );

    return response.data;
  }

  async enviarEmail(notaId, emails, currentUser) {
    if (!emails || emails.length === 0) throw new Error('Pelo menos um e-mail é obrigatório');
    if (emails.length > 10) throw new Error('Máximo de 10 e-mails por vez');

    const [nota] = await sequelize.query(
      `SELECT * FROM notas_fiscais WHERE id = $1`,
      { bind: [notaId], type: sequelize.QueryTypes.SELECT }
    );
    if (!nota) throw new Error('Nota fiscal não encontrada');
    if (nota.status !== 'autorizada') throw new Error('Somente notas autorizadas podem ser enviadas por e-mail');

    if (nota.empresa_id !== currentUser.empresa_id && currentUser.tipo !== 'MASTER') {
      throw new Error('Acesso negado');
    }

    const [config] = await sequelize.query(
      `SELECT * FROM empresa_config_fiscal WHERE empresa_id = $1`,
      { bind: [nota.empresa_id], type: sequelize.QueryTypes.SELECT }
    );
    if (!config) throw new Error('Configuração fiscal não encontrada');

    const baseUrl = this.getBaseUrl(config.ambiente);
    const endpoint = nota.tipo === 'nfce' ? 'nfce' : 'nfe';
    const url = `${baseUrl}/${endpoint}/${nota.referencia}/email`;

    await axios.post(url, { emails }, {
      auth: { username: config.focusnfe_token, password: '' },
      headers: { 'Content-Type': 'application/json' },
    });
    
    return { message: 'E-mails agendados para envio' };
  }
}

export default new NotaFiscalService();
