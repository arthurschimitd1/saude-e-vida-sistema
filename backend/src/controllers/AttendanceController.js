import { Op } from 'sequelize';
import AttendanceRecord from '../models/AttendanceRecord.js';

// ── Helpers ───────────────────────────────────────────────────────────────

const toMinutes = (t) => {
    if (!t) return 0;
    const [h, m] = t.split(':');
    return parseInt(h) * 60 + parseInt(m);
};

// Retorna hora atual no fuso de Brasília (UTC-3) independente do servidor
const nowHHMM = () => {
    const now = new Date();
    const br = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    return br.toTimeString().slice(0, 5);
};

const todayBR = () => {
    const now = new Date();
    const br = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    return br.toISOString().split('T')[0];
};

const getEmpresaId = (req) => {
    return req.user?.empresa_id ?? (req.query.empresa_id ? Number(req.query.empresa_id) : null)
        ?? (req.body?.empresa_id ? Number(req.body.empresa_id) : null);
};

const calcularTotais = (checkIn, checkOut, pauses = [], extraInicio = null) => {
    if (!checkIn || !checkOut) return { totalHours: null, extraHours: null };
    const totalPauseMin = pauses.reduce((acc, p) => acc + (p.duration_minutes || 0), 0);
    const worked = Math.max(0, toMinutes(checkOut) - toMinutes(checkIn) - totalPauseMin);
    const totalHours = parseFloat((worked / 60).toFixed(2));
    // Se tem marcação de início de H.E., calcula a partir dela; senão, usa regra das 8h
    let extraHours;
    if (extraInicio) {
        const extraMin = Math.max(0, toMinutes(checkOut) - toMinutes(extraInicio));
        extraHours = parseFloat((extraMin / 60).toFixed(2));
    } else {
        extraHours = parseFloat(Math.max(0, totalHours - 8).toFixed(2));
    }
    return { totalHours, extraHours };
};

// ── LISTAR ────────────────────────────────────────────────────────────────

export const listar = async (req, res) => {
    try {
        const where = {};
        const empresaId = getEmpresaId(req);
        if (empresaId) {
            where[Op.or] = [{ empresa_id: empresaId }, { empresa_id: null }];
        }
        if (req.query.date) where.date = req.query.date;
        if (req.query.status) where.status = req.query.status;
        if (req.query.dateFrom && req.query.dateTo) {
            where.date = { [Op.between]: [req.query.dateFrom, req.query.dateTo] };
        }
        if (req.query.search) {
            where.employee_name = { [Op.iLike]: `%${req.query.search}%` };
        }
        const records = await AttendanceRecord.findAll({ where, order: [['date', 'DESC'], ['createdAt', 'DESC']] });
        res.json(records);
    } catch (error) {
        console.error('Erro ao listar ponto:', error);
        res.status(500).json({ error: error.message });
    }
};

// ── INICIAR JORNADA ───────────────────────────────────────────────────────

export const iniciar = async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const today = todayBR();
        const { employeeName, employeeCargo } = req.body;

        if (!employeeName) return res.status(400).json({ error: 'Nome do funcionário obrigatório' });

        // Verifica se já existe registro ativo hoje
        const existing = await AttendanceRecord.findOne({
            where: {
                employee_name: employeeName,
                date: today,
                ...(empresaId ? { [Op.or]: [{ empresa_id: empresaId }, { empresa_id: null }] } : {}),
            }
        });

        if (existing && existing.status !== 'FINALIZADO') {
            return res.status(400).json({ error: 'Funcionário já possui jornada ativa hoje', record: existing });
        }

        const record = await AttendanceRecord.create({
            employeeName,
            employeeCargo: employeeCargo || null,
            date: today,
            checkIn: nowHHMM(),
            status: 'TRABALHANDO',
            empresa_id: empresaId,
            pauses: [],
            totalPauseMinutes: 0,
        });

        res.status(201).json(record);
    } catch (error) {
        console.error('Erro ao iniciar jornada:', error);
        res.status(500).json({ error: error.message });
    }
};

// ── PAUSAR ────────────────────────────────────────────────────────────────

export const pausar = async (req, res) => {
    try {
        const record = await AttendanceRecord.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Registro não encontrado' });
        if (record.status !== 'TRABALHANDO') return res.status(400).json({ error: 'Funcionário não está trabalhando' });

        const pauses = Array.isArray(record.pauses) ? [...record.pauses] : [];
        pauses.push({
            id: pauses.length + 1,
            start: new Date().toISOString(),
            end: null,
            reason: req.body.reason?.trim() || null,
            duration_minutes: null,
        });

        await record.update({ status: 'PAUSADO', pauses });
        res.json(record);
    } catch (error) {
        console.error('Erro ao pausar:', error);
        res.status(500).json({ error: error.message });
    }
};

// ── RETOMAR (fecha a pausa e registra motivo) ─────────────────────────────

export const retomar = async (req, res) => {
    try {
        const record = await AttendanceRecord.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Registro não encontrado' });
        if (record.status !== 'PAUSADO') return res.status(400).json({ error: 'Funcionário não está pausado' });

        const agora = new Date().toISOString();

        // Cria novos objetos (não muta) para o Sequelize detectar a mudança no JSONB
        const pauses = (Array.isArray(record.pauses) ? record.pauses : []).map((p, idx, arr) => {
            if (idx === arr.length - 1 && !p.end) {
                return {
                    ...p,
                    end: agora,
                    duration_minutes: Math.round((new Date(agora) - new Date(p.start)) / 60000),
                };
            }
            return { ...p };
        });

        const totalPauseMinutes = pauses.reduce((acc, p) => acc + (p.duration_minutes || 0), 0);
        record.set('pauses', pauses);
        record.changed('pauses', true);
        await record.update({ status: 'TRABALHANDO', pauses, totalPauseMinutes });
        res.json(record);
    } catch (error) {
        console.error('Erro ao retomar:', error);
        res.status(500).json({ error: error.message });
    }
};

// ── FINALIZAR JORNADA ─────────────────────────────────────────────────────

export const finalizar = async (req, res) => {
    try {
        const record = await AttendanceRecord.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Registro não encontrado' });
        if (record.status === 'FINALIZADO') return res.status(400).json({ error: 'Jornada já finalizada' });

        const agora = new Date().toISOString();

        // Cria novos objetos (não muta) — fecha pausa aberta se houver
        const pauses = (Array.isArray(record.pauses) ? record.pauses : []).map((p, idx, arr) => {
            if (idx === arr.length - 1 && !p.end) {
                return {
                    ...p,
                    end: agora,
                    reason: p.reason || req.body.reason?.trim() || 'Finalização do dia',
                    duration_minutes: Math.round((new Date(agora) - new Date(p.start)) / 60000),
                };
            }
            return { ...p };
        });

        const checkOut = nowHHMM();
        const totalPauseMinutes = pauses.reduce((acc, p) => acc + (p.duration_minutes || 0), 0);
        const { totalHours, extraHours } = calcularTotais(record.checkIn, checkOut, pauses, record.extraInicio);

        record.set('pauses', pauses);
        record.changed('pauses', true);
        await record.update({
            checkOut,
            status: 'FINALIZADO',
            pauses,
            totalPauseMinutes,
            totalHours,
            extraHours,
            observation: req.body.observation || record.observation,
        });

        res.json(record);
    } catch (error) {
        console.error('Erro ao finalizar:', error);
        res.status(500).json({ error: error.message });
    }
};

// ── INICIAR HORA EXTRA ────────────────────────────────────────────────────

export const iniciarExtra = async (req, res) => {
    try {
        const record = await AttendanceRecord.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Registro não encontrado' });
        if (record.status !== 'TRABALHANDO') return res.status(400).json({ error: 'Funcionário não está trabalhando' });
        if (record.extraInicio) return res.status(400).json({ error: 'Hora extra já iniciada às ' + record.extraInicio });

        await record.update({ extraInicio: nowHHMM() });
        res.json(record);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ── CRUD MANUAL ───────────────────────────────────────────────────────────

export const criar = async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const record = await AttendanceRecord.create({
            ...req.body,
            empresa_id: empresaId,
            pauses: req.body.pauses || [],
            totalPauseMinutes: req.body.totalPauseMinutes || 0,
        });
        res.status(201).json(record);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const atualizar = async (req, res) => {
    try {
        const record = await AttendanceRecord.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Registro não encontrado' });
        await record.update(req.body);
        res.json(record);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const excluir = async (req, res) => {
    try {
        const record = await AttendanceRecord.findByPk(req.params.id);
        if (!record) return res.status(404).json({ error: 'Registro não encontrado' });
        await record.destroy();
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const importarBulk = async (req, res) => {
    try {
        const { records, importedFile } = req.body;
        if (!Array.isArray(records) || records.length === 0) {
            return res.status(400).json({ error: 'Nenhum registro para importar' });
        }
        const empresaId = getEmpresaId(req);
        const importedAt = new Date().toISOString();
        const payload = records.map(r => ({
            ...r,
            empresa_id: empresaId,
            pauses: r.pauses || [],
            totalPauseMinutes: r.totalPauseMinutes || 0,
            status: r.status || 'FINALIZADO',
            imported: true,
            importedFile,
            importedAt,
        }));
        const created = await AttendanceRecord.bulkCreate(payload, { validate: true });
        res.status(201).json({ imported: created.length, records: created });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
