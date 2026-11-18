import { getUnitId, lucroMaisFetch, lucroMaisPublicFetch } from './_lucromais.js'

function formatDurationLabel(minutes) {
  if (!minutes) return ''
  if (minutes < 60) return `${minutes} minutos`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const hoursLabel = `${hours}h`
  return rest ? `${hoursLabel}${rest}min` : hoursLabel
}

function normalizeServiceName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function deduplicateServices(services = []) {
  const seen = new Set()
  return services.filter((service) => {
    const key = normalizeServiceName(service.name ?? service.nome)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function toLandingService(service) {
  const duration = Number(service.duration ?? service.duracaoMin ?? service.duracao_min ?? 0)
  return {
    id: service.id,
    name: service.name ?? service.nome,
    duration,
    durationLabel: service.durationLabel || formatDurationLabel(duration),
    price: Number(service.price ?? service.preco ?? 0),
    color: service.color || service.cor || '#C6A15B',
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Método não permitido' })
  }

  try {
    const unitId = getUnitId(req)
    if (!unitId) return res.status(400).json({ error: 'Unidade inválida ou não informada.' })
    // O endpoint público resolve a empresa e a unidade no servidor. Isso
    // evita que o catálogo autenticado traga serviços de outras unidades.
    let response = await lucroMaisPublicFetch(unitId, '/servicos')
    let services = response.ok
      ? deduplicateServices((await response.json()).map(toLandingService))
      : null

    // Compatibilidade durante indisponibilidade temporária do endpoint
    // público: mantém o fluxo funcionando, mas nunca repassa duplicidades.
    if (!response.ok) {
      response = await lucroMaisFetch(unitId, '/agendamentos/servicos')
      if (!response.ok) {
        return res.status(502).json({ error: 'Não foi possível carregar os serviços.' })
      }
      services = deduplicateServices((await response.json()).map(toLandingService))
    }

    return res.status(200).json(services)
  } catch (error) {
    console.error('[api/services]', error)
    return res.status(500).json({ error: 'Erro interno ao carregar serviços.' })
  }
}
