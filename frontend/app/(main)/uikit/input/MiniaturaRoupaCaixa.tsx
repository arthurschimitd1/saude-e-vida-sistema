'use client';

import { useState } from 'react';

export default function MiniaturaRoupaCaixa({ fotoUrl, nome }: { fotoUrl?: string | null; nome: string }) {
    const [fotoComErro, setFotoComErro] = useState<string | null>(null);
    return (
        <span
            className="inline-flex align-items-center justify-content-center border-round surface-100 border-1 surface-border"
            style={{ width: 40, height: 40, flexShrink: 0, overflow: 'hidden' }}
        >
            {fotoUrl && fotoUrl !== fotoComErro ? (
                <img
                    src={fotoUrl}
                    alt={`Foto de ${nome}`}
                    width={40}
                    height={40}
                    loading="lazy"
                    decoding="async"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    onError={() => setFotoComErro(fotoUrl)}
                />
            ) : (
                <i className="pi pi-image text-color-secondary" role="img" aria-label={`${nome}: sem foto disponível`} />
            )}
        </span>
    );
}
