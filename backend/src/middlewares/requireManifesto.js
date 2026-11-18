import requireCargo from './requireCargo.js';

export const PERMISSOES_MANIFESTOS = [
  '/uikit/manifestos',
  'manifestos:visualizar',
  'manifestos:documentos_recebidos',
  'manifestos:manifestar',
  'manifestos:baixar_xml',
  'manifestos:importar_nfe',
  'manifestos:criar_mdfe',
  'manifestos:editar_mdfe',
  'manifestos:emitir_mdfe',
  'manifestos:cancelar_mdfe',
  'manifestos:encerrar_mdfe',
  'manifestos:incluir_condutor',
  'manifestos:consultar',
  'manifestos:auditoria',
  'manifestos:exportar',
  'manifestos:gerenciar_veiculos',
  'manifestos:gerenciar_condutores'
];

export default function requireManifesto(permissao, mensagem) {
  return requireCargo({
    permissoes: ['/uikit/manifestos', permissao],
    mensagem: mensagem || 'Sem permissão para executar esta ação no módulo Manifestos'
  });
}
