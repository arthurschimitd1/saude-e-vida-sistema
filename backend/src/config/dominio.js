// src/config/dominio.js
export default {
    // OAuth2
    authUrl: 'https://auth.thomsonreuters.com/oauth/token',
    clientId: process.env.DOMINIO_CLIENT_ID,
    clientSecret: process.env.DOMINIO_CLIENT_SECRET,
    audience: '409f91f6-dc17-44c8-a5d8-e0a1bafd8b67',
  
    // APIs
    apiBaseUrl: 'https://api.onvio.com.br/domínio',
    endpoints: {
      activationInfo: '/integration/v1/activation/info',
      activationEnable: '/integration/v1/activation/enable',
      sendInvoice: '/invoice/v3/batches',
      batchStatus: '/invoice/v3/batches/'
    },
  
    // Limites
    maxRequestsPerDay: 40,
    tokenExpiryHours: 24
  };