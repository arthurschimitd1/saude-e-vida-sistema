import Empresa from '../models/Empresa.js';
import AgendamentoConfiguracao from '../models/AgendamentoConfiguracao.js';

const CONFIGURACAO_PADRAO = Object.freeze({
    personalizada: false,
    marca: null,
    horaInicio: '08:00',
    horaFim: '20:00',
    intervaloMin: 30,
    timeZone: 'America/Fortaleza',
});

const CONFIGURACAO_DOM_FERRAZ = Object.freeze({
    personalizada: true,
    marca: 'dom-ferraz',
    horaInicio: '09:00',
    horaFim: '19:00',
    intervaloMin: 40,
    timeZone: 'America/Fortaleza',
});

const NOMES_DOM_FERRAZ = new Set([
    'domferrazmanaira',
    'domferrazmiramar',
    'domferrazsape',
]);

export const INTERVALOS_AGENDAMENTO_PERMITIDOS = Object.freeze([10, 15, 20, 30, 40, 45, 60]);

export const normalizarNomeEmpresa = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

export const configuracaoAgendamentoPorNome = (empresaNome) => ({
    ...(NOMES_DOM_FERRAZ.has(normalizarNomeEmpresa(empresaNome))
        ? CONFIGURACAO_DOM_FERRAZ
        : CONFIGURACAO_PADRAO),
});

export const horarioParaMinutosConfiguracao = (horario) => {
    if (!/^\d{2}:\d{2}$/.test(String(horario ?? ''))) return null;
    const [hora, minuto] = String(horario).split(':').map(Number);
    if (hora < 0 || hora > 23 || minuto < 0 || minuto > 59) return null;
    return hora * 60 + minuto;
};

export const horarioPertenceConfiguracao = (horario, duracaoMin, configuracao) => {
    if (!configuracao?.personalizada) return true;
    const horarioMin = horarioParaMinutosConfiguracao(horario);
    const inicioMin = horarioParaMinutosConfiguracao(configuracao.horaInicio);
    const fimMin = horarioParaMinutosConfiguracao(configuracao.horaFim);
    const intervaloMin = Number(configuracao.intervaloMin);
    const duracao = Math.max(1, Number(duracaoMin) || 30);
    if (horarioMin === null || inicioMin === null || fimMin === null || !Number.isInteger(intervaloMin) || intervaloMin <= 0) return false;
    return horarioMin >= inicioMin
        && horarioMin + duracao <= fimMin
        && (horarioMin - inicioMin) % intervaloMin === 0;
};

export const validarConfiguracaoHorario = (data, configuracaoBase) => {
    const horaInicio = String(data?.horaInicio ?? '').slice(0, 5);
    const horaFim = String(data?.horaFim ?? '').slice(0, 5);
    const intervaloMin = Number(data?.intervaloMin ?? configuracaoBase.intervaloMin);
    const inicioMin = horarioParaMinutosConfiguracao(horaInicio);
    const fimMin = horarioParaMinutosConfiguracao(horaFim);

    if (inicioMin === null || fimMin === null) {
        throw new Error('Informe os horários inicial e final no formato HH:MM.');
    }
    if (inicioMin >= fimMin) {
        throw new Error('O horário final deve ser posterior ao horário inicial.');
    }
    if (!INTERVALOS_AGENDAMENTO_PERMITIDOS.includes(intervaloMin)) {
        throw new Error(`Escolha um intervalo válido: ${INTERVALOS_AGENDAMENTO_PERMITIDOS.join(', ')} minutos.`);
    }
    if (fimMin - inicioMin < intervaloMin) {
        throw new Error(`O expediente deve ter ao menos ${intervaloMin} minutos.`);
    }
    return { horaInicio, horaFim, intervaloMin };
};

export async function obterConfiguracaoAgendamento(empresaId) {
    const empresa = await Empresa.findByPk(Number(empresaId), { attributes: ['nome'] });
    const configuracaoBase = configuracaoAgendamentoPorNome(empresa?.nome);
    const configuracaoSalva = await AgendamentoConfiguracao.findOne({ where: { empresa_id: Number(empresaId) } });
    if (!configuracaoSalva) return configuracaoBase;
    return {
        ...configuracaoBase,
        personalizada: true,
        horaInicio: String(configuracaoSalva.hora_inicio).slice(0, 5),
        horaFim: String(configuracaoSalva.hora_fim).slice(0, 5),
        intervaloMin: Number(configuracaoSalva.intervalo_min ?? configuracaoBase.intervaloMin),
    };
}

export async function salvarConfiguracaoAgendamento(empresaId, data = {}) {
    const configuracaoBase = await obterConfiguracaoAgendamento(empresaId);
    const { horaInicio, horaFim, intervaloMin } = validarConfiguracaoHorario(data, configuracaoBase);

    const [configuracao] = await AgendamentoConfiguracao.findOrCreate({
        where: { empresa_id: Number(empresaId) },
        defaults: { hora_inicio: horaInicio, hora_fim: horaFim, intervalo_min: intervaloMin },
    });
    await configuracao.update({ hora_inicio: horaInicio, hora_fim: horaFim, intervalo_min: intervaloMin });
    return obterConfiguracaoAgendamento(empresaId);
}

export default {
    configuracaoAgendamentoPorNome,
    horarioPertenceConfiguracao,
    validarConfiguracaoHorario,
    obterConfiguracaoAgendamento,
    salvarConfiguracaoAgendamento,
};
