import test from 'node:test';
import assert from 'node:assert/strict';
import { codigoProdutoNuvemshop, parseEstoqueNuvemshopCsv } from '../src/utils/estoqueRoupaNuvemshopCsv.js';

const csv = [
  'Identificador URL;Nome;Categorias;Nome da variação 1;Valor da variação 1;Nome da variação 2;Valor da variação 2;Nome da variação 3;Valor da variação 3;Preço;Preço promocional;Estoque;SKU;Código de barras;Marca;Sexo;Custo',
  'camisa-teste;CAMISA TESTE;Camisas;Tamanho;P;Marca inventada;Preta estampa frontal;;;129.99;;;ABC;;;Masculino;50',
  'camisa-teste;;;Tamanho;M;Marca inventada;Preta estampa frontal;;;129.99;;3;DEF;;;;50',
  'bone-teste;BONÉ TESTE;Bonés;Cor;Azul;;;;;79.99;;1;;;;Unissex;',
].join('\r\n');

test('agrupa linhas da Nuvemshop e herda os dados do produto', () => {
  const resultado = parseEstoqueNuvemshopCsv(Buffer.from(csv, 'latin1'));
  assert.equal(resultado.linhas, 3);
  assert.equal(resultado.produtos.length, 2);
  assert.deepEqual(resultado.produtos[0].variacoes, [
    { tamanho: 'P', cor: 'Preta estampa frontal', quantidade_csv: null },
    { tamanho: 'M', cor: 'Preta estampa frontal', quantidade_csv: 3 },
  ]);
  assert.equal(resultado.produtos[1].variacoes[0].tamanho, 'Único');
  assert.equal(resultado.produtos[1].variacoes[0].cor, 'Azul');
});

test('gera código EAN-13 estável por produto', () => {
  const primeiro = codigoProdutoNuvemshop('camisa-teste');
  assert.equal(primeiro, codigoProdutoNuvemshop('camisa-teste'));
  assert.match(primeiro, /^29\d{11}$/);
  const soma = [...primeiro.slice(0, 12)].reduce((total, digito, indice) => total + Number(digito) * (indice % 2 ? 3 : 1), 0);
  assert.equal((10 - soma % 10) % 10, Number(primeiro[12]));
});

test('recusa variações repetidas no mesmo produto', () => {
  const repetido = `${csv}\r\ncamisa-teste;;;Tamanho;P;Marca inventada;Preta estampa frontal;;;129.99;;1;;;;;50`;
  assert.throws(() => parseEstoqueNuvemshopCsv(Buffer.from(repetido, 'latin1')), /variações repetidas/);
});

test('recupera a composição e a marca dos packs de cuecas omitidas no CSV', () => {
  const cuecas = [
    'Identificador URL;Nome;Categorias;Nome da variação 1;Valor da variação 1;Nome da variação 2;Valor da variação 2;Nome da variação 3;Valor da variação 3;Preço;Preço promocional;Estoque;SKU;Código de barras;Marca;Sexo;Custo',
    'pack-3-cuecas-calvin-klein-fxy85;PACK 3 CUECAS CALVIN KLEIN;Cuecas;Tamanho;M;;;;;89.99;;1;;;RESERVA;;',
    'pack-3-cuecas-calvin-klein-fxy85;;;Tamanho;G;;;;;89.99;;2;;;;;;',
  ].join('\r\n');
  const [produto] = parseEstoqueNuvemshopCsv(Buffer.from(cuecas, 'latin1')).produtos;

  assert.equal(produto.marca, 'CALVIN KLEIN');
  assert.deepEqual(produto.variacoes, [
    { tamanho: 'M', cor: 'Azul / Preta / Cinza', quantidade_csv: 1 },
    { tamanho: 'G', cor: 'Azul / Preta / Cinza', quantidade_csv: 2 },
  ]);
});
