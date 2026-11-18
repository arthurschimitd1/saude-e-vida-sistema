// backend/src/services/PortalContador.service.js
import Contador from '../models/ContadorModel.js';
import PortalContadorDocumento from '../models/PortalContadorDocumento.js';
import PortalContadorDocumentoLeitura from '../models/PortalContadorDocumentoLeitura.js';
import PortalContadorDocumentoSolicitacao from '../models/PortalContadorDocumentoSolicitacao.js';
import PortalContadorObrigacao from '../models/PortalContadorObrigacao.js';
import PortalContadorReuniao from '../models/PortalContadorReuniao.js';
import sequelize from '../config/database.js';
import ApiError from '../utils/apiError.js';
import CloudinaryService from '../utils/CloudinaryService.js';
import {
  empresaTemPacoteContador,
  getPermissoesEmpresa,
  usuarioPodeAcessarAreaContador
} from '../utils/contadorAccess.js';

class PortalContadorService {
  getEmpresaIdEfetiva(user) {
    return user?.empresa_id_override ?? user?.empresa_id ?? null;
  }

  getUserNome(user) {
    return user?.nomeCompleto || user?.nome || user?.email || 'Usuário';
  }

  async getUserTipoPortal(user) {
    return await usuarioPodeAcessarAreaContador(user) ? 'contador' : 'empresa';
  }

  normalizarData(value) {
    if (!value) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.slice(0, 10);
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }

  async getContexto(user) {
    const empresaId = this.getEmpresaIdEfetiva(user);
    const usuarioMaster = user?.tipo === 'MASTER';
    const permissoesEmpresa = await getPermissoesEmpresa(empresaId);
    const empresaPossuiPacoteContador = empresaTemPacoteContador(permissoesEmpresa);
    const podeGerenciarPortal = await usuarioPodeAcessarAreaContador(user);
    const contadorStatus = empresaPossuiPacoteContador && !usuarioMaster
      ? await this.getPerfilUsuarioContador(user.id)
      : empresaId
      ? await this.getContadorStatus(empresaId)
      : { possuiContador: false, contador: null };

    return {
      empresaId,
      usuarioMaster,
      empresaPossuiPacoteContador,
      podeGerenciarPortal,
      possuiContadorVinculado: contadorStatus.possuiContador,
      contador: contadorStatus.contador
    };
  }

  async getPerfilUsuarioContador(userId) {
    if (!userId) {
      return {
        possuiContador: false,
        contador: null
      };
    }

    const [contador] = await sequelize.query(`
      SELECT
        u.id,
        u."nomeCompleto" AS nome_completo,
        u.email,
        u.avatar_url,
        COALESCE(c.status, 'offline') AS status,
        c.telefone_profissional,
        c.whatsapp_profissional,
        c.horario_atendimento,
        c.ultimo_acesso
      FROM users u
      LEFT JOIN contadores c ON c.user_id = u.id
      WHERE u.id = :userId
        AND u.status = 'ativo'
      LIMIT 1
    `, {
      replacements: { userId },
      type: sequelize.QueryTypes.SELECT
    });

    if (!contador) {
      return {
        possuiContador: false,
        contador: null
      };
    }

    return {
      possuiContador: true,
      contador: {
        id: contador.id,
        nome: contador.nome_completo,
        email: contador.email,
        avatarUrl: contador.avatar_url,
        status: contador.status,
        telefone: contador.telefone_profissional,
        whatsapp: contador.whatsapp_profissional,
        horarioAtendimento: contador.horario_atendimento,
        ultimoAcesso: contador.ultimo_acesso
      }
    };
  }

  async getDashboardClientes(user, filters = {}) {
    const usuarioMaster = user?.tipo === 'MASTER';
    const contadorEmpresaId = this.getEmpresaIdEfetiva(user);
    const podeAcessar = await usuarioPodeAcessarAreaContador(user);

    if (!podeAcessar) {
      throw new ApiError(403, 'Acesso restrito a empresas com Pacote Contador');
    }

    const orderMap = {
      nome: 'empresa_nome ASC',
      scoreFiscal: 'score_fiscal DESC, empresa_nome ASC',
      pendencias: 'total_pendencias DESC, empresa_nome ASC'
    };
    const orderBy = orderMap[filters.ordenarPor] ?? orderMap.nome;

    const where = ['cc.status = COALESCE(:status, cc.status)'];
    const replacements = {
      contadorEmpresaId,
      nome: filters.nome ? `%${filters.nome}%` : null,
      status: filters.status || null
    };

    if (!usuarioMaster || contadorEmpresaId) {
      where.push('cc.contador_empresa_id = :contadorEmpresaId');
    }

    if (filters.nome) {
      where.push('e.nome ILIKE :nome');
    }

    const clientes = await sequelize.query(`
      WITH indicadores AS (
        SELECT
          cc.id AS vinculo_id,
          COUNT(DISTINCT pcd.id) FILTER (WHERE pcd.status_leitura = 'novo')::INTEGER AS documentos_pendentes_download,
          0::INTEGER AS inconsistencias_fiscais,
          COUNT(DISTINCT s.id) FILTER (WHERE s.status IN ('aberta', 'em_andamento'))::INTEGER AS solicitacoes_pendentes,
          COUNT(DISTINCT o.id) FILTER (
            WHERE o.status NOT IN ('concluida', 'cancelada')
              AND o.data_entrega <= CURRENT_DATE + COALESCE(o.dias_alerta_antecedencia, 7)
          )::INTEGER AS obrigacoes_proximas_vencimento
        FROM contador_clientes cc
        LEFT JOIN portal_contador_documentos pcd
          ON pcd.contador_empresa_id = cc.contador_empresa_id
         AND pcd.empresa_cliente_id = cc.empresa_cliente_id
        LEFT JOIN portal_contador_documento_solicitacoes s
          ON s.contador_empresa_id = cc.contador_empresa_id
         AND s.empresa_cliente_id = cc.empresa_cliente_id
        LEFT JOIN portal_contador_obrigacoes o
          ON o.contador_empresa_id = cc.contador_empresa_id
         AND o.empresa_cliente_id = cc.empresa_cliente_id
        GROUP BY cc.id
      ),
      clientes_base AS (
        SELECT
          e.id AS empresa_id,
          e.nome AS empresa_nome,
          me.cnpj AS empresa_cnpj,
          cc.status AS status_vinculo,
          cc.chave_contador,
          cc.integration_key,
          cc.ultimo_envio,
          cc.contador_empresa_id,
          ec.nome AS contador_empresa_nome,
          COALESCE(i.documentos_pendentes_download, 0)::INTEGER AS documentos_pendentes_download,
          COALESCE(i.inconsistencias_fiscais, 0)::INTEGER AS inconsistencias_fiscais,
          COALESCE(i.solicitacoes_pendentes, 0)::INTEGER AS solicitacoes_pendentes,
          COALESCE(i.obrigacoes_proximas_vencimento, 0)::INTEGER AS obrigacoes_proximas_vencimento
        FROM contador_clientes cc
        INNER JOIN empresas e ON e.id = cc.empresa_cliente_id
        INNER JOIN empresas ec ON ec.id = cc.contador_empresa_id
        LEFT JOIN minha_empresa me ON me.empresa_id = e.id
        LEFT JOIN indicadores i ON i.vinculo_id = cc.id
        WHERE ${where.join(' AND ')}
      )
      SELECT
        *,
        GREATEST(
          0,
          100
            - (documentos_pendentes_download * 5)
            - (solicitacoes_pendentes * 3)
            - (inconsistencias_fiscais * 10)
            - (obrigacoes_proximas_vencimento * 7)
        )::INTEGER AS score_fiscal,
        (
          documentos_pendentes_download
          + solicitacoes_pendentes
          + inconsistencias_fiscais
          + obrigacoes_proximas_vencimento
        )::INTEGER AS total_pendencias
      FROM clientes_base
      ORDER BY ${orderBy}
    `, {
      replacements,
      type: sequelize.QueryTypes.SELECT
    });

    return {
      filtros: {
        nome: filters.nome || null,
        status: filters.status || null,
        ordenarPor: filters.ordenarPor || 'nome'
      },
      resumo: {
        totalEmpresas: clientes.length,
        empresasComPendencias: clientes.filter(c => Number(c.total_pendencias) > 0).length,
        documentosPendentesDownload: clientes.reduce((total, c) => total + Number(c.documentos_pendentes_download || 0), 0),
        solicitacoesPendentes: clientes.reduce((total, c) => total + Number(c.solicitacoes_pendentes || 0), 0),
        obrigacoesProximasVencimento: clientes.reduce((total, c) => total + Number(c.obrigacoes_proximas_vencimento || 0), 0),
        inconsistenciasFiscais: clientes.reduce((total, c) => total + Number(c.inconsistencias_fiscais || 0), 0)
      },
      clientes: clientes.map(cliente => ({
        empresaId: cliente.empresa_id,
        nomeEmpresa: cliente.empresa_nome,
        cnpj: cliente.empresa_cnpj,
        statusVinculo: cliente.status_vinculo,
        chaveContador: cliente.chave_contador,
        integrationKey: cliente.integration_key,
        ultimoEnvio: cliente.ultimo_envio,
        contadorEmpresaId: cliente.contador_empresa_id,
        contadorEmpresaNome: cliente.contador_empresa_nome,
        scoreFiscal: Number(cliente.score_fiscal),
        inconsistenciasFiscais: Number(cliente.inconsistencias_fiscais),
        documentosPendentesDownload: Number(cliente.documentos_pendentes_download),
        solicitacoesPendentes: Number(cliente.solicitacoes_pendentes),
        obrigacoesProximasVencimento: Number(cliente.obrigacoes_proximas_vencimento),
        totalPendencias: Number(cliente.total_pendencias)
      }))
    };
  }

  async getClientesDisponiveis(user, filters = {}) {
    const contadorEmpresaId = this.getEmpresaIdEfetiva(user);
    const podeAcessar = await usuarioPodeAcessarAreaContador(user);

    if (!podeAcessar) {
      throw new ApiError(403, 'Acesso restrito a empresas com Pacote Contador');
    }

    if (!contadorEmpresaId) {
      throw new ApiError(400, 'Selecione uma empresa contábil para listar clientes disponíveis');
    }

    const nome = filters.nome ? `%${filters.nome}%` : null;

    const empresas = await sequelize.query(`
      SELECT
        e.id,
        e.nome,
        me.cnpj
      FROM empresas e
      LEFT JOIN minha_empresa me ON me.empresa_id = e.id
      WHERE e.id <> :contadorEmpresaId
        AND (:nome IS NULL OR e.nome ILIKE :nome OR me.cnpj ILIKE :nome)
        AND NOT EXISTS (
          SELECT 1
          FROM contador_clientes cc
          WHERE cc.contador_empresa_id = :contadorEmpresaId
            AND cc.empresa_cliente_id = e.id
        )
      ORDER BY e.nome
      LIMIT 50
    `, {
      replacements: { contadorEmpresaId, nome },
      type: sequelize.QueryTypes.SELECT
    });

    return empresas.map(empresa => ({
      id: empresa.id,
      nome: empresa.nome,
      cnpj: empresa.cnpj
    }));
  }

  async vincularCliente(user, data) {
    const contadorEmpresaId = this.getEmpresaIdEfetiva(user);
    const podeAcessar = await usuarioPodeAcessarAreaContador(user);

    if (!podeAcessar) {
      throw new ApiError(403, 'Acesso restrito a empresas com Pacote Contador');
    }

    if (!contadorEmpresaId) {
      throw new ApiError(400, 'Selecione uma empresa contábil para vincular clientes');
    }

    const empresaClienteId = Number(data.empresaClienteId);
    const chaveContador = String(data.chaveContador || '').trim();
    const status = data.status || 'ativo';
    const STATUS_VALIDOS = ['pendente', 'ativo', 'erro'];

    if (!empresaClienteId) {
      throw new ApiError(400, 'Empresa cliente é obrigatória');
    }

    if (empresaClienteId === Number(contadorEmpresaId)) {
      throw new ApiError(400, 'A empresa contábil não pode ser vinculada como cliente dela mesma');
    }

    if (!chaveContador) {
      throw new ApiError(400, 'Chave do contador é obrigatória');
    }

    if (!STATUS_VALIDOS.includes(status)) {
      throw new ApiError(400, 'Status inválido. Valores aceitos: pendente, ativo, erro');
    }

    const [empresaCliente] = await sequelize.query(
      'SELECT id FROM empresas WHERE id = :empresaClienteId LIMIT 1',
      {
        replacements: { empresaClienteId },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!empresaCliente) {
      throw new ApiError(404, 'Empresa cliente não encontrada');
    }

    const [vinculo] = await sequelize.query(`
      INSERT INTO contador_clientes (
        contador_empresa_id,
        empresa_cliente_id,
        chave_contador,
        integration_key,
        status,
        created_at,
        updated_at
      )
      VALUES (
        :contadorEmpresaId,
        :empresaClienteId,
        :chaveContador,
        :integrationKey,
        :status,
        NOW(),
        NOW()
      )
      ON CONFLICT (contador_empresa_id, empresa_cliente_id)
      DO UPDATE SET
        chave_contador = EXCLUDED.chave_contador,
        integration_key = COALESCE(EXCLUDED.integration_key, contador_clientes.integration_key),
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING
        id,
        contador_empresa_id,
        empresa_cliente_id,
        chave_contador,
        integration_key,
        status,
        ultimo_envio,
        created_at,
        updated_at
    `, {
      replacements: {
        contadorEmpresaId,
        empresaClienteId,
        chaveContador,
        integrationKey: data.integrationKey || null,
        status
      },
      type: sequelize.QueryTypes.SELECT
    });

    return {
      id: vinculo.id,
      contadorEmpresaId: vinculo.contador_empresa_id,
      empresaClienteId: vinculo.empresa_cliente_id,
      chaveContador: vinculo.chave_contador,
      integrationKey: vinculo.integration_key,
      status: vinculo.status,
      ultimoEnvio: vinculo.ultimo_envio,
      createdAt: vinculo.created_at,
      updatedAt: vinculo.updated_at
    };
  }

  async getContadorStatus(empresaId) {
    if (!empresaId) {
      return {
        possuiContador: false,
        contador: null
      };
    }

    const [contador] = await sequelize.query(`
        SELECT 
            u.id,
            u."nomeCompleto" AS nome_completo,
            u.email,
            u.avatar_url,
            COALESCE(c.status, 'offline') AS status,
            c.telefone_profissional,
            c.whatsapp_profissional,
            c.horario_atendimento,
            c.ultimo_acesso
        FROM contador_clientes cc
        INNER JOIN users u ON u.empresa_id = cc.contador_empresa_id
        LEFT JOIN contadores c ON u.id = c.user_id
        WHERE cc.empresa_cliente_id = :empresaId 
          AND cc.status = 'ativo'
          AND u.status = 'ativo'
        LIMIT 1
    `, {
        replacements: { empresaId },
        type: sequelize.QueryTypes.SELECT
    });

    if (!contador) {
      return {
        possuiContador: false,
        contador: null
      };
    }

    return {
      possuiContador: true,
        contador: {
        id: contador.id,
        nome: contador.nome_completo,
        email: contador.email,
        avatarUrl: contador.avatar_url,
        status: contador.status,
        telefone: contador.telefone_profissional,
        whatsapp: contador.whatsapp_profissional,
        horarioAtendimento: contador.horario_atendimento,
        ultimoAcesso: contador.ultimo_acesso
      }
    };
  }

  async updateContadorStatus(userId, status) {
    const STATUS_VALIDOS = ['online', 'offline', 'ausente'];
    
    if (!STATUS_VALIDOS.includes(status)) {
      throw new ApiError(400, 'Status inválido. Valores aceitos: online, offline, ausente');
    }

    // findOrCreate: se não existir registro na tabela contadores, cria
    const [contador] = await Contador.findOrCreate({
      where: { user_id: userId },
      defaults: {
        user_id: userId,
        status: status,
        ultimo_acesso: new Date()
      }
    });

    await contador.update({ 
      status,
      ultimo_acesso: new Date()
    });

    return { status };
  }

  async updatePerfilContador(user, data) {
    const podeAcessar = await usuarioPodeAcessarAreaContador(user);
    const STATUS_VALIDOS = ['online', 'offline', 'ausente'];

    if (!podeAcessar) {
      throw new ApiError(403, 'Acesso restrito a empresas com Pacote Contador');
    }

    if (data.status && !STATUS_VALIDOS.includes(data.status)) {
      throw new ApiError(400, 'Status inválido. Valores aceitos: online, offline, ausente');
    }

    const [contador] = await Contador.findOrCreate({
      where: { user_id: user.id },
      defaults: {
        user_id: user.id,
        status: data.status || 'offline',
        telefone_profissional: data.telefoneProfissional || null,
        whatsapp_profissional: data.whatsappProfissional || null,
        horario_atendimento: data.horarioAtendimento || null,
        ultimo_acesso: new Date()
      }
    });

    const updates = {
      status: data.status || contador.status,
      telefone_profissional: data.telefoneProfissional ?? contador.telefone_profissional,
      whatsapp_profissional: data.whatsappProfissional ?? contador.whatsapp_profissional,
      horario_atendimento: data.horarioAtendimento ?? contador.horario_atendimento,
      ultimo_acesso: new Date()
    };

    await contador.update(updates);

    return {
      id: contador.id,
      userId: contador.user_id,
      status: contador.status,
      telefoneProfissional: contador.telefone_profissional,
      whatsappProfissional: contador.whatsapp_profissional,
      horarioAtendimento: contador.horario_atendimento,
      ultimoAcesso: contador.ultimo_acesso
    };
  }

  async validarVinculoCliente(contadorEmpresaId, empresaClienteId) {
    const [vinculo] = await sequelize.query(`
      SELECT id
      FROM contador_clientes
      WHERE contador_empresa_id = :contadorEmpresaId
        AND empresa_cliente_id = :empresaClienteId
        AND status = 'ativo'
      LIMIT 1
    `, {
      replacements: { contadorEmpresaId, empresaClienteId },
      type: sequelize.QueryTypes.SELECT
    });

    if (!vinculo) {
      throw new ApiError(403, 'Empresa cliente não vinculada ao contador');
    }
  }

  async getContadorEmpresaAtivaDoCliente(empresaClienteId) {
    const [vinculo] = await sequelize.query(`
      SELECT contador_empresa_id
      FROM contador_clientes
      WHERE empresa_cliente_id = :empresaClienteId
        AND status = 'ativo'
      ORDER BY updated_at DESC
      LIMIT 1
    `, {
      replacements: { empresaClienteId },
      type: sequelize.QueryTypes.SELECT
    });

    return vinculo?.contador_empresa_id || null;
  }

  formatDocumento(documento) {
    return {
      id: documento.id,
      contadorEmpresaId: documento.contador_empresa_id,
      empresaClienteId: documento.empresa_cliente_id,
      empresaClienteNome: documento.empresa_cliente_nome,
      nome: documento.nome,
      tipo: documento.tipo,
      competencia: documento.competencia,
      descricao: documento.descricao,
      arquivoUrl: documento.arquivo_url,
      arquivoNomeOriginal: documento.arquivo_nome_original,
      arquivoMimeType: documento.arquivo_mime_type,
      arquivoTamanho: Number(documento.arquivo_tamanho || 0),
      statusLeitura: documento.status_leitura,
      baixadoEm: documento.baixado_em,
      baixadoPor: documento.baixado_por,
      baixadoPorNome: documento.baixado_por_nome,
      baixadoPorTipo: documento.baixado_por_tipo,
      criadoEm: documento.created_at,
      atualizadoEm: documento.updated_at
    };
  }

  async getDocumentosScope(user, filters = {}) {
    const empresaId = this.getEmpresaIdEfetiva(user);
    const podeGerenciarPortal = await usuarioPodeAcessarAreaContador(user);
    const where = [];
    const replacements = {};

    if (podeGerenciarPortal) {
      if (!empresaId) {
        throw new ApiError(400, 'Selecione uma empresa contábil para listar documentos');
      }

      where.push('pcd.contador_empresa_id = :contadorEmpresaId');
      replacements.contadorEmpresaId = empresaId;

      if (filters.empresaClienteId) {
        const empresaClienteId = Number(filters.empresaClienteId);
        await this.validarVinculoCliente(empresaId, empresaClienteId);
        where.push('pcd.empresa_cliente_id = :empresaClienteId');
        replacements.empresaClienteId = empresaClienteId;
      }
    } else {
      if (!empresaId) {
        throw new ApiError(400, 'empresa_id não encontrado no token');
      }

      where.push('pcd.empresa_cliente_id = :empresaClienteId');
      replacements.empresaClienteId = empresaId;
    }

    if (filters.tipo) {
      where.push('pcd.tipo = :tipo');
      replacements.tipo = filters.tipo;
    }

    if (filters.competencia) {
      where.push('pcd.competencia = :competencia');
      replacements.competencia = filters.competencia;
    }

    if (filters.statusLeitura) {
      where.push('pcd.status_leitura = :statusLeitura');
      replacements.statusLeitura = filters.statusLeitura;
    }

    return { where, replacements };
  }

  async getDocumentos(user, filters = {}) {
    const { where, replacements } = await this.getDocumentosScope(user, filters);

    const documentos = await sequelize.query(`
      SELECT
        pcd.*,
        e.nome AS empresa_cliente_nome
      FROM portal_contador_documentos pcd
      LEFT JOIN empresas e ON e.id = pcd.empresa_cliente_id
      WHERE ${where.join(' AND ')}
      ORDER BY pcd.created_at DESC
    `, {
      replacements,
      type: sequelize.QueryTypes.SELECT
    });

    return documentos.map(documento => this.formatDocumento(documento));
  }

  async getDocumentosParaDownload(user, filters = {}) {
    const { where, replacements } = await this.getDocumentosScope(user, filters);

    const documentos = await sequelize.query(`
      SELECT pcd.*
      FROM portal_contador_documentos pcd
      WHERE ${where.join(' AND ')}
      ORDER BY pcd.created_at DESC
    `, {
      replacements,
      type: sequelize.QueryTypes.SELECT
    });

    if (!documentos.length) {
      throw new ApiError(404, 'Nenhum documento disponível para download');
    }

    await Promise.all(documentos.map(documento => this.registrarLeituraDocumento(documento.id, user, 'download_lote')));

    return documentos.map(documento => {
      const filename = documento.arquivo_nome_original || documento.nome;
      return {
        ...documento,
        filename,
        downloadUrl: CloudinaryService.getDownloadUrl(
          documento.arquivo_public_id,
          filename,
          CloudinaryService.getResourceType(filename)
        )
      };
    });
  }

  async createDocumento(user, data, file) {
    if (!file) {
      throw new ApiError(400, 'Arquivo é obrigatório');
    }

    const empresaId = this.getEmpresaIdEfetiva(user);
    const podeGerenciarPortal = await usuarioPodeAcessarAreaContador(user);
    let empresaClienteId = Number(data.empresaClienteId || empresaId);
    let contadorEmpresaId = null;

    if (podeGerenciarPortal) {
      if (!empresaId) {
        throw new ApiError(400, 'Selecione uma empresa contábil para enviar documentos');
      }

      if (!empresaClienteId) {
        throw new ApiError(400, 'Empresa cliente é obrigatória');
      }

      await this.validarVinculoCliente(empresaId, empresaClienteId);
      contadorEmpresaId = empresaId;
    } else {
      if (!empresaId) {
        throw new ApiError(400, 'empresa_id não encontrado no token');
      }

      empresaClienteId = empresaId;
      contadorEmpresaId = await this.getContadorEmpresaAtivaDoCliente(empresaClienteId);
    }

    const nome = String(data.nome || file.originalname).trim();
    const tipo = String(data.tipo || 'documento').trim();
    const competencia = data.competencia ? String(data.competencia).slice(0, 7) : null;

    if (!nome) {
      throw new ApiError(400, 'Nome do documento é obrigatório');
    }

    const result = await CloudinaryService.uploadFile(
      file.buffer,
      file.originalname,
      'lucromais/portal-contador/documentos'
    );

    const documento = await PortalContadorDocumento.create({
      contador_empresa_id: contadorEmpresaId,
      empresa_cliente_id: empresaClienteId,
      nome,
      tipo,
      competencia,
      descricao: data.descricao || null,
      arquivo_url: result.secure_url,
      arquivo_public_id: result.public_id,
      arquivo_nome_original: file.originalname,
      arquivo_mime_type: file.mimetype,
      arquivo_tamanho: file.size,
      enviado_por: user?.id || null
    });

    return this.formatDocumento(documento.get({ plain: true }));
  }

  async getDocumentoById(id, user) {
    const documento = await PortalContadorDocumento.findByPk(id);
    if (!documento) {
      throw new ApiError(404, 'Documento não encontrado');
    }

    const empresaId = this.getEmpresaIdEfetiva(user);
    const podeGerenciarPortal = await usuarioPodeAcessarAreaContador(user);

    if (podeGerenciarPortal) {
      if (Number(documento.contador_empresa_id) !== Number(empresaId)) {
        throw new ApiError(403, 'Documento não pertence à empresa contábil selecionada');
      }
    } else if (Number(documento.empresa_cliente_id) !== Number(empresaId)) {
      throw new ApiError(403, 'Documento não pertence à empresa selecionada');
    }

    return documento;
  }

  async downloadDocumento(id, user) {
    const documento = await this.getDocumentoById(id, user);
    const filename = documento.arquivo_nome_original || documento.nome;
    const url = CloudinaryService.getDownloadUrl(
      documento.arquivo_public_id,
      filename,
      CloudinaryService.getResourceType(filename)
    );

    await this.registrarLeituraDocumento(documento.id, user, 'download');

    return { documento, url, filename };
  }

  async registrarLeituraDocumento(documentoId, user, acao = 'download') {
    const usuarioTipo = await this.getUserTipoPortal(user);
    const usuarioNome = this.getUserNome(user);
    const now = new Date();

    await PortalContadorDocumentoLeitura.create({
      documento_id: documentoId,
      usuario_id: user?.id || null,
      usuario_nome: usuarioNome,
      usuario_tipo: usuarioTipo,
      acao
    });

    if (usuarioTipo === 'contador') {
      await PortalContadorDocumento.update({
        status_leitura: 'baixado',
        baixado_em: now,
        baixado_por: user?.id || null,
        baixado_por_nome: usuarioNome,
        baixado_por_tipo: usuarioTipo
      }, {
        where: { id: documentoId }
      });
    }
  }

  async deleteDocumento(id, user) {
    const documento = await this.getDocumentoById(id, user);
    const filename = documento.arquivo_nome_original || documento.nome;

    await CloudinaryService.deleteFile(
      documento.arquivo_public_id,
      CloudinaryService.getResourceType(filename)
    );
    await documento.destroy();
  }

  formatSolicitacao(solicitacao) {
    return {
      id: solicitacao.id,
      contadorEmpresaId: solicitacao.contador_empresa_id,
      empresaClienteId: solicitacao.empresa_cliente_id,
      empresaClienteNome: solicitacao.empresa_cliente_nome,
      titulo: solicitacao.titulo,
      tipo: solicitacao.tipo,
      competencia: solicitacao.competencia,
      descricao: solicitacao.descricao,
      prioridade: solicitacao.prioridade,
      status: solicitacao.status,
      solicitadoPor: solicitacao.solicitado_por,
      solicitadoPorNome: solicitacao.solicitado_por_nome,
      solicitadoPorTipo: solicitacao.solicitado_por_tipo,
      atendidoEm: solicitacao.atendido_em,
      historico: solicitacao.historico || [],
      criadoEm: solicitacao.created_at,
      atualizadoEm: solicitacao.updated_at
    };
  }

  async getSolicitacoes(user, filters = {}) {
    const empresaId = this.getEmpresaIdEfetiva(user);
    const podeGerenciarPortal = await usuarioPodeAcessarAreaContador(user);
    const where = [];
    const replacements = {};

    if (podeGerenciarPortal) {
      if (!empresaId) throw new ApiError(400, 'Selecione uma empresa contábil para listar solicitações');
      where.push('s.contador_empresa_id = :contadorEmpresaId');
      replacements.contadorEmpresaId = empresaId;

      if (filters.empresaClienteId) {
        const empresaClienteId = Number(filters.empresaClienteId);
        await this.validarVinculoCliente(empresaId, empresaClienteId);
        where.push('s.empresa_cliente_id = :empresaClienteId');
        replacements.empresaClienteId = empresaClienteId;
      }
    } else {
      if (!empresaId) throw new ApiError(400, 'empresa_id não encontrado no token');
      where.push('s.empresa_cliente_id = :empresaClienteId');
      replacements.empresaClienteId = empresaId;
    }

    if (filters.status) {
      where.push('s.status = :status');
      replacements.status = filters.status;
    }

    const solicitacoes = await sequelize.query(`
      SELECT
        s.*,
        e.nome AS empresa_cliente_nome
      FROM portal_contador_documento_solicitacoes s
      LEFT JOIN empresas e ON e.id = s.empresa_cliente_id
      WHERE ${where.join(' AND ')}
      ORDER BY s.created_at DESC
    `, {
      replacements,
      type: sequelize.QueryTypes.SELECT
    });

    return solicitacoes.map(solicitacao => this.formatSolicitacao(solicitacao));
  }

  async createSolicitacao(user, data) {
    const empresaId = this.getEmpresaIdEfetiva(user);
    const podeGerenciarPortal = await usuarioPodeAcessarAreaContador(user);
    const usuarioTipo = podeGerenciarPortal ? 'contador' : 'empresa';
    let empresaClienteId = Number(data.empresaClienteId || empresaId);
    let contadorEmpresaId = null;

    if (podeGerenciarPortal) {
      if (!empresaId) throw new ApiError(400, 'Selecione uma empresa contábil para solicitar documentos');
      if (!empresaClienteId) throw new ApiError(400, 'Empresa cliente é obrigatória');
      await this.validarVinculoCliente(empresaId, empresaClienteId);
      contadorEmpresaId = empresaId;
    } else {
      if (!empresaId) throw new ApiError(400, 'empresa_id não encontrado no token');
      empresaClienteId = empresaId;
      contadorEmpresaId = await this.getContadorEmpresaAtivaDoCliente(empresaClienteId);
    }

    const titulo = String(data.titulo || '').trim();
    if (!titulo) throw new ApiError(400, 'Título da solicitação é obrigatório');

    const prioridade = data.prioridade || 'normal';
    if (!['baixa', 'normal', 'alta'].includes(prioridade)) {
      throw new ApiError(400, 'Prioridade inválida');
    }

    const historico = [{
      acao: 'criada',
      status: 'aberta',
      usuarioId: user?.id || null,
      usuarioNome: this.getUserNome(user),
      usuarioTipo,
      data: new Date().toISOString()
    }];

    const solicitacao = await PortalContadorDocumentoSolicitacao.create({
      contador_empresa_id: contadorEmpresaId,
      empresa_cliente_id: empresaClienteId,
      titulo,
      tipo: data.tipo || 'documento',
      competencia: data.competencia ? String(data.competencia).slice(0, 7) : null,
      descricao: data.descricao || null,
      prioridade,
      status: 'aberta',
      solicitado_por: user?.id || null,
      solicitado_por_nome: this.getUserNome(user),
      solicitado_por_tipo: usuarioTipo,
      historico
    });

    return this.formatSolicitacao(solicitacao.get({ plain: true }));
  }

  async updateSolicitacaoStatus(id, user, data) {
    const solicitacao = await PortalContadorDocumentoSolicitacao.findByPk(id);
    if (!solicitacao) throw new ApiError(404, 'Solicitação não encontrada');

    const empresaId = this.getEmpresaIdEfetiva(user);
    const podeGerenciarPortal = await usuarioPodeAcessarAreaContador(user);
    if (podeGerenciarPortal) {
      if (Number(solicitacao.contador_empresa_id) !== Number(empresaId)) {
        throw new ApiError(403, 'Solicitação não pertence à empresa contábil selecionada');
      }
    } else if (Number(solicitacao.empresa_cliente_id) !== Number(empresaId)) {
      throw new ApiError(403, 'Solicitação não pertence à empresa selecionada');
    }

    const status = data.status;
    if (!['aberta', 'em_andamento', 'atendida', 'cancelada'].includes(status)) {
      throw new ApiError(400, 'Status inválido');
    }

    const usuarioTipo = podeGerenciarPortal ? 'contador' : 'empresa';
    const historico = Array.isArray(solicitacao.historico) ? solicitacao.historico : [];
    historico.push({
      acao: 'status_alterado',
      status,
      observacao: data.observacao || null,
      usuarioId: user?.id || null,
      usuarioNome: this.getUserNome(user),
      usuarioTipo,
      data: new Date().toISOString()
    });

    await solicitacao.update({
      status,
      atendido_em: status === 'atendida' ? new Date() : solicitacao.atendido_em,
      historico
    });

    return this.formatSolicitacao(solicitacao.get({ plain: true }));
  }

  formatObrigacao(obrigacao) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataEntrega = obrigacao.data_entrega ? new Date(`${obrigacao.data_entrega}T00:00:00`) : null;
    const diasAlerta = Number(obrigacao.dias_alerta_antecedencia ?? 7);
    const limiteAlerta = new Date(hoje);
    limiteAlerta.setDate(limiteAlerta.getDate() + diasAlerta);

    let statusAlerta = 'em_dia';
    if (obrigacao.status === 'concluida') {
      statusAlerta = 'concluida';
    } else if (obrigacao.status === 'cancelada') {
      statusAlerta = 'cancelada';
    } else if (dataEntrega && dataEntrega < hoje) {
      statusAlerta = 'atrasada';
    } else if (dataEntrega && dataEntrega <= limiteAlerta) {
      statusAlerta = 'alerta';
    }

    return {
      id: obrigacao.id,
      contadorEmpresaId: obrigacao.contador_empresa_id,
      empresaClienteId: obrigacao.empresa_cliente_id,
      empresaClienteNome: obrigacao.empresa_cliente_nome,
      titulo: obrigacao.titulo,
      tipo: obrigacao.tipo,
      competencia: obrigacao.competencia,
      descricao: obrigacao.descricao,
      dataEntrega: obrigacao.data_entrega,
      status: obrigacao.status,
      statusAlerta,
      diasAlertaAntecedencia: Number(obrigacao.dias_alerta_antecedencia ?? 7),
      responsavelContadorId: obrigacao.responsavel_contador_id,
      responsavelContadorNome: obrigacao.responsavel_contador_nome,
      concluidoEm: obrigacao.concluido_em,
      criadoPor: obrigacao.criado_por,
      atualizadoPor: obrigacao.atualizado_por,
      criadoEm: obrigacao.created_at,
      atualizadoEm: obrigacao.updated_at
    };
  }

  async getObrigacoesScope(user, filters = {}) {
    const empresaId = this.getEmpresaIdEfetiva(user);
    const podeGerenciarPortal = await usuarioPodeAcessarAreaContador(user);
    const where = [];
    const replacements = {};

    if (podeGerenciarPortal) {
      if (!empresaId) throw new ApiError(400, 'Selecione uma empresa contábil para listar obrigações');
      where.push('o.contador_empresa_id = :contadorEmpresaId');
      replacements.contadorEmpresaId = empresaId;

      if (filters.empresaClienteId) {
        const empresaClienteId = Number(filters.empresaClienteId);
        await this.validarVinculoCliente(empresaId, empresaClienteId);
        where.push('o.empresa_cliente_id = :empresaClienteId');
        replacements.empresaClienteId = empresaClienteId;
      }
    } else {
      if (!empresaId) throw new ApiError(400, 'empresa_id não encontrado no token');
      where.push('o.empresa_cliente_id = :empresaClienteId');
      replacements.empresaClienteId = empresaId;
    }

    if (filters.status) {
      where.push('o.status = :status');
      replacements.status = filters.status;
    }

    if (filters.tipo) {
      where.push('o.tipo = :tipo');
      replacements.tipo = filters.tipo;
    }

    if (filters.competencia) {
      where.push('o.competencia = :competencia');
      replacements.competencia = filters.competencia;
    }

    if (filters.dataInicio) {
      where.push('o.data_entrega >= :dataInicio');
      replacements.dataInicio = this.normalizarData(filters.dataInicio);
    }

    if (filters.dataFim) {
      where.push('o.data_entrega <= :dataFim');
      replacements.dataFim = this.normalizarData(filters.dataFim);
    }

    return { where, replacements };
  }

  async getObrigacoes(user, filters = {}) {
    const { where, replacements } = await this.getObrigacoesScope(user, filters);

    const obrigacoes = await sequelize.query(`
      SELECT
        o.*,
        e.nome AS empresa_cliente_nome,
        u."nomeCompleto" AS responsavel_contador_nome
      FROM portal_contador_obrigacoes o
      LEFT JOIN empresas e ON e.id = o.empresa_cliente_id
      LEFT JOIN users u ON u.id = o.responsavel_contador_id
      WHERE ${where.join(' AND ')}
      ORDER BY
        CASE WHEN o.status IN ('concluida', 'cancelada') THEN 1 ELSE 0 END,
        o.data_entrega ASC,
        o.created_at DESC
    `, {
      replacements,
      type: sequelize.QueryTypes.SELECT
    });

    return obrigacoes.map(obrigacao => this.formatObrigacao(obrigacao));
  }

  async resolveObrigacaoEmpresas(user, data = {}) {
    const empresaId = this.getEmpresaIdEfetiva(user);
    const podeGerenciarPortal = await usuarioPodeAcessarAreaContador(user);
    let empresaClienteId = Number(data.empresaClienteId || empresaId);
    let contadorEmpresaId = null;

    if (podeGerenciarPortal) {
      if (!empresaId) throw new ApiError(400, 'Selecione uma empresa contábil');
      if (!empresaClienteId) throw new ApiError(400, 'Empresa cliente é obrigatória');
      await this.validarVinculoCliente(empresaId, empresaClienteId);
      contadorEmpresaId = empresaId;
    } else {
      if (!empresaId) throw new ApiError(400, 'empresa_id não encontrado no token');
      empresaClienteId = empresaId;
      contadorEmpresaId = await this.getContadorEmpresaAtivaDoCliente(empresaClienteId);
    }

    return { empresaClienteId, contadorEmpresaId, podeGerenciarPortal };
  }

  async createObrigacao(user, data) {
    const { empresaClienteId, contadorEmpresaId, podeGerenciarPortal } = await this.resolveObrigacaoEmpresas(user, data);
    const titulo = String(data.titulo || '').trim();
    const dataEntrega = this.normalizarData(data.dataEntrega || data.data_entrega);
    const status = data.status || 'pendente';
    const STATUS_VALIDOS = ['pendente', 'em_andamento', 'concluida', 'cancelada'];

    if (!titulo) throw new ApiError(400, 'Título da obrigação é obrigatório');
    if (!dataEntrega) throw new ApiError(400, 'Data de entrega é obrigatória');
    if (!STATUS_VALIDOS.includes(status)) throw new ApiError(400, 'Status inválido');

    const obrigacao = await PortalContadorObrigacao.create({
      contador_empresa_id: contadorEmpresaId,
      empresa_cliente_id: empresaClienteId,
      titulo,
      tipo: data.tipo || 'fiscal',
      competencia: data.competencia ? String(data.competencia).slice(0, 7) : null,
      descricao: data.descricao || null,
      data_entrega: dataEntrega,
      status,
      dias_alerta_antecedencia: Math.max(0, Number(data.diasAlertaAntecedencia ?? data.dias_alerta_antecedencia ?? 7)),
      responsavel_contador_id: data.responsavelContadorId || (podeGerenciarPortal ? user?.id : null),
      criado_por: user?.id || null,
      atualizado_por: user?.id || null,
      concluido_em: status === 'concluida' ? new Date() : null
    });

    return this.formatObrigacao(obrigacao.get({ plain: true }));
  }

  async getObrigacaoById(id, user) {
    const obrigacao = await PortalContadorObrigacao.findByPk(id);
    if (!obrigacao) throw new ApiError(404, 'Obrigação fiscal não encontrada');

    const empresaId = this.getEmpresaIdEfetiva(user);
    const podeGerenciarPortal = await usuarioPodeAcessarAreaContador(user);

    if (podeGerenciarPortal) {
      if (Number(obrigacao.contador_empresa_id) !== Number(empresaId)) {
        throw new ApiError(403, 'Obrigação não pertence à empresa contábil selecionada');
      }
    } else if (Number(obrigacao.empresa_cliente_id) !== Number(empresaId)) {
      throw new ApiError(403, 'Obrigação não pertence à empresa selecionada');
    }

    return obrigacao;
  }

  async updateObrigacao(id, user, data) {
    const obrigacao = await this.getObrigacaoById(id, user);
    const STATUS_VALIDOS = ['pendente', 'em_andamento', 'concluida', 'cancelada'];
    const updates = {};

    if (data.titulo !== undefined) {
      const titulo = String(data.titulo || '').trim();
      if (!titulo) throw new ApiError(400, 'Título da obrigação é obrigatório');
      updates.titulo = titulo;
    }

    if (data.tipo !== undefined) updates.tipo = data.tipo || 'fiscal';
    if (data.competencia !== undefined) updates.competencia = data.competencia ? String(data.competencia).slice(0, 7) : null;
    if (data.descricao !== undefined) updates.descricao = data.descricao || null;
    if (data.dataEntrega !== undefined || data.data_entrega !== undefined) {
      const dataEntrega = this.normalizarData(data.dataEntrega || data.data_entrega);
      if (!dataEntrega) throw new ApiError(400, 'Data de entrega é obrigatória');
      updates.data_entrega = dataEntrega;
    }
    if (data.status !== undefined) {
      if (!STATUS_VALIDOS.includes(data.status)) throw new ApiError(400, 'Status inválido');
      updates.status = data.status;
      updates.concluido_em = data.status === 'concluida' ? new Date() : null;
    }
    if (data.diasAlertaAntecedencia !== undefined || data.dias_alerta_antecedencia !== undefined) {
      updates.dias_alerta_antecedencia = Math.max(0, Number(data.diasAlertaAntecedencia ?? data.dias_alerta_antecedencia));
    }
    if (data.responsavelContadorId !== undefined) updates.responsavel_contador_id = data.responsavelContadorId || null;

    updates.atualizado_por = user?.id || null;
    await obrigacao.update(updates);

    return this.formatObrigacao(obrigacao.get({ plain: true }));
  }

  async concluirObrigacao(id, user) {
    return this.updateObrigacao(id, user, { status: 'concluida' });
  }

  async deleteObrigacao(id, user) {
    const obrigacao = await this.getObrigacaoById(id, user);
    await obrigacao.destroy();
  }

  formatReuniao(reuniao) {
    return {
      id: reuniao.id,
      contadorEmpresaId: reuniao.contador_empresa_id,
      empresaClienteId: reuniao.empresa_cliente_id,
      empresaClienteNome: reuniao.empresa_cliente_nome,
      obrigacaoId: reuniao.obrigacao_id,
      obrigacaoTitulo: reuniao.obrigacao_titulo,
      titulo: reuniao.titulo,
      descricao: reuniao.descricao,
      dataReuniao: reuniao.data_reuniao,
      horario: reuniao.horario,
      canal: reuniao.canal,
      linkReuniao: reuniao.link_reuniao,
      status: reuniao.status,
      solicitadoPor: reuniao.solicitado_por,
      solicitadoPorNome: reuniao.solicitado_por_nome,
      solicitadoPorTipo: reuniao.solicitado_por_tipo,
      canceladoEm: reuniao.cancelado_em,
      criadoPor: reuniao.criado_por,
      atualizadoPor: reuniao.atualizado_por,
      criadoEm: reuniao.created_at,
      atualizadoEm: reuniao.updated_at
    };
  }

  async getReunioesScope(user, filters = {}) {
    const empresaId = this.getEmpresaIdEfetiva(user);
    const podeGerenciarPortal = await usuarioPodeAcessarAreaContador(user);
    const where = [];
    const replacements = {};

    if (podeGerenciarPortal) {
      if (!empresaId) throw new ApiError(400, 'Selecione uma empresa contábil para listar reuniões');
      where.push('r.contador_empresa_id = :contadorEmpresaId');
      replacements.contadorEmpresaId = empresaId;

      if (filters.empresaClienteId) {
        const empresaClienteId = Number(filters.empresaClienteId);
        await this.validarVinculoCliente(empresaId, empresaClienteId);
        where.push('r.empresa_cliente_id = :empresaClienteId');
        replacements.empresaClienteId = empresaClienteId;
      }
    } else {
      if (!empresaId) throw new ApiError(400, 'empresa_id não encontrado no token');
      where.push('r.empresa_cliente_id = :empresaClienteId');
      replacements.empresaClienteId = empresaId;
    }

    if (filters.status) {
      where.push('r.status = :status');
      replacements.status = filters.status;
    }

    if (filters.obrigacaoId) {
      where.push('r.obrigacao_id = :obrigacaoId');
      replacements.obrigacaoId = Number(filters.obrigacaoId);
    }

    if (filters.dataInicio) {
      where.push('r.data_reuniao >= :dataInicio');
      replacements.dataInicio = this.normalizarData(filters.dataInicio);
    }

    if (filters.dataFim) {
      where.push('r.data_reuniao <= :dataFim');
      replacements.dataFim = this.normalizarData(filters.dataFim);
    }

    return { where, replacements };
  }

  async getReunioes(user, filters = {}) {
    const { where, replacements } = await this.getReunioesScope(user, filters);

    const reunioes = await sequelize.query(`
      SELECT
        r.*,
        e.nome AS empresa_cliente_nome,
        o.titulo AS obrigacao_titulo,
        u."nomeCompleto" AS solicitado_por_nome
      FROM portal_contador_reunioes r
      LEFT JOIN empresas e ON e.id = r.empresa_cliente_id
      LEFT JOIN portal_contador_obrigacoes o ON o.id = r.obrigacao_id
      LEFT JOIN users u ON u.id = r.solicitado_por
      WHERE ${where.join(' AND ')}
      ORDER BY
        CASE WHEN r.status IN ('realizada', 'cancelada') THEN 1 ELSE 0 END,
        r.data_reuniao ASC,
        r.horario ASC,
        r.created_at DESC
    `, {
      replacements,
      type: sequelize.QueryTypes.SELECT
    });

    return reunioes.map(reuniao => this.formatReuniao(reuniao));
  }

  async getReuniaoById(id, user) {
    const reuniao = await PortalContadorReuniao.findByPk(id);
    if (!reuniao) throw new ApiError(404, 'Reunião não encontrada');

    const empresaId = this.getEmpresaIdEfetiva(user);
    const podeGerenciarPortal = await usuarioPodeAcessarAreaContador(user);

    if (podeGerenciarPortal) {
      if (Number(reuniao.contador_empresa_id) !== Number(empresaId)) {
        throw new ApiError(403, 'Reunião não pertence à empresa contábil selecionada');
      }
    } else if (Number(reuniao.empresa_cliente_id) !== Number(empresaId)) {
      throw new ApiError(403, 'Reunião não pertence à empresa selecionada');
    }

    return reuniao;
  }

  async createReuniao(user, data) {
    const { empresaClienteId, contadorEmpresaId, podeGerenciarPortal } = await this.resolveObrigacaoEmpresas(user, data);
    const titulo = String(data.titulo || '').trim();
    const dataReuniao = this.normalizarData(data.dataReuniao || data.data_reuniao);
    const horario = String(data.horario || '').trim();
    const status = data.status || 'solicitada';
    const STATUS_VALIDOS = ['solicitada', 'agendada', 'realizada', 'cancelada'];
    const CANAIS_VALIDOS = ['whatsapp', 'google_meet', 'teams', 'presencial', 'telefone', 'outro'];

    if (!titulo) throw new ApiError(400, 'Título da reunião é obrigatório');
    if (!dataReuniao) throw new ApiError(400, 'Data da reunião é obrigatória');
    if (!/^\d{2}:\d{2}$/.test(horario)) throw new ApiError(400, 'Horário da reunião é obrigatório');
    if (!STATUS_VALIDOS.includes(status)) throw new ApiError(400, 'Status da reunião inválido');

    if (data.obrigacaoId) {
      const obrigacao = await this.getObrigacaoById(data.obrigacaoId, user);
      if (Number(obrigacao.empresa_cliente_id) !== Number(empresaClienteId)) {
        throw new ApiError(400, 'Obrigação não pertence à empresa selecionada');
      }
    }

    const canal = CANAIS_VALIDOS.includes(data.canal) ? data.canal : 'whatsapp';
    const reuniao = await PortalContadorReuniao.create({
      contador_empresa_id: contadorEmpresaId,
      empresa_cliente_id: empresaClienteId,
      obrigacao_id: data.obrigacaoId || null,
      titulo,
      descricao: data.descricao || null,
      data_reuniao: dataReuniao,
      horario,
      canal,
      link_reuniao: data.linkReuniao || data.link_reuniao || null,
      status,
      solicitado_por: user?.id || null,
      solicitado_por_tipo: podeGerenciarPortal ? 'contador' : 'empresa',
      criado_por: user?.id || null,
      atualizado_por: user?.id || null,
      cancelado_em: status === 'cancelada' ? new Date() : null
    });

    return this.formatReuniao(reuniao.get({ plain: true }));
  }

  async updateReuniao(id, user, data) {
    const reuniao = await this.getReuniaoById(id, user);
    const STATUS_VALIDOS = ['solicitada', 'agendada', 'realizada', 'cancelada'];
    const CANAIS_VALIDOS = ['whatsapp', 'google_meet', 'teams', 'presencial', 'telefone', 'outro'];
    const updates = {};

    if (data.empresaClienteId !== undefined && Number(data.empresaClienteId) !== Number(reuniao.empresa_cliente_id)) {
      throw new ApiError(400, 'Não é possível alterar a empresa da reunião');
    }

    if (data.titulo !== undefined) {
      const titulo = String(data.titulo || '').trim();
      if (!titulo) throw new ApiError(400, 'Título da reunião é obrigatório');
      updates.titulo = titulo;
    }

    if (data.obrigacaoId !== undefined) {
      if (data.obrigacaoId) {
        const obrigacao = await this.getObrigacaoById(data.obrigacaoId, user);
        if (Number(obrigacao.empresa_cliente_id) !== Number(reuniao.empresa_cliente_id)) {
          throw new ApiError(400, 'Obrigação não pertence à empresa da reunião');
        }
      }
      updates.obrigacao_id = data.obrigacaoId || null;
    }

    if (data.descricao !== undefined) updates.descricao = data.descricao || null;
    if (data.dataReuniao !== undefined || data.data_reuniao !== undefined) {
      const dataReuniao = this.normalizarData(data.dataReuniao || data.data_reuniao);
      if (!dataReuniao) throw new ApiError(400, 'Data da reunião é obrigatória');
      updates.data_reuniao = dataReuniao;
    }
    if (data.horario !== undefined) {
      const horario = String(data.horario || '').trim();
      if (!/^\d{2}:\d{2}$/.test(horario)) throw new ApiError(400, 'Horário da reunião é obrigatório');
      updates.horario = horario;
    }
    if (data.canal !== undefined) updates.canal = CANAIS_VALIDOS.includes(data.canal) ? data.canal : 'whatsapp';
    if (data.linkReuniao !== undefined || data.link_reuniao !== undefined) updates.link_reuniao = data.linkReuniao || data.link_reuniao || null;
    if (data.status !== undefined) {
      if (!STATUS_VALIDOS.includes(data.status)) throw new ApiError(400, 'Status da reunião inválido');
      updates.status = data.status;
      updates.cancelado_em = data.status === 'cancelada' ? new Date() : null;
    }

    updates.atualizado_por = user?.id || null;
    await reuniao.update(updates);

    return this.formatReuniao(reuniao.get({ plain: true }));
  }

  async cancelarReuniao(id, user) {
    return this.updateReuniao(id, user, { status: 'cancelada' });
  }

  async deleteReuniao(id, user) {
    const reuniao = await this.getReuniaoById(id, user);
    await reuniao.destroy();
  }
}

export default new PortalContadorService();
