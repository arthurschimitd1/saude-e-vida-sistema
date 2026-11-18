import Cliente from './Cliente.js';
import User from './UserModel.js';
import WhatsappClienteCrm from './WhatsappClienteCrm.js';
import WhatsappClienteEtiqueta from './WhatsappClienteEtiqueta.js';
import WhatsappEtiqueta from './WhatsappEtiqueta.js';
import WhatsappConversa from './WhatsappConversa.js';
import WhatsappMensagem from './WhatsappMensagem.js';
import WhatsappLog from './WhatsappLog.js';
import WhatsappContatoIdentificador from './WhatsappContatoIdentificador.js';
import WhatsappMergeCandidato from './WhatsappMergeCandidato.js';

WhatsappClienteCrm.belongsTo(Cliente, { foreignKey: 'cliente_id', as: 'cliente' });
Cliente.hasOne(WhatsappClienteCrm, { foreignKey: 'cliente_id', as: 'whatsappCrm' });
WhatsappClienteCrm.belongsTo(User, { foreignKey: 'responsavel_id', as: 'responsavel' });
WhatsappClienteCrm.hasMany(WhatsappClienteEtiqueta, { foreignKey: 'cliente_crm_id', as: 'etiquetas', onDelete: 'CASCADE' });
WhatsappClienteEtiqueta.belongsTo(WhatsappClienteCrm, { foreignKey: 'cliente_crm_id' });
WhatsappClienteEtiqueta.belongsTo(WhatsappEtiqueta, { foreignKey: 'etiqueta_id', as: 'etiqueta' });
WhatsappEtiqueta.hasMany(WhatsappClienteEtiqueta, { foreignKey: 'etiqueta_id' });

WhatsappConversa.belongsTo(Cliente, { foreignKey: 'cliente_id', as: 'cliente' });
Cliente.hasMany(WhatsappConversa, { foreignKey: 'cliente_id', as: 'conversasWhatsapp' });
WhatsappConversa.belongsTo(User, { foreignKey: 'responsavel_id', as: 'responsavel' });
WhatsappConversa.hasMany(WhatsappMensagem, { foreignKey: 'conversa_id', as: 'mensagens', onDelete: 'CASCADE' });
WhatsappMensagem.belongsTo(WhatsappConversa, { foreignKey: 'conversa_id', as: 'conversa' });
WhatsappMensagem.belongsTo(User, { foreignKey: 'enviado_por_user_id', as: 'enviadoPor' });
WhatsappLog.belongsTo(WhatsappConversa, { foreignKey: 'conversa_id', as: 'conversa' });

WhatsappContatoIdentificador.belongsTo(Cliente, { foreignKey: 'cliente_id', as: 'cliente' });
Cliente.hasMany(WhatsappContatoIdentificador, { foreignKey: 'cliente_id', as: 'identificadores', onDelete: 'CASCADE' });
WhatsappMergeCandidato.belongsTo(WhatsappConversa, { foreignKey: 'conversa_origem_id', as: 'conversaOrigem' });
WhatsappMergeCandidato.belongsTo(WhatsappConversa, { foreignKey: 'conversa_alvo_id', as: 'conversaAlvo' });
