'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useContextoCentral } from '../useCentralGestao';

export default function CentralGestaoMenu() {
  const { contexto, key } = useContextoCentral();
  const path = usePathname();
  let master = false;
  // Exibir navegação não concede acesso. A página e a API mantêm a validação existente.
  if (key && typeof window !== 'undefined') {
    try { master = !!localStorage.getItem('token') && JSON.parse(localStorage.getItem('user') || '{}').tipo === 'MASTER'; } catch {}
  }
  if (!master && !contexto?.autorizado) return null;
  return <li className="layout-root-menuitem"><div className="layout-menuitem-root-text">Central de Gestão</div><ul>
    <li><Link href="/central-gestao" className={path === '/central-gestao' ? 'active-route' : undefined} aria-current={path === '/central-gestao' ? 'page' : undefined}>
      <i className="pi pi-chart-line layout-menuitem-icon" aria-hidden="true" /><span className="layout-menuitem-text">Visão Geral</span>
    </Link></li>
  </ul></li>;
}

