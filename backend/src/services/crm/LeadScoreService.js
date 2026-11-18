/**
 * Lead Score Service
 * Calcula pontuação 0-100 para cada prospect com base na sua presença digital.
 * Totalmente desacoplado — recebe um objeto prospect e retorna a pontuação.
 */

const PESOS = {
    website:          20,  // possui site
    instagram:        15,  // possui Instagram
    google_reviews:   25,  // quantidade de avaliações Google
    google_rating:    25,  // nota Google (0-5)
    presenca_digital: 15,  // soma dos pontos extras de presença
};

function pontuarReviews(reviews) {
    if (!reviews || reviews === 0) return 0;
    if (reviews >= 500) return 25;
    if (reviews >= 100) return 20;
    if (reviews >= 50)  return 15;
    if (reviews >= 20)  return 10;
    if (reviews >= 5)   return 5;
    return 2;
}

function pontuarNota(rating) {
    if (!rating || rating === 0) return 0;
    if (rating >= 4.5) return 25;
    if (rating >= 4.0) return 20;
    if (rating >= 3.5) return 15;
    if (rating >= 3.0) return 10;
    return 5;
}

function pontuarPresencaDigital(prospect) {
    let pts = 0;
    if (prospect.email)     pts += 5;
    if (prospect.phone)     pts += 5;
    if (prospect.address)   pts += 5;
    return Math.min(pts, 15);
}

export function calcularLeadScore(prospect) {
    let score = 0;
    if (prospect.website)    score += PESOS.website;
    if (prospect.instagram)  score += PESOS.instagram;
    score += pontuarReviews(prospect.google_reviews);
    score += pontuarNota(prospect.google_rating);
    score += pontuarPresencaDigital(prospect);
    return Math.min(Math.max(Math.round(score), 0), 100);
}

export function classificarLead(score) {
    if (score >= 81) return { label: 'Muito Quente', color: '#ef4444', icon: 'pi-fire' };
    if (score >= 61) return { label: 'Quente',       color: '#f97316', icon: 'pi-bolt' };
    if (score >= 31) return { label: 'Morno',        color: '#f59e0b', icon: 'pi-sun' };
    return             { label: 'Frio',         color: '#3b82f6', icon: 'pi-cloud' };
}
