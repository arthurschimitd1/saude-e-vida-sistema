'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import Link from 'next/link';
import { LojaCategoria, LojaCupom, LojaCupomCliente, LojaProdutoConfiguracao, lojaOnlineService } from '@/app/(main)/services/api/lojaOnlineService';
import styles from './LojaConfiguracao.module.scss';

const dinheiro = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const PROPORCAO_FOTO_LOJA = 376 / 260;
const secoes = [
    { value: 'destaques', label: 'Destaques' },
    { value: 'promocoes', label: 'Promoções' },
    { value: 'mais-vendidos', label: 'Mais vendidos' }
];
type CupomForm = { codigo: string; titulo: string; tipo: 'percentual' | 'fixo'; valor: string; validade_fim: string; limite_uso: string; mensagem: string };
const cupomInicial: CupomForm = { codigo: '', titulo: '', tipo: 'percentual', valor: '', validade_fim: '', limite_uso: '', mensagem: '' };
const categoriaImagem = (categoria: string) => {
    const nome = categoria.toLowerCase();
    if (nome.includes('alimentação saudável')) return '/images/loja/categorias/alimentacao-saudavel.png';
    if (nome === 'alimentos' || nome.includes('alimento')) return '/images/loja/categorias/alimentos.png';
    if (nome.includes('autocuidado')) return '/images/loja/categorias/autocuidado.png';
    if (nome.includes('cáps') || nome.includes('suplement')) return '/images/loja/categorias/capsulas-suplementos.png';
    if (nome.includes('chá') || nome.includes('infus')) return '/images/loja/categorias/chas-infusoes.png';
    if (nome.includes('granel')) return '/images/loja/categorias/granel.png';
    return '/images/loja/categorias/alimentos.png';
};

const categoriaNormalizada = (valor: unknown) => String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');

function VisualCheck({ checked, onChange, ariaLabel }: { checked: boolean; onChange: (event: ChangeEvent<HTMLInputElement>) => void; ariaLabel: string }) {
    return (
        <span className={styles.checkbox}>
            <input type="checkbox" checked={checked} onChange={onChange} aria-label={ariaLabel} />
            <span aria-hidden="true" />
        </span>
    );
}

function FotoEditorModal({
    nome,
    categoria,
    preco,
    destaque,
    src,
    arquivo,
    salvando,
    onCancel,
    onSave
}: {
    nome: string;
    categoria: string;
    preco: string;
    destaque: boolean;
    src: string;
    arquivo: File;
    salvando: boolean;
    onCancel: () => void;
    onSave: (arquivo: File) => Promise<void>;
}) {
    const [zoom, setZoom] = useState(1);
    const [horizontal, setHorizontal] = useState(0);
    const [vertical, setVertical] = useState(0);
    const [erroEditor, setErroEditor] = useState('');
    const gerarRecorte = async () => {
        setErroEditor('');
        try {
            const imagem = new Image();
            const urlTemporaria = URL.createObjectURL(arquivo);
            await new Promise<void>((resolve, reject) => {
                imagem.onload = () => resolve();
                imagem.onerror = () => reject(new Error('Não foi possível ler esta imagem.'));
                imagem.src = urlTemporaria;
            });
            URL.revokeObjectURL(urlTemporaria);
            const larguraAlvo = 900;
            const alturaAlvo = Math.round(larguraAlvo / PROPORCAO_FOTO_LOJA);
            const escala = Math.max(larguraAlvo / imagem.naturalWidth, alturaAlvo / imagem.naturalHeight) * zoom;
            const largura = imagem.naturalWidth * escala;
            const altura = imagem.naturalHeight * escala;
            const canvas = document.createElement('canvas');
            canvas.width = larguraAlvo;
            canvas.height = alturaAlvo;
            const contexto = canvas.getContext('2d');
            if (!contexto) throw new Error('Não foi possível preparar o recorte.');
            contexto.fillStyle = '#ffffff';
            contexto.fillRect(0, 0, larguraAlvo, alturaAlvo);
            contexto.drawImage(imagem, (larguraAlvo - largura) / 2 + (horizontal / 100) * Math.max(0, (largura - larguraAlvo) / 2), (alturaAlvo - altura) / 2 + (vertical / 100) * Math.max(0, (altura - alturaAlvo) / 2), largura, altura);
            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
            if (!blob) throw new Error('Não foi possível gerar o recorte.');
            await onSave(new File([blob], `${nome.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.jpg`, { type: 'image/jpeg' }));
        } catch (error: any) {
            setErroEditor(error?.message || 'Não foi possível ajustar esta imagem.');
        }
    };
    return (
        <div className={styles.photoOverlay} role="dialog" aria-modal="true" aria-label={`Ajustar foto de ${nome}`}>
            <div className={styles.photoEditor}>
                <div className={styles.photoEditorHeader}>
                    <div>
                        <span>PRÉVIA DA LOJA</span>
                        <h2>Ajustar imagem</h2>
                        <p>Esta é a mesma proporção usada no card público. Mova o produto até ficar como você deseja.</p>
                    </div>
                    <button type="button" className={styles.photoClose} onClick={onCancel} aria-label="Fechar">
                        ×
                    </button>
                </div>
                <div className={styles.photoPreviewCard}>
                    <div className={styles.photoPreview}>
                        <img src={src} alt={`Prévia de ${nome}`} style={{ objectPosition: `${50 - horizontal / 2}% ${50 - vertical / 2}%`, transform: `scale(${zoom})` }} />
                        {destaque && <span className={styles.photoPreviewBadge}>Destaque</span>}
                    </div>
                    <div className={styles.photoPreviewInfo}>
                        <small>{categoria || 'SAÚDE E VIDA'}</small>
                        <strong>{nome}</strong>
                        <b>{preco}</b>
                        <span>
                            Ver produto <i className="pi pi-arrow-right" />
                        </span>
                    </div>
                </div>
                <div className={styles.photoControls}>
                    <label>
                        <span>
                            Zoom <strong>{zoom.toFixed(2)}×</strong>
                        </span>
                        <input type="range" min="1" max="2.5" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
                    </label>
                    <label>
                        <span>
                            Posição horizontal{' '}
                            <strong>
                                {horizontal > 0 ? '+' : ''}
                                {horizontal}
                            </strong>
                        </span>
                        <input type="range" min="-100" max="100" value={horizontal} onChange={(event) => setHorizontal(Number(event.target.value))} />
                    </label>
                    <label>
                        <span>
                            Posição vertical{' '}
                            <strong>
                                {vertical > 0 ? '+' : ''}
                                {vertical}
                            </strong>
                        </span>
                        <input type="range" min="-100" max="100" value={vertical} onChange={(event) => setVertical(Number(event.target.value))} />
                    </label>
                    <button
                        type="button"
                        className={styles.photoReset}
                        onClick={() => {
                            setZoom(1);
                            setHorizontal(0);
                            setVertical(0);
                        }}
                    >
                        Voltar ao centro
                    </button>
                </div>
                {erroEditor && <p className={styles.photoError}>{erroEditor}</p>}
                <div className={styles.photoEditorFooter}>
                    <button type="button" className={styles.photoCancel} onClick={onCancel} disabled={salvando}>
                        Cancelar
                    </button>
                    <button type="button" className={styles.save} onClick={gerarRecorte} disabled={salvando}>
                        {salvando ? 'Salvando…' : 'Salvar enquadramento'}
                    </button>
                </div>
            </div>
        </div>
    );
}
export default function LojaConfiguracaoPage() {
    const [produtos, setProdutos] = useState<LojaProdutoConfiguracao[]>([]);
    const [produtosEstoque, setProdutosEstoque] = useState<LojaProdutoConfiguracao[]>([]);
    const [categorias, setCategorias] = useState<LojaCategoria[]>([]);
    const [busca, setBusca] = useState('');
    const [categoriaFiltro, setCategoriaFiltro] = useState('Todas');
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState<number | null>(null);
    const [erro, setErro] = useState('');
    const [salvo, setSalvo] = useState('');
    const [cupons, setCupons] = useState<LojaCupom[]>([]);
    const [clientes, setClientes] = useState<LojaCupomCliente[]>([]);
    const [mostrarCupons, setMostrarCupons] = useState(false);
    const [cupomForm, setCupomForm] = useState<CupomForm>(cupomInicial);
    const [clientesSelecionados, setClientesSelecionados] = useState<number[]>([]);
    const [cupomSalvando, setCupomSalvando] = useState(false);
    const [mostrarCategorias, setMostrarCategorias] = useState(false);
    const [categoriaNova, setCategoriaNova] = useState('');
    const [categoriaEditando, setCategoriaEditando] = useState<number | null>(null);
    const [categoriaEditNome, setCategoriaEditNome] = useState('');
    const [categoriaSalvando, setCategoriaSalvando] = useState(false);
    const [mostrarEstoque, setMostrarEstoque] = useState(false);
    const [estoqueCarregado, setEstoqueCarregado] = useState(false);
    const [buscaEstoque, setBuscaEstoque] = useState('');
    const carregar = useCallback(async () => {
        setCarregando(true);
        setErro('');
        setSalvo('');
        try {
            const [produtosResposta, categoriasResposta] = await Promise.all([lojaOnlineService.listarConfiguracao(), lojaOnlineService.listarCategorias()]);
            setProdutos(produtosResposta.data);
            setCategorias(categoriasResposta.data);
        } catch (e: any) {
            setErro(e?.response?.data?.message || 'Não foi possível carregar os produtos.');
        } finally {
            setCarregando(false);
        }
    }, []);
    const carregarCupons = useCallback(async () => {
        try {
            const [cuponsResposta, clientesResposta] = await Promise.all([lojaOnlineService.listarCupons(), lojaOnlineService.listarClientesParaCupons()]);
            setCupons(cuponsResposta.data);
            setClientes(clientesResposta.data);
        } catch (e: any) {
            setErro(e?.response?.data?.message || e?.message || 'Não foi possível carregar os cupons.');
        }
    }, []);
    useEffect(() => {
        carregar();
    }, [carregar]);
    useEffect(() => {
        if (mostrarCupons) carregarCupons();
    }, [mostrarCupons, carregarCupons]);
    const carregarEstoque = useCallback(async () => {
        try {
            const resposta = await lojaOnlineService.listarProdutosEstoque();
            setProdutosEstoque(resposta.data);
            setEstoqueCarregado(true);
        } catch (e: any) {
            setErro(e?.response?.data?.message || 'Não foi possível carregar o estoque.');
        }
    }, []);
    useEffect(() => {
        if (mostrarEstoque && !estoqueCarregado) carregarEstoque();
    }, [mostrarEstoque, estoqueCarregado, carregarEstoque]);
    const categoriasDeFiltro = useMemo(
        () =>
            Array.from(new Set(['Todas', 'Granel', ...categorias.filter((categoria) => categoria.ativo && categoria.nome !== 'Granel').map((categoria) => categoria.nome)])).sort((a, b) =>
                a === 'Todas' ? -1 : b === 'Todas' ? 1 : a.localeCompare(b)
            ),
        [categorias, produtos]
    );
    const produtosDisponiveisNoEstoque = useMemo(() => {
        const termo = buscaEstoque.trim().toLowerCase();
        const configurados = new Set(produtos.map((produto) => produto.id));
        return produtosEstoque.filter((produto) => !configurados.has(produto.id) && (!termo || `${produto.nome} ${produto.codigo || ''} ${produto.categoria_estoque || ''}`.toLowerCase().includes(termo)));
    }, [produtos, produtosEstoque, buscaEstoque]);
    const visiveis = useMemo(() => {
        const termo = busca.trim().toLowerCase();
        return produtos.filter((produto) => {
            const pertenceCategoria = categoriaFiltro === 'Todas'
                || (categoriaFiltro === 'Granel'
                    ? Boolean(produto.a_granel) || categoriaNormalizada(produto.categoria) === 'granel'
                    : categoriaNormalizada(produto.categoria) === categoriaNormalizada(categoriaFiltro));
            const correspondeBusca = !termo || produto.nome.toLowerCase().includes(termo) || (produto.codigo || '').toLowerCase().includes(termo);
            return pertenceCategoria && correspondeBusca;
        });
    }, [produtos, busca, categoriaFiltro]);
    const categoriasDisponiveis = useMemo(
        () =>
            Array.from(
                new Set(['Granel', ...categorias.filter((categoria) => categoria.ativo && categoria.nome !== 'Granel').map((categoria) => categoria.nome)])
            ).sort((a, b) => a.localeCompare(b)),
        [categorias, produtos]
    );
    const ativos = produtos.filter((produto) => produto.ativo).length;
    const alterar = (id: number, campo: keyof LojaProdutoConfiguracao, valor: string | boolean | number | null | string[]) => setProdutos((atual) => atual.map((produto) => (produto.id === id ? { ...produto, [campo]: valor } : produto)));
    const alternarSecao = (produto: LojaProdutoConfiguracao, secao: string) => {
        const atual = produto.secoes || [];
        alterar(produto.id, 'secoes', atual.includes(secao) ? atual.filter((item) => item !== secao) : [...atual, secao]);
    };
    const salvar = async (produto: LojaProdutoConfiguracao) => {
        setSalvando(produto.id);
        setErro('');
        setSalvo('');
        try {
            const resposta = await lojaOnlineService.atualizarConfiguracao(produto.id, {
                ativo: produto.ativo,
                nome_loja: produto.nome_loja ?? '',
                preco: produto.preco,
                preco_kg: produto.preco_kg,
                a_granel: produto.a_granel,
                preco_original: produto.preco_original,
                categoria: produto.categoria,
                descricao: produto.descricao,
                secoes: produto.secoes || [],
                ordem: produto.ordem,
                destaque: (produto.secoes || []).includes('destaques'),
                promocao: (produto.secoes || []).includes('promocoes')
            });
            setProdutos(resposta.data);
                        setSalvo(`Produto "${produto.nome_original || produto.nome}" atualizado com sucesso.`);
        } catch (e: any) {
            setErro(e?.response?.data?.message || 'Não foi possível salvar este produto.');
        } finally {
            setSalvando(null);
        }
    };
    const enviarFoto = (produto: LojaProdutoConfiguracao, event: ChangeEvent<HTMLInputElement>) => {
        const arquivo = event.target.files?.[0];
        if (!arquivo) return;
        if (!arquivo.type.startsWith('image/')) {
            setErro('Selecione uma imagem JPG, PNG, WebP ou GIF.');
            return;
        }
        if (arquivo.size > 20 * 1024 * 1024) {
            setErro('A imagem deve ter no máximo 20 MB.');
            return;
        }
        setErro('');
        setSalvo('');
        const host = document.createElement('div');
        document.body.appendChild(host);
        const root = createRoot(host);
        const previewUrl = URL.createObjectURL(arquivo);
        const fechar = () => {
            URL.revokeObjectURL(previewUrl);
            root.unmount();
            host.remove();
        };
        root.render(
            <FotoEditorModal
                nome={produto.nome}
                categoria={produto.categoria || 'Saúde e Vida'}
                preco={dinheiro(produto.preco)}
                destaque={(produto.secoes || []).includes('destaques')}
                src={previewUrl}
                arquivo={arquivo}
                salvando={salvando === produto.id}
                onCancel={fechar}
                onSave={async (imagem) => {
                    setSalvando(produto.id);
                    try {
                        const resposta = await lojaOnlineService.atualizarFoto(produto.id, imagem);
                        setProdutos((atual) => atual.map((item) => (item.id === produto.id ? { ...item, foto_url: resposta.data.foto_url } : item)));
                        setSalvo(`Foto de "${produto.nome}" salva com sucesso.`);
                        fechar();
                    } catch (e: any) {
                        setErro(e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Não foi possível enviar a foto.');
                    } finally {
                        setSalvando(null);
                    }
                }}
            />
        );
        event.target.value = '';
    };
    const atualizarCupom = (campo: keyof CupomForm, valor: string) => setCupomForm((atual) => ({ ...atual, [campo]: valor }));
    const alternarCliente = (id: number) => setClientesSelecionados((atual) => (atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]));
    const criarCupom = async (event: FormEvent) => {
        event.preventDefault();
        setCupomSalvando(true);
        setErro('');
        setSalvo('');
        try {
            await lojaOnlineService.criarCupom({
                ...cupomForm,
                codigo: cupomForm.codigo.toUpperCase(),
                valor: Number(cupomForm.valor),
                validade_fim: cupomForm.validade_fim || null,
                limite_uso: cupomForm.limite_uso ? Number(cupomForm.limite_uso) : null,
                ativo: true
            });
            setCupomForm(cupomInicial);
            await carregarCupons();
            setSalvo('Cupom criado. Selecione os clientes e envie pelo WhatsApp.');
        } catch (e: any) {
            setErro(e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Não foi possível criar o cupom.');
        } finally {
            setCupomSalvando(false);
        }
    };
    const enviarCupom = async (cupom: LojaCupom) => {
        if (!clientesSelecionados.length) {
            setErro('Selecione pelo menos um cliente para receber o cupom.');
            return;
        }
        setCupomSalvando(true);
        setErro('');
        setSalvo('');
        try {
            const resposta = await lojaOnlineService.enviarCupom(cupom.id, clientesSelecionados);
            setSalvo(`${resposta.data.enviados || 0} cupom(ns) enviado(s) pelo WhatsApp${resposta.data.erros ? ` · ${resposta.data.erros} erro(s)` : ''}.`);
        } catch (e: any) {
            setErro(e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Não foi possível enviar o cupom.');
        } finally {
            setCupomSalvando(false);
        }
    };
    const criarCategoria = async (event: FormEvent) => {
        event.preventDefault();
        const nome = categoriaNova.trim();
        if (!nome) return;
        setCategoriaSalvando(true);
        setErro('');
        setSalvo('');
        try {
            const resposta = await lojaOnlineService.criarCategoria({ nome, ordem: categorias.length });
            setCategorias((atual) => [...atual, resposta.data].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome)));
            setCategoriaNova('');
            setSalvo(`Categoria "${nome}" criada. Agora você pode vinculá-la aos produtos.`);
        } catch (e: any) {
            setErro(e?.response?.data?.message || e?.message || 'Não foi possível criar a categoria.');
        } finally {
            setCategoriaSalvando(false);
        }
    };
    const iniciarEdicaoCategoria = (categoria: LojaCategoria) => {
        setCategoriaEditando(categoria.id);
        setCategoriaEditNome(categoria.nome);
    };
    const salvarCategoria = async (categoria: LojaCategoria) => {
        const nome = categoriaEditNome.trim();
        if (!nome) return;
        setCategoriaSalvando(true);
        setErro('');
        setSalvo('');
        try {
            const resposta = await lojaOnlineService.atualizarCategoria(categoria.id, { nome, ordem: categoria.ordem, ativo: categoria.ativo });
            setCategorias((atual) => atual.map((item) => (item.id === categoria.id ? resposta.data : item)));
            setProdutos((atual) => atual.map((produto) => (produto.categoria === categoria.nome ? { ...produto, categoria: nome } : produto)));
            setCategoriaEditando(null);
            setSalvo(`Categoria "${nome}" atualizada.`);
        } catch (e: any) {
            setErro(e?.response?.data?.message || e?.message || 'Não foi possível atualizar a categoria.');
        } finally {
            setCategoriaSalvando(false);
        }
    };
    const excluirCategoria = async (categoria: LojaCategoria) => {
        if (categoria.sistema || !window.confirm(`Excluir a categoria "${categoria.nome}"?`)) return;
        setCategoriaSalvando(true);
        setErro('');
        setSalvo('');
        try {
            await lojaOnlineService.excluirCategoria(categoria.id);
            setCategorias((atual) => atual.filter((item) => item.id !== categoria.id));
            setSalvo(`Categoria "${categoria.nome}" excluída.`);
        } catch (e: any) {
            setErro(e?.response?.data?.message || e?.message || 'Não foi possível excluir a categoria.');
        } finally {
            setCategoriaSalvando(false);
        }
    };
    const adicionarProdutoEstoque = async (produto: LojaProdutoConfiguracao) => {
        setSalvando(produto.id);
        setErro('');
        try {
            const resposta = await lojaOnlineService.atualizarConfiguracao(produto.id, {
                ativo: false,
                nome_loja: produto.nome_loja ?? '',
                preco: produto.preco_estoque,
                preco_kg: produto.preco_estoque,
                a_granel: false,
                preco_original: null,
                categoria: '',
                descricao: '',
                secoes: [],
                ordem: 0,
                destaque: false,
                promocao: false,
            });
            setProdutos(resposta.data);
            setCategoriaFiltro('Todas');
            setSalvo(`"${produto.nome}" foi adicionado à configuração da loja. Escolha a categoria e salve para publicar.`);
        } catch (e: any) {
            setErro(e?.response?.data?.message || e?.message || 'Não foi possível adicionar o produto à configuração.');
        } finally {
            setSalvando(null);
        }
    };

    return (
        <main className={styles.page}>
            <header className={styles.heading}>
                <div>
                    <span>LOJA ONLINE</span>
                    <h1>Configurar produtos da lojinha</h1>
                    <p>Escolha o que aparece na loja, organize por seção e gerencie os cupons enviados aos seus clientes.</p>
                </div>
                <div className={styles.headingActions}>
                    <button className={styles.couponButton} onClick={() => setMostrarEstoque((atual) => !atual)}>
                        <i className="pi pi-box" /> {mostrarEstoque ? 'Fechar estoque' : 'Adicionar do estoque'}
                    </button>
                    <button className={styles.couponButton} onClick={() => setMostrarCategorias((atual) => !atual)}>
                        <i className="pi pi-list" /> {mostrarCategorias ? 'Fechar categorias' : 'Categorias da loja'}
                    </button>
                    <button className={styles.couponButton} onClick={() => setMostrarCupons((atual) => !atual)}>
                        <i className="pi pi-ticket" /> {mostrarCupons ? 'Fechar cupons' : 'Cupons e WhatsApp'}
                    </button>
                    <Link className={styles.couponButton} href="/loja/roleta">
                        <i className="pi pi-star" /> Prêmios da roleta
                    </Link>
                    <Link className={styles.link} href="/loja" target="_blank">
                        Ver loja pública <i className="pi pi-external-link" />
                    </Link>
                </div>
            </header>
            {erro && <div className={styles.error}>{erro}</div>}
            {salvo && <div className={styles.success}>{salvo}</div>}
            {mostrarEstoque && (
                <section className={styles.stockPanel}>
                    <div className={styles.stockHeading}>
                        <div>
                            <span>CATÁLOGO DO ESTOQUE</span>
                            <h2>Adicionar produto do estoque</h2>
                            <p>Escolha um produto já cadastrado no estoque para configurar preço, categoria, foto e seções da lojinha.</p>
                        </div>
                        <i className="pi pi-box" />
                    </div>
                    <div className={styles.stockToolbar}>
                        <input className={styles.stockSearch} placeholder="Buscar produto por nome, código ou categoria" value={buscaEstoque} onChange={(event) => setBuscaEstoque(event.target.value)} />
                        <small>{produtosDisponiveisNoEstoque.length} produto(s) disponível(is)</small>
                    </div>
                    {produtosDisponiveisNoEstoque.length === 0 ? (
                        <p className={styles.stockEmpty}>Nenhum produto disponível para adicionar com esse filtro.</p>
                    ) : (
                        <div className={styles.stockList}>
                            {produtosDisponiveisNoEstoque.map((produto) => (
                                <article className={styles.stockItem} key={produto.id}>
                                    <div>
                                        <strong>{produto.nome}</strong>
                                        <small>
                                            {produto.codigo || 'Sem código'} · {produto.estoque} {produto.unidade} em estoque · {produto.categoria_estoque || 'Sem categoria no estoque'}
                                        </small>
                                    </div>
                                    <button className={styles.stockAdd} type="button" onClick={() => adicionarProdutoEstoque(produto)}>
                                        Adicionar à loja
                                    </button>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            )}
            {mostrarCupons && (
                <section className={styles.couponPanel}>
                    <div className={styles.couponHeading}>
                        <div>
                            <span>RELACIONAMENTO COM CLIENTES</span>
                            <h2>Cupons e envio pelo WhatsApp</h2>
                            <p>Crie uma oferta, selecione os clientes e envie pela integração de WhatsApp já configurada no sistema.</p>
                        </div>
                        <i className="pi pi-send" />
                    </div>
                    <form className={styles.couponForm} onSubmit={criarCupom}>
                        <label>
                            Código
                            <input required placeholder="BEMVINDO10" value={cupomForm.codigo} onChange={(e) => atualizarCupom('codigo', e.target.value.toUpperCase())} />
                        </label>
                        <label>
                            Título
                            <input required placeholder="Boas-vindas" value={cupomForm.titulo} onChange={(e) => atualizarCupom('titulo', e.target.value)} />
                        </label>
                        <label>
                            Tipo
                            <select value={cupomForm.tipo} onChange={(e) => atualizarCupom('tipo', e.target.value as CupomForm['tipo'])}>
                                <option value="percentual">Percentual (%)</option>
                                <option value="fixo">Valor fixo (R$)</option>
                            </select>
                        </label>
                        <label>
                            Desconto
                            <input required type="number" min="0.01" step="0.01" value={cupomForm.valor} onChange={(e) => atualizarCupom('valor', e.target.value)} />
                        </label>
                        <label>
                            Validade
                            <input type="date" value={cupomForm.validade_fim} onChange={(e) => atualizarCupom('validade_fim', e.target.value)} />
                        </label>
                        <label>
                            Limite de usos
                            <input type="number" min="1" step="1" placeholder="Sem limite" value={cupomForm.limite_uso} onChange={(e) => atualizarCupom('limite_uso', e.target.value)} />
                        </label>
                        <label className={styles.couponWide}>
                            Mensagem personalizada
                            <textarea placeholder="Use {{nome}} e {{codigo}} para personalizar a mensagem" value={cupomForm.mensagem} onChange={(e) => atualizarCupom('mensagem', e.target.value)} />
                        </label>
                        <button className={styles.save} disabled={cupomSalvando}>
                            {cupomSalvando ? 'Salvando…' : 'Criar cupom'}
                        </button>
                    </form>
                    <div className={styles.couponDelivery}>
                        <div className={styles.customerPicker}>
                            <div className={styles.couponSubheading}>
                                <strong>Clientes que receberão</strong>
                                <small>{clientesSelecionados.length} selecionado(s)</small>
                            </div>
                            {clientes.length === 0 ? (
                                <p>Nenhum cliente cadastrado ainda.</p>
                            ) : (
                                <div className={styles.customerList}>
                                    {clientes.map((cliente) => (
                                        <label key={cliente.id}>
                                            <VisualCheck checked={clientesSelecionados.includes(cliente.id)} onChange={() => alternarCliente(cliente.id)} ariaLabel={`Selecionar ${cliente.nome}`} />
                                            <span>
                                                <strong>{cliente.nome}</strong>
                                                <small>
                                                    {cliente.telefone} · {cliente.email || 'sem e-mail'}
                                                </small>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className={styles.couponList}>
                            <div className={styles.couponSubheading}>
                                <strong>Cupons criados</strong>
                                <small>{cupons.length} cupom(ns)</small>
                            </div>
                            {cupons.length === 0 ? (
                                <p>Crie o primeiro cupom para começar.</p>
                            ) : (
                                cupons.map((cupom) => (
                                    <article className={styles.couponCard} key={cupom.id}>
                                        <div>
                                            <strong>{cupom.codigo}</strong>
                                            <span>
                                                {cupom.titulo} · {cupom.tipo === 'percentual' ? `${cupom.valor}%` : dinheiro(cupom.valor)}
                                            </span>
                                        </div>
                                        <button className={styles.sendCoupon} disabled={cupomSalvando} onClick={() => enviarCupom(cupom)}>
                                            <i className="pi pi-whatsapp" /> Enviar
                                        </button>
                                    </article>
                                ))
                            )}
                        </div>
                    </div>
                </section>
            )}
            {mostrarCategorias && (
                <section className={styles.categoryPanel}>
                    <div className={styles.categoryHeading}>
                        <div>
                            <span>ESTRUTURA DA LOJA</span>
                            <h2>Categorias da loja</h2>
                            <p>Crie as categorias que aparecerão no seletor dos produtos e na navegação da lojinha.</p>
                        </div>
                        <i className="pi pi-tags" />
                    </div>
                    <form className={styles.categoryForm} onSubmit={criarCategoria}>
                        <input required maxLength={120} placeholder="Ex.: Chás e infusões" value={categoriaNova} onChange={(event) => setCategoriaNova(event.target.value)} />
                        <button className={styles.save} disabled={categoriaSalvando}>
                            {categoriaSalvando ? 'Salvando…' : 'Criar categoria'}
                        </button>
                    </form>
                    <div className={styles.categoryList}>
                        {categorias.map((categoria) => (
                            <div className={styles.categoryItem} key={categoria.id}>
                                <div>
                                    {categoriaEditando === categoria.id ? (
                                        <input className={styles.categoryEditInput} maxLength={120} value={categoriaEditNome} onChange={(event) => setCategoriaEditNome(event.target.value)} />
                                    ) : (
                                        <strong>{categoria.nome}</strong>
                                    )}
                                    <small>{categoria.sistema ? 'Categoria especial da loja' : categoria.em_uso ? 'Em uso por produto(s)' : categoria.legado ? 'Importada de produtos existentes' : 'Disponível para vincular aos produtos'}</small>
                                </div>
                                <div className={styles.categoryActions}>
                                    {categoriaEditando === categoria.id ? (
                                        <>
                                            <button className={styles.categoryAction} type="button" disabled={categoriaSalvando} onClick={() => salvarCategoria(categoria)}>
                                                Salvar
                                            </button>
                                            <button className={styles.categoryCancel} type="button" disabled={categoriaSalvando} onClick={() => setCategoriaEditando(null)}>
                                                Cancelar
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button className={styles.categoryAction} type="button" disabled={categoria.sistema || categoriaSalvando} onClick={() => iniciarEdicaoCategoria(categoria)}>
                                                Editar
                                            </button>
                                            <button className={styles.categoryDelete} type="button" disabled={categoria.sistema || categoriaSalvando} onClick={() => excluirCategoria(categoria)}>
                                                Excluir
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
            <div className={styles.toolbar}>
                <div className={styles.toolbarControls}>
                    <input className={styles.search} placeholder="Buscar produto por nome ou código" value={busca} onChange={(event) => setBusca(event.target.value)} />
                    <label className={styles.categoryFilter}>
                        <span>Ver produtos por categoria</span>
                        <select value={categoriaFiltro} onChange={(event) => setCategoriaFiltro(event.target.value)}>
                            {categoriasDeFiltro.map((categoria) => (
                                <option value={categoria} key={categoria}>
                                    {categoria}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <span className={styles.summary}>
                    {ativos} produto(s) publicado(s) · {visiveis.length} exibido(s)
                </span>
            </div>
            {carregando ? (
                <div className={styles.loading}>Carregando produtos…</div>
            ) : visiveis.length === 0 ? (
                <div className={styles.empty}>Nenhum produto encontrado.</div>
            ) : (
                <div className={styles.grid}>
                    {visiveis.map((produto) => (
                        <article className={styles.card} key={produto.id}>
                            <div className={styles.visual}>
                                {produto.foto_url ? (
                                    <img className={styles.image} src={produto.foto_url} alt={produto.nome} />
                                ) : (
                                    <div className={styles.placeholder}>
                                        <i className="pi pi-image" />
                                    </div>
                                )}
                                <label className={styles.upload}>
                                    {salvando === produto.id ? 'Salvando foto…' : 'Enviar foto'}
                                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => enviarFoto(produto, event)} />
                                </label>
                            </div>
                            <div>
                                <div className={styles.productTop}>
                                    <div>
                                        <h2>{produto.nome_original || produto.nome}</h2>
                                        <p className={styles.meta}>
                                            {produto.codigo || 'Sem código'} · Estoque: {produto.estoque} {produto.unidade} · Preço cadastrado: {dinheiro(produto.preco_estoque)}{produto.nome_loja ? ' · Nome personalizado na loja' : ''}
                                        </p>
                                    </div>
                                    <label className={styles.switch}>
                                        <VisualCheck checked={produto.ativo} onChange={(event) => alterar(produto.id, 'ativo', event.target.checked)} ariaLabel="Publicar produto na loja" />
                                        <span>Na loja</span>
                                    </label>
                                </div>
                                <div className={styles.fields}>
                                    <label className={styles.wide}>
                                        Nome exibido na loja
                                        <input
                                            maxLength={200}
                                            value={produto.nome_loja ?? produto.nome_original ?? produto.nome}
                                            placeholder={produto.nome_original || produto.nome}
                                            onChange={(event) => alterar(produto.id, 'nome_loja', event.target.value)}
                                        />
                                        <small>Altera somente o nome mostrado na lojinha. O produto do estoque, código, estoque e vínculo permanecem os mesmos.</small>
                                    </label>
                                    <label className={styles.wide}>
                                        <span className={styles.granelOption}>
                                            <VisualCheck checked={Boolean(produto.a_granel)} onChange={(event) => alterar(produto.id, 'a_granel', event.target.checked)} ariaLabel="Vender produto na aba Granel" />
                                            <span>Vender na aba Granel</span>
                                        </span>
                                        <small>O estoque será baixado em kg quando o cliente finalizar o pedido.</small>
                                    </label>
                                    {produto.a_granel && (
                                        <label>
                                            Preço por kg (R$)
                                            <input
                                                required
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                value={produto.preco_kg ?? produto.preco}
                                                onChange={(event) => {
                                                    const valor = Number(event.target.value);
                                                    alterar(produto.id, 'preco_kg', valor);
                                                    alterar(produto.id, 'preco', valor);
                                                }}
                                            />
                                        </label>
                                    )}
                                    <label>
                                        Preço na loja (R$){produto.a_granel && <small>Para granel, este campo acompanha o preço por kg.</small>}
                                        <input type="number" min="0" step="0.01" value={produto.preco} onChange={(event) => alterar(produto.id, 'preco', Number(event.target.value))} />
                                    </label>
                                    <label>
                                        Categoria
                                        <div className={styles.categoryPicker} role="group" aria-label={`Categoria de ${produto.nome}`}>
                                            <button type="button" className={`${styles.categoryChoice} ${!produto.categoria ? styles.categoryChoiceEmpty : ''}`} onClick={() => alterar(produto.id, 'categoria', '')}>
                                                <span className={styles.categoryChoiceImage}>
                                                    <i className="pi pi-slash" />
                                                </span>
                                                <strong>Sem categoria</strong>
                                            </button>
                                            {categoriasDisponiveis.map((categoria) => (
                                                <button
                                                    type="button"
                                                    key={categoria}
                                                    className={`${styles.categoryChoice} ${categoriaNormalizada(produto.categoria) === categoriaNormalizada(categoria) ? styles.categoryChoiceActive : ''}`}
                                                    onClick={() => alterar(produto.id, 'categoria', categoria)}
                                                >
                                                    <span className={styles.categoryChoiceImage}>
                                                        <img src={categoriaImagem(categoria)} alt="" />
                                                    </span>
                                                    <strong>{categoria}</strong>
                                                </button>
                                            ))}
                                        </div>
                                    </label>
                                    <label>
                                        Preço anterior (R$)
                                        <input type="number" min="0" step="0.01" value={produto.preco_original ?? ''} onChange={(event) => alterar(produto.id, 'preco_original', event.target.value === '' ? null : Number(event.target.value))} />
                                    </label>
                                    <label>
                                        Ordem na seção
                                        <input type="number" min="0" step="1" value={produto.ordem || 0} onChange={(event) => alterar(produto.id, 'ordem', Number(event.target.value))} />
                                    </label>
                                    <div className={`${styles.wide} ${styles.sectionField}`}>
                                        <span>Seções da vitrine</span>
                                        <div className={styles.sectionChecks}>
                                            {secoes.map((secao) => (
                                                <label key={secao.value}>
                                                    <VisualCheck checked={(produto.secoes || []).includes(secao.value)} onChange={() => alternarSecao(produto, secao.value)} ariaLabel={`Adicionar à seção ${secao.label}`} />
                                                    <span>{secao.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <label className={styles.wide}>
                                        Descrição comercial
                                        <textarea value={produto.descricao} placeholder="Explique o produto para o cliente" onChange={(event) => alterar(produto.id, 'descricao', event.target.value)} />
                                    </label>
                                </div>
                                <div className={styles.footer}>
                                    <button className={styles.save} disabled={salvando === produto.id} onClick={() => salvar(produto)}>
                                        {salvando === produto.id ? 'Salvando…' : 'Salvar produto'}
                                    </button>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </main>
    );
}
