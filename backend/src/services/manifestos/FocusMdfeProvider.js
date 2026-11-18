import FocusResellerService from '../focus/FocusResellerService.js';

class FocusMdfeProvider {
  async emitir(empresaId, referencia, payload) {
    const { client } = await FocusResellerService.getEmpresaClient(empresaId);
    const { data } = await client.post('/v2/mdfe', payload, {
      params: { ref: referencia }
    });
    return data;
  }

  async consultar(empresaId, referencia) {
    const { client } = await FocusResellerService.getEmpresaClient(empresaId);
    const { data } = await client.get(`/v2/mdfe/${encodeURIComponent(referencia)}`);
    return data;
  }

  async cancelar(empresaId, referencia, justificativa) {
    const { client } = await FocusResellerService.getEmpresaClient(empresaId);
    const { data } = await client.delete(
      `/v2/mdfe/${encodeURIComponent(referencia)}`,
      { data: { justificativa } }
    );
    return data;
  }

  async encerrar(empresaId, referencia, payload) {
    const { client } = await FocusResellerService.getEmpresaClient(empresaId);
    const { data } = await client.post(
      `/v2/mdfe/${encodeURIComponent(referencia)}/encerrar`,
      payload
    );
    return data;
  }

  async incluirCondutor(empresaId, referencia, condutor) {
    const { client } = await FocusResellerService.getEmpresaClient(empresaId);
    const { data } = await client.post(
      `/v2/mdfe/${encodeURIComponent(referencia)}/inclusao_condutor`,
      { nome: condutor.nome, cpf: String(condutor.cpf).replace(/\D/g, '') }
    );
    return data;
  }
}

export default new FocusMdfeProvider();
