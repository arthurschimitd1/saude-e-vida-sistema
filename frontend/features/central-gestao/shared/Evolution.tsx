'use client';
import { Chart } from 'primereact/chart';
import { Point } from './analises';
import { moeda, dataBR, numero } from './Widgets';
import s from './Analises.module.scss';

import { agruparSerie } from './series';

export default function Evolution({
    points,
    previous = [],
    previousStart,
    currentStart,
    granularity = 'dia',
    quantityLabel = 'vendas'
}: {
    points: Point[];
    previous?: Point[];
    previousStart?: string;
    currentStart?: string;
    granularity?: string;
    quantityLabel?: string;
}) {
    const current = agruparSerie(points, granularity);
    // Alinha pelo deslocamento relativo dos períodos equivalentes.
    const offset = previousStart && currentStart ? (Date.parse(currentStart) - Date.parse(previousStart)) / 86400000 : 0;
    const shifted = previous.map((p) => ({ ...p, dia: new Date(Date.parse(p.dia.slice(0, 10) + 'T12:00Z') + offset * 86400000).toISOString().slice(0, 10) }));
    const prior = new Map(agruparSerie(shifted, granularity).map((p) => [p.dia, p]));
    const data = {
        labels: current.map((p) => dataBR(p.dia)),
        datasets: [
            { label: 'Período atual', data: current.map((p) => (p.valor === null ? null : Number(p.valor))), borderColor: '#138478', backgroundColor: '#13847812', fill: true, tension: 0.2, pointRadius: current.length < 3 ? 3 : 0 },
            ...(previousStart
                ? [
                      {
                          label: 'Período anterior equivalente',
                          data: current.map((p) => (prior.get(p.dia)?.valor === null ? null : Number(prior.get(p.dia)?.valor || 0))),
                          borderColor: '#7b94a9',
                          borderDash: [5, 4],
                          fill: false,
                          tension: 0.2,
                          pointRadius: 0
                      }
                  ]
                : [])
        ]
    };
    const options = {
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
            tooltip: {
                callbacks: {
                    label: (ctx: any) =>
                        `${ctx.dataset.label}: ${moeda(ctx.raw == null ? null : String(ctx.raw))} · ${numero(ctx.datasetIndex ? prior.get(current[ctx.dataIndex].dia)?.quantidade ?? 0 : current[ctx.dataIndex].quantidade)} ${quantityLabel}`
                }
            }
        },
        scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 7, font: { size: 10 } } }, y: { ticks: { maxTicksLimit: 5, font: { size: 10 } }, grid: { color: '#eaf0ed' } } }
    };
    return (
        <div className={s.chart}>
            <Chart type="line" data={data} style={{ height: '100%', width: '100%' }} options={options} />
        </div>
    );
}

