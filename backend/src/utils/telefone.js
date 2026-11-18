// Números de celular brasileiros têm uma ambiguidade real: o "9" extra depois
// do DDD (ex: 83 9 9646-4513) às vezes chega formatado, às vezes não — depende
// de como o número foi digitado manualmente vs. como a Z-API/WhatsApp entrega
// no webhook. Sem isso, o mesmo contato gera duas conversas/clientes diferentes
// (um com o "9", outro sem) só porque os dígitos batidos não são idênticos.
//
// Em vez de tentar adivinhar qual é o formato "correto", geramos todas as
// variantes plausíveis (com/sem "9", com/sem "55") e usamos isso pra buscar
// se já existe cliente/conversa pra esse telefone antes de criar um novo.
export function variantesTelefone(telefoneBruto) {
    const digits = (telefoneBruto || '').replace(/\D/g, '');
    if (!digits) return [];

    const variantes = new Set([digits]);
    const semPais = digits.startsWith('55') ? digits.slice(2) : digits;
    const comPais = digits.startsWith('55') ? digits : `55${digits}`;
    variantes.add(semPais);
    variantes.add(comPais);

    // semPais deveria ser DDD (2 dígitos) + número (8 ou 9 dígitos)
    if (semPais.length === 11 && semPais[2] === '9') {
        // tem o "9" — adiciona a variante sem ele
        const semNove = `${semPais.slice(0, 2)}${semPais.slice(3)}`;
        variantes.add(semNove);
        variantes.add(`55${semNove}`);
    } else if (semPais.length === 10) {
        // não tem o "9" — adiciona a variante com ele
        const comNove = `${semPais.slice(0, 2)}9${semPais.slice(2)}`;
        variantes.add(comNove);
        variantes.add(`55${comNove}`);
    }

    return Array.from(variantes);
}
