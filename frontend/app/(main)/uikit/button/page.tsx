'use client';
import React, { useState, useEffect } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Dialog } from 'primereact/dialog';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { FilterMatchMode } from 'primereact/api';
import { Toast } from 'primereact/toast';
import { confirmDialog, ConfirmDialog } from 'primereact/confirmdialog';
import { Calendar } from 'primereact/calendar';
import { Divider } from 'primereact/divider';
import { Tag } from 'primereact/tag';
import { useRef } from 'react';
import { classNames } from 'primereact/utils';
import { Chart } from 'primereact/chart';
import api from '../../services/api/baseApi';
import { useRouter } from 'next/navigation';

const STORAGE_KEY = 'saudevida_orcamentos';
const DIAS_INATIVO = 30;

interface Cliente {
  id?: number;
  nomeCompleto: string;
  cpf?: string;
  cnpj?: string;
  email?: string;
  telefone: string;
  cep?: string;
  rua: string;
  bairro: string;
  cidade: string;
  estado: string;
  pais: string;
  numero: string;
  complemento?: string;
  pontoReferencia?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  data_nascimento?: string | null;
}

const ClientesPage = () => {
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteDialog, setClienteDialog] = useState(false);
  const [cliente, setCliente] = useState<Cliente>({
    nomeCompleto: '',
    telefone: '',
    rua: '',
    bairro: '',
    cidade: '',
    estado: '',
    pais: 'Brasil',
    numero: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [filters, setFilters] = useState({
    global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    bairro: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS }
  });
  const [globalFilterValue, setGlobalFilterValue] = useState('');
  const toast = useRef<Toast>(null);
  const [loading, setLoading] = useState(false);
  const [visualizarDialog, setVisualizarDialog] = useState(false);
  const [clienteVisualizado, setClienteVisualizado] = useState<Cliente | null>(null);
  const [filtroDataInicio, setFiltroDataInicio] = useState<Date | null>(null);
  const [filtroDataFim, setFiltroDataFim] = useState<Date | null>(null);
  const [orcamentosCliente, setOrcamentosCliente] = useState<any[]>([]);
  const [comprasCliente, setComprasCliente] = useState<any[]>([]);
  const [loadingCompras, setLoadingCompras] = useState(false);
  // cliente_id → { ultima_compra, total_compras, tem_recorrencia_ativa }
  const [atividadeClientes, setAtividadeClientes] = useState<Record<number, { ultima_compra: string | null; total_compras: number; tem_recorrencia_ativa: boolean }>>({});
  const [mostrarApenasInativos, setMostrarApenasInativos] = useState(false);
  const [aniversariantesHoje, setAniversariantesHoje] = useState<Cliente[]>([]);
  const [anivDialog, setAnivDialog] = useState(false);

  // ── CMV ──
  const [cmvDialog, setCmvDialog] = useState(false);
  const [cmvLoading, setCmvLoading] = useState(false);
  const [cmvVendas, setCmvVendas] = useState<any[]>([]);
  const [cmvClienteDetalhe, setCmvClienteDetalhe] = useState<any>(null);
  const [cmvInativFaixa, setCmvInativFaixa] = useState<{ label: string; lista: any[] } | null>(null);
  const [cmvPeriodo, setCmvPeriodo] = useState<'semana' | 'mes' | 'ano' | 'custom'>('mes');
  const [cmvDataInicio, setCmvDataInicio] = useState<Date | null>(null);
  const [cmvDataFim, setCmvDataFim] = useState<Date | null>(null);

  const fetchCMVData = async () => {
    setCmvLoading(true);
    try {
      const res = await api.get('/vendas');
      setCmvVendas(Array.isArray(res.data) ? res.data : []);
    } catch {
      setCmvVendas([]);
    } finally {
      setCmvLoading(false);
    }
  };

  const abrirCMV = () => {
    setCmvDialog(true);
    fetchCMVData();
  };

  const cmvVendasFiltradas = (() => {
    const agora = new Date();
    let inicio: Date | null = null;
    let fim: Date | null = new Date(agora);
    fim.setHours(23, 59, 59, 999);

    if (cmvPeriodo === 'semana') {
      inicio = new Date(agora);
      inicio.setDate(agora.getDate() - 6);
      inicio.setHours(0, 0, 0, 0);
    } else if (cmvPeriodo === 'mes') {
      inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
    } else if (cmvPeriodo === 'ano') {
      inicio = new Date(agora.getFullYear(), 0, 1);
    } else {
      inicio = cmvDataInicio ? new Date(cmvDataInicio) : null;
      fim = cmvDataFim ? new Date(cmvDataFim) : null;
      if (fim) fim.setHours(23, 59, 59, 999);
    }

    return cmvVendas.filter(v => {
      const d = new Date(v.data ?? v.createdAt);
      if (inicio && d < inicio) return false;
      if (fim && d > fim) return false;
      return true;
    });
  })();

  const calcCMV = (vendas: any[]) => {
    const totalFaturado = vendas.reduce((s, v) => s + Number(v.valor_total ?? 0), 0);
    const totalPedidos = vendas.length;
    const ticketMedio = totalPedidos > 0 ? totalFaturado / totalPedidos : 0;

    const hoje = Date.now();
    const faixas = { ate20: [] as any[], de21a90: [] as any[], de91a180: [] as any[], mais180: [] as any[] };
    clientes.forEach((c: any) => {
      const ativ = atividadeClientes[c.id];
      if (!ativ?.ultima_compra) { faixas.mais180.push(c); return; }
      const dias = (hoje - new Date(ativ.ultima_compra).getTime()) / (1000 * 60 * 60 * 24);
      if (dias <= 20) faixas.ate20.push(c);
      else if (dias <= 90) faixas.de21a90.push(c);
      else if (dias <= 180) faixas.de91a180.push(c);
      else faixas.mais180.push(c);
    });

    // Top clientes por valor (com cliente_id para detalhe)
    const gastos: Record<number, { id: number; nome: string; total: number; pedidos: number }> = {};
    vendas.forEach(v => {
      const id = v.cliente_id ?? 0;
      const nome = v.cliente?.nomeCompleto ?? 'Consumidor Final (em loja)';
      if (!gastos[id]) gastos[id] = { id, nome, total: 0, pedidos: 0 };
      gastos[id].total += Number(v.valor_total ?? 0);
      gastos[id].pedidos += 1;
    });
    const topClientes = Object.values(gastos).sort((a, b) => b.total - a.total).slice(0, 10);

    // Locais com mais pedidos
    const porLocal: Record<string, { bairro: string; cidade: string; clientesSet: Set<any>; total: number }> = {};
    vendas.forEach(v => {
      if (!v.cliente_id) return;
      const c = clientes.find((x: any) => x.id === v.cliente_id) as any;
      if (!c || (!c.bairro && !c.cidade)) return;
      const key = `${c.bairro ?? ''}|${c.cidade ?? ''}`;
      if (!porLocal[key]) porLocal[key] = { bairro: c.bairro ?? '-', cidade: c.cidade ?? '-', clientesSet: new Set(), total: 0 };
      porLocal[key].total += Number(v.valor_total ?? 0);
      porLocal[key].clientesSet.add(c.id);
    });
    const locais = Object.values(porLocal)
      .map(l => ({ bairro: l.bairro, cidade: l.cidade, clientes: l.clientesSet.size, total: l.total }))
      .sort((a, b) => b.total - a.total).slice(0, 8);

    // Produtos mais comprados (geral)
    const produtosGeral: Record<string, { nome: string; qtd: number; total: number }> = {};
    vendas.forEach(v => {
      (v.itens ?? []).forEach((it: any) => {
        const nome = it.produto?.name ?? it.Product?.name ?? `Produto #${it.produto_id}`;
        if (!produtosGeral[nome]) produtosGeral[nome] = { nome, qtd: 0, total: 0 };
        produtosGeral[nome].qtd += Number(it.quantidade ?? 0);
        produtosGeral[nome].total += Number(it.valor_total ?? 0);
      });
    });
    const topProdutos = Object.values(produtosGeral).sort((a, b) => b.qtd - a.qtd).slice(0, 10);

    // Produtos por cliente (para detalhe)
    const produtosPorCliente: Record<number, { nome: string; qtd: number; total: number }[]> = {};
    vendas.forEach(v => {
      const cid = v.cliente_id ?? 0;
      if (!produtosPorCliente[cid]) produtosPorCliente[cid] = [];
      (v.itens ?? []).forEach((it: any) => {
        const nome = it.produto?.name ?? it.Product?.name ?? `Produto #${it.produto_id}`;
        const ex = produtosPorCliente[cid].find(p => p.nome === nome);
        if (ex) { ex.qtd += Number(it.quantidade ?? 0); ex.total += Number(it.valor_total ?? 0); }
        else produtosPorCliente[cid].push({ nome, qtd: Number(it.quantidade ?? 0), total: Number(it.valor_total ?? 0) });
      });
    });

    // Charts
    const chartTopClientes = {
      labels: topClientes.slice(0, 8).map(c => c.nome.split(' ')[0]),
      datasets: [{ label: 'Total Gasto (R$)', data: topClientes.slice(0, 8).map(c => c.total), backgroundColor: ['#1e88e5','#43a047','#fb8c00','#8e24aa','#e53935','#00897b','#f4511e','#3949ab'] }]
    };
    const chartTopProdutos = {
      labels: topProdutos.slice(0, 8).map(p => p.nome.length > 15 ? p.nome.slice(0, 15) + '…' : p.nome),
      datasets: [{ label: 'Quantidade vendida', data: topProdutos.slice(0, 8).map(p => p.qtd), backgroundColor: '#1e88e5' }]
    };

    return { totalFaturado, totalPedidos, ticketMedio, faixas, ativos: faixas.ate20.length, topClientes, locais, topProdutos, produtosPorCliente, chartTopClientes, chartTopProdutos };
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
    }
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    setLoading(true);
    try {
      const [clientesRes, atividadeRes] = await Promise.all([
        api.get('/clientes'),
        api.get('/financeiro/vendas/ultima-compra').catch(() => ({ data: [] }))
      ]);
      const lista: Cliente[] = clientesRes.data.data || [];
      setClientes(lista);

      // Aniversariantes de hoje (compara dia e mês, ignora ano)
      const hoje = new Date();
      const diaHoje = hoje.getDate();
      const mesHoje = hoje.getMonth(); // 0-indexed
      setAniversariantesHoje(lista.filter(c => {
        if (!c.data_nascimento) return false;
        const nasc = new Date(c.data_nascimento + 'T12:00:00'); // evita timezone shift
        return nasc.getDate() === diaHoje && nasc.getMonth() === mesHoje;
      }));

      const mapa: Record<number, { ultima_compra: string | null; total_compras: number; tem_recorrencia_ativa: boolean }> = {};
      for (const row of (atividadeRes.data ?? [])) {
        mapa[row.cliente_id] = {
          ultima_compra: row.ultima_compra ?? null,
          total_compras: Number(row.total_compras),
          tem_recorrencia_ativa: row.tem_recorrencia_ativa === true || row.tem_recorrencia_ativa === 't',
        };
      }
      setAtividadeClientes(mapa);
    } catch (error: any) {
      console.error('Erro ao buscar clientes:', error);
      showError(error.response?.data?.message || 'Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  const isClienteInativo = (c: Cliente): boolean => {
    const ativ = atividadeClientes[(c as any).id];
    if (!ativ) return true; // nunca comprou e sem recorrência
    if (ativ.tem_recorrencia_ativa) return false; // recorrência ativa = cliente ativo
    if (!ativ.ultima_compra) return true;
    const dias = (Date.now() - new Date(ativ.ultima_compra).getTime()) / (1000 * 60 * 60 * 24);
    return dias > DIAS_INATIVO;
  };

  const showError = (message: string) => {
    toast.current?.show({
      severity: 'error',
      summary: 'Erro',
      detail: message,
      life: 5000
    });
  };

  const showSuccess = (message: string) => {
    toast.current?.show({
      severity: 'success',
      summary: 'Sucesso',
      detail: message,
      life: 3000
    });
  };

  const buscarCEP = async (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        const data = await response.json();
        
        if (!data.erro) {
          setCliente(prev => ({
            ...prev,
            rua: data.logradouro || '',
            bairro: data.bairro || '',
            cidade: data.localidade || '',
            estado: data.uf || '',
            cep: formatarCEP(cepLimpo)
          }));
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      }
    }
  };

  // Formata CPF para 123.456.789-09
  const formatarCPF = (cpf: string) => {
    const nums = cpf.replace(/\D/g, '');
    return nums.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  // Formata CNPJ para 00.000.000/0000-00
  const formatarCNPJ = (cnpj: string) => {
    const nums = cnpj.replace(/\D/g, '');
    return nums.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  // Formata CEP para 12345-678
  const formatarCEP = (cep: string) => {
    const nums = cep.replace(/\D/g, '');
    return nums.replace(/(\d{5})(\d{3})/, '$1-$2');
  };

  // Remove formatação do telefone (mantém apenas números)
  const formatarTelefone = (telefone: string) => {
    return telefone.replace(/\D/g, '');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Aplica formatação automática para CPF e CNPJ
    let valorFormatado = value;
    if (name === 'cpf') {
      valorFormatado = formatarCPF(value);
    } else if (name === 'cnpj') {
      valorFormatado = formatarCNPJ(value);
    }
    
    setCliente(prev => ({
      ...prev,
      [name]: valorFormatado
    }));

    if (name === 'cep') {
      buscarCEP(value);
    }
  };

  const openNew = () => {
    setCliente({
      nomeCompleto: '',
      telefone: '',
      rua: '',
      bairro: '',
      cidade: '',
      estado: '',
      pais: 'Brasil',
      numero: ''
    });
    setSubmitted(false);
    setClienteDialog(true);
  };

  const hideDialog = () => {
    setSubmitted(false);
    setClienteDialog(false);
  };

  const saveCliente = async () => {
    setSubmitted(true);

    // Validação frontend dos campos obrigatórios (apenas nome e telefone)
    const requiredFields = [
      'nomeCompleto', 'telefone'
    ];

    const missingFields = requiredFields.filter(field => !cliente[field as keyof typeof cliente]);

    if (missingFields.length > 0) {
      showError(`Preencha os campos obrigatórios: ${missingFields.join(', ')}`);
      return;
    }

    try {
      // Prepara os dados no formato EXATO que o backend espera
      const payload = {
        nomeCompleto: cliente.nomeCompleto.trim(),
        cpf: cliente.cpf ? formatarCPF(cliente.cpf.replace(/\D/g, '')) : null,
        cnpj: cliente.cnpj ? formatarCNPJ(cliente.cnpj.replace(/\D/g, '')) : null,
        email: cliente.email?.trim() || null,
        telefone: formatarTelefone(cliente.telefone),
        cep: cliente.cep ? formatarCEP(cliente.cep.replace(/\D/g, '')) : null,
        rua: cliente.rua?.trim() || null,
        bairro: cliente.bairro?.trim() || null,
        cidade: cliente.cidade?.trim() || null,
        estado: cliente.estado?.trim().substring(0, 2).toUpperCase() || null,
        pais: cliente.pais?.trim() || 'Brasil',
        numero: cliente.numero?.trim() || null,
        complemento: cliente.complemento?.trim() || null,
        pontoReferencia: cliente.pontoReferencia?.trim() || null,
        inscricao_estadual: cliente.inscricao_estadual?.trim() || null,
        data_nascimento: cliente.data_nascimento || null
      };

      console.log('Enviando payload:', payload);

      let response;
      if (cliente.id) {
        response = await api.put(`/clientes/${cliente.id}`, payload);
      } else {
        response = await api.post('/clientes', payload);
      }

      showSuccess('Cliente salvo com sucesso!');
      fetchClientes();
      setClienteDialog(false);
    } catch (error: any) {
      console.error('Erro completo:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        config: error.config
      });

      if (error.response?.status === 422) {
        const errors = error.response.data?.errors || {};
        const errorMessages = Object.entries(errors)
          .map(([field, messages]) => `${field}: ${(messages as string[]).join(', ')}`)
          .join('\n');
        showError(`Erros de validação:\n${errorMessages}`);
      } else {
        showError(error.response?.data?.message || 'Erro ao salvar cliente');
      }
    }
  };

  const editCliente = (clienteToEdit: Cliente) => {
    setCliente({
      ...clienteToEdit,
      cpf: clienteToEdit.cpf ? formatarCPF(clienteToEdit.cpf) : '',
      cnpj: clienteToEdit.cnpj ? formatarCNPJ(clienteToEdit.cnpj) : '',
      telefone: formatarTelefone(clienteToEdit.telefone),
      cep: clienteToEdit.cep ? formatarCEP(clienteToEdit.cep) : '',
      data_nascimento: clienteToEdit.data_nascimento ?? null
    });
    setClienteDialog(true);
  };

  const confirmDelete = (clienteToDelete: Cliente) => {
    confirmDialog({
      message: `Deseja realmente excluir o cliente "${clienteToDelete.nomeCompleto}"?`,
      header: 'Confirmar exclusão',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sim, excluir',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: () => deleteCliente(clienteToDelete)
    });
  };

  const deleteCliente = async (clienteToDelete: Cliente) => {
    if (!clienteToDelete.id) return;

    try {
      await api.delete(`/clientes/${clienteToDelete.id}`);
      showSuccess('Cliente removido com sucesso');
      fetchClientes();
    } catch (error: any) {
      console.error('Erro ao remover cliente:', error);
      showError(error.response?.data?.message || 'Erro ao remover cliente');
    }
  };

  const fmtMoeda = (val: number) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtData = (val: any) => { try { return new Date(val).toLocaleDateString('pt-BR'); } catch { return '-'; } };

  const calcularTotal = (produtos: any[], desconto: number, tipoDesconto = 'percent', descontoValor = 0) => {
    const subtotal = produtos.reduce((t: number, p: any) => t + p.preco * p.quantidade, 0);
    if (tipoDesconto === 'valor') return Math.max(0, subtotal - descontoValor);
    return subtotal - subtotal * (desconto / 100);
  };

  const abrirVisualizacao = async (c: Cliente) => {
    setClienteVisualizado(c);
    setFiltroDataInicio(null);
    setFiltroDataFim(null);
    setComprasCliente([]);
    setVisualizarDialog(true);

    try {
      const res = await api.get('/orcamentos', { params: { nome_cliente: c.nomeCompleto } });
      const data = res.data?.data ?? res.data ?? [];
      setOrcamentosCliente(data.map((o: any) => ({
        id: o.id, numero: o.numero, nomeCliente: o.nome_cliente,
        dataOrcamento: o.data_orcamento, validadeOrcamento: o.validade_orcamento,
        funcionario: o.funcionario_nome ?? '-',
        produtos: (o.itens ?? []).map((it: any) => ({ id: it.produto_id ?? 0, nome: it.nome, preco: Number(it.preco), quantidade: Number(it.quantidade) })),
        desconto: Number(o.desconto ?? 0),
        descontoValor: Number(o.desconto_valor ?? 0),
        tipoDesconto: o.tipo_desconto ?? 'percent'
      })));
    } catch {
      setOrcamentosCliente([]);
    }

    await fetchComprasCliente(c, null, null);
  };

  const fetchComprasCliente = async (c: Cliente, dataInicio: Date | null, dataFim: Date | null) => {
    if (!(c as any).id) return;
    setLoadingCompras(true);
    try {
      const params: Record<string, any> = { cliente_id: (c as any).id };
      if (dataInicio) params.dataInicio = dataInicio.toISOString();
      if (dataFim) { const fim = new Date(dataFim); fim.setHours(23, 59, 59); params.dataFim = fim.toISOString(); }
      const res = await api.get('/financeiro/vendas', { params });
      setComprasCliente((res.data ?? []).map((v: any) => ({
        id: v.id,
        dataVenda: v.data,
        funcionario: { id: v.funcionario_id, nome: v.funcionario_nome },
        produtos: (v.itens ?? []).map((it: any) => ({ nome: it.nome, quantidade: Number(it.quantidade), valor: Number(it.valor_unitario) })),
        pagamentos: v.pagamentos ?? [{ forma: v.forma_pagamento, valor: Number(v.valor_total) }],
        formaPagamento: v.forma_pagamento,
        tipoCartao: v.tipo_cartao,
        parcelas: v.parcelas,
        comNota: v.com_nota,
        valorTotal: Number(v.valor_total),
      })));
    } catch {
      setComprasCliente([]);
    } finally {
      setLoadingCompras(false);
    }
  };

  const aplicarFiltroData = () => {
    if (!clienteVisualizado) return;
    api.get('/orcamentos', {
      params: {
        nome_cliente: clienteVisualizado.nomeCompleto,
        dataInicio: filtroDataInicio?.toISOString(),
        dataFim: filtroDataFim?.toISOString()
      }
    }).then(res => {
      const data = res.data?.data ?? res.data ?? [];
      setOrcamentosCliente(data.map((o: any) => ({
        id: o.id, numero: o.numero, nomeCliente: o.nome_cliente,
        dataOrcamento: o.data_orcamento, validadeOrcamento: o.validade_orcamento,
        funcionario: o.funcionario_nome ?? '-',
        produtos: (o.itens ?? []).map((it: any) => ({ id: it.produto_id ?? 0, nome: it.nome, preco: Number(it.preco), quantidade: Number(it.quantidade) })),
        desconto: Number(o.desconto ?? 0),
        descontoValor: Number(o.desconto_valor ?? 0),
        tipoDesconto: o.tipo_desconto ?? 'percent'
      })));
    }).catch(() => setOrcamentosCliente([]));

    fetchComprasCliente(clienteVisualizado, filtroDataInicio, filtroDataFim);
  };

  const actionBodyTemplate = (rowData: Cliente) => {
    return (
      <div className="flex gap-2">
        <Button
          icon="pi pi-eye"
          rounded outlined
          style={{ borderColor: '#1565c0', color: '#1565c0' }}
          onClick={() => abrirVisualizacao(rowData)}
          tooltip="Visualizar" tooltipOptions={{ position: 'top' }}
        />
        <Button
          icon="pi pi-pencil"
          rounded outlined
          style={{ borderColor: '#1565c0', color: '#1565c0' }}
          onClick={() => editCliente(rowData)}
          tooltip="Editar" tooltipOptions={{ position: 'top' }}
        />
        <Button
          icon="pi pi-trash"
          rounded outlined severity="danger"
          onClick={() => confirmDelete(rowData)}
          tooltip="Excluir" tooltipOptions={{ position: 'top' }}
        />
      </div>
    );
  };

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    let _filters = { ...filters };
    _filters['global'].value = value;
    setFilters(_filters);
    setGlobalFilterValue(value);
  };

  const clienteDialogFooter = (
    <React.Fragment>
      <Button label="Cancelar" icon="pi pi-times" rounded outlined style={{ borderColor: '#1565c0', color: '#1565c0' }} onClick={hideDialog} />
      <Button label="Salvar" icon="pi pi-check" rounded outlined style={{ borderColor: '#1565c0', color: '#1565c0' }} onClick={saveCliente} />
    </React.Fragment>
  );

  return (
    <div className="grid">
      <Toast ref={toast} />
      <ConfirmDialog />
      <div className="col-12">
        <div className="card">
          <div className="flex justify-content-between align-items-center mb-4">
            <h5>Gerenciar Clientes</h5>
            <div className="flex gap-2 align-items-center">
              {/* Botão Aniversariantes */}
              <div style={{ position: 'relative', display: 'inline-flex' }}>
                <Button
                  label="Aniversariantes do dia"
                  icon="pi pi-gift"
                  onClick={() => setAnivDialog(true)}
                  style={{ background: '#fae8ff', color: '#7e22ce', border: '1px solid #d8b4fe' }}
                  className="p-button-text"
                />
                {aniversariantesHoje.length > 0 && (
                  <span style={{
                    position: 'absolute', top: -6, right: -6,
                    background: '#c026d3', color: '#fff',
                    borderRadius: '50%', width: 20, height: 20,
                    fontSize: 11, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none'
                  }}>
                    {aniversariantesHoje.length}
                  </span>
                )}
              </div>
              <Button
                label="Análise de Clientes"
                icon="pi pi-chart-bar"
                onClick={abrirCMV}
                style={{ background: '#1e3a5f', color: '#fff', border: 'none' }}
              />
              <Button
                label="Novo Cliente"
                icon="pi pi-plus"
                onClick={openNew}
                className="p-button-primary"
              />
            </div>
          </div>

          <div className="flex justify-content-between mb-4">
            <span className="p-input-icon-left w-full mr-2">
              <i className="pi pi-search" />
              <InputText
                value={globalFilterValue}
                onChange={onGlobalFilterChange}
                placeholder="Pesquisar clientes..."
                className="w-full"
              />
            </span>
          </div>

          {/* ── Banner de clientes inativos ── */}
          {(() => {
            const inativos = clientes.filter(isClienteInativo);
            if (inativos.length === 0 || loading) return null;
            return (
              <div className="flex align-items-center justify-content-between mb-3 p-3 border-round"
                style={{ background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: '8px' }}>
                <div className="flex align-items-center gap-2">
                  <i className="pi pi-exclamation-triangle" style={{ color: '#d97706', fontSize: '1.1rem' }} />
                  <span style={{ color: '#92400e', fontWeight: 600 }}>
                    {inativos.length} cliente{inativos.length > 1 ? 's' : ''} sem compras nos últimos {DIAS_INATIVO} dias
                  </span>
                </div>
                <Button
                  label={mostrarApenasInativos ? 'Mostrar todos' : 'Ver inativos'}
                  icon={mostrarApenasInativos ? 'pi pi-list' : 'pi pi-filter'}
                  size="small"
                  text
                  style={{ color: '#d97706' }}
                  onClick={() => setMostrarApenasInativos(v => !v)}
                />
              </div>
            );
          })()}

          <DataTable
            value={mostrarApenasInativos ? clientes.filter(isClienteInativo) : clientes}
            paginator
            rows={10}
            rowsPerPageOptions={[5, 10, 25, 50]}
            filters={filters}
            filterDisplay="menu"
            loading={loading}
            globalFilterFields={['nomeCompleto', 'telefone', 'cpf', 'cnpj', 'bairro', 'cidade']}
            emptyMessage="Nenhum cliente encontrado."
            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} clientes"
            paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
          >
            <Column header="Nome" sortable field="nomeCompleto" style={{ minWidth: '200px' }} body={(c: Cliente) => {
              const inativo = isClienteInativo(c);
              const ativ = atividadeClientes[(c as any).id];
              const tooltip = inativo
                ? (ativ?.ultima_compra ? `Última compra: ${fmtData(ativ.ultima_compra)}` : 'Nunca realizou uma compra')
                : undefined;
              return (
                <div className="flex align-items-center gap-2">
                  <span>{c.nomeCompleto}</span>
                  {inativo && (
                    <Tag value="Inativo" severity="warning" style={{ fontSize: '0.7rem' }}
                      title={tooltip} />
                  )}
                </div>
              );
            }} />
            <Column field="telefone" header="Telefone" sortable style={{ minWidth: '150px' }} />
            <Column field="cpf" header="CPF" style={{ minWidth: '150px' }} />
            <Column field="cnpj" header="CNPJ" style={{ minWidth: '180px' }} />
            <Column field="bairro" header="Bairro" sortable filter filterPlaceholder="Pesquisar por bairro" style={{ minWidth: '150px' }} />
            <Column field="cidade" header="Cidade" sortable style={{ minWidth: '150px' }} />
            <Column field="estado" header="UF" style={{ minWidth: '80px' }} />
            <Column body={actionBodyTemplate} exportable={false} style={{ minWidth: '120px' }}></Column>
          </DataTable>
        </div>
      </div>

      {/* ── DIALOG ANIVERSARIANTES DO DIA ── */}
      <Dialog
        header={<div className="flex align-items-center gap-2"><i className="pi pi-gift" style={{ color: '#c026d3' }} /><span>Aniversariantes de hoje</span></div>}
        visible={anivDialog}
        style={{ width: '480px' }}
        modal
        onHide={() => setAnivDialog(false)}
        footer={<Button label="Fechar" icon="pi pi-times" className="p-button-text" onClick={() => setAnivDialog(false)} />}
      >
        {aniversariantesHoje.length === 0 ? (
          <div className="text-center text-color-secondary py-4">
            <i className="pi pi-calendar-times mb-2 block" style={{ fontSize: '2rem', color: '#d8b4fe' }} />
            <p>Nenhum aniversariante hoje.</p>
          </div>
        ) : (
          <div className="flex flex-column gap-3 pt-2">
            {aniversariantesHoje.map(c => {
              const idade = c.data_nascimento
                ? new Date().getFullYear() - new Date(c.data_nascimento + 'T12:00:00').getFullYear()
                : null;
              return (
                <div key={c.id} className="flex align-items-center justify-content-between p-3 border-round"
                  style={{ background: 'linear-gradient(135deg, #fdf4ff, #fce7f3)', border: '1px solid #e879f9' }}>
                  <div className="flex align-items-center gap-3">
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: '#c026d3', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, flexShrink: 0
                    }}>🎂</div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#1f2937' }}>{c.nomeCompleto}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        {c.telefone && <span><i className="pi pi-phone mr-1" style={{ fontSize: 10 }} />{c.telefone}</span>}
                        {idade !== null && <span style={{ marginLeft: 8, color: '#c026d3', fontWeight: 600 }}>{idade} anos hoje 🎉</span>}
                      </div>
                    </div>
                  </div>
                  <Button
                    icon="pi pi-eye"
                    rounded text
                    style={{ color: '#7e22ce' }}
                    onClick={() => { setAnivDialog(false); abrirVisualizacao(c); }}
                    tooltip="Ver detalhes"
                    tooltipOptions={{ position: 'left' }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Dialog>

      {/* ── DIALOG VISUALIZAR CLIENTE ── */}
      <Dialog visible={visualizarDialog} style={{ width: '700px' }}
        header={clienteVisualizado?.nomeCompleto}
        modal onHide={() => setVisualizarDialog(false)}
        footer={<Button label="Fechar" icon="pi pi-times" rounded outlined style={{ borderColor: '#1565c0', color: '#1565c0' }} onClick={() => setVisualizarDialog(false)} />}>
        {clienteVisualizado && (
          <div>
            {/* Info do cliente */}
            <div style={{ background: 'linear-gradient(160deg,#1a3a6b,#1565c0,#1e88e5)', borderRadius: '8px', padding: '1rem 1.25rem', marginBottom: '1rem', color: '#fff' }}>
              <div className="flex justify-content-between">
                <div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>CPF: {clienteVisualizado.cpf || '-'}</div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>CNPJ: {clienteVisualizado.cnpj || '-'}</div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Email: {clienteVisualizado.email || '-'}</div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Tel: {clienteVisualizado.telefone}</div>
                  {clienteVisualizado.inscricao_estadual && (
                    <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>IE: {clienteVisualizado.inscricao_estadual}</div>
                  )}
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.85rem', opacity: 0.8 }}>
                  <div>{clienteVisualizado.rua}, {clienteVisualizado.numero}</div>
                  <div>{clienteVisualizado.complemento && `${clienteVisualizado.complemento} — `}{clienteVisualizado.bairro}</div>
                  <div>{clienteVisualizado.cidade}/{clienteVisualizado.estado} — {clienteVisualizado.cep}</div>
                  <div>{clienteVisualizado.pais}</div>
                </div> 
              </div>
            </div>

            <Divider align="left"><span className="font-bold text-sm">Histórico de Orçamentos</span></Divider>

            {/* Filtro por data */}
            <div className="flex gap-2 align-items-end mb-3">
              <div>
                <label className="block mb-1 text-sm">De</label>
                <Calendar value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.value as Date)} dateFormat="dd/mm/yy" mask="99/99/9999" readOnlyInput={false} showIcon placeholder="DD/MM/AAAA" />
              </div>
              <div>
                <label className="block mb-1 text-sm">Até</label>
                <Calendar value={filtroDataFim} onChange={e => setFiltroDataFim(e.value as Date)} dateFormat="dd/mm/yy" mask="99/99/9999" readOnlyInput={false} showIcon placeholder="DD/MM/AAAA" />
              </div>
              <Button label="Filtrar" icon="pi pi-filter" rounded outlined style={{ borderColor: '#1565c0', color: '#1565c0' }} onClick={aplicarFiltroData} />
              <Button icon="pi pi-times" rounded outlined severity="secondary" tooltip="Limpar filtro"
                onClick={() => {
                  setFiltroDataInicio(null);
                  setFiltroDataFim(null);
                  if (clienteVisualizado) fetchComprasCliente(clienteVisualizado, null, null);
                }} />
            </div>

            <DataTable value={orcamentosCliente} emptyMessage="Nenhum orçamento encontrado." className="p-datatable-sm">
              <Column field="numero" header="Nº" style={{ width: '5rem' }} />
              <Column header="Data" body={(r: any) => fmtData(r.dataOrcamento)} />
              <Column header="Válido até" body={(r: any) => fmtData(r.validadeOrcamento)} />
              <Column field="funcionario" header="Responsável" />
              <Column header="Total" body={(r: any) => fmtMoeda(calcularTotal(r.produtos, r.desconto, r.tipoDesconto, r.descontoValor))} />
            </DataTable>

            {orcamentosCliente.length > 0 && (
              <div style={{ marginTop: '0.75rem', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)', borderRadius: '8px', padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#166534', fontWeight: 600 }}>Total em orçamentos no período</span>
                <span style={{ color: '#15803d', fontWeight: 700, fontSize: '1.1rem' }}>
                  {fmtMoeda(orcamentosCliente.reduce((acc, o) => acc + calcularTotal(o.produtos, o.desconto, o.tipoDesconto, o.descontoValor), 0))}
                </span>
              </div>
            )}

            <Divider align="left"><span className="font-bold text-sm">Histórico de Compras</span></Divider>

            {loadingCompras ? (
              <div className="flex align-items-center justify-content-center py-3 gap-2 text-color-secondary">
                <i className="pi pi-spin pi-spinner" /> Carregando compras...
              </div>
            ) : (
              <>
                <DataTable value={comprasCliente} emptyMessage="Nenhuma compra registrada." className="p-datatable-sm">
                  <Column header="Data" body={(r: any) => fmtData(r.dataVenda)} style={{ width: '7rem' }} />
                  <Column header="Funcionário" body={(r: any) => r.funcionario?.nome ?? '-'} />
                  <Column header="Itens" body={(r: any) => {
                    const nomes = (r.produtos ?? []).map((p: any) => `${p.nome} (x${p.quantidade})`).join(', ');
                    const total = (r.produtos ?? []).reduce((s: number, p: any) => s + (p.quantidade || 0), 0);
                    return <span title={nomes}>{total} item{total !== 1 ? 's' : ''}</span>;
                  }} />
                  <Column header="Pagamento" body={(r: any) => {
                    if (r.pagamentos?.length > 1) return r.pagamentos.map((p: any) => p.forma === 'CARTAO' ? 'Cartão' : p.forma === 'DINHEIRO' ? 'Dinheiro' : 'PIX').join(' + ');
                    if (r.formaPagamento === 'CARTAO') return r.tipoCartao === 'credito' ? `Crédito ${r.parcelas ?? 1}x` : 'Débito';
                    return r.formaPagamento === 'DINHEIRO' ? 'Dinheiro' : r.formaPagamento === 'PIX' ? 'PIX' : r.formaPagamento ?? '-';
                  }} />
                  <Column header="NF" body={(r: any) => r.comNota ? 'Sim' : 'Não'} style={{ width: '4rem' }} />
                  <Column header="Total" body={(r: any) => fmtMoeda(r.valorTotal || 0)} style={{ width: '8rem' }} />
                </DataTable>

                {comprasCliente.length > 0 && (
                  <div style={{ marginTop: '0.75rem', background: 'rgba(30,136,229,0.10)', border: '1px solid rgba(30,136,229,0.35)', borderRadius: '8px', padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#0d47a1', fontWeight: 600 }}>Total comprado no período</span>
                    <span style={{ color: '#1565c0', fontWeight: 700, fontSize: '1.1rem' }}>
                      {fmtMoeda(comprasCliente.reduce((acc, c) => acc + (c.valorTotal || 0), 0))}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Dialog>

      <Dialog
        visible={clienteDialog}
        style={{ width: '36rem' }}
        breakpoints={{ '960px': '75vw', '641px': '90vw' }}
        header="Detalhes do Cliente"
        modal
        className="p-fluid"
        footer={clienteDialogFooter}
        onHide={hideDialog}
      >
        {/* Informações Básicas */}
        <div className="field">
          <label htmlFor="nomeCompleto" className="font-bold">
            Nome Completo *
          </label>
          <InputText
            id="nomeCompleto"
            name="nomeCompleto"
            value={cliente.nomeCompleto}
            onChange={handleInputChange}
            required
            autoFocus
            className={classNames({ 'p-invalid': submitted && !cliente.nomeCompleto })}
          />
          {submitted && !cliente.nomeCompleto && <small className="p-error">Nome é obrigatório.</small>}
        </div>

        <div className="grid">
          <div className="col-12 md:col-6 field">
            <label htmlFor="cpf" className="font-bold">
              CPF
            </label>
            <InputText
              id="cpf"
              name="cpf"
              value={cliente.cpf || ''}
              onChange={handleInputChange}
              placeholder="000.000.000-00"
              keyfilter="num"
            />
            <small className="text-color-secondary">Opcional, mas recomendado</small>
          </div>
          <div className="col-12 md:col-6 field">
            <label htmlFor="cnpj" className="font-bold">
              CNPJ
            </label>
            <InputText
              id="cnpj"
              name="cnpj"
              value={cliente.cnpj || ''}
              onChange={handleInputChange}
              placeholder="00.000.000/0000-00"
              keyfilter="num"
            />
            <small className="text-color-secondary">Opcional (preencha CPF ou CNPJ)</small>
          </div>
        </div>

        <div className="grid">
          <div className="col-6 field">
            <label htmlFor="email" className="font-bold">
              Email
            </label>
            <InputText
              id="email"
              name="email"
              value={cliente.email || ''}
              onChange={handleInputChange}
              placeholder="cliente@exemplo.com"
            />
            <small className="text-color-secondary">Opcional</small>
          </div>
          <div className="col-6 field">
            <label htmlFor="data_nascimento" className="font-bold">
              Data de Nascimento
            </label>
            <Calendar
              id="data_nascimento"
              value={cliente.data_nascimento ? new Date(cliente.data_nascimento + 'T12:00:00') : null}
              onChange={(e) => setCliente(prev => ({
                ...prev,
                data_nascimento: e.value ? (e.value as Date).toISOString().split('T')[0] : null
              }))}
              dateFormat="dd/mm/yy"
              mask="99/99/9999"
              readOnlyInput={false}
              showIcon
              placeholder="DD/MM/AAAA"
              className="w-full"
              showButtonBar
            />
            <small className="text-color-secondary">Opcional — para alerta de aniversário</small>
          </div>
        </div>

        <div className="field">
          <label htmlFor="telefone" className="font-bold">
            Telefone *
          </label>
          <InputText
            id="telefone"
            name="telefone"
            value={cliente.telefone}
            onChange={handleInputChange}
            required
            placeholder="11999998888"
            keyfilter="num"
            className={classNames({ 'p-invalid': submitted && !cliente.telefone })}
          />
          {submitted && !cliente.telefone && <small className="p-error">Telefone é obrigatório.</small>}
        </div>

        {/* Dados de Endereço */}
        <Divider align="left" className="mt-3 mb-2">
          <span className="font-bold text-sm">Dados de Endereço (opcionais)</span>
        </Divider>

        <div className="grid">
          <div className="col-12 field">
            <label htmlFor="cep" className="font-bold">
              CEP
            </label>
            <InputText
              id="cep"
              name="cep"
              value={cliente.cep || ''}
              onChange={handleInputChange}
              placeholder="00000-000"
              keyfilter="num"
            />
          </div>
        </div>

        <div className="grid">
          <div className="col-8 field">
            <label htmlFor="rua" className="font-bold">
              Logradouro (Rua)
            </label>
            <InputText
              id="rua"
              name="rua"
              value={cliente.rua}
              onChange={handleInputChange}
            />
          </div>
          <div className="col-4 field">
            <label htmlFor="numero" className="font-bold">
              Número
            </label>
            <InputText
              id="numero"
              name="numero"
              value={cliente.numero}
              onChange={handleInputChange}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="complemento" className="font-bold">
            Complemento
          </label>
          <InputText
            id="complemento"
            name="complemento"
            value={cliente.complemento || ''}
            onChange={handleInputChange}
            placeholder="Apto, Bloco, etc. (opcional)"
          />
        </div>

        <div className="field">
          <label htmlFor="bairro" className="font-bold">
            Bairro
          </label>
          <InputText
            id="bairro"
            name="bairro"
            value={cliente.bairro}
            onChange={handleInputChange}
          />
        </div>

        <div className="grid">
          <div className="col-7 field">
            <label htmlFor="cidade" className="font-bold">
              Cidade
            </label>
            <InputText
              id="cidade"
              name="cidade"
              value={cliente.cidade}
              onChange={handleInputChange}
            />
          </div>
          <div className="col-2 field">
            <label htmlFor="estado" className="font-bold">
              UF
            </label>
            <InputText
              id="estado"
              name="estado"
              value={cliente.estado}
              onChange={(e) => {
                setCliente({
                  ...cliente,
                  estado: e.target.value.toUpperCase().substring(0, 2)
                });
              }}
              maxLength={2}
              placeholder="SP"
            />
          </div>
          <div className="col-3 field">
            <label htmlFor="pais" className="font-bold">
              País
            </label>
            <InputText
              id="pais"
              name="pais"
              value={cliente.pais}
              onChange={handleInputChange}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="pontoReferencia" className="font-bold">
            Ponto de Referência
          </label>
          <InputText
            id="pontoReferencia"
            name="pontoReferencia"
            value={cliente.pontoReferencia || ''}
            onChange={handleInputChange}
            placeholder="Opcional"
          />
        </div>

        {/* Dados Fiscais */}
        <Divider align="left" className="mt-3 mb-2">
          <span className="font-bold text-sm">Dados Fiscais (opcionais)</span>
        </Divider>

        <div className="field">
          <label htmlFor="inscricao_estadual" className="font-bold">
            Inscrição Estadual
          </label>
          <InputText
            id="inscricao_estadual"
            name="inscricao_estadual"
            value={cliente.inscricao_estadual || ''}
            onChange={handleInputChange}
            placeholder="Opcional"
          />
          <small className="text-color-secondary">
            Obrigatória se o cliente tiver CNPJ e for emitir NF-e.
          </small>
        </div>

        <div className="field">
          <label htmlFor="inscricao_municipal" className="font-bold">
            Inscrição Municipal
          </label>
          <InputText
            id="inscricao_municipal"
            name="inscricao_municipal"
            value={cliente.inscricao_municipal || ''}
            onChange={handleInputChange}
            placeholder="Opcional"
          />
          <small className="text-color-secondary">
            Pode ser exigida para emissão de NFS-e, conforme o município.
          </small>
        </div>
      </Dialog>

      {/* ── DIALOG CMV ── */}
      <Dialog
        header="Análise de Clientes"
        visible={cmvDialog}
        style={{ width: '95vw', maxWidth: '1400px' }}
        modal
        onHide={() => setCmvDialog(false)}
      >
        {cmvLoading ? (
          <div className="flex justify-content-center align-items-center" style={{ height: 200 }}>
            <i className="pi pi-spin pi-spinner text-4xl text-primary" />
          </div>
        ) : (() => {
          const { totalFaturado, totalPedidos, ticketMedio, faixas, ativos, topClientes, locais, topProdutos, produtosPorCliente, chartTopClientes, chartTopProdutos } = calcCMV(cmvVendasFiltradas);
          const fmtM = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const pctAtivos = clientes.length > 0 ? ((ativos / clientes.length) * 100).toFixed(1) : '0';

          const faixasCfg = [
            { label: 'Até 20 dias',      lista: faixas.ate20,     color: 'rgba(34,197,94,0.1)',   border: '#86efac', text: '#15803d' },
            { label: '21 a 90 dias',     lista: faixas.de21a90,   color: 'rgba(245,158,11,0.1)',  border: '#fde047', text: '#a16207' },
            { label: '91 a 180 dias',    lista: faixas.de91a180,  color: 'rgba(239,68,68,0.1)',   border: '#fca5a5', text: '#b91c1c' },
            { label: 'Mais de 180 dias', lista: faixas.mais180,   color: 'rgba(236,72,153,0.1)',  border: '#f9a8d4', text: '#be185d' },
          ];

          return (
            <div className="grid">
              {/* Barra de filtro por período */}
              <div className="col-12">
                <div className="flex align-items-center gap-2 flex-wrap">
                  {(['semana', 'mes', 'ano', 'custom'] as const).map((p) => {
                    const labels: Record<string, string> = { semana: 'Semana', mes: 'Mês', ano: 'Ano', custom: 'Personalizado' };
                    return (
                      <Button
                        key={p}
                        label={labels[p]}
                        size="small"
                        outlined={cmvPeriodo !== p}
                        onClick={() => setCmvPeriodo(p)}
                        style={{
                          borderColor: '#1e3a5f',
                          color: cmvPeriodo === p ? '#fff' : '#1e3a5f',
                          background: cmvPeriodo === p ? '#1e3a5f' : 'transparent',
                        }}
                      />
                    );
                  })}
                  {cmvPeriodo === 'custom' && (
                    <>
                      <Calendar
                        value={cmvDataInicio}
                        onChange={e => setCmvDataInicio(e.value as Date | null)}
                        dateFormat="dd/mm/yy"
                        mask="99/99/9999"
                        readOnlyInput={false}
                        showIcon
                        placeholder="DD/MM/AAAA"
                        style={{ width: 180 }}
                      />
                      <Calendar
                        value={cmvDataFim}
                        onChange={e => setCmvDataFim(e.value as Date | null)}
                        dateFormat="dd/mm/yy"
                        mask="99/99/9999"
                        readOnlyInput={false}
                        showIcon
                        placeholder="DD/MM/AAAA"
                        style={{ width: 180 }}
                      />
                    </>
                  )}
                </div>
                <Divider className="my-3" />
              </div>

              {/* Cards resumo */}
              {[
                { icon: 'pi-users',      label: 'Total Clientes',  value: clientes.length,   sub: 'cadastrados',         bg: 'rgba(45,106,79,0.12)',  color: '#2d6a4f' },
                { icon: 'pi-dollar',     label: 'Total Faturado',  value: fmtM(totalFaturado), sub: `${totalPedidos} pedidos`, bg: 'rgba(30,136,229,0.12)', color: '#1e88e5' },
                { icon: 'pi-chart-line', label: 'Ticket Médio',    value: fmtM(ticketMedio), sub: 'por pedido',          bg: 'rgba(30,125,52,0.12)', color: '#1e7d34' },
                { icon: 'pi-user-plus',  label: 'Clientes Ativos', value: ativos,            sub: `${pctAtivos}% do total`, bg: 'rgba(106,5,114,0.12)', color: '#6a0572' },
              ].map(card => (
                <div key={card.label} className="col-12 md:col-3">
                  <div className="p-3 border-round surface-card border-1 surface-border">
                    <div className="flex align-items-center gap-2 mb-2 text-color-secondary">
                      <i className={`pi ${card.icon} text-sm`} style={{ color: card.color }} />
                      <span className="text-sm">{card.label}</span>
                    </div>
                    <div className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</div>
                    <div className="text-xs text-color-secondary mt-1">{card.sub}</div>
                  </div>
                </div>
              ))}

              {/* Linha 2: Gráficos em Barra */}
              <div className="col-12 md:col-6">
                <div className="surface-card border-round border-1 surface-border p-3">
                  <h6 className="mb-3 mt-0 text-color-secondary font-medium">Distribuição Melhores Clientes</h6>
                  {chartTopClientes.labels.length > 0 ? (
                    <Chart type="bar" data={chartTopClientes} options={{
                      responsive: true,
                      plugins: { legend: { display: false } },
                      scales: { y: { beginAtZero: true, ticks: { callback: (v: any) => `R$ ${Number(v).toLocaleString('pt-BR')}` } } }
                    }} style={{ maxHeight: 220 }} />
                  ) : <p className="text-center text-color-secondary py-4">Sem dados</p>}
                </div>
              </div>

              <div className="col-12 md:col-6">
                <div className="surface-card border-round border-1 surface-border p-3">
                  <h6 className="mb-3 mt-0 text-color-secondary font-medium">Top Produtos por Quantidade</h6>
                  {chartTopProdutos.labels.length > 0 ? (
                    <Chart type="bar" data={chartTopProdutos} options={{
                      responsive: true,
                      plugins: { legend: { display: false } },
                      scales: { y: { beginAtZero: true } }
                    }} style={{ maxHeight: 220 }} />
                  ) : <p className="text-center text-color-secondary py-4">Sem dados</p>}
                </div>
              </div>

              {/* Tabelas lado a lado */}
              <div className="col-12 md:col-6">
                <div className="surface-card border-round border-1 surface-border p-3">
                  <h6 className="mb-3 flex align-items-center gap-2 mt-0">
                    <i className="pi pi-star" style={{ color: '#f59e0b' }} />Melhores Clientes por Valor
                  </h6>
                  <DataTable value={topClientes} paginator rows={5} rowsPerPageOptions={[5, 10]} emptyMessage="Sem dados" size="small">
                    <Column header="Cliente" field="nome" sortable />
                    <Column header="Pedidos" field="pedidos" sortable style={{ width: '6rem' }} />
                    <Column header="Total" sortable body={(r: any) => <span className="font-semibold">{fmtM(r.total)}</span>} />
                    <Column style={{ width: '3.5rem' }} body={(r: any) => (
                      <Button icon="pi pi-eye" rounded text size="small" tooltip="Ver histórico"
                        onClick={() => setCmvClienteDetalhe({ ...r, produtos: (produtosPorCliente[r.id] ?? []).sort((a: any, b: any) => b.qtd - a.qtd) })} />
                    )} />
                  </DataTable>
                </div>
              </div>

              <div className="col-12 md:col-6">
                <div className="surface-card border-round border-1 surface-border p-3">
                  <h6 className="mb-3 flex align-items-center gap-2 mt-0">
                    <i className="pi pi-box" style={{ color: '#1e88e5' }} />Produtos Mais Comprados
                  </h6>
                  <DataTable value={topProdutos} paginator rows={5} rowsPerPageOptions={[5, 10]} emptyMessage="Sem dados" size="small">
                    <Column header="Produto" field="nome" sortable />
                    <Column header="Qtd" field="qtd" sortable style={{ width: '6rem' }} body={(r: any) => <span className="font-semibold">{Number(r.qtd).toLocaleString('pt-BR')}</span>} />
                    <Column header="Total" sortable body={(r: any) => fmtM(r.total)} />
                  </DataTable>
                </div>
              </div>

              {/* Locais + Inatividade */}
              <div className="col-12 md:col-6">
                <div className="surface-card border-round border-1 surface-border p-3">
                  <h6 className="mb-3 flex align-items-center gap-2 mt-0">
                    <i className="pi pi-map-marker" style={{ color: '#e53935' }} />Locais com Mais Pedidos
                  </h6>
                  <DataTable value={locais} emptyMessage="Sem dados de localização" size="small">
                    <Column header="Bairro" field="bairro" sortable />
                    <Column header="Cidade" field="cidade" sortable />
                    <Column header="Clientes" field="clientes" sortable style={{ width: '6rem' }} />
                    <Column header="Faturado" sortable body={(r: any) => fmtM(r.total)} />
                  </DataTable>
                </div>
              </div>

              <div className="col-12 md:col-6">
                <div className="surface-card border-round border-1 surface-border p-3">
                  <h6 className="mb-3 flex align-items-center gap-2 mt-0">
                    <i className="pi pi-clock" style={{ color: '#f59e0b' }} />Análise de Inatividade
                  </h6>
                  <div className="flex flex-column gap-2">
                    {faixasCfg.map(f => (
                      <div key={f.label} className="flex align-items-center justify-content-between p-3 border-round"
                        style={{ background: f.color, border: `1px solid ${f.border}` }}>
                        <div>
                          <div className="font-semibold" style={{ color: f.text }}>{f.label}</div>
                          <div className="text-sm mt-1" style={{ color: f.text }}>{f.lista.length} clientes</div>
                        </div>
                        <Button icon="pi pi-eye" rounded text size="small" style={{ color: f.text }}
                          tooltip="Ver clientes" disabled={f.lista.length === 0}
                          onClick={() => setCmvInativFaixa({ label: f.label, lista: f.lista })} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </Dialog>

      {/* Detalhe cliente CMV */}
      {cmvClienteDetalhe && (
        <Dialog header={`Histórico — ${cmvClienteDetalhe.nome}`} visible modal
          style={{ width: '560px' }} onHide={() => setCmvClienteDetalhe(null)}>
          <div className="grid">
            <div className="col-4 text-center">
              <div className="text-xs text-color-secondary mb-1">Pedidos</div>
              <div className="text-xl font-bold text-primary">{cmvClienteDetalhe.pedidos}</div>
            </div>
            <div className="col-8 text-center">
              <div className="text-xs text-color-secondary mb-1">Total Gasto</div>
              <div className="text-xl font-bold" style={{ color: '#1e7d34' }}>
                {cmvClienteDetalhe.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>
            <div className="col-12 mt-2">
              <h6 className="mb-2">Produtos mais comprados</h6>
              <DataTable value={cmvClienteDetalhe.produtos} emptyMessage="Sem itens registrados" size="small">
                <Column header="Produto" field="nome" sortable />
                <Column header="Qtd" field="qtd" sortable style={{ width: '5rem' }} body={(r: any) => Number(r.qtd).toLocaleString('pt-BR')} />
                <Column header="Total" sortable body={(r: any) => r.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
              </DataTable>
            </div>
          </div>
        </Dialog>
      )}

      {/* Clientes por faixa de inatividade */}
      {cmvInativFaixa && (
        <Dialog header={`Inatividade — ${cmvInativFaixa.label}`} visible modal
          style={{ width: '560px' }} onHide={() => setCmvInativFaixa(null)}>
          <DataTable value={cmvInativFaixa.lista} paginator rows={10} emptyMessage="Nenhum cliente" size="small">
            <Column header="Nome" field="nomeCompleto" sortable />
            <Column header="Cidade" field="cidade" sortable />
            <Column header="Telefone" field="telefone" />
            <Column header="Última Compra" body={(c: any) => {
              const ativ = atividadeClientes[c.id];
              return ativ?.ultima_compra ? new Date(ativ.ultima_compra).toLocaleDateString('pt-BR') : 'Nunca';
            }} />
          </DataTable>
        </Dialog>
      )}
    </div>
  );
};

export default ClientesPage;
