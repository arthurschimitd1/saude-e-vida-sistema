import ConfiguracaoFiscal from '../../models/ConfiguracaoFiscal.js';

const digitos = (valor) => String(valor ?? '').replace(/\D/g, '');
const valor = (numero, casas = 2) => Number(numero ?? 0).toFixed(casas);

const dadosProprietario = (veiculo) => {
  const documento = digitos(veiculo.proprietario_documento);
  if (!documento) return {};

  return {
    ...(documento.length === 11
      ? { cpf_proprietario_veiculo: documento }
      : { cnpj_proprietario_veiculo: documento }),
    rntrc_proprietario_veiculo: veiculo.rntrc || undefined,
    razao_social_proprietario_veiculo: veiculo.proprietario_nome || undefined,
    uf_proprietario_veiculo: veiculo.uf_licenciamento || undefined,
    tipo_proprietario_veiculo: 2
  };
};

class ManifestoPayloadService {
  async montar(empresaId, mdfe, veiculo, condutores, documentos) {
    const fiscal = await ConfiguracaoFiscal.findOne({ where: { empresa_id: empresaId } });
    if (!fiscal) {
      throw new Error('Configuração fiscal da empresa não encontrada.');
    }
    if (!/^\d{7}$/.test(digitos(fiscal.codigo_municipio))) {
      throw new Error(
        'Informe o código IBGE do município na Configuração Fiscal antes de emitir o MDF-e.'
      );
    }
    if (!digitos(fiscal.cnpj) || !fiscal.razao_social || !fiscal.municipio || !fiscal.uf) {
      throw new Error('Complete os dados do emitente na Configuração Fiscal.');
    }

    const nfes = documentos
      .filter((documento) => String(documento.tipo).toUpperCase() === 'NFE')
      .map((documento) => ({ chave_nfe: digitos(documento.chave_acesso) }));
    const ctes = documentos
      .filter((documento) => String(documento.tipo).toUpperCase() === 'CTE')
      .map((documento) => ({ chave_cte: digitos(documento.chave_acesso) }));

    const seguro = mdfe.dados_seguro ?? {};
    const payload = {
      data_emissao: new Date(mdfe.previsao_inicio || Date.now()).toISOString(),
      emitente: Number(mdfe.tipo_emitente),
      tipo_transporte: mdfe.tipo_transportador
        ? Number(mdfe.tipo_transportador)
        : undefined,
      serie: Number(mdfe.serie || 1),
      numero: mdfe.numero ? Number(mdfe.numero) : undefined,
      uf_inicio: mdfe.uf_carregamento,
      uf_fim: mdfe.uf_descarregamento,
      municipios_carregamento: [{
        codigo: Number(mdfe.codigo_municipio_carregamento),
        nome: mdfe.municipio_carregamento
      }],
      percursos: [...new Set(mdfe.ufs_percurso ?? [])].map((uf) => ({
        uf_percurso: String(uf).toUpperCase()
      })),
      data_hora_previsto_inicio_viagem: mdfe.previsao_inicio
        ? new Date(mdfe.previsao_inicio).toISOString()
        : undefined,
      cnpj_emitente: digitos(fiscal.cnpj),
      inscricao_estadual_emitente: digitos(fiscal.inscricao_estadual),
      nome_emitente: fiscal.razao_social,
      nome_fantasia_emitente: fiscal.nome_fantasia || undefined,
      logradouro_emitente: fiscal.logradouro,
      numero_emitente: fiscal.numero,
      complemento_emitente: fiscal.complemento || undefined,
      bairro_emitente: fiscal.bairro,
      municipio_emitente: fiscal.municipio,
      codigo_municipio_emitente: Number(digitos(fiscal.codigo_municipio)),
      cep_emitente: digitos(fiscal.cep) || undefined,
      uf_emitente: fiscal.uf,
      telefone_emitente: digitos(fiscal.telefone) || undefined,
      email_emitente: fiscal.email || undefined,
      municipios_descarregamento: [{
        codigo: Number(mdfe.codigo_municipio_descarregamento),
        nome: mdfe.municipio_descarregamento,
        notas_fiscais: nfes,
        conhecimentos_transporte: ctes
      }],
      quantidade_total_nfe: nfes.length || undefined,
      quantidade_total_cte: ctes.length || undefined,
      valor_total_carga: valor(mdfe.valor_total_carga),
      codigo_unidade_medida_peso_bruto:
        String(mdfe.unidade_carga).toUpperCase() === 'TON' ? '02' : '01',
      peso_bruto: valor(mdfe.peso_bruto, 4),
      tipo_carga: mdfe.tipo_carga || undefined,
      descricao_produto: mdfe.produto_predominante || undefined,
      seguros_carga: seguro.nome_seguradora
        ? [{
            responsavel_seguro: Number(seguro.responsavel_seguro || 1),
            nome_seguradora: seguro.nome_seguradora,
            cnpj_seguradora: digitos(seguro.cnpj_seguradora),
            numero_apolice: seguro.numero_apolice,
            numero_averbacao: seguro.numero_averbacao
          }]
        : undefined,
      informacao_adicional_fisco: mdfe.informacoes_fisco || undefined,
      informacao_complementar: mdfe.informacoes_complementares || undefined,
      modal_rodoviario: {
        registro_nacional_transporte: veiculo.rntrc || undefined,
        codigo_veiculo: String(veiculo.id),
        placa_veiculo: veiculo.placa,
        renavam_veiculo: digitos(veiculo.renavam) || undefined,
        tara_veiculo: Number(veiculo.tara_kg),
        capacidade_kg_veiculo: veiculo.capacidade_kg
          ? Number(veiculo.capacidade_kg)
          : undefined,
        ...dadosProprietario(veiculo),
        condutores: condutores.map((condutor) => ({
          nome: condutor.nome,
          cpf: digitos(condutor.cpf)
        })),
        tipo_rodado_veiculo: veiculo.tipo_rodado || undefined,
        tipo_carroceria_veiculo: veiculo.tipo_carroceria,
        uf_licenciamento_veiculo: veiculo.uf_licenciamento,
        veiculos_reboque: mdfe.reboques ?? []
      }
    };

    return JSON.parse(JSON.stringify(payload));
  }
}

export default new ManifestoPayloadService();
