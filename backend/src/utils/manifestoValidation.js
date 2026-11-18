const somenteDigitos = (valor) => String(valor ?? '').replace(/\D/g, '');

export const normalizarPlaca = (valor) =>
  String(valor ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

export const normalizarDocumento = somenteDigitos;

export function cpfValido(valor) {
  const cpf = somenteDigitos(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const calcular = (tamanho) => {
    let soma = 0;
    for (let indice = 0; indice < tamanho; indice += 1) {
      soma += Number(cpf[indice]) * (tamanho + 1 - indice);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return calcular(9) === Number(cpf[9]) && calcular(10) === Number(cpf[10]);
}

export function validarVeiculo(dados = {}) {
  const erros = [];
  const placa = normalizarPlaca(dados.placa);

  if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa)) {
    erros.push('Informe uma placa válida no padrão brasileiro.');
  }
  if (!dados.tara_kg || Number(dados.tara_kg) <= 0) {
    erros.push('Informe a tara do veículo em kg.');
  }
  if (!dados.tipo_carroceria) erros.push('Informe o tipo de carroceria.');
  if (!/^[A-Z]{2}$/.test(String(dados.uf_licenciamento ?? '').toUpperCase())) {
    erros.push('Informe a UF de licenciamento.');
  }

  return erros;
}

export function validarCondutor(dados = {}) {
  const erros = [];
  if (String(dados.nome ?? '').trim().length < 2) {
    erros.push('Informe o nome completo do condutor.');
  }
  if (!cpfValido(dados.cpf)) erros.push('Informe um CPF válido para o condutor.');
  return erros;
}

export function validarMdfe(dados = {}, documentos = [], veiculo, condutores = []) {
  const erros = [];

  if (![1, 2, 3].includes(Number(dados.tipo_emitente))) {
    erros.push('Selecione o tipo de emitente.');
  }
  if (!/^[A-Z]{2}$/.test(String(dados.uf_carregamento ?? '').toUpperCase())) {
    erros.push('Informe a UF de carregamento.');
  }
  if (!/^\d{7}$/.test(somenteDigitos(dados.codigo_municipio_carregamento))) {
    erros.push('Informe o código IBGE do município de carregamento.');
  }
  if (String(dados.municipio_carregamento ?? '').trim().length < 2) {
    erros.push('Informe o município de carregamento.');
  }
  if (!/^[A-Z]{2}$/.test(String(dados.uf_descarregamento ?? '').toUpperCase())) {
    erros.push('Informe a UF de descarregamento.');
  }
  if (!/^\d{7}$/.test(somenteDigitos(dados.codigo_municipio_descarregamento))) {
    erros.push('Informe o código IBGE do município de descarregamento.');
  }
  if (String(dados.municipio_descarregamento ?? '').trim().length < 2) {
    erros.push('Informe o município de descarregamento.');
  }
  if (!veiculo) erros.push('Selecione o veículo de tração.');
  if (condutores.length === 0) erros.push('Selecione ao menos um condutor.');
  if (documentos.length === 0) erros.push('Vincule ao menos uma NF-e ou CT-e autorizada.');
  if (Number(dados.peso_bruto) <= 0) erros.push('Informe o peso bruto da carga.');
  if (Number(dados.valor_total_carga) <= 0) erros.push('Informe o valor total da carga.');

  const chavesInvalidas = documentos.filter(
    (documento) => !/^\d{44}$/.test(somenteDigitos(documento.chave_acesso))
  );
  if (chavesInvalidas.length > 0) {
    erros.push('Todos os documentos devem possuir chave de acesso com 44 dígitos.');
  }

  return erros;
}

export const STATUS_MDFE_EDITAVEIS = new Set([
  'RASCUNHO',
  'EM_VALIDACAO',
  'PRONTO_PARA_EMISSAO',
  'REJEITADO',
  'ERRO_COMUNICACAO'
]);

export function mapearStatusFocus(resposta = {}) {
  const bruto = String(resposta.status ?? resposta.status_sefaz ?? '').toLowerCase();

  if (bruto.includes('process')) return 'PROCESSANDO';
  if (bruto.includes('autoriz')) return 'AUTORIZADO';
  if (bruto.includes('encerr')) return 'ENCERRADO';
  if (bruto.includes('cancel')) return 'CANCELADO';
  if (bruto.includes('rejeit') || bruto.includes('erro')) return 'REJEITADO';
  return 'PROCESSANDO';
}
