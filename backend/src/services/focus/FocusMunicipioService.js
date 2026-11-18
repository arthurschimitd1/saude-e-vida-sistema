// src/services/focus/FocusMunicipioService.js

import { focusResellerClient } from '../../config/focus.js';

class FocusMunicipioService {
  async buscarCodigoMunicipio(nomeMunicipio, uf) {
    if (!nomeMunicipio || !uf) {
      return null;
    }

    const { data } = await focusResellerClient.get('/v2/municipios', {
      params: {
        nome_municipio: nomeMunicipio,
        sigla_uf: uf.toUpperCase()
      }
    });

    return data?.[0]?.codigo_municipio || null;
  }
}

export default new FocusMunicipioService();