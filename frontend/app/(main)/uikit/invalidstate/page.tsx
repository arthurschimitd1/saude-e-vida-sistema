"use client";

import React, { useState, useEffect, useRef } from "react";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { InputMask } from "primereact/inputmask";
import { Password } from "primereact/password";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dialog } from "primereact/dialog";
import { Divider } from "primereact/divider";
import { Tag } from "primereact/tag";
import { confirmDialog, ConfirmDialog } from "primereact/confirmdialog";
import api from '../../services/api/baseApi';

interface User {
    id?: number;
    nomeCompleto: string;
    cpf: string;
    cargo: string;
    cep?: string;
    rua: string;
    bairro: string;
    cidade: string;
    estado: string;
    pais: string;
    numero: string;
    pontoReferencia?: string;
    email: string;
    senha: string;
    permissoes?: string[];
    empresa_id?: number | null;
    tipo?: string;
    avatar_url?: string;
    avatar_position?: string;
}

const USER_VAZIO: User = {
    nomeCompleto: "", cpf: "", cargo: "", cep: "", rua: "", bairro: "",
    cidade: "", estado: "", pais: "Brasil", numero: "", pontoReferencia: "",
    email: "", senha: "", permissoes: []
};

const DEFAULT_AVATAR_POSITION = '50% 50%';

const UserRegistrationPage = () => {
    const toast = useRef<Toast>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [user, setUser] = useState<User>(USER_VAZIO);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [expandedRows, setExpandedRows] = useState<any>(null);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [displayUserDialog, setDisplayUserDialog] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searchNome, setSearchNome] = useState('');

    // Filtro por empresa (só para MASTER)
    const [isMaster, setIsMaster] = useState(false);
    const [empresas, setEmpresas] = useState<{ label: string; value: number | null }[]>([]);
    const [empresaFiltro, setEmpresaFiltro] = useState<number | null>(null);
    const [empresaDoForm, setEmpresaDoForm] = useState<number | null>(null); // empresa escolhida no formulário pelo MASTER
    const [empresaMap, setEmpresaMap] = useState<Record<number, string>>({}); // id → nome

    // Visualizar usuário com senha (requer autenticação de Gerente/Dono/Master)
    const [verSenhaDialog, setVerSenhaDialog] = useState(false);
    const [usuarioAlvo, setUsuarioAlvo] = useState<User | null>(null);
    const [autenticadores, setAutenticadores] = useState<{ label: string; value: number; email: string; cargo: string }[]>([]);
    const [autenticadorId, setAutenticadorId] = useState<number | null>(null);
    const [autenticadorSenha, setAutenticadorSenha] = useState('');
    const [autenticando, setAutenticando] = useState(false);
    const [senhaRevelada, setSenhaRevelada] = useState<string | null>(null);
    const [verSenhaVisivel, setVerSenhaVisivel] = useState(false);
    // Redefinição de senha quando senha_texto não está disponível
    const [redefinirMode, setRedefinirMode] = useState(false);
    const [novaSenha, setNovaSenha] = useState('');
    const [salvandoSenha, setSalvandoSenha] = useState(false);

    // Avatar
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [avatarPosition, setAvatarPosition] = useState(DEFAULT_AVATAR_POSITION);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Upload de avatar (mesmo padrão do Estoque de Roupas)
    const uploadAvatar = async (file: File) => {
        const formData = new FormData();
        formData.append('avatar', file);

        const response = await api.post('/users/avatar/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data; // { avatar_url, public_id }
    };

    const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validações
        if (file.size > 5 * 1024 * 1024) {
            toast.current?.show({
                severity: 'error',
                summary: 'Erro',
                detail: 'A imagem deve ter no máximo 5MB',
                life: 3000
            });
            return;
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            toast.current?.show({
                severity: 'error',
                summary: 'Erro',
                detail: 'Formato não suportado. Use JPG, PNG, GIF ou WebP',
                life: 3000
            });
            return;
        }

        setAvatarFile(file);
        setAvatarPreview(URL.createObjectURL(file));
    };

    const clearAvatar = () => {
        setAvatarFile(null);
        setAvatarPreview(null);
        setAvatarPosition(DEFAULT_AVATAR_POSITION);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    
    // Função para obter o token do localStorage
    const getToken = () => {
        return localStorage.getItem('token');
    };

    // Função para verificar se está logado
    const isAuthenticated = () => {
        const token = getToken();
        if (!token) {
            window.location.href = '/auth/login';
            return false;
        }
        return true;
    };
    
    const [cargos, setCargos] = useState<{ label: string; value: string }[]>([]);
    const [cargosCompletos, setCargosCompletos] = useState<{ nome: string; permissoes: string[] }[]>([]);

    const cargosFixos = [
        { label: "Dono", value: "Dono" },
        { label: "Administrador", value: "Administrador" },
        { label: "Gerente", value: "Gerente" },
        { label: "Colaborador", value: "Colaborador" },
        { label: "Visitante", value: "Visitante" },
    ];

    const carregarCargos = async () => {
        try {
            const u = JSON.parse(localStorage.getItem('user') ?? '{}');
            const ec = localStorage.getItem('empresa_selecionada');
            const isMaster = u?.tipo === 'MASTER' || u?.email === 'admin@master.com';
            const eid = isMaster && ec ? Number(ec) : u?.empresa_id;
            if (!eid) { setCargos(cargosFixos); return; }
            const res = await api.get(`/empresas/${eid}/cargos`);
            const personalizados: { nome: string; permissoes: string[] }[] = Array.isArray(res.data) ? res.data : [];
            setCargosCompletos(personalizados);
            setCargos([
                ...cargosFixos,
                ...personalizados
                    .filter(c => !cargosFixos.find(f => f.value === c.nome))
                    .map(c => ({ label: `${c.nome} ★`, value: c.nome }))
            ]);
        } catch {
            setCargos(cargosFixos);
        }
    };

    const estadosBrasil = [
        { label: "Acre", value: "AC" },
        { label: "Alagoas", value: "AL" },
        { label: "Amapá", value: "AP" },
        { label: "Amazonas", value: "AM" },
        { label: "Bahia", value: "BA" },
        { label: "Ceará", value: "CE" },
        { label: "Distrito Federal", value: "DF" },
        { label: "Espírito Santo", value: "ES" },
        { label: "Goiás", value: "GO" },
        { label: "Maranhão", value: "MA" },
        { label: "Mato Grosso", value: "MT" },
        { label: "Mato Grosso do Sul", value: "MS" },
        { label: "Minas Gerais", value: "MG" },
        { label: "Pará", value: "PA" },
        { label: "Paraíba", value: "PB" },
        { label: "Paraná", value: "PR" },
        { label: "Pernambuco", value: "PE" },
        { label: "Piauí", value: "PI" },
        { label: "Rio de Janeiro", value: "RJ" },
        { label: "Rio Grande do Norte", value: "RN" },
        { label: "Rio Grande do Sul", value: "RS" },
        { label: "Rondônia", value: "RO" },
        { label: "Roraima", value: "RR" },
        { label: "Santa Catarina", value: "SC" },
        { label: "São Paulo", value: "SP" },
        { label: "Sergipe", value: "SE" },
        { label: "Tocantins", value: "TO" }
    ];

    // Função para buscar usuários
    const fetchUsers = async (filtroEmpresa?: number | null) => {
        if (!isAuthenticated()) return;
        setLoading(true);
        try {
            const params: Record<string, any> = {};
            if (filtroEmpresa) params.empresa_id = filtroEmpresa;
            const res = await api.get('/users', { params });
            setUsers(res.data?.data ?? res.data ?? []);
        } catch (error) {
            console.error('Erro:', error);
            toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar usuários', life: 3000 });
        } finally {
            setLoading(false);
        }
    };

    // Inicialização única: lê contexto do localStorage e dispara fetchUsers uma só vez
    useEffect(() => {
        try {
            const u = JSON.parse(localStorage.getItem('user') ?? '{}');
            if (u?.tipo === 'MASTER' || u?.email === 'admin@master.com') {
                setIsMaster(true);
                api.get('/empresas').then(res => {
                    const raw = res.data ?? [];
                    const lista = raw.map((e: any) => ({ label: e.nomeEmpresa ?? e.nome, value: e.id }));
                    setEmpresas([{ label: 'Todas as empresas', value: null }, ...lista]);
                    const mapa: Record<number, string> = {};
                    raw.forEach((e: any) => { mapa[e.id] = e.nomeEmpresa ?? e.nome; });
                    setEmpresaMap(mapa);
                }).catch(() => {});
            }
            // Lê empresa selecionada no topbar e usa na primeira busca
            const saved = localStorage.getItem('empresa_selecionada');
            const empId = saved && !isNaN(Number(saved)) ? Number(saved) : null;
            if (empId) { setEmpresaFiltro(empId); setEmpresaDoForm(empId); }
            fetchUsers(empId);
        } catch {
            fetchUsers();
        }
        carregarCargos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Recarrega quando o usuário muda o filtro manualmente no dropdown (ignora o mount)
    const mountedRef = React.useRef(false);
    useEffect(() => {
        if (!mountedRef.current) { mountedRef.current = true; return; }
        fetchUsers(empresaFiltro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [empresaFiltro]);

    // ── Visualizar senha do usuário ──
    const abrirVerSenha = async (alvo: User) => {
        setUsuarioAlvo(alvo);
        setSenhaRevelada(null);
        setAutenticadorId(null);
        setAutenticadorSenha('');
        setVerSenhaVisivel(false);
        setRedefinirMode(false);
        setNovaSenha('');

        // Se for MASTER: acesso direto
        if (isMaster) {
            try {
                const res = await api.get(`/users/${alvo.id}/senha`);
                setSenhaRevelada(res.data.senha);
            } catch {
                setRedefinirMode(true);
            }
            setVerSenhaDialog(true);
            return;
        }

        // Conta de empresa: precisa autenticar um Gerente, Dono, Administrador ou quem tem senha:ver
        const cargosPermitidos = ['Gerente', 'Dono', 'Administrador'];
        const lista = users
            .filter(u => cargosPermitidos.includes(u.cargo) || (u.permissoes ?? []).includes('senha:ver'))
            .map(u => ({ label: `${u.nomeCompleto} (${u.cargo})`, value: u.id!, email: u.email, cargo: u.cargo }));

        // Inclui o próprio usuário logado se tiver cargo ou permissão
        try {
            const logado = JSON.parse(localStorage.getItem('user') ?? '{}');
            const logadoTemPermissao = cargosPermitidos.includes(logado.cargo) || (logado.permissoes ?? []).includes('senha:ver');
            if (logado?.email && logadoTemPermissao && !lista.find(l => l.email === logado.email)) {
                lista.unshift({ label: `${logado.nomeCompleto ?? logado.email} (${logado.cargo})`, value: logado.id, email: logado.email, cargo: logado.cargo });
            }
        } catch {}

        setAutenticadores(lista);
        setVerSenhaDialog(true);
    };

    const confirmarVerSenha = async () => {
        if (autenticadorId === null) return toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Selecione quem está autenticando', life: 3000 });
        if (!autenticadorSenha.trim()) return toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Digite a senha', life: 3000 });

        const autenticador = autenticadores.find(a => a.value === autenticadorId);
        if (!autenticador) return;

        setAutenticando(true);
        try {
            // Autentica quem está autorizando
            const resp = await api.post('/auth/login', {
                email: autenticador.email,
                senha: autenticadorSenha,
            }, { skipAuthInterceptor: true } as any);

            // Login válido — usa dados já carregados (não depende do formato do resp)
            const tokenAutenticador: string = resp.data?.token ?? '';
            const userCompleto = users.find(u => u.id === autenticadorId);
            const cargo = userCompleto?.cargo ?? autenticador.cargo ?? '';
            const tipo = userCompleto?.tipo ?? resp.data?.user?.tipo ?? '';
            const permissoesAutenticador: string[] = userCompleto?.permissoes ?? [];
            const ehMaster = tipo === 'MASTER' || cargo === 'MASTER';
            const temPermissao = ehMaster
                || ['Gerente', 'Dono', 'Administrador'].includes(cargo)
                || permissoesAutenticador.includes('senha:ver');

            if (!temPermissao) {
                toast.current?.show({ severity: 'error', summary: 'Sem permissão', detail: 'Este usuário não tem permissão para visualizar senhas', life: 3000 });
                return;
            }

            // Usa o token do autenticador (não o do usuário logado) para buscar a senha
            const res = await api.get(`/users/${usuarioAlvo?.id}/senha`, {
                headers: tokenAutenticador ? { Authorization: `Bearer ${tokenAutenticador}` } : undefined,
            });
            setSenhaRevelada(res.data.senha);
            
        } catch (err: any) {
            // Se der 404 ou erro, entra no modo redefinição
            if (err.status === 404) {
                setRedefinirMode(true);
            } else {
                toast.current?.show({ severity: 'error', summary: 'Erro', detail: err?.message || 'Senha incorreta', life: 3000 });
            }
        } finally {
            setAutenticando(false);
        }
    };

    const salvarNovaSenha = async () => {
        if (!novaSenha.trim()) return toast.current?.show({ severity: 'error', summary: 'Erro', detail: 'Digite a nova senha', life: 3000 });
        setSalvandoSenha(true);
        try {
            // ✅ USA API EM VEZ DE FETCH
            await api.put(`/users/${usuarioAlvo?.id}`, { senha: novaSenha });
            setSenhaRevelada(novaSenha);
            setRedefinirMode(false);
            toast.current?.show({ severity: 'success', summary: 'Sucesso', detail: 'Senha redefinida!', life: 3000 });
        } catch (err: any) {
            toast.current?.show({ severity: 'error', summary: 'Erro', detail: err?.message || 'Erro ao salvar', life: 3000 });
        } finally {
            setSalvandoSenha(false);
        }
    };

    const handleInputChange = (e: any) => {
        const { name, value } = e.target;
        setUser(prev => ({ ...prev, [name]: value }));
    };

    const handleCepBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
        const cep = e.target.value.replace(/\D/g, '');
        if (cep.length === 8) {
            try {
                const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                const data = await response.json();
                if (!data.erro) {
                    setUser(prev => ({
                        ...prev,
                        cep: data.cep,
                        rua: data.logradouro,
                        bairro: data.bairro,
                        cidade: data.localidade,
                        estado: data.uf
                    }));
                }
            } catch (error) {
                console.error("Erro ao buscar CEP:", error);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!isAuthenticated()) return;

        // Validação básica (senha só obrigatória para novo cadastro)
        const senhaObrigatoria = editingId === null;
        if (!user.nomeCompleto || !user.cargo || !user.email || (senhaObrigatoria && !user.senha)) {
            toast.current?.show({
                severity: 'error',
                summary: 'Erro',
                detail: 'Preencha todos os campos obrigatórios',
                life: 3000
            });
            return;
        }

        try {
            setLoading(true);

            // Se tem avatar novo, faz upload primeiro
            let avatarData = null;
            if (avatarFile) {
                try {
                    avatarData = await uploadAvatar(avatarFile);
                } catch (uploadError: any) {
                    toast.current?.show({
                        severity: 'error',
                        summary: 'Erro',
                        detail: uploadError?.message || 'Falha ao fazer upload da foto',
                        life: 3000
                    });
                    setLoading(false);
                    return;
                }
            }

            const payload: any = { ...user };

            // Não envia senha vazia na edição (mantém a senha atual no banco)
            if (editingId !== null && !payload.senha) {
                delete payload.senha;
            }

            // MASTER: usa a empresa escolhida no formulário
            if (isMaster && empresaDoForm) {
                payload.empresa_id = empresaDoForm;
            }

            // Adiciona avatar_url se fez upload
            if (avatarData) {
                payload.avatar_url = avatarData.avatar_url;
            }
            payload.avatar_position = avatarPosition;

            let result;
            if (editingId !== null) {
                result = await api.put(`/users/${editingId}`, payload);
            } else {
                result = await api.post('/users', payload);
            }
            
            toast.current?.show({
                severity: 'success',
                summary: 'Sucesso',
                detail: editingId !== null 
                    ? 'Usuário atualizado com sucesso' 
                    : 'Usuário cadastrado com sucesso',
                life: 3000
            });

            // Atualizar a lista de usuários
            await fetchUsers(empresaFiltro);
            
            // Reset
            setUser(USER_VAZIO);
            setEditingId(null);
            setShowForm(false);
            clearAvatar();
        } catch (error: any) {
            console.error('Erro:', error);

            // ✅ Tratamento de erro 401
            if (error.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/auth/login';
                toast.current?.show({
                    severity: 'error',
                    summary: 'Sessão expirada',
                    detail: 'Faça login novamente',
                    life: 3000
                });
                return;
            }
            
            toast.current?.show({
                severity: 'error',
                summary: 'Erro',
                detail: error.message || 'Erro desconhecido',
                life: 3000
            });
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (userToEdit: User) => {
        setUser(userToEdit);
        setEditingId(userToEdit.id || null);
        setShowForm(true);
        
        // Carrega preview do avatar existente
        if (userToEdit.avatar_url) {
            setAvatarPreview(userToEdit.avatar_url);
        } else {
            clearAvatar();
        }
        setAvatarPosition(userToEdit.avatar_position || DEFAULT_AVATAR_POSITION);
    };

    const confirmDelete = (id: number, nome: string) => {
        confirmDialog({
            message: `Deseja realmente excluir o usuário "${nome}"?`,
            header: 'Confirmar exclusão',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Sim, excluir',
            rejectLabel: 'Cancelar',
            acceptClassName: 'p-button-danger',
            accept: () => handleDelete(id)
        });
    };

    const handleDelete = async (id: number) => {
        if (!isAuthenticated()) return;
        
        try {
            setLoading(true);
            
            // ✅ USA API EM VEZ DE FETCH
            await api.delete(`/users/${id}`);

            toast.current?.show({
                severity: 'success',
                summary: 'Sucesso',
                detail: 'Usuário removido com sucesso',
                life: 3000
            });

            // Atualizar a lista de usuários
            await fetchUsers(empresaFiltro);
            
            if (editingId === id) {
                setEditingId(null);
                setUser(USER_VAZIO);
            }
        } catch (error: any) {
            console.error('Erro:', error);
            
            // ✅ Tratamento de erro 401
            if (error.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/auth/login';
                toast.current?.show({
                    severity: 'error',
                    summary: 'Sessão expirada',
                    detail: 'Faça login novamente',
                    life: 3000
                });
                return;
            }
            
            toast.current?.show({
                severity: 'error',
                summary: 'Erro',
                detail: 'Falha ao remover usuário',
                life: 3000
            });
        } finally {
            setLoading(false);
        }
    };

    const rowExpansionTemplate = (data: User) => {
        return (
            <div className="p-3">
                <div className="grid">
                    <div className="col-12 md:col-6">
                        <div className="field">
                            <label>CPF</label>
                            <p>{data.cpf}</p>
                        </div>
                        <div className="field">
                            <label>Cargo</label>
                            <Tag value={data.cargo} severity="info" />
                        </div>
                        <div className="field">
                            <label>Email</label>
                            <p>{data.email}</p>
                        </div>
                    </div>
                    <div className="col-12 md:col-6">
                        <div className="field">
                            <label>Endereço</label>
                            <p>
                                {data.rua}, {data.numero}<br />
                                {data.bairro}<br />
                                {data.cidade} - {data.estado}<br />
                                {data.cep && `CEP: ${data.cep}`}
                            </p>
                        </div>
                        {data.pontoReferencia && (
                            <div className="field">
                                <label>Ponto de Referência</label>
                                <p>{data.pontoReferencia}</p>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex justify-content-end gap-2 mt-3">
                    <Button
                        icon="pi pi-pencil"
                        rounded
                        outlined
                        severity="info"
                        tooltip="Editar"
                        tooltipOptions={{ position: 'top' }}
                        onClick={() => handleEdit(data)}
                    />
                    <Button
                        icon="pi pi-trash"
                        rounded
                        outlined
                        severity="danger"
                        tooltip="Excluir"
                        tooltipOptions={{ position: 'top' }}
                        onClick={() => data.id && confirmDelete(data.id, data.nomeCompleto)}
                    />
                </div>
            </div>
        );
    };

    const nameBodyTemplate = (rowData: User) => {
        return (
            <span 
                className="text-primary cursor-pointer font-semibold" 
                onClick={() => {
                    setSelectedUser(rowData);
                    setDisplayUserDialog(true);
                }}
            >
                {rowData.nomeCompleto}
            </span>
        );
    };

    const userDialogFooter = (
        <Button 
            label="Fechar" 
            icon="pi pi-times" 
            onClick={() => setDisplayUserDialog(false)} 
            className="p-button-text" 
        />
    );

    return (
        <div className="p-4">
            <Toast ref={toast} />
            <h1 className="text-2xl font-bold mb-6">Cadastro de Usuários</h1>
            
            <div className="flex justify-content-between align-items-center mb-4 gap-2 flex-wrap">
                <div className="flex gap-2 flex-wrap">
                    <InputText
                        value={searchNome}
                        onChange={(e) => setSearchNome(e.target.value)}
                        placeholder="Pesquisar por nome..."
                    />
                    {isMaster && (
                        <Dropdown
                            value={empresaFiltro}
                            options={empresas}
                            onChange={(e) => setEmpresaFiltro(e.value)}
                            placeholder="Filtrar por empresa"
                            style={{ minWidth: '200px' }}
                        />
                    )}
                </div>
                {!showForm && (
                    <Button
                        label="Novo Usuário"
                        icon="pi pi-plus"
                        className="p-button-primary"
                        onClick={() => {
                            setShowForm(true);
                            setEditingId(null);
                            setUser({
                                nomeCompleto: "",
                                cpf: "",
                                cargo: "",
                                cep: "",
                                rua: "",
                                bairro: "",
                                cidade: "",
                                estado: "",
                                pais: "Brasil",
                                numero: "",
                                pontoReferencia: "",
                                email: "",
                                senha: ""
                            });
                        }}
                    />
                )}
            </div>
            
            {showForm ? (
                <div className="card p-fluid">
                    <form onSubmit={handleSubmit}>
                        {/* Seleção de empresa — só para MASTER */}
                        {isMaster && user.tipo !== 'MASTER' && (
                            <div className="field mb-3">
                                <label htmlFor="empresaDoForm" className="font-semibold">
                                    <i className="pi pi-building mr-1" style={{ color: '#1e88e5' }} />
                                    Empresa *
                                </label>
                                <Dropdown
                                    id="empresaDoForm"
                                    value={empresaDoForm}
                                    options={empresas.filter(e => e.value !== null)}
                                    onChange={e => {
                                        setEmpresaDoForm(e.value);
                                        // Resetar cargo/permissões ao trocar empresa
                                        setUser(prev => ({ ...prev, cargo: '', permissoes: [] }));
                                    }}
                                    placeholder="Selecione a empresa do usuário"
                                    className="w-full"
                                    required
                                />
                                {!empresaDoForm && (
                                    <small className="text-orange-500">Selecione a empresa antes de preencher o cargo</small>
                                )}
                            </div>
                        )}

                        {/* Campo de Avatar */}
                        <div className="field mb-4">
                            <label className="font-semibold block mb-2">
                                <i className="pi pi-camera mr-2" style={{ color: 'var(--primary-color)' }} />
                                Foto do Usuário
                            </label>
                            <div className="flex align-items-start gap-3">
                                {/* Preview circular */}
                                <div 
                                    className="flex align-items-center justify-content-center border-circle overflow-hidden flex-shrink-0"
                                    style={{ 
                                        width: '100px', 
                                        height: '100px', 
                                        backgroundColor: 'var(--surface-100)',
                                        border: '2px solid var(--surface-300)'
                                    }}
                                >
                                    {avatarPreview ? (
                                        <img 
                                            src={avatarPreview} 
                                            alt="Preview"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: avatarPosition }}
                                        />
                                    ) : user.avatar_url ? (
                                        <img 
                                            src={user.avatar_url} 
                                            alt="Avatar atual"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: avatarPosition }}
                                        />
                                    ) : (
                                        <i className="pi pi-user" style={{ fontSize: '2.5rem', color: 'var(--surface-400)' }} />
                                    )}
                                </div>
                                
                                {/* Botões de upload */}
                                <div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleAvatarSelect}
                                        style={{ display: 'none' }}
                                    />
                                    <Button
                                        type="button"
                                        label={avatarFile || user.avatar_url ? 'Trocar foto' : 'Selecionar foto'}
                                        icon="pi pi-upload"
                                        className="p-button-outlined p-button-sm"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={loading}
                                    />
                                    {(avatarFile || user.avatar_url) && (
                                        <Button
                                            type="button"
                                            icon="pi pi-times"
                                            className="p-button-text p-button-sm p-button-danger ml-2"
                                            onClick={() => {
                                                clearAvatar();
                                                setUser(prev => ({ ...prev, avatar_url: '' }));
                                            }}
                                            disabled={loading}
                                        />
                                    )}
                                    <small className="block mt-1 text-color-secondary">
                                        JPG, PNG, GIF ou WebP (máx. 5MB)
                                    </small>
                                    {(avatarPreview || user.avatar_url) && (
                                        <div className="mt-3" style={{ width: '220px' }}>
                                            <div className="flex justify-content-between align-items-center mb-1">
                                                <small className="text-color-secondary">Ajustar enquadramento</small>
                                                <Button
                                                    type="button"
                                                    label="Centralizar"
                                                    text
                                                    size="small"
                                                    onClick={() => setAvatarPosition(DEFAULT_AVATAR_POSITION)}
                                                    disabled={loading}
                                                />
                                            </div>
                                            <div className="flex align-items-center gap-2 mb-1">
                                                <i className="pi pi-arrows-h text-color-secondary" />
                                                <input
                                                    aria-label="Posição horizontal da foto"
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    value={Number.parseInt(avatarPosition.split(' ')[0], 10) || 50}
                                                    onChange={(e) => setAvatarPosition(`${e.target.value}% ${avatarPosition.split(' ')[1] || '50%'}`)}
                                                    style={{ width: '100%' }}
                                                    disabled={loading}
                                                />
                                            </div>
                                            <div className="flex align-items-center gap-2">
                                                <i className="pi pi-arrows-v text-color-secondary" />
                                                <input
                                                    aria-label="Posição vertical da foto"
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    value={Number.parseInt(avatarPosition.split(' ')[1], 10) || 50}
                                                    onChange={(e) => setAvatarPosition(`${avatarPosition.split(' ')[0] || '50%'} ${e.target.value}%`)}
                                                    style={{ width: '100%' }}
                                                    disabled={loading}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid">
                            <div className="col-12 md:col-6">
                                <div className="field">
                                    <label htmlFor="nomeCompleto">Nome Completo*</label>
                                    <InputText
                                        id="nomeCompleto"
                                        name="nomeCompleto"
                                        value={user.nomeCompleto}
                                        onChange={handleInputChange}
                                        required
                                        disabled={loading}
                                    />
                                </div>
                                
                                <div className="field">
                                    <label htmlFor="cpf">CPF</label>
                                    <InputMask
                                        id="cpf"
                                        name="cpf"
                                        mask="999.999.999-99"
                                        value={user.cpf}
                                        onChange={handleInputChange}
                                        disabled={loading}
                                    />
                                </div>
                                
                                <div className="field">
                                    <label htmlFor="cargo">Cargo*</label>
                                    <Dropdown
                                        id="cargo"
                                        name="cargo"
                                        options={cargos}
                                        value={user.cargo}
                                        onChange={async (e) => {
                                            handleInputChange(e);
                                            // Cargos com acesso total
                                            const cargosTotal = ['Dono', 'Gerente', 'Administrador'];
                                            if (cargosTotal.includes(e.value)) {
                                                // Busca permissoes da empresa para limitar ao pacote dela
                                                try {
                                                    const u = JSON.parse(localStorage.getItem('user') ?? '{}');
                                                    const ec = localStorage.getItem('empresa_selecionada');
                                                    // MASTER: prioriza empresa escolhida no form
                                                    const empId = empresaDoForm ?? (ec ? Number(ec) : u?.empresa_id);
                                                    if (empId) {
                                                        const resp = await import('../../services/api/baseApi').then(m => m.default.get(`/access-control/companies/${empId}`));
                                                        const todasRotas = [
                                                            '/central-gestao',
                                                            '/uikit/formlayout', '/uikit/producao', '/uikit/relatorios-produtos', '/uikit/pedidos', '/uikit/fornecedores',
                                                            '/uikit/button', '/uikit/input',
                                                            '/uikit/table', '/financeiro/entradas', '/financeiro/contas-receber', '/financeiro/saidas', '/financeiro/relatorios', '/uikit/crm',
                                                            '/uikit/invalidstate', '/uikit/panel', '/uikit/media'
                                                        ];
                                                        const permEmpresa: string[] = resp.data?.permissions ?? resp.data?.modules ?? [];
                                                        const permissoes = todasRotas.filter(r => r === '/' || permEmpresa.includes(r));
                                                        setUser(prev => ({ ...prev, cargo: e.value, permissoes }));
                                                        return;
                                                    }
                                                } catch {}
                                            }
                                            // Cargo personalizado com permissões definidas
                                            const cargoCustom = cargosCompletos.find(c => c.nome === e.value);
                                            if (cargoCustom) {
                                                setUser(prev => ({ ...prev, cargo: e.value, permissoes: cargoCustom.permissoes }));
                                            }
                                        }}
                                        placeholder="Selecione um cargo"
                                        required
                                        disabled={loading}
                                        itemTemplate={(opt) => (
                                            <div className="flex align-items-center justify-content-between w-full">
                                                <span>{opt.label}</span>
                                                {cargosCompletos.find(c => c.nome === opt.value) && (
                                                    <span className="text-xs text-primary ml-2">permissões definidas</span>
                                                )}
                                            </div>
                                        )}
                                    />
                                    {user.cargo && cargosCompletos.find(c => c.nome === user.cargo) && (
                                        <small className="text-primary block mt-1">
                                            <i className="pi pi-check-circle mr-1" />
                                            Permissões do cargo serão aplicadas automaticamente
                                        </small>
                                    )}
                                </div>
                                
                                <div className="field">
                                    <label htmlFor="email">Email*</label>
                                    <InputText
                                        id="email"
                                        name="email"
                                        value={user.email}
                                        onChange={handleInputChange}
                                        type="email"
                                        required
                                        disabled={loading}
                                    />
                                </div>
                                
                                <div className="field">
                                    <label htmlFor="senha">
                                        Senha{editingId === null ? '*' : ' (deixe em branco para manter a atual)'}
                                    </label>
                                    <Password
                                        id="senha"
                                        name="senha"
                                        value={user.senha}
                                        onChange={handleInputChange}
                                        feedback={false}
                                        toggleMask
                                        required={editingId === null}
                                        placeholder={editingId !== null ? 'Nova senha (opcional)' : ''}
                                        disabled={loading}
                                    />
                                </div>
                            </div>
                            
                            <div className="col-12 md:col-6">
                                <div className="field">
                                    <label htmlFor="cep">CEP</label>
                                    <InputMask
                                        id="cep"
                                        name="cep"
                                        mask="99999-999"
                                        value={user.cep}
                                        onChange={handleInputChange}
                                        onBlur={handleCepBlur}
                                        disabled={loading}
                                    />
                                </div>
                                
                                <div className="field">
                                    <label htmlFor="rua">Rua</label>
                                    <InputText
                                        id="rua"
                                        name="rua"
                                        value={user.rua}
                                        onChange={handleInputChange}
                                        disabled={loading}
                                    />
                                </div>
                                
                                <div className="field">
                                    <label htmlFor="numero">Número</label>
                                    <InputText
                                        id="numero"
                                        name="numero"
                                        value={user.numero}
                                        onChange={handleInputChange}
                                        disabled={loading}
                                    />
                                </div>
                                
                                <div className="field">
                                    <label htmlFor="bairro">Bairro</label>
                                    <InputText
                                        id="bairro"
                                        name="bairro"
                                        value={user.bairro}
                                        onChange={handleInputChange}
                                        disabled={loading}
                                    />
                                </div>
                                
                                <div className="field">
                                    <label htmlFor="cidade">Cidade</label>
                                    <InputText
                                        id="cidade"
                                        name="cidade"
                                        value={user.cidade}
                                        onChange={handleInputChange}
                                        disabled={loading}
                                    />
                                </div>
                                
                                <div className="field">
                                    <label htmlFor="estado">Estado</label>
                                    <Dropdown
                                        id="estado"
                                        name="estado"
                                        options={estadosBrasil}
                                        value={user.estado}
                                        onChange={handleInputChange}
                                        placeholder="Selecione um estado"
                                        disabled={loading}
                                    />
                                </div>
                                
                                <div className="field">
                                    <label htmlFor="pontoReferencia">Ponto de Referência</label>
                                    <InputText
                                        id="pontoReferencia"
                                        name="pontoReferencia"
                                        value={user.pontoReferencia}
                                        onChange={handleInputChange}
                                        disabled={loading}
                                    />
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex justify-content-end gap-2 mt-4">
                            <Button
                                label="Cancelar"
                                icon="pi pi-times"
                                severity="secondary"
                                onClick={() => {
                                    setShowForm(false);
                                    setEditingId(null);
                                    setUser(USER_VAZIO);
                                    // Ao cancelar, volta empresa para a do topbar (se houver)
                                    const ec = localStorage.getItem('empresa_selecionada');
                                    setEmpresaDoForm(ec ? Number(ec) : null);
                                }}
                                disabled={loading}
                            />
                            <Button
                                label={editingId !== null ? "Atualizar" : "Salvar"}
                                icon="pi pi-check"
                                type="submit"
                                loading={loading}
                            />
                        </div>
                    </form>
                </div>
            ) : (
                <div className="card">
                    <ConfirmDialog />
                    <DataTable
                        value={users.filter(u =>
                            u.nomeCompleto.toLowerCase().includes(searchNome.toLowerCase())
                        )}
                        paginator
                        rows={10}
                        rowsPerPageOptions={[5, 10, 25, 50]}
                        tableStyle={{ minWidth: '20rem' }}
                        emptyMessage="Nenhum usuário encontrado."
                        expandedRows={expandedRows}
                        onRowToggle={(e) => setExpandedRows(e.data)}
                        rowExpansionTemplate={rowExpansionTemplate}
                        loading={loading}
                    >
                        <Column expander style={{ width: '3rem' }} />

                        {/* Coluna de Avatar */}
                        <Column
                            header="Foto"
                            body={(rowData: User) => (
                                <div 
                                    className="flex align-items-center justify-content-center border-circle overflow-hidden"
                                    style={{ 
                                        width: '40px', 
                                        height: '40px', 
                                        backgroundColor: 'var(--surface-100)',
                                        border: '1px solid var(--surface-300)'
                                    }}
                                >
                                    {rowData.avatar_url ? (
                                        <img 
                                            src={rowData.avatar_url} 
                                            alt={rowData.nomeCompleto}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: rowData.avatar_position || DEFAULT_AVATAR_POSITION }}
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                    ) : (
                                        <i className="pi pi-user" style={{ fontSize: '1.2rem', color: 'var(--surface-400)' }} />
                                    )}
                                </div>
                            )}
                            style={{ width: '4rem' }}
                        />

                        <Column field="nomeCompleto" header="Nome" body={nameBodyTemplate} sortable />
                        <Column field="cargo" header="Cargo" sortable />
                        <Column field="email" header="E-mail" sortable />
                        {isMaster && (
                            <Column
                                header="Empresa"
                                sortable
                                sortField="empresa_id"
                                body={(row: any) => (
                                    <span className="flex align-items-center gap-1">
                                        <i className="pi pi-building text-color-secondary" style={{ fontSize: '12px' }} />
                                        <span>{empresaMap[row.empresa_id] ?? (row.empresa_id ? `#${row.empresa_id}` : '—')}</span>
                                    </span>
                                )}
                            />
                        )}
                        <Column
                            header="Ações"
                            body={(rowData) => (
                                <div className="flex gap-2">
                                    <Button
                                        icon="pi pi-eye"
                                        rounded
                                        outlined
                                        severity="secondary"
                                        tooltip="Visualizar senha"
                                        tooltipOptions={{ position: 'top' }}
                                        onClick={() => abrirVerSenha(rowData)}
                                        disabled={loading}
                                    />
                                    <Button
                                        icon="pi pi-pencil"
                                        rounded
                                        outlined
                                        severity="info"
                                        tooltip="Editar"
                                        tooltipOptions={{ position: 'top' }}
                                        onClick={() => handleEdit(rowData)}
                                        disabled={loading}
                                    />
                                    <Button
                                        icon="pi pi-trash"
                                        rounded
                                        outlined
                                        severity="danger"
                                        tooltip="Excluir"
                                        tooltipOptions={{ position: 'top' }}
                                        onClick={() => rowData.id && confirmDelete(rowData.id, rowData.nomeCompleto)}
                                        disabled={loading}
                                    />
                                </div>
                            )}
                            style={{ width: '11rem' }}
                        />
                    </DataTable>
                </div>
            )}

            {/* ── Modal: Visualizar senha do usuário ── */}
            <Dialog
                header={`Visualizar senha — ${usuarioAlvo?.nomeCompleto}`}
                visible={verSenhaDialog}
                style={{ width: '460px' }}
                modal
                onHide={() => { setVerSenhaDialog(false); setSenhaRevelada(null); }}
                footer={
                    senhaRevelada ? (
                        <Button label="Fechar" icon="pi pi-times" className="p-button-text"
                            onClick={() => { setVerSenhaDialog(false); setSenhaRevelada(null); }} />
                    ) : redefinirMode ? (
                        <div className="flex gap-2 justify-content-end">
                            <Button label="Cancelar" icon="pi pi-times" className="p-button-text"
                                onClick={() => setRedefinirMode(false)} disabled={salvandoSenha} />
                            <Button label="Salvar nova senha" icon="pi pi-check"
                                loading={salvandoSenha} onClick={salvarNovaSenha} />
                        </div>
                    ) : (
                        <div className="flex gap-2 justify-content-end">
                            <Button label="Cancelar" icon="pi pi-times" className="p-button-text"
                                onClick={() => setVerSenhaDialog(false)} disabled={autenticando} />
                            <Button label="Confirmar" icon="pi pi-check"
                                loading={autenticando} onClick={confirmarVerSenha} />
                        </div>
                    )
                }
            >
                {senhaRevelada ? (
                    <div>
                        <p className="text-sm text-color-secondary mb-3">
                            Senha de <strong>{usuarioAlvo?.nomeCompleto}</strong>:
                        </p>
                        <div className="flex align-items-center gap-2 p-3"
                            style={{ background: 'rgba(30,136,229,0.08)', border: '1px solid #1e88e5', borderRadius: '8px' }}>
                            <span className="font-bold text-lg flex-1" style={{ letterSpacing: verSenhaVisivel ? 'normal' : '4px' }}>
                                {verSenhaVisivel ? senhaRevelada : '•'.repeat(senhaRevelada.length)}
                            </span>
                            <Button icon={verSenhaVisivel ? 'pi pi-eye-slash' : 'pi pi-eye'} text rounded
                                onClick={() => setVerSenhaVisivel(v => !v)} tooltip={verSenhaVisivel ? 'Ocultar' : 'Mostrar'} />
                            <Button icon="pi pi-copy" text rounded tooltip="Copiar"
                                onClick={() => { navigator.clipboard.writeText(senhaRevelada); toast.current?.show({ severity: 'success', summary: 'Copiado!', detail: 'Senha copiada', life: 2000 }); }} />
                        </div>
                    </div>
                ) : redefinirMode ? (
                    <div>
                        <div className="flex align-items-center gap-2 mb-3 p-3"
                            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid #f59e0b', borderRadius: '8px' }}>
                            <i className="pi pi-exclamation-triangle" style={{ color: '#d97706' }} />
                            <span className="text-sm">
                                A senha original deste usuário não está disponível para visualização (foi cadastrada antes desse recurso existir). Redefina a senha para uma nova e ela passará a ser exibida normalmente.
                            </span>
                        </div>
                        <div className="field">
                            <label className="font-medium">Nova senha para <strong>{usuarioAlvo?.nomeCompleto}</strong> *</label>
                            <Password
                                value={novaSenha}
                                onChange={(e) => setNovaSenha(e.target.value)}
                                feedback={false} toggleMask
                                placeholder="Digite a nova senha"
                                className="w-full mt-1" inputClassName="w-full"
                                disabled={salvandoSenha}
                                onKeyDown={(e) => e.key === 'Enter' && salvarNovaSenha()}
                                autoFocus
                            />
                        </div>
                    </div>
                ) : (
                    <div>
                        <p className="text-sm text-color-secondary mb-4">
                            Apenas <strong>Gerentes</strong>, <strong>Donos</strong> e a conta <strong>Master</strong> podem visualizar senhas.
                            Selecione quem está autorizando e informe a senha.
                        </p>
                        <div className="field">
                            <label className="font-medium">Quem está autorizando? *</label>
                            <Dropdown
                                value={autenticadorId}
                                options={autenticadores}
                                onChange={(e) => setAutenticadorId(e.value)}
                                placeholder="Selecione o autorizador"
                                filter className="w-full mt-1"
                                emptyMessage="Nenhum Gerente ou Dono cadastrado"
                            />
                        </div>
                        <div className="field mt-3">
                            <label className="font-medium">Senha do autorizador *</label>
                            <Password
                                value={autenticadorSenha}
                                onChange={(e) => setAutenticadorSenha(e.target.value)}
                                feedback={false} toggleMask
                                placeholder="Digite a senha"
                                className="w-full mt-1" inputClassName="w-full"
                                disabled={autenticando}
                                onKeyDown={(e) => e.key === 'Enter' && confirmarVerSenha()}
                            />
                        </div>
                    </div>
                )}
            </Dialog>

            <Dialog
                visible={displayUserDialog} 
                style={{ width: '90vw', maxWidth: '500px' }} 
                header="Detalhes do Usuário" 
                modal 
                footer={userDialogFooter} 
                onHide={() => setDisplayUserDialog(false)}
            >
                {selectedUser && (
                    <div className="grid">
                        <div className="col-12">
                            {/* Avatar do usuário */}
                            <div className="flex justify-content-center mb-3">
                                {selectedUser.avatar_url ? (
                                    <img 
                                        src={selectedUser.avatar_url} 
                                        alt={selectedUser.nomeCompleto}
                                        style={{ 
                                            width: '120px', 
                                            height: '120px', 
                                            borderRadius: '50%', 
                                            objectFit: 'cover',
                                            objectPosition: selectedUser.avatar_position || DEFAULT_AVATAR_POSITION,
                                            border: '3px solid var(--surface-300)'
                                        }}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                ) : (
                                    <div 
                                        className="flex align-items-center justify-content-center border-circle"
                                        style={{ 
                                            width: '120px', 
                                            height: '120px', 
                                            backgroundColor: 'var(--surface-100)',
                                            border: '3px solid var(--surface-300)'
                                        }}
                                    >
                                        <i className="pi pi-user" style={{ fontSize: '3rem', color: 'var(--surface-400)' }} />
                                    </div>
                                )}
                        </div>
                        
                        <div className="field">
                            <label className="font-bold">Nome Completo</label>
                            <p>{selectedUser.nomeCompleto}</p>
                        </div>
                        <Divider />
                    </div>
                        
                        <div className="col-12 md:col-6">
                            <div className="field">
                                <label className="font-bold">CPF</label>
                                <p>{selectedUser.cpf}</p>
                            </div>
                            
                            <div className="field">
                                <label className="font-bold">Cargo</label>
                                <Tag value={selectedUser.cargo} severity="info" />
                            </div>
                            
                            <div className="field">
                                <label className="font-bold">Email</label>
                                <p>{selectedUser.email}</p>
                            </div>
                        </div>
                        
                        <div className="col-12 md:col-6">
                            <div className="field">
                                <label className="font-bold">Endereço</label>
                                <p>
                                    {selectedUser.rua}, {selectedUser.numero}<br />
                                    {selectedUser.bairro}<br />
                                    {selectedUser.cidade} - {selectedUser.estado}<br />
                                    {selectedUser.cep && `CEP: ${selectedUser.cep}`}
                                </p>
                            </div>
                            
                            {selectedUser.pontoReferencia && (
                                <div className="field">
                                    <label className="font-bold">Ponto de Referência</label>
                                    <p>{selectedUser.pontoReferencia}</p>
                                </div>
                            )}
                        </div>
                        
                        <div className="col-12 flex justify-content-end gap-2 mt-3">
                            <Button
                                icon="pi pi-pencil"
                                rounded
                                outlined
                                severity="info"
                                tooltip="Editar"
                                tooltipOptions={{ position: 'top' }}
                                onClick={() => {
                                    setDisplayUserDialog(false);
                                    handleEdit(selectedUser);
                                    setShowForm(true);
                                }}
                                disabled={loading}
                            />
                            <Button
                                icon="pi pi-trash"
                                rounded
                                outlined
                                severity="danger"
                                tooltip="Excluir"
                                tooltipOptions={{ position: 'top' }}
                                onClick={() => {
                                    if (selectedUser.id) {
                                        confirmDelete(selectedUser.id, selectedUser.nomeCompleto);
                                        setDisplayUserDialog(false);
                                    }
                                }}
                                disabled={loading}
                            />
                        </div>
                    </div>
                )}
            </Dialog>
        </div>
    );
};

export default UserRegistrationPage;
