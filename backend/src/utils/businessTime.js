export const BUSINESS_TIME_ZONE = 'America/Fortaleza';

const formatterCache = new Map();

const formatter = (timeZone = BUSINESS_TIME_ZONE) => {
  if (!formatterCache.has(timeZone)) {
    formatterCache.set(timeZone, new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }));
  }
  return formatterCache.get(timeZone);
};

export const businessDateParts = (value = new Date(), timeZone = BUSINESS_TIME_ZONE) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Data inválida');

  const parts = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second
  };
};

const offsetMinutesAt = (date, timeZone = BUSINESS_TIME_ZONE) => {
  const parts = businessDateParts(date, timeZone);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  const instantWithoutMilliseconds = Math.floor(date.getTime() / 1000) * 1000;
  return Math.round((representedAsUtc - instantWithoutMilliseconds) / 60000);
};

const pad = (value) => String(value).padStart(2, '0');

export const businessDate = (value = new Date(), timeZone = BUSINESS_TIME_ZONE) => {
  const parts = businessDateParts(value, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
};

export const fiscalDateTime = (value = new Date(), timeZone = BUSINESS_TIME_ZONE) => {
  const date = value instanceof Date ? value : new Date(value);
  const parts = businessDateParts(date, timeZone);
  const offset = offsetMinutesAt(date, timeZone);
  const sign = offset >= 0 ? '+' : '-';
  const absolute = Math.abs(offset);
  const offsetText = `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
    + `T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}${offsetText}`;
};

export const fiscalDateTimeForBusinessDate = (
  dateOnly,
  value = new Date(),
  timeZone = BUSINESS_TIME_ZONE
) => {
  const selectedDate = String(dateOnly || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
    throw new Error('A data de emissão deve estar no formato YYYY-MM-DD');
  }

  const today = businessDate(value, timeZone);
  if (selectedDate > today) {
    throw new Error('A data de emissão não pode estar no futuro');
  }

  const currentParts = businessDateParts(value, timeZone);
  const selectedStart = startOfBusinessDate(selectedDate, timeZone);
  const selectedInstant = new Date(
    selectedStart.getTime()
      + currentParts.hour * 60 * 60 * 1000
      + currentParts.minute * 60 * 1000
      + currentParts.second * 1000
  );

  return fiscalDateTime(selectedInstant, timeZone);
};

export const startOfBusinessDate = (dateOnly, timeZone = BUSINESS_TIME_ZONE) => {
  const match = String(dateOnly || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error('Data civil deve estar no formato YYYY-MM-DD');
  const [, year, month, day] = match.map(Number);
  const targetUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  let instant = targetUtc;

  // Duas passagens acomodam mudanças de offset sem depender do fuso do servidor.
  for (let index = 0; index < 2; index += 1) {
    const offset = offsetMinutesAt(new Date(instant), timeZone);
    instant = targetUtc - offset * 60_000;
  }

  return new Date(instant);
};

export const businessMonthSequence = (
  value = new Date(),
  count = 6,
  timeZone = BUSINESS_TIME_ZONE
) => {
  const current = businessDateParts(value, timeZone);
  return Array.from({ length: count }, (_, index) => {
    const monthsAgo = count - index - 1;
    const cursor = new Date(Date.UTC(current.year, current.month - 1 - monthsAgo, 1));
    const key = cursor.toISOString().slice(0, 7);
    const label = new Intl.DateTimeFormat('pt-BR', {
      month: 'short',
      year: '2-digit',
      timeZone: 'UTC'
    }).format(cursor);
    return { key, label };
  });
};
