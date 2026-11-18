'use client';
import { Chart } from 'primereact/chart';
import type { Visao } from '../types';
import { moeda, numero, dataBR } from './DetalhesDialog';
import styles from '../CentralGestao.module.scss';

export default function VendasChart({ serie }: { serie: Visao['vendas']['serie'] }) {
  return <div className={styles.salesChart} role="img" aria-label="Evolução diária das vendas registradas no período atual. Consulte os registros para detalhes.">
    <Chart type="line" style={{ height: '100%' }} data={{ labels: serie.map(item => `${item.dia.slice(8,10)}/${item.dia.slice(5,7)}`), datasets: [{
      label: 'Período atual', data: serie.map(item => item.valor === null ? null : Number(item.valor)),
      borderColor: '#16847b', backgroundColor: 'rgba(22,132,123,.06)', fill: true, borderWidth: 2,
      pointRadius: serie.length < 8 ? 3 : 0, pointHoverRadius: 4, tension: .15, spanGaps: false,
    }] }} options={{ responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#163c39', padding: 11, cornerRadius: 8, displayColors: false, callbacks: {
        title: (items: { dataIndex: number }[]) => items[0] ? dataBR(serie[items[0].dataIndex].dia) : '',
        label: (item: { dataIndex: number }) => `Período atual: ${moeda(serie[item.dataIndex].valor)}`,
        afterLabel: (item: { dataIndex: number }) => `${numero(serie[item.dataIndex].quantidade)} venda(s)`,
      } } },
      scales: { x: { grid: { display: false }, border: { display: false }, ticks: { color: '#768782', maxTicksLimit: 7, maxRotation: 0, font: { size: 10 } } },
        y: { beginAtZero: true, border: { display: false }, grid: { color: '#edf1f0' }, ticks: { color: '#768782', maxTicksLimit: 5, font: { size: 10 }, callback: (value: number | string) => Number(value).toLocaleString('pt-BR', { notation: 'compact' }) } } },
    }} />
  </div>;
}

