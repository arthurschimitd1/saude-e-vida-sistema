'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAnalise, Access } from './analises';
import styles from './Analises.module.scss';

export default function CentralSubnav() {
    const path = usePathname();
    const { data } = useAnalise<Access>('acesso');
    const links = [
        { href: '/central-gestao', label: 'Visão Geral', icon: 'pi-chart-line' },
        ...(data?.comercial ? [{ href: '/central-gestao/comercial', label: 'Comercial', icon: 'pi-shopping-bag' }] : []),
        ...(data?.estoque ? [{ href: '/central-gestao/estoque', label: 'Estoque', icon: 'pi-box' }] : [])
    ];
    return (
        <nav className={styles.subnav} aria-label="Visões da Central de Gestão">
            {links.map((l) => (
                <Link key={l.href} href={l.href} prefetch={false} aria-current={path === l.href ? 'page' : undefined}>
                    <i className={`pi ${l.icon}`} aria-hidden="true" />
                    {l.label}
                </Link>
            ))}
        </nav>
    );
}

