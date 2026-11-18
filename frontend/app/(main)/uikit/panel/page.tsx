'use client';

import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import React, { useEffect, useRef, useState } from 'react';
import api from '../../services/api/baseApi';

type User = {
    id: number;
    nomeCompleto: string;
    email: string;
    cargo: string;
    status: 'ativo' | 'bloqueado';
    permissoes?: string[];
    empresa_id?: number | null;
};

type Permissao = {
    label: string;
    rota: string;
};

const ABAS: Permissao[] = [
    { label: 'Central de Gestão', rota: '/central-gestao' },
    { label: 'Estoque', rota: '/uikit/formlayout' },
    { label: 'Produção', rota: '/uikit/producao' },
    { label: 'Relatórios de produtos', rota: '/uikit/relatorios-produtos' },
    { label: 'Pedidos', rota: '/uikit/pedidos' },
    { label: 'Fornecedores', rota: '/uikit/fornecedores' },
    { label: 'Clientes', rota: '/uikit/button' },
    { label: 'Caixa', rota: '/uikit/input' },
    { label: 'Lojinha online', rota: '/loja/gestao' },
    { label: 'Configurar lojinha', rota: '/loja/configuracao' },
    { label: 'WhatsApp da empresa', rota: '/uikit/automacao-whatsapp' },
    { label: 'Custos por Funcionários', rota: '/uikit/table' },
    { label: 'Entradas', rota: '/financeiro/entradas' },
    { label: 'Contas a Receber', rota: '/financeiro/contas-receber' },
    { label: 'Saídas', rota: '/financeiro/saidas' },
    { label: 'Relatórios Financeiros', rota: '/financeiro/relatorios' },
    { label: 'CRM / RFM', rota: '/uikit/crm' },
    { label: 'Usuários', rota: '/uikit/invalidstate' },
    { label: 'Gestão de Acessos', rota: '/uikit/panel' },
    { label: 'Minha Empresa', rota: '/uikit/media' },
];

type GrupoAbas = { label: string; icon: string; cor: string; rotas: string[] };

const GRUPOS_ABAS: GrupoAbas[] = [
    {
        label: 'Central de Gestão',
        icon: 'pi-chart-line',
        cor: '#15803d',
        rotas: ['/central-gestao'],
    },
    {
        label: 'Operacional',
        icon: 'pi-box',
        cor: '#16a34a',
        rotas: ['/uikit/formlayout', '/uikit/producao', '/uikit/relatorios-produtos', '/uikit/pedidos', '/uikit/fornecedores'],
    },
    {
        label: 'Comercial',
        icon: 'pi-shopping-cart',
        cor: '#22c55e',
        rotas: ['/uikit/button', '/uikit/input', '/loja/gestao', '/loja/configuracao', '/uikit/automacao-whatsapp'],
    },
    {
        label: 'Financeiro',
        icon: 'pi-wallet',
        cor: '#10b981',
        rotas: [
            '/uikit/table', '/financeiro/entradas', '/financeiro/contas-receber', '/financeiro/saidas', '/financeiro/relatorios', '/uikit/crm',
        ],
    },
    {
        label: 'Administração',
        icon: 'pi-shield',
        cor: '#8b5cf6',
        rotas: ['/uikit/invalidstate', '/uikit/panel', '/uikit/media'],
    },
];

const GestaoAcessosPage = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchNome, setSearchNome] = useState('');
    const [searchCargo, setSearchCargo] = useState('');

    const [permissoesDialogVisible, setPermissoesDialogVisible] = useState(false);
    const [usuarioSelecionado, setUsuarioSelecionado] = useState<User | null>(null);
    const [permissoesSelecionadas, setPermissoesSelecionadas] = useState<string[]>([]);
    const [modulosEmpresa, setModulosEmpresa] = useState<string[]>([]);
    const [isMaster, setIsMaster] = useState(false);
    const [modulosCarregados, setModulosCarregados] = useState(false);
    // Módulos disponíveis para o usuário cujo dialog está aberto (baseado na empresa dele)
    // null = dialog não aberto; [] = carregado mas empresa sem módulos; [...] = módulos carregados
    const [modulosDialogo, setModulosDialogo] = useState<string[] | null>(null);
    const [carregandoDialogo, setCarregandoDialogo] = useState(false);
    const [rotasPermitidasCargo, setRotasPermitidasCargo] = useState<string[] | null>(null);
    const [nomeCargoDialogo, setNomeCargoDialogo] = useState<string>('');

    // Gestão de cargos — persiste no banco via API
    const getEmpresaIdLocal = (): number | null => {
        try {
            const u = JSON.parse(localStorage.getItem('user') ?? '{}');
            const sel = localStorage.getItem('empresa_selecionada');
            if ((u?.tipo === 'MASTER' || u?.email === 'admin@master.com') && sel) return Number(sel);
            return u?.empresa_id ?? null;
        } catch { return null; }
    };

    const carregarCargosAPI = async (): Promise<{ nome: string; permissoes: string[] }[]> => {
        const eid = getEmpresaIdLocal();
        if (!eid) return [];
        try {
            const res = await api.get(`/empresas/${eid}/cargos`);
            return Array.isArray(res.data) ? res.data : [];
        } catch { return []; }
    };

    const salvarCargosAPI = async (lista: { nome: string; permissoes: string[] }[]) => {
        const eid = getEmpresaIdLocal();
        if (!eid) return;
        await api.put(`/empresas/${eid}/cargos`, { cargos: lista });
        // Mantém localStorage em sincronia como cache
        try { localStorage.setItem(`cargos_${eid}`, JSON.stringify(lista)); } catch { }
    };

    // Cache local por empresa — só usa empresa_selecionada para MASTER
    const CARGOS_KEY = () => {
        try {
            const u = JSON.parse(localStorage.getItem('user') ?? '{}');
            const ehMaster = u?.tipo === 'MASTER' || u?.email === 'admin@master.com';
            const ec = ehMaster ? localStorage.getItem('empresa_selecionada') : null;
            return `cargos_${ec ?? u?.empresa_id ?? 'master'}`;
        } catch { return 'cargos_local'; }
    };
    const carregarCargos = (): { nome: string; permissoes: string[] }[] => {
        try { return JSON.parse(localStorage.getItem(CARGOS_KEY()) ?? '[]'); } catch { return []; }
    };
    const [cargosDialog, setCargosDialog] = useState(false);
    const [cargos, setCargos] = useState<{ nome: string; permissoes: string[] }[]>([]);
    const [cargoEditando, setCargoEditando] = useState<{ nome: string; permissoes: string[] } | null>(null);
    const [cargoNome, setCargoNome] = useState('');
    const [cargoPermissoes, setCargoPermissoes] = useState<string[]>([]);

    const toast = useRef<Toast>(null);

    const cargoOptions = [
        { label: 'Todos', value: '' },
        { label: 'Administrador', value: 'Administrador' },
        { label: 'Gerente', value: 'Gerente' },
        { label: 'Vendedor', value: 'Vendedor' },
        { label: 'Operador', value: 'Operador' },
        { label: 'Financeiro', value: 'Financeiro' },
    ];

    const MODULOS_CACHE_KEY = (eid: number | string) => `modulos_empresa_${eid}`;

    const carregarModulosEmpresa = async (empresaId: number) => {
        try {
            // O controle de acessos versionado é a fonte de verdade. A coluna
            // legada de empresas pode ficar defasada após uma atualização de
            // pacote e acabava ocultando abas válidas no gerenciador.
            const res = await api.get(`/access-control/companies/${empresaId}`);
            const perms: string[] = res.data?.permissions ?? res.data?.modules ?? [];
            if (perms.length > 0) {
                localStorage.setItem(MODULOS_CACHE_KEY(empresaId), JSON.stringify(perms));
            }
            setModulosEmpresa(perms);
        } catch {
            try {
                const legacy = await api.get(`/empresas/${empresaId}`);
                const perms: string[] = legacy.data?.permissoes ?? [];
                if (perms.length > 0) setModulosEmpresa(perms);
                else throw new Error('empresa sem módulos');
            } catch {
                // API falhou: usa cache do localStorage para não apagar os módulos
                try {
                    const cached = localStorage.getItem(MODULOS_CACHE_KEY(empresaId));
                    if (cached) setModulosEmpresa(JSON.parse(cached));
                } catch { }
            }
        } finally {
            setModulosCarregados(true);
        }
    };

    useEffect(() => {
        fetchUsers();
        const userStr = localStorage.getItem('user');
        if (!userStr) return;
        try {
            const u = JSON.parse(userStr);
            const ehMaster = u?.tipo === 'MASTER' || u?.email === 'admin@master.com';
            setIsMaster(ehMaster);

            if (ehMaster) {
                const ec = localStorage.getItem('empresa_selecionada');
                if (ec && !isNaN(Number(ec))) {
                    carregarModulosEmpresa(Number(ec));
                } else {
                    setModulosCarregados(true);
                }
                return;
            }
            const empresaId = u?.empresa_id;
            if (empresaId) {
                carregarModulosEmpresa(empresaId);
            } else {
                setModulosCarregados(true);
            }
        } catch { setModulosCarregados(true); }
    }, []);

    const abrirCargos = async () => {
        const eid = getEmpresaIdLocal();
        const [lista] = await Promise.all([
            carregarCargosAPI(),
            eid ? carregarModulosEmpresa(eid) : Promise.resolve(),
        ]);
        setCargos(lista);
        setCargoEditando(null);
        setCargoNome('');
        setCargoPermissoes([]);
        setCargosDialog(true);
    };

    const sincronizarNomeCargoComUsuarios = async (nomeAnterior: string, nomeNovo: string) => {
        const empresaId = getEmpresaIdLocal();
        if (!empresaId || nomeAnterior === nomeNovo) return;
        try {
            const resposta = await api.get('/users', { params: { empresa_id: empresaId, cargo: nomeAnterior } });
            const usuarios = (resposta.data?.data ?? resposta.data ?? []).filter((usuario: any) => usuario.tipo !== 'MASTER');
            await Promise.all(usuarios.map((usuario: any) => api.put(`/users/${usuario.id}`, {
                cargo: nomeNovo,
            })));
        } catch {
            showError('Cargo salvo, mas não foi possível sincronizar todos os usuários vinculados.');
        }
    };

    const salvarCargo = async () => {
        if (!cargoNome.trim()) return showError('Informe o nome do cargo');
        const lista = await carregarCargosAPI();
        const permissoesDoCargo = cargoPermissoes.filter(r => ABAS.some(aba => aba.rota === r));

        if (cargoEditando) {
            // Renomeia os usuários antes de persistir o cargo. Assim o backend
            // consegue recalcular as permissões do novo nome e não transforma
            // o usuário em um perfil explícito por acidente.
            await sincronizarNomeCargoComUsuarios(cargoEditando.nome, cargoNome.trim());
            const atualizado = lista.map(c => c.nome === cargoEditando.nome
                ? { nome: cargoNome.trim(), permissoes: permissoesDoCargo }
                : c);
            await salvarCargosAPI(atualizado);
            setCargos(atualizado);
            showSuccess('Cargo salvo! Usuários vinculados foram sincronizados.');
        } else {
            if (lista.find(c => c.nome.toLowerCase() === cargoNome.trim().toLowerCase())) return showError('Cargo já existe');
            const novo = [...lista, { nome: cargoNome.trim(), permissoes: permissoesDoCargo }];
            await salvarCargosAPI(novo);
            setCargos(novo);
            showSuccess('Cargo salvo!');
        }

        setCargoEditando(null);
        setCargoNome('');
        setCargoPermissoes([]);
    };

    const excluirCargo = async (nome: string) => {
        const lista = await carregarCargosAPI();
        const atualizado = lista.filter(c => c.nome !== nome);
        await salvarCargosAPI(atualizado);
        setCargos(atualizado);
        showSuccess('Cargo removido');
    };

    const editarCargo = (cargo: { nome: string; permissoes: string[] }) => {
        setCargoEditando(cargo);
        setCargoNome(cargo.nome);
        setCargoPermissoes(cargo.permissoes);
    };

    const fetchUsers = async (nome?: string, cargo?: string) => {
        setLoading(true);
        try {
            const params: Record<string, any> = {};
            if (nome) params.nome = nome;
            if (cargo) params.cargo = cargo;
            try { const ec = localStorage.getItem('empresa_selecionada'); const u = JSON.parse(localStorage.getItem('user') ?? '{}'); const empId = ec ? Number(ec) : u?.empresa_id; if (empId) params.empresa_id = empId; } catch { }
            const response = await api.get('/users', { params });
            const lista = (response.data.data ?? response.data ?? []).filter((u: any) => u.tipo !== 'MASTER');
            setUsers(lista);
        } catch {
            showError('Erro ao carregar usuários');
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = async (user: User) => {
        const novoStatus = user.status === 'ativo' ? 'bloqueado' : 'ativo';
        try {
            await api.put(`/users/${user.id}`, { status: novoStatus });
            setUsers(prev =>
                prev.map(u => u.id === user.id ? { ...u, status: novoStatus } : u)
            );
            showSuccess(
                novoStatus === 'bloqueado'
                    ? `Acesso de "${user.nomeCompleto}" bloqueado.`
                    : `Acesso de "${user.nomeCompleto}" liberado.`
            );
        } catch {
            showError('Erro ao atualizar status do usuário');
        }
    };

    // Abas disponíveis no contexto do painel (Gerenciar Cargos, etc.)
    const usuarioAtualEhMaster = () => {
        try {
            const u = JSON.parse(localStorage.getItem('user') ?? '{}');
            return u?.tipo === 'MASTER' || u?.email === 'admin@master.com';
        } catch { return isMaster; }
    };

    const abasDisponiveis = () => {
        // Todas as empresas podem configurar todas as abas. O acesso efetivo
        // continua sendo definido pelas permissões do cargo/usuário.
        return ABAS;
    };

    // Abas disponíveis no dialog de permissões (todas as abas do sistema)
    // null = dialog não aberto → usa todas as abas
    // Quando rotasPermitidasCargo está definido, restringe ainda mais ao cargo do usuário
    const abasDoDialog = () => {
        const porEmpresa = abasDisponiveis();
        if (rotasPermitidasCargo !== null) {
            return porEmpresa.filter(a => rotasPermitidasCargo.includes(a.rota));
        }
        return porEmpresa;
    };

    const abrirPermissoes = async (user: User) => {
        setUsuarioSelecionado(user);
        setCarregandoDialogo(true);
        setPermissoesDialogVisible(true);
        setRotasPermitidasCargo(null);
        setNomeCargoDialogo('');

        const FLAGS_INTERNAS = ['ponto:todos', 'planejamento:todos', 'agendamento:todos', 'comissoes:todos', 'senha:ver', 'caixa:pular_senha'];

        // Busca dados frescos em paralelo: permissões atuais do usuário no banco
        let modulos: string[] = [];
        let permissoesFrescas: string[] = user.permissoes ?? [];

        await Promise.all([
            user.empresa_id
                ? api.get(`/access-control/companies/${user.empresa_id}`)
                    .then(res => { modulos = res.data?.permissions ?? res.data?.modules ?? []; })
                    .catch(() => api.get(`/empresas/${user.empresa_id}`)
                        .then(res => { modulos = res.data?.permissoes ?? []; })
                        .catch(() => {}))
                : Promise.resolve(),
            api.get(`/users/${user.id}`)
                .then(res => {
                    permissoesFrescas = res.data?.data?.permissoes ?? res.data?.permissoes ?? permissoesFrescas;
                })
                .catch(() => {}),
        ]);

        setModulosDialogo(modulos);
        setCarregandoDialogo(false);

        // Todas as abas ficam disponíveis para qualquer empresa.
        const abasValidas = ABAS;

        // salvas = permissões do banco filtradas apenas pelas abas conhecidas
        const salvas = permissoesFrescas.filter(r => FLAGS_INTERNAS.includes(r) || abasValidas.some(a => a.rota === r));
        const salvasNaoFlags = salvas.filter(r => !FLAGS_INTERNAS.includes(r));

        // Cargo define padrão, não teto: o dialog mostra todos os módulos do plano da empresa.
        // Se o usuário não tem permissões salvas, usa as permissões do cargo como ponto de partida.
        // O cargo do usuário continua sendo a fonte dos módulos permitidos
        // mesmo quando quem abre a ficha é o MASTER. Antes essa condição
        // ignorava o cargo justamente no acesso MASTER e deixava aparecer
        // apenas as permissões já gravadas individualmente.
        if (user.cargo) {
            try {
                const cargosCustom = await carregarCargosAPI();
                const cargoConfig = cargosCustom.find(c => c.nome === user.cargo);
                if (cargoConfig) {
                    setNomeCargoDialogo(cargoConfig.nome);
                    const rotasDoCargo = cargoConfig.permissoes.filter(r => ABAS.some(a => a.rota === r));
                    const abasDoCargo = ABAS.filter(a => rotasDoCargo.includes(a.rota));
                    const rotasDisponiveis = Array.from(new Set([...abasValidas.map(a => a.rota), ...abasDoCargo.map(a => a.rota)]));
                    setModulosDialogo((atual) => Array.from(new Set([...(atual ?? []), ...rotasDoCargo])));
                    // As permissões do cargo são a base; acessos individuais já
                    // salvos são preservados por cima dela.
                    const inicial = Array.from(new Set([
                        ...cargoConfig.permissoes,
                        ...salvas,
                    ])).filter(r => FLAGS_INTERNAS.includes(r) || rotasDisponiveis.includes(r));
                    setPermissoesSelecionadas(inicial);
                    return;
                }
            } catch { }
        }

        // Sem cargo customizado (ou MASTER): comportamento original
        if (salvasNaoFlags.length > 0) {
            setPermissoesSelecionadas(salvas);
            return;
        }

        if (['Gerente', 'Administrador', 'Dono'].includes(user.cargo)) {
            setPermissoesSelecionadas([...abasValidas.map(a => a.rota), 'senha:ver', 'caixa:pular_senha']);
        } else {
            setPermissoesSelecionadas([]);
        }
    };

    const togglePermissao = (rota: string) => {
        setPermissoesSelecionadas(prev => {
            if (prev.includes(rota)) {
                return prev.filter(r => r !== rota);
            }
            return [...prev, rota];
        });
    };

    const selecionarTudo = () => setPermissoesSelecionadas(abasDoDialog().map(a => a.rota));
    const limparTudo = () => setPermissoesSelecionadas([]);

    const salvarPermissoes = async () => {
        try {
            const FLAGS_EXTRAS = ['senha:ver', 'caixa:pular_senha'];
            let permsValidas = permissoesSelecionadas.filter(r =>
                FLAGS_EXTRAS.includes(r) || abasDoDialog().some(a => a.rota === r)
            );
            // Garante no frontend que nada fora do cargo é enviado (espelha o que o backend faria)
            if (rotasPermitidasCargo !== null) {
                permsValidas = permsValidas.filter(r => rotasPermitidasCargo.includes(r));
            }
            await api.put(`/users/${usuarioSelecionado?.id}`, { permissoes: permsValidas });
            showSuccess(`Permissões de "${usuarioSelecionado?.nomeCompleto}" salvas!`);
            setPermissoesDialogVisible(false);
            setModulosDialogo(null);
            setRotasPermitidasCargo(null);
            setNomeCargoDialogo('');
            setUsers(prev => prev.map(u =>
                u.id === usuarioSelecionado?.id ? { ...u, permissoes: permsValidas } : u
            ));
        } catch {
            showError('Erro ao atualizar permissão');
        }
    };

    const showSuccess = (message: string) => {
        toast.current?.show({ severity: 'success', summary: 'Sucesso', detail: message, life: 3000 });
    };

    const showError = (message: string) => {
        toast.current?.show({ severity: 'error', summary: 'Erro', detail: message, life: 3000 });
    };

    const handleSearch = () => fetchUsers(searchNome, searchCargo);

    const handleClear = () => {
        setSearchNome('');
        setSearchCargo('');
        fetchUsers();
    };

    const statusBodyTemplate = (rowData: User) => (
        <Tag
            value={rowData.status === 'ativo' ? 'Ativo' : 'Bloqueado'}
            severity={rowData.status === 'ativo' ? 'success' : 'danger'}
        />
    );

    const actionBodyTemplate = (rowData: User) => (
        <div className="flex gap-2">
            <Button
                icon="pi pi-shield"
                rounded
                outlined
                severity="info"
                tooltip="Gerenciar permissões"
                tooltipOptions={{ position: 'top' }}
                onClick={() => abrirPermissoes(rowData)}
            />
            {rowData.status === 'ativo' ? (
                <Button
                    icon="pi pi-lock"
                    rounded
                    outlined
                    severity="danger"
                    tooltip="Bloquear acesso"
                    tooltipOptions={{ position: 'top' }}
                    onClick={() => toggleStatus(rowData)}
                />
            ) : (
                <Button
                    icon="pi pi-lock-open"
                    rounded
                    outlined
                    severity="success"
                    tooltip="Liberar acesso"
                    tooltipOptions={{ position: 'top' }}
                    onClick={() => toggleStatus(rowData)}
                />
            )}
        </div>
    );

    const fecharDialogPermissoes = () => {
        setPermissoesDialogVisible(false);
        setModulosDialogo(null);
        setRotasPermitidasCargo(null);
        setNomeCargoDialogo('');
    };

    const dialogFooter = (
        <div>
            <Button label="Cancelar" icon="pi pi-times" onClick={fecharDialogPermissoes} className="p-button-text" />
            <Button label="Salvar" icon="pi pi-check" onClick={salvarPermissoes} autoFocus />
        </div>
    );

    return (
        <div className="grid">
            <Toast ref={toast} />

            <div className="col-12">
                <div className="card">
                    <div className="flex justify-content-between align-items-center mb-5">
                        <h5>Gestão de Acessos</h5>
                        <div className="flex gap-2 flex-wrap">
                            <Button label="Gerenciar Cargos" icon="pi pi-briefcase" severity="secondary" onClick={abrirCargos} />
                            <InputText
                                value={searchNome}
                                onChange={(e) => setSearchNome(e.target.value)}
                                placeholder="Pesquisar por nome..."
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <Dropdown
                                value={searchCargo}
                                options={cargoOptions}
                                onChange={(e) => setSearchCargo(e.value)}
                                placeholder="Filtrar por cargo"
                                style={{ minWidth: '180px' }}
                            />
                            <Button icon="pi pi-search" onClick={handleSearch} tooltip="Pesquisar" />
                            <Button icon="pi pi-times" severity="secondary" onClick={handleClear} tooltip="Limpar filtros" />
                        </div>
                    </div>

                    <DataTable
                        value={users}
                        paginator
                        rows={10}
                        rowsPerPageOptions={[5, 10, 25, 50]}
                        loading={loading}
                        tableStyle={{ minWidth: '50rem' }}
                        emptyMessage="Nenhum usuário encontrado"
                    >
                        <Column field="nomeCompleto" header="Nome Completo" sortable style={{ width: '28%' }} />
                        <Column field="cargo" header="Cargo" sortable style={{ width: '18%' }} />
                        <Column field="email" header="E-mail" sortable style={{ width: '25%' }} />
                        <Column field="status" header="Status" body={statusBodyTemplate} sortable style={{ width: '12%' }} />
                        <Column body={actionBodyTemplate} exportable={false} style={{ minWidth: '10rem' }} />
                    </DataTable>
                </div>
            </div>

            <Dialog
                visible={permissoesDialogVisible}
                style={{ width: '420px' }}
                header={`Permissões — ${usuarioSelecionado?.nomeCompleto}`}
                modal
                footer={dialogFooter}
                onHide={fecharDialogPermissoes}
            >
                {(!modulosCarregados || carregandoDialogo) ? (
                    <div className="flex justify-content-center align-items-center py-5">
                        <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem', color: '#1e88e5' }} />
                        <span className="ml-3 text-color-secondary">Carregando permissões...</span>
                    </div>
                ) : (
                    <>
                        {nomeCargoDialogo && (
                            <div className="mb-3 px-3 py-2 border-round flex align-items-center gap-2"
                                style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                                <i className="pi pi-briefcase" style={{ color: '#1e88e5', fontSize: 13 }} />
                                <span className="text-sm" style={{ color: '#1e40af' }}>
                                    Limitado ao cargo <strong>{nomeCargoDialogo}</strong>
                                </span>
                            </div>
                        )}
                        <div className="flex justify-content-between align-items-center mb-3">
                            <p className="m-0 text-sm text-color-secondary">
                                Selecione quais abas este usuário pode acessar:
                            </p>
                            <Button
                                label={permissoesSelecionadas.length >= abasDoDialog().length ? 'Limpar' : 'Selecionar tudo'}
                                text
                                size="small"
                                onClick={permissoesSelecionadas.length >= abasDoDialog().length ? limparTudo : selecionarTudo}
                            />
                        </div>
                        <div className="flex flex-column gap-3">
                            {GRUPOS_ABAS.map(grupo => {
                                const abasDoGrupo = abasDoDialog().filter(a => grupo.rotas.includes(a.rota));
                                if (abasDoGrupo.length === 0) return null;
                                const todasMarcadas = abasDoGrupo.every(a => permissoesSelecionadas.includes(a.rota));
                                const algumas = abasDoGrupo.some(a => permissoesSelecionadas.includes(a.rota));
                                return (
                                    <div key={grupo.label}>
                                        {/* Cabeçalho do grupo com toggle */}
                                        <div className="flex align-items-center gap-2 mb-2 pb-1"
                                            style={{ borderBottom: `2px solid ${grupo.cor}30` }}>
                                            <div
                                                style={{ width: '20px', height: '20px', minWidth: '20px', border: `2px solid ${todasMarcadas ? grupo.cor : algumas ? grupo.cor : '#ced4da'}`, borderRadius: '4px', backgroundColor: todasMarcadas ? grupo.cor : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                                                onClick={() => {
                                                    if (todasMarcadas) {
                                                        setPermissoesSelecionadas(prev => prev.filter(r => !grupo.rotas.includes(r)));
                                                    } else {
                                                        setPermissoesSelecionadas(prev => Array.from(new Set([...prev, ...abasDoGrupo.map(a => a.rota)])));
                                                    }
                                                }}
                                            >
                                                {todasMarcadas && <i className="pi pi-check" style={{ color: 'white', fontSize: '11px' }} />}
                                                {!todasMarcadas && algumas && <div style={{ width: '10px', height: '2px', backgroundColor: grupo.cor }} />}
                                            </div>
                                            <i className={`pi ${grupo.icon}`} style={{ color: grupo.cor, fontSize: '14px' }} />
                                            <span className="font-semibold" style={{ color: grupo.cor }}>{grupo.label}</span>
                                        </div>
                                        {/* Itens */}
                                        <div className="flex flex-column gap-2 pl-2">
                                            {abasDoGrupo.map(aba => {
                                                const marcado = permissoesSelecionadas.includes(aba.rota);
                                                const isPonto = aba.rota === '/uikit/ponto';
                                                const isPlanejamento = aba.rota === '/uikit/message';
                                                const isAgendamento = aba.rota === '/uikit/agendamentos';
                                                const isComissoes = aba.rota === '/uikit/comissoes';
                                                const podeVerTodosPonto = permissoesSelecionadas.includes('ponto:todos');
                                                const podeVerTodosPlanejamento = permissoesSelecionadas.includes('planejamento:todos');
                                                const podeVerTodosAgendamento = permissoesSelecionadas.includes('agendamento:todos');
                                                const podeVerTodasComissoes = permissoesSelecionadas.includes('comissoes:todos');
                                                return (
                                                    <div key={aba.rota}>
                                                        <div className="flex align-items-center" style={{ cursor: 'pointer' }}
                                                            onClick={() => togglePermissao(aba.rota)}>
                                                            <div style={{ width: '18px', height: '18px', minWidth: '18px', border: `2px solid ${marcado ? grupo.cor : '#ced4da'}`, borderRadius: '4px', backgroundColor: marcado ? grupo.cor : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                                                                {marcado && <i className="pi pi-check" style={{ color: 'white', fontSize: '10px' }} />}
                                                            </div>
                                                            <span className="ml-2 text-sm">{aba.label}</span>
                                                        </div>
                                                        {isPonto && marcado && (
                                                            <div className="flex gap-3 mt-1 ml-4" onClick={e => e.stopPropagation()}>
                                                                <label className="flex align-items-center gap-1 text-xs" style={{ cursor: 'pointer', color: '#6c757d' }}>
                                                                    <input type="radio" name={`ponto_scope_user_${usuarioSelecionado?.id}`}
                                                                        checked={!podeVerTodosPonto}
                                                                        onChange={() => setPermissoesSelecionadas(prev => prev.filter(r => r !== 'ponto:todos'))}
                                                                        style={{ accentColor: grupo.cor }}
                                                                    />
                                                                    Apenas o próprio
                                                                </label>
                                                                <label className="flex align-items-center gap-1 text-xs" style={{ cursor: 'pointer', color: '#6c757d' }}>
                                                                    <input type="radio" name={`ponto_scope_user_${usuarioSelecionado?.id}`}
                                                                        checked={podeVerTodosPonto}
                                                                        onChange={() => setPermissoesSelecionadas(prev => [...prev.filter(r => r !== 'ponto:todos'), 'ponto:todos'])}
                                                                        style={{ accentColor: grupo.cor }}
                                                                    />
                                                                    Todos os funcionários
                                                                </label>
                                                            </div>
                                                        )}
                                                        {isPlanejamento && marcado && (
                                                            <div className="flex gap-3 mt-1 ml-4" onClick={e => e.stopPropagation()}>
                                                                <label className="flex align-items-center gap-1 text-xs" style={{ cursor: 'pointer', color: '#6c757d' }}>
                                                                    <input type="radio" name={`plan_scope_user_${usuarioSelecionado?.id}`}
                                                                        checked={!podeVerTodosPlanejamento}
                                                                        onChange={() => setPermissoesSelecionadas(prev => prev.filter(r => r !== 'planejamento:todos'))}
                                                                        style={{ accentColor: grupo.cor }}
                                                                    />
                                                                    Apenas as próprias tarefas
                                                                </label>
                                                                <label className="flex align-items-center gap-1 text-xs" style={{ cursor: 'pointer', color: '#6c757d' }}>
                                                                    <input type="radio" name={`plan_scope_user_${usuarioSelecionado?.id}`}
                                                                        checked={podeVerTodosPlanejamento}
                                                                        onChange={() => setPermissoesSelecionadas(prev => [...prev.filter(r => r !== 'planejamento:todos'), 'planejamento:todos'])}
                                                                        style={{ accentColor: grupo.cor }}
                                                                    />
                                                                    Todas as tarefas
                                                                </label>
                                                            </div>
                                                        )}
                                                        {isAgendamento && marcado && (
                                                            <div className="flex gap-3 mt-1 ml-4" onClick={e => e.stopPropagation()}>
                                                                <label className="flex align-items-center gap-1 text-xs" style={{ cursor: 'pointer', color: '#6c757d' }}>
                                                                    <input type="radio" name={`agend_scope_user_${usuarioSelecionado?.id}`}
                                                                        checked={!podeVerTodosAgendamento}
                                                                        onChange={() => setPermissoesSelecionadas(prev => prev.filter(r => r !== 'agendamento:todos'))}
                                                                        style={{ accentColor: grupo.cor }}
                                                                    />
                                                                    Apenas os próprios agendamentos
                                                                </label>
                                                                <label className="flex align-items-center gap-1 text-xs" style={{ cursor: 'pointer', color: '#6c757d' }}>
                                                                    <input type="radio" name={`agend_scope_user_${usuarioSelecionado?.id}`}
                                                                        checked={podeVerTodosAgendamento}
                                                                        onChange={() => setPermissoesSelecionadas(prev => [...prev.filter(r => r !== 'agendamento:todos'), 'agendamento:todos'])}
                                                                        style={{ accentColor: grupo.cor }}
                                                                    />
                                                                    Todos os agendamentos
                                                                </label>
                                                            </div>
                                                        )}
                                                        {isComissoes && marcado && (
                                                            <div className="flex gap-3 mt-1 ml-4" onClick={e => e.stopPropagation()}>
                                                                <label className="flex align-items-center gap-1 text-xs" style={{ cursor: 'pointer', color: '#6c757d' }}>
                                                                    <input type="radio" name={`comissoes_scope_user_${usuarioSelecionado?.id}`}
                                                                        checked={!podeVerTodasComissoes}
                                                                        onChange={() => setPermissoesSelecionadas(prev => prev.filter(r => r !== 'comissoes:todos'))}
                                                                        style={{ accentColor: grupo.cor }}
                                                                    />
                                                                    Apenas as próprias comissões
                                                                </label>
                                                                <label className="flex align-items-center gap-1 text-xs" style={{ cursor: 'pointer', color: '#6c757d' }}>
                                                                    <input type="radio" name={`comissoes_scope_user_${usuarioSelecionado?.id}`}
                                                                        checked={podeVerTodasComissoes}
                                                                        onChange={() => setPermissoesSelecionadas(prev => [...prev.filter(r => r !== 'comissoes:todos'), 'comissoes:todos'])}
                                                                        style={{ accentColor: grupo.cor }}
                                                                    />
                                                                    Comissões de todos
                                                                </label>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* ── Permissão especial: Visualizar senhas ── */}
                        {/* Permissões especiais do usuário */}
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
                            <span className="text-xs font-semibold text-color-secondary mb-2 block">Permissões especiais</span>
                            <div className="flex flex-column gap-2">
                                {(rotasPermitidasCargo === null || rotasPermitidasCargo.includes('senha:ver')) && (
                                <div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}
                                        onClick={() => setPermissoesSelecionadas(prev =>
                                            prev.includes('senha:ver')
                                                ? prev.filter(r => r !== 'senha:ver')
                                                : [...prev, 'senha:ver']
                                        )}>
                                        <div style={{
                                            width: 18, height: 18, minWidth: 18,
                                            border: `2px solid ${permissoesSelecionadas.includes('senha:ver') ? '#dc2626' : '#ced4da'}`,
                                            borderRadius: 4,
                                            backgroundColor: permissoesSelecionadas.includes('senha:ver') ? '#dc2626' : 'transparent',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {permissoesSelecionadas.includes('senha:ver') && <i className="pi pi-check" style={{ color: 'white', fontSize: 10 }} />}
                                        </div>
                                        <i className="pi pi-eye" style={{ color: '#dc2626', fontSize: 13 }} />
                                        <span style={{ fontWeight: 600, color: '#dc2626' }}>Pode visualizar senhas de outros usuários</span>
                                    </label>
                                    <small style={{ color: '#9ca3af', marginLeft: 26, display: 'block', marginTop: 2 }}>
                                        Aparece como autenticador no botão "Ver Senha" na gestão de usuários
                                    </small>
                                </div>
                                )}
                                {(rotasPermitidasCargo === null || rotasPermitidasCargo.includes('caixa:pular_senha')) && (
                                <div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}
                                        onClick={() => setPermissoesSelecionadas(prev =>
                                            prev.includes('caixa:pular_senha')
                                                ? prev.filter(r => r !== 'caixa:pular_senha')
                                                : [...prev, 'caixa:pular_senha']
                                        )}>
                                        <div style={{
                                            width: 18, height: 18, minWidth: 18,
                                            border: `2px solid ${permissoesSelecionadas.includes('caixa:pular_senha') ? '#f59e0b' : '#ced4da'}`,
                                            borderRadius: 4,
                                            backgroundColor: permissoesSelecionadas.includes('caixa:pular_senha') ? '#f59e0b' : 'transparent',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {permissoesSelecionadas.includes('caixa:pular_senha') && <i className="pi pi-check" style={{ color: 'white', fontSize: 10 }} />}
                                        </div>
                                        <i className="pi pi-lock-open" style={{ color: '#f59e0b', fontSize: 13 }} />
                                        <span style={{ fontWeight: 600, color: '#b45309' }}>Alterar configuração de senha do caixa</span>
                                    </label>
                                    <small style={{ color: '#9ca3af', marginLeft: 26, display: 'block', marginTop: 2 }}>
                                        Pode ativar ou desativar a exigência de senha para todos os usuários nas Configurações
                                    </small>
                                </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </Dialog>

            {/* ── Modal: Gerenciar Cargos ── */}
            <Dialog
                header="Gerenciar Cargos"
                visible={cargosDialog}
                style={{ width: 'min(900px, 96vw)' }}
                contentStyle={{ maxHeight: '72vh', overflowY: 'auto' }}
                breakpoints={{ '960px': '90vw', '640px': '96vw' }}
                modal
                onHide={() => { setCargosDialog(false); setCargoEditando(null); setCargoNome(''); setCargoPermissoes([]); }}
                footer={<Button label="Fechar" icon="pi pi-times" className="p-button-text" onClick={() => setCargosDialog(false)} />}
            >
                {/* Formulário novo/editar cargo */}
                <div className="p-3 mb-3 border-round" style={{ background: 'rgba(30,136,229,0.06)', border: '1px solid #dee2e6' }}>
                    <p className="font-semibold mb-2">{cargoEditando ? `Editando: ${cargoEditando.nome}` : 'Novo Cargo'}</p>
                    <div className="field mb-2">
                        <label className="text-sm font-medium">Nome do cargo *</label>
                        <InputText value={cargoNome} onChange={e => setCargoNome(e.target.value)}
                            placeholder="Ex: Caixa, Vendedor..." className="w-full mt-1" />
                    </div>
                    <div className="field mb-3">
                        <label className="text-sm font-medium">Permissões padrão deste cargo:</label>
                        {!modulosCarregados ? (
                            <div className="flex align-items-center mt-2 gap-2">
                                <i className="pi pi-spin pi-spinner" style={{ color: '#1e88e5' }} />
                                <span className="text-sm text-color-secondary">Carregando módulos...</span>
                            </div>
                        ) : (
                            <div className="mt-2 flex flex-column gap-3">
                                {GRUPOS_ABAS.map(grupo => {
                                    const abasDoGrupo = abasDisponiveis().filter(a => grupo.rotas.includes(a.rota));
                                    if (abasDoGrupo.length === 0) return null;
                                    const todasMarcadas = abasDoGrupo.every(a => cargoPermissoes.includes(a.rota));
                                    const algumas = abasDoGrupo.some(a => cargoPermissoes.includes(a.rota));
                                    return (
                                        <div key={grupo.label}>
                                            {/* Cabeçalho do grupo com toggle geral */}
                                            <div className="flex align-items-center gap-2 mb-2 pb-1"
                                                style={{ borderBottom: `2px solid ${grupo.cor}20` }}>
                                                <div
                                                    style={{ width: '18px', height: '18px', minWidth: '18px', border: `2px solid ${todasMarcadas ? grupo.cor : algumas ? grupo.cor : '#ced4da'}`, borderRadius: '4px', backgroundColor: todasMarcadas ? grupo.cor : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                                                    onClick={() => {
                                                        if (todasMarcadas) {
                                                            setCargoPermissoes(prev => prev.filter(r => !grupo.rotas.includes(r)));
                                                        } else {
                                                            setCargoPermissoes(prev => Array.from(new Set([...prev, ...abasDoGrupo.map(a => a.rota)])));
                                                        }
                                                    }}
                                                >
                                                    {todasMarcadas && <i className="pi pi-check" style={{ color: 'white', fontSize: '9px' }} />}
                                                    {!todasMarcadas && algumas && <div style={{ width: '8px', height: '2px', backgroundColor: grupo.cor }} />}
                                                </div>
                                                <i className={`pi ${grupo.icon}`} style={{ color: grupo.cor, fontSize: '13px' }} />
                                                <span className="font-semibold text-sm" style={{ color: grupo.cor }}>{grupo.label}</span>
                                            </div>
                                            {/* Itens do grupo */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', paddingLeft: '6px' }}>
                                                {abasDoGrupo.map(aba => {
                                                    const marcado = cargoPermissoes.includes(aba.rota);
                                                    const isPonto = aba.rota === '/uikit/ponto';
                                                    const isPlanejamento = aba.rota === '/uikit/message';
                                                    const isAgendamento = aba.rota === '/uikit/agendamentos';
                                                    const isComissoes = aba.rota === '/uikit/comissoes';
                                                    const podeVerTodosPonto = cargoPermissoes.includes('ponto:todos');
                                                    const podeVerTodosPlanejamento = cargoPermissoes.includes('planejamento:todos');
                                                    const podeVerTodosAgendamento = cargoPermissoes.includes('agendamento:todos');
                                                    const podeVerTodasComissoes = cargoPermissoes.includes('comissoes:todos');
                                                    const spanFull = (isPonto || isPlanejamento || isAgendamento || isComissoes) && marcado;
                                                    return (
                                                        <div key={aba.rota} style={{ gridColumn: spanFull ? '1 / -1' : undefined }}>
                                                            <div className="flex align-items-center gap-2" style={{ cursor: 'pointer' }}
                                                                onClick={() => setCargoPermissoes(prev => {
                                                                    if (marcado) {
                                                                        return prev.filter(r => r !== aba.rota && r !== 'ponto:todos' && r !== 'planejamento:todos' && r !== 'agendamento:todos' && r !== 'comissoes:todos');
                                                                    }
                                                                    return [...prev, aba.rota];
                                                                })}>
                                                                <div style={{ width: '14px', height: '14px', minWidth: '14px', border: `2px solid ${marcado ? grupo.cor : '#ced4da'}`, borderRadius: '3px', backgroundColor: marcado ? grupo.cor : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    {marcado && <i className="pi pi-check" style={{ color: 'white', fontSize: '8px' }} />}
                                                                </div>
                                                                <span className="text-sm">{aba.label}</span>
                                                            </div>
                                                            {isPonto && marcado && (
                                                                <div className="flex gap-3 mt-1 ml-4" onClick={e => e.stopPropagation()}>
                                                                    <label className="flex align-items-center gap-1 text-xs" style={{ cursor: 'pointer', color: '#6c757d' }}>
                                                                        <input type="radio" name={`ponto_scope_cargo_${cargoNome}`}
                                                                            checked={!podeVerTodosPonto}
                                                                            onChange={() => setCargoPermissoes(prev => prev.filter(r => r !== 'ponto:todos'))}
                                                                            style={{ accentColor: grupo.cor }}
                                                                        />
                                                                        Apenas o próprio
                                                                    </label>
                                                                    <label className="flex align-items-center gap-1 text-xs" style={{ cursor: 'pointer', color: '#6c757d' }}>
                                                                        <input type="radio" name={`ponto_scope_cargo_${cargoNome}`}
                                                                            checked={podeVerTodosPonto}
                                                                            onChange={() => setCargoPermissoes(prev => [...prev.filter(r => r !== 'ponto:todos'), 'ponto:todos'])}
                                                                            style={{ accentColor: grupo.cor }}
                                                                        />
                                                                        Todos os funcionários
                                                                    </label>
                                                                </div>
                                                            )}
                                                            {isPlanejamento && marcado && (
                                                                <div className="flex gap-3 mt-1 ml-4" onClick={e => e.stopPropagation()}>
                                                                    <label className="flex align-items-center gap-1 text-xs" style={{ cursor: 'pointer', color: '#6c757d' }}>
                                                                        <input type="radio" name={`plan_scope_cargo_${cargoNome}`}
                                                                            checked={!podeVerTodosPlanejamento}
                                                                            onChange={() => setCargoPermissoes(prev => prev.filter(r => r !== 'planejamento:todos'))}
                                                                            style={{ accentColor: grupo.cor }}
                                                                        />
                                                                        Apenas as próprias tarefas
                                                                    </label>
                                                                    <label className="flex align-items-center gap-1 text-xs" style={{ cursor: 'pointer', color: '#6c757d' }}>
                                                                        <input type="radio" name={`plan_scope_cargo_${cargoNome}`}
                                                                            checked={podeVerTodosPlanejamento}
                                                                            onChange={() => setCargoPermissoes(prev => [...prev.filter(r => r !== 'planejamento:todos'), 'planejamento:todos'])}
                                                                            style={{ accentColor: grupo.cor }}
                                                                        />
                                                                        Todas as tarefas
                                                                    </label>
                                                                </div>
                                                            )}
                                                            {isAgendamento && marcado && (
                                                                <div className="flex gap-3 mt-1 ml-4" onClick={e => e.stopPropagation()}>
                                                                    <label className="flex align-items-center gap-1 text-xs" style={{ cursor: 'pointer', color: '#6c757d' }}>
                                                                        <input type="radio" name={`agend_scope_cargo_${cargoNome}`}
                                                                            checked={!podeVerTodosAgendamento}
                                                                            onChange={() => setCargoPermissoes(prev => prev.filter(r => r !== 'agendamento:todos'))}
                                                                            style={{ accentColor: grupo.cor }}
                                                                        />
                                                                        Apenas os próprios agendamentos
                                                                    </label>
                                                                    <label className="flex align-items-center gap-1 text-xs" style={{ cursor: 'pointer', color: '#6c757d' }}>
                                                                        <input type="radio" name={`agend_scope_cargo_${cargoNome}`}
                                                                            checked={podeVerTodosAgendamento}
                                                                            onChange={() => setCargoPermissoes(prev => [...prev.filter(r => r !== 'agendamento:todos'), 'agendamento:todos'])}
                                                                            style={{ accentColor: grupo.cor }}
                                                                        />
                                                                        Todos os agendamentos
                                                                    </label>
                                                                </div>
                                                            )}
                                                            {isComissoes && marcado && (
                                                                <div className="flex gap-3 mt-1 ml-4" onClick={e => e.stopPropagation()}>
                                                                    <label className="flex align-items-center gap-1 text-xs" style={{ cursor: 'pointer', color: '#6c757d' }}>
                                                                        <input type="radio" name={`comissoes_scope_cargo_${cargoNome}`}
                                                                            checked={!podeVerTodasComissoes}
                                                                            onChange={() => setCargoPermissoes(prev => prev.filter(r => r !== 'comissoes:todos'))}
                                                                            style={{ accentColor: grupo.cor }}
                                                                        />
                                                                        Apenas as próprias comissões
                                                                    </label>
                                                                    <label className="flex align-items-center gap-1 text-xs" style={{ cursor: 'pointer', color: '#6c757d' }}>
                                                                        <input type="radio" name={`comissoes_scope_cargo_${cargoNome}`}
                                                                            checked={podeVerTodasComissoes}
                                                                            onChange={() => setCargoPermissoes(prev => [...prev.filter(r => r !== 'comissoes:todos'), 'comissoes:todos'])}
                                                                            style={{ accentColor: grupo.cor }}
                                                                        />
                                                                        Comissões de todos
                                                                    </label>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    {/* Permissões especiais */}
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e5e7eb' }}>
                        <span className="text-xs font-semibold text-color-secondary mb-2 block">Permissões especiais</span>
                        <div className="flex flex-column gap-2">
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}
                                onClick={() => setCargoPermissoes(prev =>
                                    prev.includes('senha:ver')
                                        ? prev.filter(r => r !== 'senha:ver')
                                        : [...prev, 'senha:ver']
                                )}>
                                <div style={{
                                    width: 14, height: 14, minWidth: 14,
                                    border: `2px solid ${cargoPermissoes.includes('senha:ver') ? '#dc2626' : '#ced4da'}`,
                                    borderRadius: 3,
                                    backgroundColor: cargoPermissoes.includes('senha:ver') ? '#dc2626' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    {cargoPermissoes.includes('senha:ver') && <i className="pi pi-check" style={{ color: 'white', fontSize: 8 }} />}
                                </div>
                                <i className="pi pi-eye" style={{ color: '#dc2626', fontSize: 12 }} />
                                <span style={{ fontWeight: 600, color: '#dc2626' }}>Pode visualizar senhas de outros usuários</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}
                                onClick={() => setCargoPermissoes(prev =>
                                    prev.includes('caixa:pular_senha')
                                        ? prev.filter(r => r !== 'caixa:pular_senha')
                                        : [...prev, 'caixa:pular_senha']
                                )}>
                                <div style={{
                                    width: 14, height: 14, minWidth: 14,
                                    border: `2px solid ${cargoPermissoes.includes('caixa:pular_senha') ? '#f59e0b' : '#ced4da'}`,
                                    borderRadius: 3,
                                    backgroundColor: cargoPermissoes.includes('caixa:pular_senha') ? '#f59e0b' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    {cargoPermissoes.includes('caixa:pular_senha') && <i className="pi pi-check" style={{ color: 'white', fontSize: 8 }} />}
                                </div>
                                <i className="pi pi-lock-open" style={{ color: '#f59e0b', fontSize: 12 }} />
                                <span style={{ fontWeight: 600, color: '#b45309' }}>Alterar configuração de senha do caixa</span>
                            </label>
                        </div>
                    </div>

                    <div className="flex gap-2 justify-content-end mt-2">
                        {cargoEditando && (
                            <Button label="Cancelar" icon="pi pi-times" size="small" className="p-button-text"
                                onClick={() => { setCargoEditando(null); setCargoNome(''); setCargoPermissoes([]); }} />
                        )}
                        <Button label={cargoEditando ? 'Salvar alterações' : 'Adicionar cargo'} icon="pi pi-check" size="small" onClick={salvarCargo} />
                    </div>
                </div>

                {/* Lista de cargos cadastrados */}
                <div className="mt-2">
                    <p className="font-semibold text-sm mb-2" style={{ color: '#6c757d' }}>
                        {cargos.length === 0 ? 'Nenhum cargo cadastrado ainda.' : `${cargos.length} cargo(s) cadastrado(s)`}
                    </p>
                    {cargos.map(c => {
                        const gruposDosCargo = GRUPOS_ABAS.filter(g => g.rotas.some(r => c.permissoes.includes(r)));
                        return (
                            <div key={c.nome} className="p-3 mb-2 border-round"
                                style={{ border: cargoEditando?.nome === c.nome ? '2px solid #1e88e5' : '1px solid #dee2e6', background: cargoEditando?.nome === c.nome ? 'rgba(30,136,229,0.04)' : 'transparent', transition: 'all 0.2s' }}>
                                <div className="flex align-items-start justify-content-between gap-2">
                                    <div className="flex-1">
                                        <div className="flex align-items-center gap-2 mb-2">
                                            <i className="pi pi-briefcase" style={{ color: '#1e88e5', fontSize: '13px' }} />
                                            <span className="font-semibold">{c.nome}</span>
                                            {c.permissoes.length === 0 && (
                                                <span className="text-xs text-color-secondary">(sem permissões)</span>
                                            )}
                                        </div>
                                        {gruposDosCargo.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {gruposDosCargo.map(g => {
                                                    const total = g.rotas.filter(r => c.permissoes.includes(r)).length;
                                                    const all = g.rotas.filter(r => abasDisponiveis().some(a => a.rota === r)).length;
                                                    return (
                                                        <span key={g.label} className="text-xs px-2 py-1 border-round-lg"
                                                            style={{ backgroundColor: `${g.cor}18`, color: g.cor, border: `1px solid ${g.cor}40`, fontWeight: 500 }}>
                                                            <i className={`pi ${g.icon} mr-1`} style={{ fontSize: '10px' }} />
                                                            {g.label} {total < all ? `(${total}/${all})` : ''}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-1">
                                        <Button icon="pi pi-pencil" rounded outlined severity="info" size="small"
                                            tooltip="Editar permissões" tooltipOptions={{ position: 'top' }} onClick={() => editarCargo(c)} />
                                        <Button icon="pi pi-trash" rounded outlined severity="danger" size="small"
                                            tooltip="Excluir cargo" tooltipOptions={{ position: 'top' }} onClick={() => excluirCargo(c.nome)} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Dialog>
        </div>
    );
};

export default GestaoAcessosPage;
