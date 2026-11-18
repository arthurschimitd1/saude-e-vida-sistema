const axios = require('axios');
const EmpresaFocus =
  require('../models/EmpresaFocus');

async function getClient(empresaId) {
  const config =
    await EmpresaFocus.findOne({
      where: {
        empresaId,
      },
    });

  if (!config) {
    throw new Error(
      'Empresa não configurada na Focus'
    );
  }

  return axios.create({
    baseURL: process.env.FOCUS_URL,
    auth: {
      username: config.tokenProducao,
      password: '',
    },
  });
}

module.exports = {
  getClient,
};