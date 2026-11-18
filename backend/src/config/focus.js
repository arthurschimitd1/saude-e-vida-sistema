import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export const FOCUS_URLS = {
  producao: 'https://api.focusnfe.com.br',
  homologacao: 'https://homologacao.focusnfe.com.br'
};

export const getFocusBaseUrl = (
  ambiente = 'producao'
) =>
  ambiente === 'producao'
    ? FOCUS_URLS.producao
    : FOCUS_URLS.homologacao;

export const focusResellerClient =
  axios.create({
    baseURL: FOCUS_URLS.producao,
    auth: {
      username:
        process.env.FOCUS_RESELLER_TOKEN,
      password: ''
    },
    timeout: 30000
  });

export const createFocusClient = ({
  token,
  ambiente = 'producao'
}) =>
  axios.create({
    baseURL:
      getFocusBaseUrl(ambiente),
    auth: {
      username: token,
      password: ''
    },
    timeout: 30000
  });