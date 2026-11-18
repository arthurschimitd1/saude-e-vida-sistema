import express from 'express';
import { getMigrationState } from './config/migrationState.js';
import cors from 'cors';
import helmet from 'helmet';
import sequelize from './config/database.js';
import './models/associations.js'; // registra as associações entre models
import './models/whatsappCrmAssociations.js';
import productRoutes from './routes/productRoutes.js';
import productCategoryRoutes from './routes/productCategoryRoutes.js';
import userRoutes from './routes/userRoutes.js';
import authRoutes from './routes/AuthRoutes.js';
import clienteRoutes from './routes/clienteRoutes.js';
import rawMaterialRoutes from './routes/RawMaterialRoutes.js';
import dominioRoutes from './routes/dominioRoutes.js';
import inventarioRoutes from './routes/inventarioRoutes.js';
import vendaRoutes from './routes/vendaRoutes.js';
import comissaoRoutes from './routes/comissaoRoutes.js';
import taxaCartaoRoutes from './routes/taxaCartaoRoutes.js';
import comissaoAssinaturaRoutes from './routes/comissaoAssinaturaRoutes.js';
import orcamentoRoutes from './routes/orcamentoRoutes.js';
import movimentoRoutes from './routes/movimentoRoutes.js';
import empresaRoutes from './routes/empresaRoutes.js';
import recorrenciaRoutes from './routes/Recorrencia.route.js';
import recorrenciaGestaoRoutes from './routes/RecorrenciaGestao.routes.js';
import historicoPagamentoRoutes from './routes/HistoricoPagamento.routes.js';
import turnoCaixaRoutes from './routes/turnoCaixaRoutes.js';
import producaoRoutes from './routes/producaoRoutes.js';
import minhaEmpresaRoutes from './routes/Minhaempresaroutes.js';
import financeiroRoutes from './routes/financeiroRoutes.js';
import marketingRoutes from './routes/marketingRoutes.js';
import planejamentoRoutes from './routes/planejamentoRoutes.js';
import kanbanColunaRoutes from './routes/kanbanColunaRoutes.js';
import setorPlanejamentoRoutes from './routes/setorPlanejamentoRoutes.js';
import pedidoRoutes from './routes/pedidoRoutes.js';
import notaFiscalRoutes from './routes/notaFiscalRoutes.js';
import empresaConfigFiscalRoutes from './routes/empresaConfigFiscalRoutes.js';
import clienteRecorrenciaRoutes from './routes/ClienteRecorrencia.routes.js';
import funcionarioCustoRoutes from './routes/funcionarioCustoRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import serviceInvoiceRoutes from './routes/serviceInvoiceRoutes.js';
import nfseConfigRoutes from './routes/nfseConfigRoutes.js';
import focusResellerRoutes from './routes/focus/focusResellerRoutes.js';
import focusInvoiceRoutes from './routes/focus/focusInvoiceRoutes.js';
import focusNFeRoutes from './routes/focus/focusNFeRoutes.js';
import focusNFCeRoutes from './routes/focus/focusNFCeRoutes.js';
import focusNFSeRoutes from './routes/focus/focusNFSeRoutes.js';
import calendarioRoutes from './routes/calendarioRoutes.js';
import estoqueRoupaRoutes from './routes/estoqueRoupaRoutes.js';
import estoqueRoupaHistoricoRoutes from './routes/estoqueRoupaHistoricoRoutes.js';
import contratoRoutes from './routes/contratoRoutes.js';
import procuracaoRoutes from './routes/procuracaoRoutes.js';
import saidaRoutes from './routes/saidaRoutes.js';
import departamentoRoutes from './routes/departamentoRoutes.js';
import lancamentoVinculoRoutes from './routes/lancamentoVinculoRoutes.js';
import orcamentoFinanceiroRoutes from './routes/orcamentoFinanceiroRoutes.js';
import crmCampanhaRoutes from './routes/crm/campanhaRoutes.js';
import crmProspectRoutes from './routes/crm/prospectRoutes.js';
import crmInteracaoRoutes from './routes/crm/interacaoRoutes.js';
import crmScriptRoutes from './routes/crm/scriptRoutes.js';
import crmDashboardRoutes from './routes/crm/dashboardRoutes.js';
import crmChromeRoutes from './routes/crm/chromeExtensionRoutes.js';
import automacaoRoutes from './routes/automacaoRoutes.js';
// jobs agendados 
// import './jobs/focusSyncJob.js';
// import './jobs/automacaoVencimentoJob.js';
import bairrosRoutes from './routes/bairrosRoutes.js';
import agendamentoRoutes from './routes/agendamentoRoutes.js';
import publicAgendamentoRoutes from './routes/publicAgendamentoRoutes.js';
import publicNfeRoutes from './routes/publicNfeRoutes.js';
import publicLandingCheckoutRoutes from './routes/PublicLandingCheckout.routes.js';
import centroCustoRoutes from './routes/centroCustoRoutes.js';
import crmWhatsAppRoutes from './routes/crm/whatsappRoutes.js';
import inteligenciaFiscalRoutes from './routes/inteligencia-fiscal/index.js';
import maiaRoutes from './routes/maiaRoutes.js';
import whatsappCrmConfigRoutes from './routes/whatsappCrm/configRoutes.js';
import whatsappCrmDashboardRoutes from './routes/whatsappCrm/dashboardRoutes.js';
import whatsappCrmLogRoutes from './routes/whatsappCrm/logRoutes.js';
import whatsappCrmClienteRoutes from './routes/whatsappCrm/clienteRoutes.js';
import whatsappCrmConversaRoutes from './routes/whatsappCrm/conversaRoutes.js';
import whatsappCrmEtiquetaRoutes from './routes/whatsappCrm/etiquetaRoutes.js';
import whatsappCrmCatalogoRoutes from './routes/whatsappCrm/catalogoRoutes.js';
import whatsappCrmWebhookRoutes from './routes/whatsappCrm/webhookRoutes.js';
import whatsappCrmMergeRoutes from './routes/whatsappCrm/mergeRoutes.js';
import whatsappCrmMonitoriaRoutes from './routes/whatsappCrm/monitoriaRoutes.js';
import whatsappMetaWebhookRoutes from './routes/whatsappCrm/metaWebhookRoutes.js';
import dashboardFiscalRoutes from './routes/dashbordFiscalRoutes.js';
import manifestoRoutes from './routes/manifestos/manifestoRoutes.js';
import accessControlRoutes from './routes/accessControlRoutes.js';
import portalContadorRoutes from './routes/portalContador.routes.js';
import fornecedorRoutes from './routes/fornecedorRoutes.js';
import stockLocationRoutes from './routes/stockLocationRoutes.js';
import usageRoutes from './routes/usageRoutes.js';
import masterAnalyticsRoutes from './routes/masterAnalyticsRoutes.js';
import asaasRoutes from './routes/Asaas.routes.js';
import assinaturaImportacaoRoutes from './routes/assinaturaImportacaoRoutes.js';
import contasReceberRoutes from './routes/contasReceberRoutes.js';
import relatorioProdutosRoutes from './routes/relatorioProdutosRoutes.js';
import nuvemshopRoutes from './routes/Nuvemshop.routes.js';
import centralGestaoRoutes from './routes/centralGestaoRoutes.js';
import centralGestaoAnalisesRoutes from './routes/centralGestaoAnalisesRoutes.js';
import lojaOnlineRoutes from './routes/lojaOnlineRoutes.js';

const app = express();

// Origens permitidas: FRONTEND_URL (pode ser lista separada por vírgula) ou localhost em dev
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000,http://localhost:3001')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

// Middlewares
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        if (origin === 'https://api.z-api.io') return callback(null, true);
        callback(new Error(`CORS: origem não permitida — ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Empresa-Override', 'Idempotency-Key'],
    credentials: false,
}));
app.use(express.json({
    verify: (req, res, buffer) => {
        if (req.originalUrl?.startsWith('/api/integracoes/nuvemshop/webhooks/') || req.originalUrl?.startsWith('/api/whatsapp-meta/webhook/')) {
            req.rawBody = Buffer.from(buffer);
        }
    },
}));

// Log de requisições
app.use((req, res, next) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Conexão com o banco
// sequelize.authenticate()
//   .then(() => {
//     console.log('\n🔌 Conexão com o banco estabelecida');
//   })
//   .catch(error => {
//     console.error('\n❌ ERRO no banco:', error.message);
//   });

// Rota raiz
app.get('/', (req, res) => {
  res.json({ status: 'API Online', version: '1.0.0' });
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', database: 'connected', migrations: getMigrationState() });
});

// --- ROTAS EXISTENTES ---
app.use('/api/central-gestao/analises', centralGestaoAnalisesRoutes);
app.use('/api/central-gestao', centralGestaoRoutes);
app.use('/api/products', productRoutes);
app.use('/api/product-categories', productCategoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/raw-materials', rawMaterialRoutes);
app.use('/api/dominio', dominioRoutes);
app.use('/api/inventarios', inventarioRoutes);
app.use('/api/vendas', vendaRoutes);
app.use('/api/comissoes', comissaoRoutes);
app.use('/api/taxas-cartao', taxaCartaoRoutes);
app.use('/api/comissao-assinatura', comissaoAssinaturaRoutes);
app.use('/api/orcamentos', orcamentoRoutes);
app.use('/api/movimentos', movimentoRoutes);
app.use('/api/empresas', empresaRoutes);
app.use('/api/access-control', accessControlRoutes);
app.use('/api/recorrencias', recorrenciaRoutes);
app.use('/api/recorrencias/gestao', recorrenciaGestaoRoutes);
app.use('/api/bairros', bairrosRoutes);
app.use('/api/agendamentos', agendamentoRoutes);
// Integração pública da landing Dom Ferraz. O slug é resolvido no backend
// para uma empresa específica; nenhuma rota autenticada é alterada.
app.use('/api/public/agendamentos/dom-ferraz', publicAgendamentoRoutes);
app.use('/api/public/agendamentos/sky-barbearia', publicAgendamentoRoutes);
app.use('/api/public/nfe', publicNfeRoutes);
app.use('/api/public/landing-checkout', publicLandingCheckoutRoutes);
app.use('/api/loja', lojaOnlineRoutes);
app.use('/api/historico-pagamentos', historicoPagamentoRoutes);
app.use('/api/turnos-caixa', turnoCaixaRoutes);
app.use('/api/producao', producaoRoutes);
app.use('/api/relatorios-produtos', relatorioProdutosRoutes);
app.use('/api/minha-empresa', minhaEmpresaRoutes);
app.use('/api/financeiro', financeiroRoutes);
app.use('/api/financeiro/contas-receber', contasReceberRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/planejamento', planejamentoRoutes);
app.use('/api/kanban-colunas', kanbanColunaRoutes);
app.use('/api/setores-planejamento', setorPlanejamentoRoutes);
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/notas-fiscais', notaFiscalRoutes);
app.use('/api/empresa-config-fiscal', empresaConfigFiscalRoutes);
app.use('/api/cliente-recorrencias', clienteRecorrenciaRoutes);
app.use('/api/funcionarios-custos', funcionarioCustoRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/service-invoices', serviceInvoiceRoutes);
app.use('/api/nfse-config', nfseConfigRoutes);
app.use('/api/focus-reseller', focusResellerRoutes);
app.use('/api/focus-invoice', focusInvoiceRoutes);
app.use('/api/focus-nfe', focusNFeRoutes);
app.use('/api/focus-nfce', focusNFCeRoutes);
app.use('/api/focus-nfse', focusNFSeRoutes);
app.use('/api/calendario', calendarioRoutes);
app.use('/api/estoque-roupas', estoqueRoupaHistoricoRoutes);
app.use('/api/estoque-roupas', estoqueRoupaRoutes);
app.use('/api/contratos', contratoRoutes);
app.use('/api/procuracoes', procuracaoRoutes);
app.use('/api/saidas', saidaRoutes);
app.use('/api/departamentos', departamentoRoutes);
app.use('/api/lancamento-vinculos', lancamentoVinculoRoutes);
app.use('/api/orcamentos-financeiros', orcamentoFinanceiroRoutes);
app.use('/api/automacao', automacaoRoutes);
app.use('/api/centros-de-custos', centroCustoRoutes);
app.use('/api/inteligencia-fiscal', inteligenciaFiscalRoutes);
app.use('/api/maia', maiaRoutes);
app.use('/api/dashboard-fiscal', dashboardFiscalRoutes);
app.use('/api/manifestos', manifestoRoutes);
app.use('/api/portal-contador', portalContadorRoutes);
app.use('/api/fornecedores', fornecedorRoutes);
app.use('/api/stock-locations', stockLocationRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/master/analytics', masterAnalyticsRoutes);
app.use('/api/asaas', asaasRoutes);
app.use('/api/assinaturas', assinaturaImportacaoRoutes);
app.use('/api/integracoes/nuvemshop', nuvemshopRoutes);

// --- MÓDULO CRM PROSPECÇÃO COMERCIAL ---
app.use('/api/crm/campanhas',   crmCampanhaRoutes);
app.use('/api/crm/prospects',   crmProspectRoutes);
app.use('/api/crm/interacoes',  crmInteracaoRoutes);
app.use('/api/crm/scripts',     crmScriptRoutes);
app.use('/api/crm/dashboard',   crmDashboardRoutes);
app.use('/api/crm/chrome',      crmChromeRoutes);
app.use('/api/crm/whatsapp',    crmWhatsAppRoutes);

// WhatsApp CRM funcional. A rota antiga acima permanece durante a transição.
app.use('/api/whatsapp-crm/config',    whatsappCrmConfigRoutes);
app.use('/api/whatsapp-crm/dashboard', whatsappCrmDashboardRoutes);
app.use('/api/whatsapp-crm/logs',      whatsappCrmLogRoutes);
app.use('/api/whatsapp-crm/clientes',  whatsappCrmClienteRoutes);
app.use('/api/whatsapp-crm/conversas', whatsappCrmConversaRoutes);
app.use('/api/whatsapp-crm/etiquetas', whatsappCrmEtiquetaRoutes);
app.use('/api/whatsapp-crm/catalogos', whatsappCrmCatalogoRoutes);
app.use('/api/whatsapp-crm/merge',     whatsappCrmMergeRoutes);
app.use('/api/whatsapp-crm/monitoria', whatsappCrmMonitoriaRoutes);
app.use('/api/whatsapp-crm/webhook',   whatsappCrmWebhookRoutes);
app.use('/api/whatsapp-meta/webhook',  whatsappMetaWebhookRoutes);

// Rota 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada'
  });
});

// Middleware de Erro Global
app.use((err, req, res, next) => {
  console.error('🔥 Erro detectado:', err.stack);

  res.status(err.statusCode || err.status || 500).json({
    success: false,
    message: err.message || 'Erro interno no servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

export default app;
