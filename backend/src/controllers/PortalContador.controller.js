// backend/src/controllers/PortalContador.controller.js
import portalContadorService from '../services/PortalContador.service.js';
import ApiResponse from '../utils/apiResponse.js';
import { usuarioPodeAcessarAreaContador } from '../utils/contadorAccess.js';
import { ZipArchive } from 'archiver';

const safeZipFilename = (filename, fallback) => {
  const value = filename || fallback || 'documento';
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 180);
};

class PortalContadorController {
  async getContexto(req, res, next) {
    try {
      const result = await portalContadorService.getContexto(req.user);

      new ApiResponse(res).success(200, result);
    } catch (error) {
      next(error);
    }
  }

  async getContadorStatus(req, res, next) {
    try {
      const empresaId = req.user.empresa_id;
      const result = await portalContadorService.getContadorStatus(empresaId);
      
      new ApiResponse(res).success(200, result);
    } catch (error) {
      next(error);
    }
  }

  async getDashboardClientes(req, res, next) {
    try {
      const result = await portalContadorService.getDashboardClientes(req.user, req.query);

      new ApiResponse(res).success(200, result);
    } catch (error) {
      next(error);
    }
  }

  async getClientesDisponiveis(req, res, next) {
    try {
      const result = await portalContadorService.getClientesDisponiveis(req.user, req.query);

      new ApiResponse(res).success(200, result);
    } catch (error) {
      next(error);
    }
  }

  async vincularCliente(req, res, next) {
    try {
      const result = await portalContadorService.vincularCliente(req.user, req.body);

      new ApiResponse(res).success(201, result, 'Cliente vinculado com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async updateContadorStatus(req, res, next) {
    try {
      const possuiPacoteContador = await usuarioPodeAcessarAreaContador(req.user);

      if (!possuiPacoteContador) {
        return res.status(403).json({ message: 'Apenas empresas com Pacote Contador podem alterar status' });
      }

      const result = await portalContadorService.updateContadorStatus(
        req.user.id, 
        req.body.status
      );
      
      new ApiResponse(res).success(200, result, 'Status atualizado com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async updatePerfilContador(req, res, next) {
    try {
      const result = await portalContadorService.updatePerfilContador(req.user, req.body);

      new ApiResponse(res).success(200, result, 'Perfil do contador atualizado com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async getDocumentos(req, res, next) {
    try {
      const result = await portalContadorService.getDocumentos(req.user, req.query);

      new ApiResponse(res).success(200, result);
    } catch (error) {
      next(error);
    }
  }

  async createDocumento(req, res, next) {
    try {
      const result = await portalContadorService.createDocumento(req.user, req.body, req.file);

      new ApiResponse(res).success(201, result, 'Documento enviado com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async downloadDocumento(req, res, next) {
    try {
      const { documento, url, filename } = await portalContadorService.downloadDocumento(req.params.id, req.user);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Falha ao baixar arquivo do Cloudinary');
      }

      const buffer = await response.arrayBuffer();

      res.setHeader('Content-Type', documento.arquivo_mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(Buffer.from(buffer));
    } catch (error) {
      next(error);
    }
  }

  async deleteDocumento(req, res, next) {
    try {
      await portalContadorService.deleteDocumento(req.params.id, req.user);

      new ApiResponse(res).success(200, null, 'Documento removido com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async downloadDocumentosZip(req, res, next) {
    try {
      const documentos = await portalContadorService.getDocumentosParaDownload(req.user, req.query);
      const archive = new ZipArchive({ zlib: { level: 9 } });
      const zipName = `documentos_portal_contador_${new Date().toISOString().slice(0, 10)}.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

      archive.on('error', (error) => next(error));
      archive.pipe(res);

      for (const documento of documentos) {
        const response = await fetch(documento.downloadUrl);
        if (!response.ok) {
          throw new Error(`Falha ao baixar arquivo "${documento.filename}" do Cloudinary`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const filename = safeZipFilename(documento.filename, documento.nome);
        archive.append(buffer, { name: filename });
      }

      await archive.finalize();
    } catch (error) {
      next(error);
    }
  }

  async getSolicitacoes(req, res, next) {
    try {
      const result = await portalContadorService.getSolicitacoes(req.user, req.query);

      new ApiResponse(res).success(200, result);
    } catch (error) {
      next(error);
    }
  }

  async createSolicitacao(req, res, next) {
    try {
      const result = await portalContadorService.createSolicitacao(req.user, req.body);

      new ApiResponse(res).success(201, result, 'Solicitação criada com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async updateSolicitacaoStatus(req, res, next) {
    try {
      const result = await portalContadorService.updateSolicitacaoStatus(req.params.id, req.user, req.body);

      new ApiResponse(res).success(200, result, 'Solicitação atualizada com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async getObrigacoes(req, res, next) {
    try {
      const result = await portalContadorService.getObrigacoes(req.user, req.query);

      new ApiResponse(res).success(200, result);
    } catch (error) {
      next(error);
    }
  }

  async createObrigacao(req, res, next) {
    try {
      const result = await portalContadorService.createObrigacao(req.user, req.body);

      new ApiResponse(res).success(201, result, 'Obrigação fiscal cadastrada com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async updateObrigacao(req, res, next) {
    try {
      const result = await portalContadorService.updateObrigacao(req.params.id, req.user, req.body);

      new ApiResponse(res).success(200, result, 'Obrigação fiscal atualizada com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async concluirObrigacao(req, res, next) {
    try {
      const result = await portalContadorService.concluirObrigacao(req.params.id, req.user);

      new ApiResponse(res).success(200, result, 'Obrigação fiscal concluída com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async deleteObrigacao(req, res, next) {
    try {
      await portalContadorService.deleteObrigacao(req.params.id, req.user);

      new ApiResponse(res).success(200, null, 'Obrigação fiscal removida com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async getReunioes(req, res, next) {
    try {
      const result = await portalContadorService.getReunioes(req.user, req.query);

      new ApiResponse(res).success(200, result);
    } catch (error) {
      next(error);
    }
  }

  async createReuniao(req, res, next) {
    try {
      const result = await portalContadorService.createReuniao(req.user, req.body);

      new ApiResponse(res).success(201, result, 'Reunião cadastrada com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async updateReuniao(req, res, next) {
    try {
      const result = await portalContadorService.updateReuniao(req.params.id, req.user, req.body);

      new ApiResponse(res).success(200, result, 'Reunião atualizada com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async cancelarReuniao(req, res, next) {
    try {
      const result = await portalContadorService.cancelarReuniao(req.params.id, req.user);

      new ApiResponse(res).success(200, result, 'Reunião cancelada com sucesso');
    } catch (error) {
      next(error);
    }
  }

  async deleteReuniao(req, res, next) {
    try {
      await portalContadorService.deleteReuniao(req.params.id, req.user);

      new ApiResponse(res).success(200, null, 'Reunião removida com sucesso');
    } catch (error) {
      next(error);
    }
  }
}

export default new PortalContadorController();
