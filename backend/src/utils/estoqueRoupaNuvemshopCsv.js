import crypto from 'crypto';
import titoPackCuecas from '../data/titoPackCuecas.cjs';

const limpar = (valor) => String(valor ?? '').replace(/\s+/g, ' ').trim();

export const normalizarTextoEstoque = (valor) => limpar(valor)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const decodificar = (buffer) => {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
  catch { return new TextDecoder('windows-1252').decode(buffer); }
};

const lerLinhasCsv = (texto, delimitador = ';') => {
  const linhas = [];
  let linha = [];
  let campo = '';
  let entreAspas = false;
  for (let i = 0; i < texto.length; i += 1) {
    const caractere = texto[i];
    if (caractere === '"') {
      if (entreAspas && texto[i + 1] === '"') { campo += '"'; i += 1; }
      else entreAspas = !entreAspas;
    } else if (caractere === delimitador && !entreAspas) {
      linha.push(campo); campo = '';
    } else if ((caractere === '\n' || caractere === '\r') && !entreAspas) {
      if (caractere === '\r' && texto[i + 1] === '\n') i += 1;
      linha.push(campo); campo = '';
      if (linha.some(valor => valor !== '')) linhas.push(linha);
      linha = [];
    } else campo += caractere;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
};

const valorBase = (linhas, campo) => limpar(linhas.find(linha => limpar(linha[campo]))?.[campo]);

const numero = (valor, fallback = 0) => {
  const texto = limpar(valor).replace(',', '.');
  if (!texto) return fallback;
  const resultado = Number(texto);
  return Number.isFinite(resultado) && resultado >= 0 ? resultado : fallback;
};

const quantidade = (valor) => {
  const texto = limpar(valor);
  if (!texto || texto === '-') return null;
  const resultado = Number(texto.replace(',', '.'));
  if (!Number.isInteger(resultado) || resultado < 0) throw new Error(`Estoque inválido: ${texto}`);
  return resultado;
};

const digitoEan13 = (base) => {
  const soma = [...base].reduce((total, digito, indice) => total + Number(digito) * (indice % 2 ? 3 : 1), 0);
  return String((10 - (soma % 10)) % 10);
};

export const codigoProdutoNuvemshop = (slug) => {
  const hash = crypto.createHash('sha256').update(slug).digest('hex');
  const numeroHash = BigInt(`0x${hash.slice(0, 15)}`) % 10000000000n;
  const base = `29${numeroHash.toString().padStart(10, '0')}`;
  return `${base}${digitoEan13(base)}`;
};

export const parseEstoqueNuvemshopCsv = (buffer) => {
  const matriz = lerLinhasCsv(decodificar(buffer).replace(/^\uFEFF/, ''));
  if (matriz.length < 2) throw new Error('O CSV está vazio');
  const cabecalhos = matriz[0].map(limpar);
  const obrigatorios = ['Identificador URL', 'Nome', 'Categorias', 'Estoque', 'Preço'];
  for (const campo of obrigatorios) if (!cabecalhos.includes(campo)) throw new Error(`Coluna obrigatória ausente: ${campo}`);
  const linhas = matriz.slice(1).map(valores => Object.fromEntries(cabecalhos.map((campo, indice) => [campo, valores[indice] ?? ''])));
  const grupos = new Map();
  for (const linha of linhas) {
    const slug = limpar(linha['Identificador URL']);
    if (!slug) throw new Error('Existe uma linha sem Identificador URL');
    if (!grupos.has(slug)) grupos.set(slug, []);
    grupos.get(slug).push(linha);
  }

  const produtos = [...grupos.entries()].map(([slug, itens]) => {
    const nome = valorBase(itens, 'Nome');
    const tipo = valorBase(itens, 'Categorias') || 'Outro';
    const packCuecas = titoPackCuecas[slug] ?? null;
    if (!nome) throw new Error(`Produto ${slug} está sem nome`);
    const precoPromocional = numero(valorBase(itens, 'Preço promocional'), 0);
    const variacoes = itens.map(linha => {
      const pares = [1, 2, 3].map(indice => ({
        nome: normalizarTextoEstoque(linha[`Nome da variação ${indice}`]),
        valor: limpar(linha[`Valor da variação ${indice}`]),
      }));
      const tamanho = pares.find(par => ['tamanho', 'tam', 'size'].includes(par.nome))?.valor || 'Único';
      const descritores = pares.filter(par => par.valor && !['tamanho', 'tam', 'size'].includes(par.nome)).map(par => par.valor);
      return {
        tamanho,
        cor: descritores.join(' / ') || packCuecas?.composicao || null,
        quantidade_csv: quantidade(linha.Estoque),
      };
    });
    const chaves = variacoes.map(item => `${normalizarTextoEstoque(item.tamanho)}|${normalizarTextoEstoque(item.cor)}`);
    if (new Set(chaves).size !== chaves.length) throw new Error(`O produto ${nome} (${slug}) possui variações repetidas`);
    return {
      slug,
      codigo: codigoProdutoNuvemshop(slug),
      nome,
      tipo,
      genero: valorBase(itens, 'Sexo') || null,
      marca: packCuecas?.marca || valorBase(itens, 'Marca') || null,
      preco_venda: precoPromocional || numero(valorBase(itens, 'Preço'), 0),
      preco_compra: numero(valorBase(itens, 'Custo'), 0),
      observacao: `Origem Nuvemshop: ${slug}`,
      variacoes,
    };
  });
  return { linhas: linhas.length, produtos };
};

export const chaveVariacaoEstoque = (variacao) => `${normalizarTextoEstoque(variacao?.tamanho)}|${normalizarTextoEstoque(variacao?.cor)}`;

export const chaveProdutoEstoque = (produto) => {
  const cores = [...new Set((produto?.variacoes ?? []).map(v => normalizarTextoEstoque(v.cor)).filter(Boolean))].sort().join('|');
  return [normalizarTextoEstoque(produto?.nome), normalizarTextoEstoque(produto?.tipo), cores].join('::');
};
