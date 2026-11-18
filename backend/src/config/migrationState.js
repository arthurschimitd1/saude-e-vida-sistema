let state = { status: 'NAO_INICIADO', total: null, executadasAntes: null, aplicadas: [] };

export function setMigrationState(next) {
  state = { ...state, ...next, aplicadas: next.aplicadas || state.aplicadas || [] };
}

export function getMigrationState() {
  return { ...state, aplicadas: [...state.aplicadas] };
}
