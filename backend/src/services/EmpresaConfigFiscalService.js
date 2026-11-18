// src/services/EmpresaConfigFiscalService.js
import EmpresaConfigFiscal from '../models/EmpresaConfigFiscal.js';

class EmpresaConfigFiscalService {
  async getByEmpresa(empresaId, currentUser) {
    if (Number(currentUser.empresa_id) !== Number(empresaId) && currentUser.tipo !== 'MASTER') {
      throw new Error('Acesso negado');
    }
    const config = await EmpresaConfigFiscal.findOne({ where: { empresa_id: empresaId } });
    return config;
  }

  async createOrUpdate(empresaId, data, currentUser) {
    if (Number(currentUser.empresa_id) !== Number(empresaId) && currentUser.tipo !== 'MASTER') {
      throw new Error('Acesso negado');
    }
    
    // Prepara os dados para upsert
    const upsertData = {
      empresa_id: empresaId,
      focusnfe_token: data.focusnfe_token,
      ambiente: data.ambiente,
      cnpj_emitente: data.cnpj_emitente,
      nome_emitente: data.nome_emitente,
      logradouro_emitente: data.logradouro_emitente,
      numero_emitente: data.numero_emitente,
      bairro_emitente: data.bairro_emitente,
      municipio_emitente: data.municipio_emitente,
      uf_emitente: data.uf_emitente,
      cep_emitente: data.cep_emitente,
      telefone_emitente: data.telefone_emitente,
      inscricao_estadual_emitente: data.inscricao_estadual_emitente,
      regime_tributario_emitente: data.regime_tributario_emitente,
      dados_emitente: data.dados_emitente || {},
    };
    
    // Remove campos undefined
    Object.keys(upsertData).forEach(key => {
      if (upsertData[key] === undefined) {
        delete upsertData[key];
      }
    });
    
    const [config, created] = await EmpresaConfigFiscal.upsert(upsertData);
    return config;
  }
}

export default new EmpresaConfigFiscalService();