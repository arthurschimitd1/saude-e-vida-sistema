import crypto from 'node:crypto';
import { Op } from 'sequelize';

import sequelize from '../../config/database.js';
import ManifestoCondutor from '../../models/ManifestoCondutor.js';
import ManifestoDocumento from '../../models/ManifestoDocumento.js';
import ManifestoEvento from '../../models/ManifestoEvento.js';
import ManifestoMdfe from '../../models/ManifestoMdfe.js';
import ManifestoVeiculo from '../../models/ManifestoVeiculo.js';
import NotaFiscalEmitida from '../../models/NotaFiscalEmitida.js';
import ApiError from '../../utils/apiError.js';
import {
  mapearStatusFocus,
  normalizarDocumento,
  normalizarPlaca,
  STATUS_MDFE_EDITAVEIS,
  validarCondutor,
  validarMdfe,
  validarVeiculo
} from '../../utils/manifestoValidation.js';
import FocusMdfeProvider from './FocusMdfeProvider.js';
import ManifestoAuditService from './ManifestoAuditService.js';
import ManifestoPayloadService from './ManifestoPayloadService.js';

const CAMPOS_MDFE = [
  'numero', 'serie', 'ambiente', 'tipo_emitente', 'tipo_transportador', 'modal',
  'uf_carregamento', 'codigo_municipio_carregamento', 'municipio_carregamento',
  'uf_descarregamento', 'codigo_municipio_descarregamento', 'municipio_descarregamento',
  'ufs_percurso', 'previsao_inicio', 'rota_observacoes', 'veiculo_id', 'reboques',
  'condutor_ids', 'peso_bruto', 'peso_liquido', 'unidade_carga', 'valor_total_carga',
  'produto_predominante', 'tipo_carga', 'dados_seguro', 'informacoes_fisco',
  'informacoes_complementares'
];

const selecionar = (origem, campos) =>
  campos.reduce((destino, campo) => {
    if (Object.prototype.hasOwnProperty.call(origem ?? {}, campo)) destino[campo] = origem[campo];
    return destino;
  }, {});

const extrairRetorno = (resposta = {}) => ({
  status: resposta.status ?? resposta.status_sefaz ?? null,
  codigo: String(resposta.codigo ?? resposta.codigo_status ?? resposta.status_sefaz ?? ''),
  motivo: resposta.mensagem ?? resposta.mensagem_sefaz ?? resposta.motivo ?? null,
  protocolo: resposta.protocolo ?? resposta.protocolo_autorizacao ?? null,
  chave: resposta.chave ?? resposta.chave_nfe ?? resposta.chave_acesso ?? null,
  numero: resposta.numero ?? null,
  serie: resposta.serie ?? null,
  xml: resposta.xml ?? resposta.caminho_xml_nota_fiscal ?? null,
  pdf: resposta.pdf ?? resposta.caminho_danfe ?? resposta.caminho_pdf ?? null
});

const mensagemProvedor = (error) =>
  error.response?.data?.mensagem
  || error.response?.data?.message
  || error.response?.data?.erro
  || error.message
  || 'Falha de comunicação com o provedor fiscal.';

class ManifestoService {
  async dashboard(empresaId) {
    const grupos = await ManifestoMdfe.findAll({
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'total']],
      where: { empresa_id: empresaId, deleted_at: null },
      group: ['status'],
      raw: true
    });
    const porStatus = Object.fromEntries(grupos.map((item) => [item.status, Number(item.total)]));

    return {
      mdfe: {
        total: Object.values(porStatus).reduce((soma, total) => soma + total, 0),
        rascunhos: porStatus.RASCUNHO ?? 0,
        processando: porStatus.PROCESSANDO ?? 0,
        autorizados: porStatus.AUTORIZADO ?? 0,
        pendentes_encerramento:
          (porStatus.EM_TRANSITO ?? 0) + (porStatus.PENDENTE_ENCERRAMENTO ?? 0),
        encerrados: porStatus.ENCERRADO ?? 0,
        rejeitados: porStatus.REJEITADO ?? 0,
        cancelados: porStatus.CANCELADO ?? 0,
        erros: porStatus.ERRO_COMUNICACAO ?? 0
      },
      eventosRecentes: await ManifestoEvento.findAll({
        where: { empresa_id: empresaId },
        order: [['created_at', 'DESC']],
        limit: 8
      })
    };
  }

  async listarVeiculos(empresaId, incluirInativos = false) {
    return ManifestoVeiculo.findAll({
      where: {
        empresa_id: empresaId,
        deleted_at: null,
        ...(incluirInativos ? {} : { ativo: true })
      },
      order: [['placa', 'ASC']]
    });
  }

  async salvarVeiculo(empresaId, dados, id = null) {
    const payload = {
      ...selecionar(dados, [
        'renavam', 'tara_kg', 'capacidade_kg', 'tipo_rodado', 'tipo_carroceria',
        'uf_licenciamento', 'proprietario_nome', 'proprietario_documento', 'rntrc', 'ativo'
      ]),
      placa: normalizarPlaca(dados.placa),
      uf_licenciamento: String(dados.uf_licenciamento ?? '').toUpperCase(),
      proprietario_documento: normalizarDocumento(dados.proprietario_documento) || null
    };
    const erros = validarVeiculo(payload);
    if (erros.length) throw new ApiError(400, erros.join(' '));

    if (id) {
      const veiculo = await this.buscarVeiculo(empresaId, id);
      await veiculo.update(payload);
      return veiculo;
    }

    return ManifestoVeiculo.create({ ...payload, empresa_id: empresaId });
  }

  async buscarVeiculo(empresaId, id) {
    const veiculo = await ManifestoVeiculo.findOne({
      where: { id, empresa_id: empresaId, deleted_at: null }
    });
    if (!veiculo) throw new ApiError(404, 'Veículo não encontrado.');
    return veiculo;
  }

  async excluirVeiculo(empresaId, id) {
    const veiculo = await this.buscarVeiculo(empresaId, id);
    await veiculo.update({ ativo: false, deleted_at: new Date() });
  }

  async listarCondutores(empresaId, incluirInativos = false) {
    return ManifestoCondutor.findAll({
      where: {
        empresa_id: empresaId,
        deleted_at: null,
        ...(incluirInativos ? {} : { ativo: true })
      },
      order: [['nome', 'ASC']]
    });
  }

  async salvarCondutor(empresaId, dados, id = null) {
    const payload = {
      ...selecionar(dados, ['nome', 'telefone', 'cnh', 'validade_cnh', 'ativo']),
      nome: String(dados.nome ?? '').trim(),
      cpf: normalizarDocumento(dados.cpf)
    };
    const erros = validarCondutor(payload);
    if (erros.length) throw new ApiError(400, erros.join(' '));

    if (id) {
      const condutor = await this.buscarCondutor(empresaId, id);
      await condutor.update(payload);
      return condutor;
    }

    return ManifestoCondutor.create({ ...payload, empresa_id: empresaId });
  }

  async buscarCondutor(empresaId, id) {
    const condutor = await ManifestoCondutor.findOne({
      where: { id, empresa_id: empresaId, deleted_at: null }
    });
    if (!condutor) throw new ApiError(404, 'Condutor não encontrado.');
    return condutor;
  }

  async excluirCondutor(empresaId, id) {
    const condutor = await this.buscarCondutor(empresaId, id);
    await condutor.update({ ativo: false, deleted_at: new Date() });
  }

  async listarDocumentosElegiveis(empresaId, busca = '') {
    const termo = String(busca).trim();
    return NotaFiscalEmitida.findAll({
      where: {
        empresa_id: empresaId,
        tipo: { [Op.in]: ['NFE', 'CTE'] },
        status: { [Op.iLike]: '%autoriz%' },
        chave_acesso: {
          [Op.and]: [
            { [Op.ne]: null },
            ...(termo ? [{ [Op.iLike]: `%${termo}%` }] : [])
          ]
        }
      },
      attributes: [
        'id', 'tipo', 'chave_acesso', 'numero', 'serie', 'status', 'valor_total',
        'emitente_nome', 'destinatario_nome', 'data_emissao'
      ],
      order: [['data_emissao', 'DESC']],
      limit: 100
    });
  }

  async listarMdfe(empresaId, filtros = {}) {
    const pagina = Math.max(1, Number(filtros.pagina) || 1);
    const limite = Math.min(100, Math.max(5, Number(filtros.limite) || 20));
    const busca = String(filtros.busca ?? '').trim();
    const where = {
      empresa_id: empresaId,
      deleted_at: null,
      ...(filtros.status ? { status: String(filtros.status).toUpperCase() } : {}),
      ...(busca
        ? {
            [Op.or]: [
              { referencia: { [Op.iLike]: `%${busca}%` } },
              { chave_acesso: { [Op.iLike]: `%${busca}%` } },
              { numero: { [Op.iLike]: `%${busca}%` } },
              { municipio_carregamento: { [Op.iLike]: `%${busca}%` } },
              { municipio_descarregamento: { [Op.iLike]: `%${busca}%` } }
            ]
          }
        : {})
    };

    const { rows, count } = await ManifestoMdfe.findAndCountAll({
      where,
      order: [['updated_at', 'DESC']],
      limit: limite,
      offset: (pagina - 1) * limite,
      attributes: { exclude: ['payload_focus', 'resposta_provedor', 'xml_enviado', 'xml_autorizado'] }
    });

    return { data: rows, total: count, pagina, limite };
  }

  async detalharMdfe(empresaId, id) {
    const mdfe = await ManifestoMdfe.findOne({
      where: { id, empresa_id: empresaId, deleted_at: null },
      attributes: { exclude: ['xml_enviado', 'xml_autorizado'] }
    });
    if (!mdfe) throw new ApiError(404, 'MDF-e não encontrado.');

    const [documentos, eventos] = await Promise.all([
      ManifestoDocumento.findAll({ where: { mdfe_id: id, empresa_id: empresaId } }),
      ManifestoEvento.findAll({
        where: { empresa_id: empresaId, entidade_tipo: 'MDFE', entidade_id: String(id) },
        order: [['created_at', 'DESC']]
      })
    ]);
    return { ...mdfe.toJSON(), documentos, eventos };
  }

  async criarMdfe(empresaId, usuarioId, dados, contexto = {}) {
    const transaction = await sequelize.transaction();
    try {
      const referencia = `LM${empresaId}${Date.now()}${crypto.randomBytes(3).toString('hex')}`;
      const mdfe = await ManifestoMdfe.create({
        ...selecionar(dados, CAMPOS_MDFE),
        empresa_id: empresaId,
        usuario_id: usuarioId,
        referencia,
        status: 'RASCUNHO',
        idempotency_key: String(dados.idempotency_key ?? crypto.randomUUID())
      }, { transaction });

      await this.substituirDocumentos(mdfe, empresaId, dados.documentos ?? [], transaction);
      await ManifestoAuditService.registrar({
        empresaId,
        usuarioId,
        entidadeTipo: 'MDFE',
        entidadeId: mdfe.id,
        acao: 'CRIAR_RASCUNHO',
        statusPosterior: 'RASCUNHO',
        ip: contexto.ip,
        transaction
      });
      await transaction.commit();
      return this.detalharMdfe(empresaId, mdfe.id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async atualizarMdfe(empresaId, usuarioId, id, dados, contexto = {}) {
    const transaction = await sequelize.transaction();
    try {
      const mdfe = await ManifestoMdfe.findOne({
        where: { id, empresa_id: empresaId, deleted_at: null },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!mdfe) throw new ApiError(404, 'MDF-e não encontrado.');
      if (!STATUS_MDFE_EDITAVEIS.has(mdfe.status)) {
        throw new ApiError(409, `O MDF-e em status ${mdfe.status} não pode mais ser editado.`);
      }
      if (dados.versao != null && Number(dados.versao) !== Number(mdfe.versao)) {
        throw new ApiError(409, 'Este rascunho foi alterado por outro usuário. Atualize a página.');
      }

      const statusAnterior = mdfe.status;
      await mdfe.update({
        ...selecionar(dados, CAMPOS_MDFE),
        status: 'RASCUNHO',
        versao: Number(mdfe.versao) + 1
      }, { transaction });
      if (Array.isArray(dados.documentos)) {
        await this.substituirDocumentos(mdfe, empresaId, dados.documentos, transaction);
      }
      await ManifestoAuditService.registrar({
        empresaId,
        usuarioId,
        entidadeTipo: 'MDFE',
        entidadeId: mdfe.id,
        acao: 'ATUALIZAR_RASCUNHO',
        statusAnterior,
        statusPosterior: 'RASCUNHO',
        ip: contexto.ip,
        transaction
      });
      await transaction.commit();
      return this.detalharMdfe(empresaId, mdfe.id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async substituirDocumentos(mdfe, empresaId, documentos, transaction) {
    const unicos = new Map();
    for (const documento of documentos) {
      const chave = normalizarDocumento(documento.chave_acesso);
      if (!chave) continue;
      unicos.set(chave, {
        empresa_id: empresaId,
        mdfe_id: mdfe.id,
        tipo: String(documento.tipo ?? 'NFE').toUpperCase(),
        chave_acesso: chave,
        documento_origem_id: documento.documento_origem_id ?? documento.id ?? null,
        emitente_nome: documento.emitente_nome ?? null,
        destinatario_nome: documento.destinatario_nome ?? null,
        uf_origem: documento.uf_origem ?? null,
        uf_destino: documento.uf_destino ?? null,
        valor: Number(documento.valor ?? documento.valor_total ?? 0),
        peso: Number(documento.peso ?? 0),
        status: documento.status ?? null,
        dados: documento.dados ?? {}
      });
    }

    await ManifestoDocumento.destroy({ where: { mdfe_id: mdfe.id }, transaction });
    if (unicos.size) {
      await ManifestoDocumento.bulkCreate([...unicos.values()], { transaction });
    }
    const lista = [...unicos.values()];
    await mdfe.update({
      quantidade_documentos: lista.length,
      valor_total_carga: lista.reduce((soma, item) => soma + Number(item.valor), 0)
        || Number(mdfe.valor_total_carga)
    }, { transaction });
  }

  async validar(empresaId, id) {
    const detalhe = await this.detalharMdfe(empresaId, id);
    const veiculo = detalhe.veiculo_id
      ? await this.buscarVeiculo(empresaId, detalhe.veiculo_id)
      : null;
    const condutores = await ManifestoCondutor.findAll({
      where: { id: { [Op.in]: detalhe.condutor_ids ?? [] }, empresa_id: empresaId, ativo: true }
    });
    const erros = validarMdfe(detalhe, detalhe.documentos, veiculo, condutores);
    try {
      if (erros.length === 0) {
        await ManifestoPayloadService.montar(
          empresaId,
          detalhe,
          veiculo,
          condutores,
          detalhe.documentos
        );
      }
    } catch (error) {
      erros.push(error.message);
    }

    await ManifestoMdfe.update(
      { status: erros.length ? 'EM_VALIDACAO' : 'PRONTO_PARA_EMISSAO' },
      { where: { id, empresa_id: empresaId } }
    );
    return { valido: erros.length === 0, erros };
  }

  async emitir(empresaId, usuarioId, id, contexto = {}) {
    const validacao = await this.validar(empresaId, id);
    if (!validacao.valido) throw new ApiError(400, validacao.erros.join(' '));

    const transaction = await sequelize.transaction();
    let mdfe;
    try {
      mdfe = await ManifestoMdfe.findOne({
        where: { id, empresa_id: empresaId, deleted_at: null },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!mdfe) throw new ApiError(404, 'MDF-e não encontrado.');
      if (mdfe.status === 'PROCESSANDO') {
        throw new ApiError(409, 'Este MDF-e já está em processamento.');
      }
      if (!['PRONTO_PARA_EMISSAO', 'REJEITADO', 'ERRO_COMUNICACAO'].includes(mdfe.status)) {
        throw new ApiError(409, `Não é possível emitir um MDF-e em status ${mdfe.status}.`);
      }
      await mdfe.update({ status: 'PROCESSANDO', data_emissao: new Date() }, { transaction });
      await ManifestoAuditService.registrar({
        empresaId,
        usuarioId,
        entidadeTipo: 'MDFE',
        entidadeId: id,
        acao: 'SOLICITAR_EMISSAO',
        statusAnterior: 'PRONTO_PARA_EMISSAO',
        statusPosterior: 'PROCESSANDO',
        ip: contexto.ip,
        transaction
      });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    const detalhe = await this.detalharMdfe(empresaId, id);
    const veiculo = await this.buscarVeiculo(empresaId, detalhe.veiculo_id);
    const condutores = await ManifestoCondutor.findAll({
      where: { id: { [Op.in]: detalhe.condutor_ids }, empresa_id: empresaId, ativo: true }
    });

    try {
      const payload = await ManifestoPayloadService.montar(
        empresaId,
        mdfe,
        veiculo,
        condutores,
        detalhe.documentos
      );
      const resposta = await FocusMdfeProvider.emitir(empresaId, mdfe.referencia, payload);
      await this.aplicarResposta(empresaId, usuarioId, mdfe, resposta, 'EMITIR', contexto, { payload });
      return this.detalharMdfe(empresaId, id);
    } catch (error) {
      await this.registrarFalhaExterna(empresaId, usuarioId, mdfe, error, 'EMITIR', contexto);
      throw new ApiError(error.response?.status || 502, mensagemProvedor(error));
    }
  }

  async consultar(empresaId, usuarioId, id, contexto = {}) {
    const mdfe = await this.buscarMdfe(empresaId, id);
    try {
      const resposta = await FocusMdfeProvider.consultar(empresaId, mdfe.referencia);
      await this.aplicarResposta(empresaId, usuarioId, mdfe, resposta, 'CONSULTAR', contexto);
      return this.detalharMdfe(empresaId, id);
    } catch (error) {
      await this.registrarFalhaExterna(empresaId, usuarioId, mdfe, error, 'CONSULTAR', contexto, false);
      throw new ApiError(error.response?.status || 502, mensagemProvedor(error));
    }
  }

  async cancelar(empresaId, usuarioId, id, justificativa, contexto = {}) {
    const texto = String(justificativa ?? '').trim();
    if (texto.length < 15 || texto.length > 255) {
      throw new ApiError(400, 'A justificativa deve ter entre 15 e 255 caracteres.');
    }
    const mdfe = await this.buscarMdfe(empresaId, id);
    if (mdfe.status !== 'AUTORIZADO') {
      throw new ApiError(409, 'Somente MDF-e autorizado pode ser cancelado.');
    }
    try {
      const resposta = await FocusMdfeProvider.cancelar(empresaId, mdfe.referencia, texto);
      await this.aplicarResposta(
        empresaId, usuarioId, mdfe, resposta, 'CANCELAR', contexto, { justificativa: texto }
      );
      return this.detalharMdfe(empresaId, id);
    } catch (error) {
      await this.registrarFalhaExterna(
        empresaId, usuarioId, mdfe, error, 'CANCELAR', contexto, false, texto
      );
      throw new ApiError(error.response?.status || 502, mensagemProvedor(error));
    }
  }

  async encerrar(empresaId, usuarioId, id, dados, contexto = {}) {
    const mdfe = await this.buscarMdfe(empresaId, id);
    if (!['AUTORIZADO', 'EM_TRANSITO', 'PENDENTE_ENCERRAMENTO'].includes(mdfe.status)) {
      throw new ApiError(409, 'Este MDF-e não está disponível para encerramento.');
    }
    if (!dados.data || !/^[A-Z]{2}$/.test(String(dados.sigla_uf ?? '').toUpperCase())
      || String(dados.nome_municipio ?? '').trim().length < 2) {
      throw new ApiError(400, 'Informe data, UF e município de encerramento.');
    }
    try {
      const resposta = await FocusMdfeProvider.encerrar(empresaId, mdfe.referencia, {
        data: dados.data,
        sigla_uf: String(dados.sigla_uf).toUpperCase(),
        nome_municipio: String(dados.nome_municipio).trim()
      });
      await this.aplicarResposta(empresaId, usuarioId, mdfe, resposta, 'ENCERRAR', contexto);
      return this.detalharMdfe(empresaId, id);
    } catch (error) {
      await this.registrarFalhaExterna(empresaId, usuarioId, mdfe, error, 'ENCERRAR', contexto, false);
      throw new ApiError(error.response?.status || 502, mensagemProvedor(error));
    }
  }

  async incluirCondutor(empresaId, usuarioId, id, condutorId, contexto = {}) {
    const mdfe = await this.buscarMdfe(empresaId, id);
    if (!['AUTORIZADO', 'EM_TRANSITO'].includes(mdfe.status)) {
      throw new ApiError(409, 'A inclusão de condutor exige MDF-e autorizado.');
    }
    const condutor = await this.buscarCondutor(empresaId, condutorId);
    try {
      const resposta = await FocusMdfeProvider.incluirCondutor(
        empresaId, mdfe.referencia, condutor
      );
      const ids = [...new Set([...(mdfe.condutor_ids ?? []), Number(condutor.id)])];
      await mdfe.update({ condutor_ids: ids });
      await this.aplicarResposta(
        empresaId, usuarioId, mdfe, resposta, 'INCLUIR_CONDUTOR', contexto,
        { condutor_id: condutor.id }
      );
      return this.detalharMdfe(empresaId, id);
    } catch (error) {
      await this.registrarFalhaExterna(
        empresaId, usuarioId, mdfe, error, 'INCLUIR_CONDUTOR', contexto, false
      );
      throw new ApiError(error.response?.status || 502, mensagemProvedor(error));
    }
  }

  async arquivar(empresaId, usuarioId, id, contexto = {}) {
    const mdfe = await this.buscarMdfe(empresaId, id);
    if (!STATUS_MDFE_EDITAVEIS.has(mdfe.status)) {
      throw new ApiError(409, 'Somente rascunhos ou documentos rejeitados podem ser arquivados.');
    }
    await mdfe.update({ deleted_at: new Date() });
    await ManifestoAuditService.registrar({
      empresaId,
      usuarioId,
      entidadeTipo: 'MDFE',
      entidadeId: id,
      acao: 'ARQUIVAR',
      statusAnterior: mdfe.status,
      statusPosterior: 'ARQUIVADO',
      ip: contexto.ip
    });
  }

  async buscarMdfe(empresaId, id) {
    const mdfe = await ManifestoMdfe.findOne({
      where: { id, empresa_id: empresaId, deleted_at: null }
    });
    if (!mdfe) throw new ApiError(404, 'MDF-e não encontrado.');
    return mdfe;
  }

  async aplicarResposta(empresaId, usuarioId, mdfe, resposta, acao, contexto, extra = {}) {
    const retorno = extrairRetorno(resposta);
    let status = mapearStatusFocus(resposta);
    if (acao === 'CANCELAR') status = 'CANCELADO';
    if (acao === 'ENCERRAR') status = 'ENCERRADO';
    const anterior = mdfe.status;
    await mdfe.update({
      status,
      status_fiscal: retorno.status,
      codigo_retorno: retorno.codigo,
      motivo_retorno: retorno.motivo,
      protocolo: retorno.protocolo || mdfe.protocolo,
      chave_acesso: retorno.chave || mdfe.chave_acesso,
      numero: retorno.numero || mdfe.numero,
      serie: retorno.serie || mdfe.serie,
      payload_focus: extra.payload || mdfe.payload_focus,
      resposta_provedor: resposta,
      xml_autorizado: retorno.xml || mdfe.xml_autorizado,
      pdf_url: retorno.pdf || mdfe.pdf_url,
      data_autorizacao: status === 'AUTORIZADO' ? new Date() : mdfe.data_autorizacao,
      data_cancelamento: status === 'CANCELADO' ? new Date() : mdfe.data_cancelamento,
      data_encerramento: status === 'ENCERRADO' ? new Date() : mdfe.data_encerramento
    });
    await ManifestoAuditService.registrar({
      empresaId,
      usuarioId,
      entidadeTipo: 'MDFE',
      entidadeId: mdfe.id,
      acao,
      statusAnterior: anterior,
      statusPosterior: status,
      protocolo: retorno.protocolo,
      justificativa: extra.justificativa,
      codigoRetorno: retorno.codigo,
      motivoRetorno: retorno.motivo,
      dados: { status_fiscal: retorno.status },
      ip: contexto.ip
    });
  }

  async registrarFalhaExterna(
    empresaId,
    usuarioId,
    mdfe,
    error,
    acao,
    contexto,
    alterarStatus = true,
    justificativa
  ) {
    const motivo = mensagemProvedor(error);
    const statusAnterior = mdfe.status;
    const status = error.response?.status && error.response.status < 500
      ? 'REJEITADO'
      : 'ERRO_COMUNICACAO';
    if (alterarStatus) {
      await mdfe.update({
        status,
        codigo_retorno: String(error.response?.status ?? ''),
        motivo_retorno: motivo,
        resposta_provedor: error.response?.data ?? null
      });
    }
    await ManifestoAuditService.registrar({
      empresaId,
      usuarioId,
      entidadeTipo: 'MDFE',
      entidadeId: mdfe.id,
      acao,
      statusAnterior,
      statusPosterior: alterarStatus ? status : statusAnterior,
      justificativa,
      resultado: 'ERRO',
      codigoRetorno: String(error.response?.status ?? ''),
      motivoRetorno: motivo,
      ip: contexto.ip
    });
  }
}

export default new ManifestoService();
