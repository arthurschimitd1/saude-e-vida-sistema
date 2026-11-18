import type { Metadata } from 'next';
import CentralSubnav from '@/features/central-gestao/shared/CentralSubnav';

export const metadata: Metadata = { title:'Central de Gestão | Saúde e Vida', description:'Visão gerencial dos registros da sua empresa.' };
export default function CentralGestaoLayout({ children }: { children:React.ReactNode }) { return <><CentralSubnav />{children}</>; }
