'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { lojaOnlineService, LojaProduto } from '@/app/(main)/services/api/lojaOnlineService';
import styles from './Produto.module.scss';

type CarrinhoItem = LojaProduto & { quantidadeCarrinho: number };
type ModoGranel = 'valor' | 'peso';

const LOCAL_CART_KEY = 'saude_e_vida_loja_carrinho';
const dinheiro = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ProdutoPage({ params }: { params: { id: string } }) {
    const [produto, setProduto] = useState<LojaProduto | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState('');
    const [quantidade, setQuantidade] = useState(1);
    const [modoGranel, setModoGranel] = useState<ModoGranel>('valor');
    const [valorDesejado, setValorDesejado] = useState(5);
    const [gramasDesejadas, setGramasDesejadas] = useState(100);
    const [adicionado, setAdicionado] = useState(false);

    useEffect(() => {
        let ativo = true;
        lojaOnlineService.catalogoPublico()
            .then((resposta) => {
                if (!ativo) return;
                const encontrado = resposta.data.produtos.find((item) => item.id === Number(params.id));
                if (!encontrado) setErro('Produto não encontrado.');
                setProduto(encontrado || null);
            })
            .catch(() => { if (ativo) setErro('Não foi possível carregar este produto agora.'); })
            .finally(() => { if (ativo) setCarregando(false); });
        return () => { ativo = false; };
    }, [params.id]);

    const preco = useMemo(() => produto ? Number(produto.a_granel ? (produto.preco_kg || produto.preco) : produto.preco) : 0, [produto]);
    const precoAnterior = produto?.preco_original && Number(produto.preco_original) > preco ? Number(produto.preco_original) : null;
    const passo = 1;
    const quantidadeGranel = produto?.a_granel
        ? modoGranel === 'valor' ? valorDesejado / Math.max(preco, 0.01) : gramasDesejadas / 1000
        : 0;
    const valorGranel = quantidadeGranel * preco;
    const quantidadeSelecionada = produto?.a_granel ? quantidadeGranel : quantidade;
    const formatarPeso = (pesoKg: number) => pesoKg >= 1
        ? `${pesoKg.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`
        : `${(pesoKg * 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} g`;
    const quantidadeFormatada = produto?.a_granel ? formatarPeso(quantidade) : quantidade.toLocaleString('pt-BR');

    const alterarQuantidade = (delta: number) => {
        if (!produto) return;
        setQuantidade((atual) => Math.max(passo, Math.min(Number(produto.estoque), Number((atual + delta).toFixed(3)))));
        setAdicionado(false);
    };

    const adicionarCarrinho = () => {
        if (!produto || quantidadeSelecionada <= 0 || quantidadeSelecionada > produto.estoque) return;
        let carrinho: CarrinhoItem[] = [];
        try {
            const salvo = window.localStorage.getItem(LOCAL_CART_KEY);
            carrinho = salvo ? JSON.parse(salvo) as CarrinhoItem[] : [];
        } catch {
            carrinho = [];
        }
        const existente = carrinho.find((item) => item.id === produto.id);
        const novoCarrinho = existente
            ? carrinho.map((item) => item.id === produto.id ? { ...item, quantidadeCarrinho: Math.min(item.estoque, item.quantidadeCarrinho + quantidadeSelecionada) } : item)
            : [...carrinho, { ...produto, quantidadeCarrinho: quantidadeSelecionada }];
        try { window.localStorage.setItem(LOCAL_CART_KEY, JSON.stringify(novoCarrinho)); } catch { /* a loja ainda confirma a ação na tela */ }
        setAdicionado(true);
    };

    if (carregando) return <main className={styles.page}><div className={styles.state}>Carregando produto…</div></main>;
    if (erro || !produto) return <main className={styles.page}><div className={styles.state}><h1>Produto indisponível</h1><p>{erro || 'Este produto não está mais disponível na loja.'}</p><Link className={styles.backButton} href="/loja">Voltar para a loja</Link></div></main>;

    return <main className={styles.page}>
        <header className={styles.header}>
            <Link href="/loja" className={styles.brand}><span className={styles.mark}><i className="pi pi-leaf" /></span><strong>Saúde <em>e Vida</em></strong></Link>
            <Link href="/loja" className={styles.backLink}><i className="pi pi-arrow-left" /> Voltar para a loja</Link>
        </header>
        <div className={styles.content}>
            <div className={styles.breadcrumb}><Link href="/loja">Loja</Link><i className="pi pi-angle-right" /><span>{produto.nome}</span></div>
            <section className={styles.product}>
                <div className={styles.photoArea}>
                    {produto.foto_url ? <img src={produto.foto_url} alt={produto.nome} /> : <div className={styles.placeholder}><i className="pi pi-leaf" /></div>}
                </div>
                <div className={styles.info}>
                    <span className={styles.category}>{produto.a_granel ? 'GRANEL' : (produto.categoria || 'SAÚDE E VIDA')}</span>
                    <h1>{produto.nome}</h1>
                    {produto.codigo && <small className={styles.code}>Código: {produto.codigo}</small>}
                    {produto.descricao && <p className={styles.description}>{produto.descricao}</p>}
                    <div className={styles.priceBlock}>
                        {precoAnterior && <del>{dinheiro(precoAnterior)}</del>}
                        <strong>{dinheiro(preco)}</strong>
                        {produto.a_granel && <span>por kg</span>}
                    </div>
                    {produto.a_granel ? <div className={styles.bulkPurchase}>
                        <span className={styles.quantityLabel}>Venda a granel · preço por kg</span>
                        <p className={styles.bulkRule}>Escolha pelo peso para informar quantos gramas deseja ou por valor para informar quanto quer gastar. O sistema calcula automaticamente o outro valor.</p>
                        <div className={styles.bulkModes} role="tablist" aria-label="Modo de compra a granel">
                            <button type="button" className={modoGranel === 'valor' ? styles.bulkModeActive : ''} onClick={() => { setModoGranel('valor'); setAdicionado(false); }}>Por valor</button>
                            <button type="button" className={modoGranel === 'peso' ? styles.bulkModeActive : ''} onClick={() => { setModoGranel('peso'); setAdicionado(false); }}>Por peso</button>
                        </div>
                        {modoGranel === 'valor' ? <label>Quanto você quer gastar?
                            <div className={styles.inputWithPrefix}><span>R$</span><input type="number" min="0.01" max={Number((produto.estoque * preco).toFixed(2))} step="0.01" value={valorDesejado} onChange={(event) => { setValorDesejado(Math.max(0, Number(event.target.value))); setAdicionado(false); }} /></div>
                        </label> : <label>Quanto você quer comprar?
                            <div className={styles.inputWithSuffix}><input type="number" min="1" max={Math.floor(produto.estoque * 1000)} step="1" value={gramasDesejadas} onChange={(event) => { setGramasDesejadas(Math.max(0, Number(event.target.value))); setAdicionado(false); }} /><span>g</span></div>
                        </label>}
                        <div className={styles.bulkSummary}><strong>{modoGranel === 'valor' ? `${dinheiro(valorGranel)} = ${formatarPeso(quantidadeGranel)}` : `${formatarPeso(quantidadeGranel)} = ${dinheiro(valorGranel)}`}</strong><small>{formatarPeso(produto.estoque)} disponíveis · {dinheiro(preco)} por kg</small></div>
                    </div> : <div className={styles.quantityBlock}>
                        <span>Quantidade</span>
                        <div className={styles.quantityControl}>
                            <button type="button" onClick={() => alterarQuantidade(-passo)} aria-label="Diminuir quantidade">−</button>
                            <strong>{quantidadeFormatada}</strong>
                            <button type="button" onClick={() => alterarQuantidade(passo)} aria-label="Aumentar quantidade">+</button>
                        </div>
                        <small>{produto.estoque.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} unidades disponíveis</small>
                    </div>}
                    <button type="button" className={styles.addButton} onClick={adicionarCarrinho}>
                        <i className="pi pi-shopping-cart" /> {adicionado ? 'Adicionado ao carrinho' : produto.a_granel ? `Adicionar ${formatarPeso(quantidadeGranel)} ao carrinho` : 'Adicionar ao carrinho'}
                    </button>
                    {adicionado && <Link className={styles.checkoutLink} href="/loja">Continuar comprando <i className="pi pi-arrow-right" /></Link>}
                </div>
            </section>
        </div>
    </main>;
}
