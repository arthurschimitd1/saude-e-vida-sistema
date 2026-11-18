const inteiroPositivo = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export class FiscalEmpresaScopeError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'FiscalEmpresaScopeError';
    this.statusCode = statusCode;
  }
}

export function resolverEmpresaFiscal(user, empresaIdInformada) {
  if (!user) {
    throw new FiscalEmpresaScopeError(401, 'Autenticação necessária');
  }

  const empresaInformada = inteiroPositivo(empresaIdInformada);
  const empresaDoUsuario = inteiroPositivo(user.empresa_id);
  const empresaOverride = inteiroPositivo(user.empresa_id_override);
  const isMaster = user.tipo === 'MASTER' || user.email === 'admin@master.com';

  if (isMaster) {
    if (empresaOverride) {
      if (empresaInformada && empresaInformada !== empresaOverride) {
        throw new FiscalEmpresaScopeError(403, 'Empresa informada não corresponde à empresa selecionada');
      }
      return empresaOverride;
    }

    // Compatibilidade com as telas fiscais atuais enquanto elas ainda enviam
    // o ID na URL. Novos módulos devem selecionar a empresa pelo header.
    if (empresaInformada) return empresaInformada;

    throw new FiscalEmpresaScopeError(400, 'Selecione uma empresa para acessar os dados fiscais');
  }

  if (!empresaDoUsuario) {
    throw new FiscalEmpresaScopeError(403, 'Usuário não está vinculado a uma empresa');
  }

  if (empresaInformada && empresaInformada !== empresaDoUsuario) {
    throw new FiscalEmpresaScopeError(403, 'Acesso negado aos dados fiscais desta empresa');
  }

  return empresaDoUsuario;
}
