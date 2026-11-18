// src/services/fiscal/inteligencia/regras/notaFiscal/classificadores/utils.js

/**
 * Remove acentos, transforma em minúsculo e elimina espaços extras.
 */
export function normalizarTexto(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Mantém apenas números.
 */
export function somenteNumeros(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

/**
 * Verifica se o texto contém pelo menos um dos termos informados.
 */
export function contemAlgum(texto, termos = []) {
  const textoNormalizado = normalizarTexto(texto);

  return termos.some((termo) =>
    textoNormalizado.includes(normalizarTexto(termo)),
  );
}

/**
 * Verifica se o código do erro corresponde a algum código conhecido.
 */
export function codigoEhUmDos(codigo, codigos = []) {
  const codigoNormalizado = normalizarTexto(codigo);

  return codigos.some(
    (codigoEsperado) =>
      codigoNormalizado === normalizarTexto(codigoEsperado),
  );
}

/**
 * Obtém todo o conteúdo textual relevante do erro.
 */
export function obterTextoCompletoErro(erro = {}) {
  return normalizarTexto(
    [
      erro.codigo,
      erro.campo,
      erro.mensagem,
      erro.detalhes,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

/**
 * Extrai o índice do item retornado pelo provedor.
 *
 * Exemplos aceitos:
 * itens.1.codigo_ncm
 * items.2.cfop
 * itens[3].codigo_ncm
 */
export function extrairIndiceItem(campo) {
  if (!campo) {
    return null;
  }

  const correspondencia = String(campo).match(
    /(?:itens|items)(?:\.|\[)(\d+)/i,
  );

  if (!correspondencia) {
    return null;
  }

  const indice = Number(correspondencia[1]);

  return Number.isInteger(indice) ? indice : null;
}

/**
 * Localiza o item da venda correspondente ao índice retornado
 * pela Focus.
 *
 * A Focus costuma numerar os itens iniciando em 1.
 */
export function localizarItemRelacionado(contexto, erro) {
  const indiceItem = extrairIndiceItem(erro?.campo);

  if (indiceItem === null) {
    return null;
  }

  return contexto?.itens?.[indiceItem - 1] ?? null;
}

/**
 * Localiza o produto associado ao item da venda.
 */
export function localizarProdutoRelacionado(contexto, item) {
  const produtoId =
    item?.produto_id ??
    item?.product_id ??
    item?.produtoId ??
    null;

  if (!produtoId) {
    return null;
  }

  const mapaProdutos = contexto?.produtosPorId;

  if (mapaProdutos instanceof Map) {
    return (
      mapaProdutos.get(Number(produtoId)) ??
      mapaProdutos.get(String(produtoId)) ??
      null
    );
  }

  return (
    contexto?.produtos?.find(
      (produto) => Number(produto.id) === Number(produtoId),
    ) ?? null
  );
}

/**
 * Localiza o item no payload exatamente como foi enviado.
 */
export function localizarItemPayload(contexto, erro) {
  const indiceItem = extrairIndiceItem(erro?.campo);

  if (indiceItem === null) {
    return null;
  }

  const payload =
    contexto?.payloadEnviado ??
    contexto?.payload_enviado ??
    null;

  const itensPayload =
    payload?.items ??
    payload?.itens ??
    [];

  return itensPayload[indiceItem - 1] ?? null;
}

/**
 * Monta as referências de item, produto e payload.
 */
export function obterReferenciasProduto(contexto, erro) {
  const itemRelacionado =
    localizarItemRelacionado(contexto, erro);

  const produtoRelacionado =
    localizarProdutoRelacionado(
      contexto,
      itemRelacionado,
    );

  const itemPayload =
    localizarItemPayload(contexto, erro);

  return {
    itemRelacionado,
    produtoRelacionado,
    itemPayload,
  };
}

/**
 * Determina se o erro indica ausência de valor.
 */
export function indicaCampoAusente(erro) {
  const texto = obterTextoCompletoErro(erro);

  return contemAlgum(texto, [
    'nao pode ser vazio',
    'nao pode estar vazio',
    'campo vazio',
    'obrigatorio',
    'nao informado',
    'nao preenchido',
    'ausente',
    'required',
    'must not be empty',
    'deve ser informado',
  ]);
}

/**
 * Determina se o erro indica valor ou formato inválido.
 */
export function indicaValorInvalido(erro) {
  const texto = obterTextoCompletoErro(erro);

  return contemAlgum(texto, [
    'invalido',
    'incorreto',
    'formato',
    'tamanho',
    'caracteres',
    'digitos',
    'nao permitido',
    'nao reconhecido',
    'fora do padrao',
    'schema',
  ]);
}

/**
 * Determina se o erro se refere a determinado campo.
 */
export function erroRelacionadoAoCampo(
  erro,
  nomesCampo = [],
) {
  const texto = obterTextoCompletoErro(erro);

  return contemAlgum(texto, nomesCampo);
}