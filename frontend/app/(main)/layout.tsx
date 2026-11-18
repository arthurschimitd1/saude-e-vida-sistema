import { Metadata, Viewport } from 'next';
import Layout from '../../layout/layout';

interface AppLayoutProps {
    children: React.ReactNode;
}

// Força todas as páginas dentro do grupo (main) a serem renderizadas em runtime,
// evitando erros de prerender estático com hooks como useSearchParams.
export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
    initialScale: 1,
    width: 'device-width'
};

export const metadata: Metadata = {
    title: 'Saúde e Vida',
    description: 'Gestão operacional e financeira para a loja Saúde e Vida.',
    robots: { index: false, follow: false },
    openGraph: {
        type: 'website',
        title: 'Saúde e Vida',
        url: 'http://127.0.0.1:3000/',
        description: 'Gestão operacional e financeira para a loja Saúde e Vida.',
        images: ['https://www.primefaces.org/static/social/sakai-react.png'],
        ttl: 604800
    },
    icons: {
        icon: {
            url: '/images/loja/saude-e-vida-tree.png',
            type: 'image/png'
        },
        shortcut: '/images/loja/saude-e-vida-tree.png'
    }
};

export default function AppLayout({ children }: AppLayoutProps) {
    return <Layout>{children}</Layout>;
}
