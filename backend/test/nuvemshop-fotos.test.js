import assert from 'node:assert/strict';
import test from 'node:test';
import nuvemshopTitoFotos from '../src/data/nuvemshopTitoFotos.js';
import titoPackCuecas from '../src/data/titoPackCuecas.cjs';

test('catálogo de fotos da Tito Imports é seguro e não contém duplicatas', () => {
  const entradas = Object.entries(nuvemshopTitoFotos);
  assert.equal(entradas.length, 338);
  assert.equal(entradas.filter(([, fotos]) => fotos.length > 0).length, 325);

  for (const [slug, fotos] of entradas) {
    assert.match(slug, /^[a-z0-9-]+$/);
    assert.equal(new Set(fotos).size, fotos.length, `Fotos repetidas em ${slug}`);
    for (const foto of fotos) {
      const url = new URL(foto);
      assert.equal(url.protocol, 'https:');
      assert.equal(url.hostname, 'dcdn-us.mitiendanube.com');
      assert.match(url.pathname, /\/stores\/008\/104\/359\/products\//);
      assert.doesNotMatch(foto, /^data:/);
    }
  }
});

test('os treze relógios adicionados têm fotos próprias por identificador', () => {
  const slugs = [
    'relogio-moncler-h9h7n', 'relogio-moncler-dnyrp',
    'relogio-rolex-7vmgh', 'relogio-rolex-mk4lu', 'relogio-rolex-um0id',
    'relogio-rolex-spprz', 'relogio-rolex-mdu4j',
    'relogio-tag-heuer-xic6l', 'relogio-tag-heuer-76pvw',
    'relogio-tag-heuer-157em', 'relogio-tag-heuer-qrnk1',
    'relogio-tag-heuer-13zt5', 'relogio-tag-heuer-1pt7c',
  ];
  for (const slug of slugs) {
    assert.ok(nuvemshopTitoFotos[slug]?.length, `Sem fotos para ${slug}`);
  }
  assert.equal(new Set(slugs.map(slug => nuvemshopTitoFotos[slug][0])).size, slugs.length);
});

test('todos os packs de três cuecas com fotos possuem composição identificada', () => {
  const slugsFotos = Object.keys(nuvemshopTitoFotos).filter(slug => slug.startsWith('pack-3-cuecas')).sort();
  const slugsComposicoes = Object.keys(titoPackCuecas).sort();
  assert.deepEqual(slugsComposicoes, slugsFotos);
  for (const dados of Object.values(titoPackCuecas)) {
    assert.match(dados.composicao, /^[^/]+ \/ [^/]+ \/ [^/]+$/);
    assert.ok(dados.marca);
  }
});
