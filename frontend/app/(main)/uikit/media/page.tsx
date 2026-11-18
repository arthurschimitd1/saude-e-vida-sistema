'use client';

import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { confirmPopup, ConfirmPopup } from 'primereact/confirmpopup';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputMask } from 'primereact/inputmask';
import { Toast } from 'primereact/toast';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from '@/app/(main)/components/MobileFriendlyInputNumber';
import { FileUpload } from 'primereact/fileupload';
import React, { useEffect, useRef, useState } from 'react';
import api from '../../services/api/baseApi';

type Empresa = {
  id?: number;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  regimeTributario: string;
  cnae: string[];
  endereco: {
    cep: string;
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    municipio: string;
    uf: string;
    codigoIBGE: string;
  };
  contato: {
    email: string;
    telefone: string;
    senha: string;
    responsavel: {
      nome: string;
      cpf: string;
    };
  };
  certificadoDigital: {
    arquivo: string;
    senha: string;
  };
  infoGov: {
    arquivo: string;
    senha: string;
  };
  notasFiscais: {
    tipo: string;
    ativo: boolean;
    homologacao: { serie: string; proximoNumero: number; };
    producao: { serie: string; proximoNumero: number; };
  }[];
};

const EmpresaPage = () => {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [visibleDialog, setVisibleDialog] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const toast = useRef<Toast>(null);

  const regimeTributarioOptions = [
    { label: 'Simples Nacional', value: 'Simples Nacional' },
    { label: 'Lucro Presumido', value: 'Lucro Presumido' },
    { label: 'Lucro Real', value: 'Lucro Real' }
  ];

  const notaFiscalOptions = [
    { label: 'NFS-e', value: 'NFS-e' },
    { label: 'NF-e', value: 'NF-e' },
    { label: 'NFC-e', value: 'NFC-e' }
  ];

  const ambienteOptions = [
    { label: 'Produção', value: 'produção' },
    { label: 'Homologação', value: 'homologação' }
  ];

  const ufOptions = [
    { label: 'AC', value: 'AC' },
    { label: 'AL', value: 'AL' },
    { label: 'AP', value: 'AP' },
    { label: 'AM', value: 'AM' },
    { label: 'BA', value: 'BA' },
    { label: 'CE', value: 'CE' },
    { label: 'DF', value: 'DF' },
    { label: 'ES', value: 'ES' },
    { label: 'GO', value: 'GO' },
    { label: 'MA', value: 'MA' },
    { label: 'MT', value: 'MT' },
    { label: 'MS', value: 'MS' },
    { label: 'MG', value: 'MG' },
    { label: 'PA', value: 'PA' },
    { label: 'PB', value: 'PB' },
    { label: 'PR', value: 'PR' },
    { label: 'PE', value: 'PE' },
    { label: 'PI', value: 'PI' },
    { label: 'RJ', value: 'RJ' },
    { label: 'RN', value: 'RN' },
    { label: 'RS', value: 'RS' },
    { label: 'RO', value: 'RO' },
    { label: 'RR', value: 'RR' },
    { label: 'SC', value: 'SC' },
    { label: 'SP', value: 'SP' },
    { label: 'SE', value: 'SE' },
    { label: 'TO', value: 'TO' }
  ];

  const [newEmpresa, setNewEmpresa] = useState<Empresa>({
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    inscricaoEstadual: '',
    inscricaoMunicipal: '',
    regimeTributario: 'Simples Nacional',
    cnae: [],
    endereco: {
      cep: '',
      logradouro: '',
      numero: '',
      bairro: '',
      municipio: '',
      uf: 'SP',
      codigoIBGE: ''
    },
    contato: {
      email: '',
      telefone: '',
      senha: '',
      responsavel: {
        nome: '',
        cpf: ''
      }
    },
    certificadoDigital: {
      arquivo: '',
      senha: ''
    },
    infoGov: {
      arquivo: '',
      senha: ''
    },
    notasFiscais: [
      { tipo: 'NF-e', ativo: false, homologacao: { serie: '1', proximoNumero: 1 }, producao: { serie: '1', proximoNumero: 1 } },
      { tipo: 'NFC-e', ativo: false, homologacao: { serie: '1', proximoNumero: 1 }, producao: { serie: '1', proximoNumero: 1 } },
      { tipo: 'NFS-e', ativo: false, homologacao: { serie: '1', proximoNumero: 1 }, producao: { serie: '1', proximoNumero: 1 } }
    ]
  });

  const handleInputChange = (field: string, value: any, nestedObject?: string) => {
    if (nestedObject) {
      setNewEmpresa(prev => ({
        ...prev,
        [nestedObject]: {
          ...(prev[nestedObject as keyof Empresa] as Record<string, unknown>),
          [field]: value
        }
      }));
    } else {
      setNewEmpresa(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleNestedInputChange = (parent: string, field: string, value: any, grandParent?: string) => {
    if (grandParent) {
      const grandParentVal = (prev: Empresa) => prev[grandParent as keyof Empresa] as Record<string, unknown>;
      const parentVal = (gp: Record<string, unknown>) => gp[parent] as Record<string, unknown>;
      setNewEmpresa(prev => {
        const gp = grandParentVal(prev);
        return {
          ...prev,
          [grandParent]: {
            ...gp,
            [parent]: {
              ...parentVal(gp),
              [field]: value
            }
          }
        };
      });
    } else {
      setNewEmpresa(prev => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof Empresa] as Record<string, unknown>),
          [field]: value
        }
      }));
    }
  };

  const showSuccess = (message: string) => {
    toast.current?.show({
      severity: 'success',
      summary: 'Sucesso',
      detail: message,
      life: 3000
    });
  };

  const showError = (message: string) => {
    toast.current?.show({
      severity: 'error',
      summary: 'Erro',
      detail: message,
      life: 3000
    });
  };

  const validateForm = () => {
    const errors = [];
    if (!newEmpresa.razaoSocial) errors.push('Razão Social é obrigatória');
    if (!newEmpresa.cnpj || newEmpresa.cnpj.replace(/\D/g, '').length !== 14) errors.push('CNPJ inválido');
    if (!newEmpresa.endereco.cep || newEmpresa.endereco.cep.replace(/\D/g, '').length !== 8) errors.push('CEP inválido');
    if (newEmpresa.contato.senha && newEmpresa.contato.senha !== confirmarSenha) errors.push('As senhas não coincidem');
    return errors;
  };

  const mapToBackend = (empresa: Empresa) => ({
    razao_social: empresa.razaoSocial,
    nome_fantasia: empresa.nomeFantasia,
    cnpj: empresa.cnpj,
    inscricao_estadual: empresa.inscricaoEstadual,
    inscricao_municipal: empresa.inscricaoMunicipal,
    regime_tributario: empresa.regimeTributario,
    cnae_principal: empresa.cnae[0] || '',
    cep: empresa.endereco.cep,
    logradouro: empresa.endereco.logradouro,
    numero: empresa.endereco.numero,
    bairro: empresa.endereco.bairro,
    municipio: empresa.endereco.municipio,
    uf: empresa.endereco.uf,
    codigo_ibge: empresa.endereco.codigoIBGE,
    email: empresa.contato.email,
    telefone: empresa.contato.telefone,
    responsavel: empresa.contato.responsavel.nome,
    cpf_responsavel: empresa.contato.responsavel.cpf,
    senha_contato: empresa.contato.senha,
    link_certificado: empresa.certificadoDigital.arquivo,
    senha_certificado: empresa.certificadoDigital.senha,
    acesso_gov_email: empresa.infoGov.arquivo,
    acesso_gov_senha: empresa.infoGov.senha,
    notas_fiscais: empresa.notasFiscais
  });

  const fetchEmpresas = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const empresaId = user?.empresa_id;
      const url = empresaId ? `/minha-empresa?empresa_id=${empresaId}` : '/minha-empresa';
      const response = await api.get(url);
      const data = response.data;
      const mapped = data.map((e: any) => ({
        id: e.id,
        razaoSocial: e.razao_social,
        nomeFantasia: e.nome_fantasia,
        cnpj: e.cnpj,
        inscricaoEstadual: e.inscricao_estadual,
        inscricaoMunicipal: e.inscricao_municipal,
        regimeTributario: e.regime_tributario,
        cnae: [e.cnae_principal],
        endereco: {
          cep: e.cep,
          logradouro: e.logradouro,
          numero: e.numero,
          bairro: e.bairro,
          municipio: e.municipio,
          uf: e.uf,
          codigoIBGE: e.codigo_ibge},
        contato: {
          email: e.email,
          telefone: e.telefone,
          senha: "",
          responsavel: {
            nome: e.responsavel,
            cpf: e.cpf_responsavel
          }
        },
        certificadoDigital: {
          arquivo: e.link_certificado,
          senha: ""
        },
        infoGov: {
          arquivo: e.acesso_gov_email,
          senha: e.acesso_gov_senha
        },
        notasFiscais: Array.isArray(e.notas_fiscais) && e.notas_fiscais.length > 0
          ? e.notas_fiscais
          : [
              { tipo: 'NF-e',  ativo: false, homologacao: { serie: '1', proximoNumero: 1 }, producao: { serie: '1', proximoNumero: 1 } },
              { tipo: 'NFC-e', ativo: false, homologacao: { serie: '1', proximoNumero: 1 }, producao: { serie: '1', proximoNumero: 1 } },
              { tipo: 'NFS-e', ativo: false, homologacao: { serie: '1', proximoNumero: 1 }, producao: { serie: '1', proximoNumero: 1 } },
            ]
      }));
      setEmpresas(mapped);
    } catch (error) {
      showError('Erro ao carregar empresas');
    }
  };

  useEffect(() => {
    fetchEmpresas();
  }, []);

  const handleSubmit = async () => {
    const errors = validateForm();
    if (errors.length > 0) {
      errors.forEach(error => showError(error));
      return;
    }

    try {
      const payload = mapToBackend(newEmpresa);

      if (isEditing && selectedEmpresa) {
        await api.put(`/minha-empresa/${selectedEmpresa.id}`, payload);
        showSuccess('Empresa atualizada com sucesso!');
      } else {
        await api.post('/minha-empresa', payload);
        showSuccess('Empresa cadastrada com sucesso!');
      }

      await fetchEmpresas();
      resetForm();
      setVisibleDialog(false);
    } catch (error) {
      showError('Erro ao salvar empresa');
    }
  };

  const resetForm = () => {
    setNewEmpresa({
      razaoSocial: '',
      nomeFantasia: '',
      cnpj: '',
      inscricaoEstadual: '',
      inscricaoMunicipal: '',
      regimeTributario: 'Simples Nacional',
      cnae: [],
      endereco: {
        cep: '',
        logradouro: '',
        numero: '',
        bairro: '',
        municipio: '',
        uf: 'SP',
        codigoIBGE: ''
      },
      contato: {
        email: '',
        telefone: '',
        senha: '',
        responsavel: {
          nome: '',
          cpf: ''
        }
      },
      certificadoDigital: {
        arquivo: '',
        senha: ''
      },
      infoGov: {
        arquivo: '',
        senha: ''
      },
      notasFiscais: [
        { tipo: 'NF-e', ativo: false, homologacao: { serie: '1', proximoNumero: 1 }, producao: { serie: '1', proximoNumero: 1 } },
        { tipo: 'NFC-e', ativo: false, homologacao: { serie: '1', proximoNumero: 1 }, producao: { serie: '1', proximoNumero: 1 } },
        { tipo: 'NFS-e', ativo: false, homologacao: { serie: '1', proximoNumero: 1 }, producao: { serie: '1', proximoNumero: 1 } }
      ]
    });
    setConfirmarSenha('');
    setSelectedEmpresa(null);
    setIsEditing(false);
  };

  const notasFiscaisPadrao = [
    { tipo: 'NF-e',  ativo: false, homologacao: { serie: '1', proximoNumero: 1 }, producao: { serie: '1', proximoNumero: 1 } },
    { tipo: 'NFC-e', ativo: false, homologacao: { serie: '1', proximoNumero: 1 }, producao: { serie: '1', proximoNumero: 1 } },
    { tipo: 'NFS-e', ativo: false, homologacao: { serie: '1', proximoNumero: 1 }, producao: { serie: '1', proximoNumero: 1 } },
  ];

  const editEmpresa = (empresa: Empresa) => {
    setNewEmpresa({
      ...empresa,
      notasFiscais: Array.isArray(empresa.notasFiscais) && empresa.notasFiscais.length > 0
        ? empresa.notasFiscais
        : notasFiscaisPadrao,
    });
    setSelectedEmpresa(empresa);
    setIsEditing(true);
    setVisibleDialog(true);
  };

  const confirmDelete = (event: React.MouseEvent<HTMLButtonElement>, empresa: Empresa) => {
    confirmPopup({
      target: event.currentTarget,
      message: `Tem certeza que deseja excluir "${empresa.razaoSocial}"?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sim',
      rejectLabel: 'Não',
      accept: () => deleteEmpresa(empresa.id),
      reject: () => {}
    });
  };

  const deleteEmpresa = async (id?: number) => {
    if (id) {
      try {
        await api.delete(`/minha-empresa/${id}`);
        await fetchEmpresas();
        showSuccess('Empresa excluída com sucesso!');
      } catch (error) {
        showError('Erro ao excluir empresa');
      }
    }
  };

  const openNewEmpresaDialog = () => {
    resetForm();
    setVisibleDialog(true);
  };

  const actionBodyTemplate = (rowData: Empresa) => {
    return (
      <div className="flex gap-2">
        <Button icon="pi pi-pencil" rounded outlined onClick={() => editEmpresa(rowData)} />
        <Button icon="pi pi-trash" rounded outlined severity="danger" onClick={(e) => confirmDelete(e, rowData)} />
      </div>
    );
  };

  const dialogFooter = (
    <div>
      <Button label="Cancelar" icon="pi pi-times" onClick={() => setVisibleDialog(false)} className="p-button-text" />
      <Button label="Salvar" icon="pi pi-check" onClick={handleSubmit} autoFocus />
    </div>
  );

  return (
    <div className="grid">
      <Toast ref={toast} />
      <ConfirmPopup />
      <div className="col-12">
        <div className="card">
          <div className="flex justify-content-between align-items-center mb-5">
            <h5>Empresas Cadastradas</h5>
            <Button label="Nova Empresa" icon="pi pi-plus" onClick={openNewEmpresaDialog} />
          </div>

          <DataTable value={empresas} paginator rows={10} rowsPerPageOptions={[5, 10, 25, 50]} tableStyle={{ minWidth: '50rem' }} emptyMessage="Nenhuma empresa cadastrada.">
            <Column field="razaoSocial" header="Razão Social" sortable />
            <Column field="nomeFantasia" header="Nome Fantasia" sortable />
            <Column field="cnpj" header="CNPJ" sortable />
            <Column field="regimeTributario" header="Regime Tributário" sortable />
            <Column body={actionBodyTemplate} exportable={false} style={{ minWidth: '12rem' }}></Column>
          </DataTable>

          <Dialog
            visible={visibleDialog}
            style={{ width: '70vw' }}
            header={isEditing ? 'Editar Empresa' : 'Nova Empresa'}
            modal
            className="p-fluid"
            footer={dialogFooter}
            onHide={() => setVisibleDialog(false)}
          >
            <div className="grid">
              <div className="col-12">
                <h5>Dados Básicos</h5>
                <div className="grid">
                  <div className="col-12 md:col-6">
                    <div className="field">
                      <label htmlFor="razaoSocial">Razão Social*</label>
                      <InputText
                        id="razaoSocial"
                        value={newEmpresa.razaoSocial}
                        onChange={(e) => handleInputChange('razaoSocial', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="col-12 md:col-6">
                    <div className="field">
                      <label htmlFor="nomeFantasia">Nome Fantasia</label>
                      <InputText
                        id="nomeFantasia"
                        value={newEmpresa.nomeFantasia}
                        onChange={(e) => handleInputChange('nomeFantasia', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-12 md:col-4">
                    <div className="field">
                      <label htmlFor="cnpj">CNPJ*</label>
                      <InputMask
                        id="cnpj"
                        value={newEmpresa.cnpj}
                        onChange={(e) => handleInputChange('cnpj', e.value)}
                        mask="99.999.999/9999-99"
                        placeholder="00.000.000/0000-00"
                      />
                    </div>
                  </div>
                  <div className="col-12 md:col-4">
                    <div className="field">
                      <label htmlFor="inscricaoEstadual">Inscrição Estadual</label>
                      <InputText
                        id="inscricaoEstadual"
                        value={newEmpresa.inscricaoEstadual}
                        onChange={(e) => handleInputChange('inscricaoEstadual', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-12 md:col-4">
                    <div className="field">
                      <label htmlFor="inscricaoMunicipal">Inscrição Municipal</label>
                      <InputText
                        id="inscricaoMunicipal"
                        value={newEmpresa.inscricaoMunicipal}
                        onChange={(e) => handleInputChange('inscricaoMunicipal', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-12 md:col-6">
                    <div className="field">
                      <label htmlFor="regimeTributario">Regime Tributário</label>
                      <Dropdown
                        id="regimeTributario"
                        value={newEmpresa.regimeTributario}
                        options={regimeTributarioOptions}
                        onChange={(e) => handleInputChange('regimeTributario', e.value)}
                      />
                    </div>
                  </div>
                  <div className="col-12 md:col-6">
                    <div className="field">
                      <label htmlFor="cnae">CNAE Principal</label>
                      <InputText
                        id="cnae"
                        value={newEmpresa.cnae[0] || ''}
                        onChange={(e) => handleInputChange('cnae', [e.target.value])}
                        placeholder="0000-0/00"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-12">
                <h5>Endereço</h5>
                <div className="grid">
                  <div className="col-12 md:col-3">
                    <div className="field">
                      <label htmlFor="cep">CEP*</label>
                      <InputMask
                        id="cep"
                        value={newEmpresa.endereco.cep}
                        onChange={(e) => handleInputChange('cep', e.value, 'endereco')}
                        mask="99999-999"
                        placeholder="00000-000"
                      />
                    </div>
                  </div>
                  <div className="col-12 md:col-6">
                    <div className="field">
                      <label htmlFor="logradouro">Logradouro</label>
                      <InputText
                        id="logradouro"
                        value={newEmpresa.endereco.logradouro}
                        onChange={(e) => handleInputChange('logradouro', e.target.value, 'endereco')}
                      />
                    </div>
                  </div>
                  <div className="col-12 md:col-3">
                    <div className="field">
                      <label htmlFor="numero">Número</label>
                      <InputText
                        id="numero"
                        value={newEmpresa.endereco.numero}
                        onChange={(e) => handleInputChange('numero', e.target.value, 'endereco')}
                      />
                    </div>
                  </div>
                  <div className="col-12 md:col-6">
                    <div className="field">
                      <label htmlFor="bairro">Bairro</label>
                      <InputText
                        id="bairro"
                        value={newEmpresa.endereco.bairro}
                        onChange={(e) => handleInputChange('bairro', e.target.value, 'endereco')}
                      />
                    </div>
                  </div>
                  <div className="col-12 md:col-6">
                    <div className="field">
                      <label htmlFor="municipio">Município</label>
                      <InputText
                        id="municipio"
                        value={newEmpresa.endereco.municipio}
                        onChange={(e) => handleInputChange('municipio', e.target.value, 'endereco')}
                      />
                    </div>
                  </div>
                  <div className="col-12 md:col-3">
                    <div className="field">
                      <label htmlFor="uf">UF</label>
                      <Dropdown
                        id="uf"
                        value={newEmpresa.endereco.uf}
                        options={ufOptions}
                        onChange={(e) => handleInputChange('uf', e.value, 'endereco')}
                      />
                    </div>
                  </div>
                  <div className="col-12 md:col-3">
                    <div className="field">
                      <label htmlFor="codigoIBGE">Código IBGE</label>
                      <InputText
                        id="codigoIBGE"
                        value={newEmpresa.endereco.codigoIBGE}
                        onChange={(e) => handleInputChange('codigoIBGE', e.target.value, 'endereco')}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-12">
                <h5>Contato</h5>
                <div className="grid">
                  <div className="col-12 md:col-6">
                    <div className="field">
                      <label htmlFor="email">E-mail</label>
                      <InputText
                        id="email"
                        value={newEmpresa.contato.email}
                        onChange={(e) => handleInputChange('email', e.target.value, 'contato')}
                      />
                    </div>
                  </div>
                  <div className="col-12 md:col-6">
                    <div className="field">
                      <label htmlFor="telefone">Telefone</label>
                      <InputMask
                        id="telefone"
                        value={newEmpresa.contato.telefone}
                        onChange={(e) => handleInputChange('telefone', e.value, 'contato')}
                        mask="(99) 99999-9999"
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>
                  <div className="col-12 md:col-6">
                    <div className="field">
                      <label htmlFor="responsavelNome">Responsável</label>
                      <InputText
                        id="responsavelNome"
                        value={newEmpresa.contato.responsavel.nome}
                        onChange={(e) => handleNestedInputChange('responsavel', 'nome', e.target.value, 'contato')}
                      />
                    </div>
                  </div>
                  <div className="col-12 md:col-6">
                    <div className="field">
                      <label htmlFor="responsavelCpf">CPF do Responsável</label>
                      <InputMask
                        id="responsavelCpf"
                        value={newEmpresa.contato.responsavel.cpf}
                        onChange={(e) => handleNestedInputChange('responsavel', 'cpf', e.value, 'contato')}
                        mask="999.999.999-99"
                        placeholder="000.000.000-00"
                      />
                    </div>
                  </div>
                  <div className="col-12 md:col-6">
                    <div className="field">
                      <label htmlFor="contatoSenha">Senha</label>
                      <InputText
                        id="contatoSenha"
                        type="password"
                        value={newEmpresa.contato.senha}
                        onChange={(e) => handleInputChange('senha', e.target.value, 'contato')}
                        placeholder="Digite a senha"
                      />
                    </div>
                  </div>
                  <div className="col-12 md:col-6">
                    <div className="field">
                      <label htmlFor="confirmarSenha">Confirmar Senha</label>
                      <InputText
                        id="confirmarSenha"
                        type="password"
                        value={confirmarSenha}
                        onChange={(e) => setConfirmarSenha(e.target.value)}
                        placeholder="Confirme a senha"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-12">
  <h5>Certificados</h5>
  <div className="grid">
    <div className="col-12 md:col-6">
      <div className="field">
        <label htmlFor="certificadoLink">Link do Certificado Digital (Google Drive)</label>
        <InputText
          id="certificadoLink"
          value={newEmpresa.certificadoDigital.arquivo}
          onChange={(e) => handleInputChange('arquivo', e.target.value, 'certificadoDigital')}
          placeholder="Cole o link do Drive aqui"
        />
      </div>
    </div>
    <div className="col-12 md:col-6">
      <div className="field">
        <label htmlFor="certificadoSenha">Senha do Certificado</label>
        <InputText
          id="certificadoSenha"
          type="password"
          value={newEmpresa.certificadoDigital.senha}
          onChange={(e) => handleInputChange('senha', e.target.value, 'certificadoDigital')}
        />
      </div>
    </div>
    <div className="col-12 md:col-6">
      <div className="field">
        <label htmlFor="govArquivo">Acesso Gov (Email)</label>
        <InputText
          id="govArquivo"
          value={newEmpresa.infoGov.arquivo}
          onChange={(e) => handleInputChange('arquivo', e.target.value, 'infoGov')}
        />
      </div>
    </div>
    <div className="col-12 md:col-6">
      <div className="field">
        <label htmlFor="govSenha">Senha do Acesso Gov</label>
        <InputText
          id="govSenha"
          type="password"
          value={newEmpresa.infoGov.senha}
          onChange={(e) => handleInputChange('senha', e.target.value, 'infoGov')}
        />
      </div>
    </div>
  </div>
</div>

              <div className="col-12">
                <h5>Nota Fiscal</h5>
                <div className="grid">
                  {newEmpresa.notasFiscais.map((nota, index) => (
                    <div key={nota.tipo} className="col-12" style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '1rem', marginBottom: '1rem' }}>
                      <div className="flex align-items-center gap-2 mb-3">
                        <input
                          type="checkbox"
                          id={`toggle-${nota.tipo}`}
                          checked={nota.ativo}
                          onChange={(e) => {
                            const updated = [...newEmpresa.notasFiscais];
                            updated[index] = { ...updated[index], ativo: e.target.checked };
                            setNewEmpresa(prev => ({ ...prev, notasFiscais: updated }));
                          }}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <label htmlFor={`toggle-${nota.tipo}`} style={{ fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>{nota.tipo}</label>
                      </div>
                      {nota.ativo && (
                        <div className="grid">
                          <div className="col-12 md:col-6">
                            <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Homologação</p>
                            <div className="grid">
                              <div className="col-6">
                                <div className="field">
                                  <label>Série</label>
                                  <InputText
                                    value={nota.homologacao.serie}
                                    onChange={(e) => {
                                      const updated = [...newEmpresa.notasFiscais];
                                      updated[index] = { ...updated[index], homologacao: { ...updated[index].homologacao, serie: e.target.value } };
                                      setNewEmpresa(prev => ({ ...prev, notasFiscais: updated }));
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="col-6">
                                <div className="field">
                                  <label>Próximo número</label>
                                  <InputNumber
                                    value={nota.homologacao.proximoNumero}
                                    onValueChange={(e) => {
                                      const updated = [...newEmpresa.notasFiscais];
                                      updated[index] = { ...updated[index], homologacao: { ...updated[index].homologacao, proximoNumero: e.value || 1 } };
                                      setNewEmpresa(prev => ({ ...prev, notasFiscais: updated }));
                                    }}
                                    min={1}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="col-12 md:col-6">
                            <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Produção</p>
                            <div className="grid">
                              <div className="col-6">
                                <div className="field">
                                  <label>Série</label>
                                  <InputText
                                    value={nota.producao.serie}
                                    onChange={(e) => {
                                      const updated = [...newEmpresa.notasFiscais];
                                      updated[index] = { ...updated[index], producao: { ...updated[index].producao, serie: e.target.value } };
                                      setNewEmpresa(prev => ({ ...prev, notasFiscais: updated }));
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="col-6">
                                <div className="field">
                                  <label>Próximo número</label>
                                  <InputNumber
                                    value={nota.producao.proximoNumero}
                                    onValueChange={(e) => {
                                      const updated = [...newEmpresa.notasFiscais];
                                      updated[index] = { ...updated[index], producao: { ...updated[index].producao, proximoNumero: e.value || 1 } };
                                      setNewEmpresa(prev => ({ ...prev, notasFiscais: updated }));
                                    }}
                                    min={1}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export default EmpresaPage;