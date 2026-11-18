import type { Point } from './analises';

// Somente agrupamento visual de decimais já calculados no backend. Totais/KPIs não vêm deste gráfico.
export function agruparSerie(points: Point[], granularity: string): Point[] {
    const groups = new Map<string, Point>();
    for (const p of points) {
        let key = p.dia.slice(0, 10);
        if (granularity === 'mes') key = key.slice(0, 7) + '-01';
        else if (granularity === 'semana') {
            const d = new Date(key + 'T12:00Z');
            d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
            key = d.toISOString().slice(0, 10);
        }
        const old = groups.get(key);
        groups.set(key, {
            dia: key,
            valor: old?.valor === null || p.valor === null ? null : String(Number(old?.valor || 0) + Number(p.valor)),
            quantidade: old?.quantidade === null || p.quantidade === null ? null : Number(old?.quantidade || 0) + Number(p.quantidade)
        });
    }
    return Array.from(groups.values());
}

