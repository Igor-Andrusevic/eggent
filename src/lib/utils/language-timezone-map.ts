export interface TimezoneGuess {
  timezone: string;
  confidence: "high" | "low";
  displayName: string;
  utcOffset: string;
}

const LANGUAGE_TO_TIMEZONE: Record<string, TimezoneGuess> = {
  it: { timezone: "Europe/Rome", confidence: "high", displayName: "Рим (Италия)", utcOffset: "UTC+1/+2" },
  ru: { timezone: "Europe/Moscow", confidence: "high", displayName: "Москва (Россия)", utcOffset: "UTC+3" },
  de: { timezone: "Europe/Berlin", confidence: "high", displayName: "Берлин (Германия)", utcOffset: "UTC+1/+2" },
  es: { timezone: "Europe/Madrid", confidence: "high", displayName: "Мадрид (Испания)", utcOffset: "UTC+1/+2" },
  fr: { timezone: "Europe/Paris", confidence: "high", displayName: "Париж (Франция)", utcOffset: "UTC+1/+2" },
  pl: { timezone: "Europe/Warsaw", confidence: "high", displayName: "Варшава (Польша)", utcOffset: "UTC+1/+2" },
  uk: { timezone: "Europe/Kyiv", confidence: "high", displayName: "Киев (Украина)", utcOffset: "UTC+2/+3" },
  ja: { timezone: "Asia/Tokyo", confidence: "high", displayName: "Токио (Япония)", utcOffset: "UTC+9" },
  "zh-cn": { timezone: "Asia/Shanghai", confidence: "medium", displayName: "Шанхай (Китай)", utcOffset: "UTC+8" },
  "zh-tw": { timezone: "Asia/Taipei", confidence: "medium", displayName: "Тайбэй (Тайвань)", utcOffset: "UTC+8" },
  ko: { timezone: "Asia/Seoul", confidence: "high", displayName: "Сеул (Корея)", utcOffset: "UTC+9" },
  pt: { timezone: "Europe/Lisbon", confidence: "medium", displayName: "Лиссабон (Португалия)", utcOffset: "UTC+0/+1" },
  "pt-br": { timezone: "America/Sao_Paulo", confidence: "medium", displayName: "Сан-Паулу (Бразилия)", utcOffset: "UTC-3" },
  nl: { timezone: "Europe/Amsterdam", confidence: "high", displayName: "Амстердам (Нидерланды)", utcOffset: "UTC+1/+2" },
  sv: { timezone: "Europe/Stockholm", confidence: "high", displayName: "Стокгольм (Швеция)", utcOffset: "UTC+1/+2" },
  da: { timezone: "Europe/Copenhagen", confidence: "high", displayName: "Копенгаген (Дания)", utcOffset: "UTC+1/+2" },
  no: { timezone: "Europe/Oslo", confidence: "high", displayName: "Осло (Норвегия)", utcOffset: "UTC+1/+2" },
  fi: { timezone: "Europe/Helsinki", confidence: "high", displayName: "Хельсинки (Финляндия)", utcOffset: "UTC+2/+3" },
  cs: { timezone: "Europe/Prague", confidence: "high", displayName: "Прага (Чехия)", utcOffset: "UTC+1/+2" },
  sk: { timezone: "Europe/Bratislava", confidence: "high", displayName: "Братислава (Словакия)", utcOffset: "UTC+1/+2" },
  hu: { timezone: "Europe/Budapest", confidence: "high", displayName: "Будапешт (Венгрия)", utcOffset: "UTC+1/+2" },
  ro: { timezone: "Europe/Bucharest", confidence: "high", displayName: "Бухарест (Румыния)", utcOffset: "UTC+2/+3" },
  bg: { timezone: "Europe/Sofia", confidence: "high", displayName: "София (Болгария)", utcOffset: "UTC+2/+3" },
  el: { timezone: "Europe/Athens", confidence: "high", displayName: "Афины (Греция)", utcOffset: "UTC+2/+3" },
  tr: { timezone: "Europe/Istanbul", confidence: "high", displayName: "Стамбул (Турция)", utcOffset: "UTC+3" },
  he: { timezone: "Asia/Jerusalem", confidence: "high", displayName: "Иерусалим (Израиль)", utcOffset: "UTC+2/+3" },
  ar: { timezone: "Asia/Dubai", confidence: "low", displayName: "Дубай (ОАЭ)", utcOffset: "UTC+4" },
  hi: { timezone: "Asia/Kolkata", confidence: "high", displayName: "Калькутта (Индия)", utcOffset: "UTC+5:30" },
  th: { timezone: "Asia/Bangkok", confidence: "high", displayName: "Бангкок (Таиланд)", utcOffset: "UTC+7" },
  vi: { timezone: "Asia/Ho_Chi_Minh", confidence: "high", displayName: "Хошимин (Вьетнам)", utcOffset: "UTC+7" },
  id: { timezone: "Asia/Jakarta", confidence: "medium", displayName: "Джакарта (Индонезия)", utcOffset: "UTC+7" },
  lv: { timezone: "Europe/Riga", confidence: "high", displayName: "Рига (Латвия)", utcOffset: "UTC+2/+3" },
  lt: { timezone: "Europe/Vilnius", confidence: "high", displayName: "Вильнюс (Литва)", utcOffset: "UTC+2/+3" },
  et: { timezone: "Europe/Tallinn", confidence: "high", displayName: "Таллин (Эстония)", utcOffset: "UTC+2/+3" },
};

export function guessTimezoneFromLanguage(languageCode: string | undefined): TimezoneGuess | null {
  if (!languageCode) return null;

  const normalizedLang = languageCode.toLowerCase().trim();

  if (LANGUAGE_TO_TIMEZONE[normalizedLang]) {
    return LANGUAGE_TO_TIMEZONE[normalizedLang];
  }

  const baseLang = normalizedLang.split("-")[0];
  if (baseLang && LANGUAGE_TO_TIMEZONE[baseLang]) {
    return LANGUAGE_TO_TIMEZONE[baseLang];
  }

  return null;
}

export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function formatTimezoneForDisplay(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("ru", {
      timeZone: timezone,
      timeZoneName: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
    return formatter.format(now);
  } catch {
    return timezone;
  }
}

export const POPULAR_TIMEZONES: Array<{ id: string; name: string; offset: string }> = [
  { id: "Europe/Moscow", name: "Москва", offset: "UTC+3" },
  { id: "Europe/Kyiv", name: "Киев", offset: "UTC+2/+3" },
  { id: "Europe/Riga", name: "Рига", offset: "UTC+2/+3" },
  { id: "Europe/Vilnius", name: "Вильнюс", offset: "UTC+2/+3" },
  { id: "Europe/Tallinn", name: "Таллин", offset: "UTC+2/+3" },
  { id: "Europe/Warsaw", name: "Варшава", offset: "UTC+1/+2" },
  { id: "Europe/Berlin", name: "Берлин", offset: "UTC+1/+2" },
  { id: "Europe/Paris", name: "Париж", offset: "UTC+1/+2" },
  { id: "Europe/Rome", name: "Рим", offset: "UTC+1/+2" },
  { id: "Europe/Madrid", name: "Мадрид", offset: "UTC+1/+2" },
  { id: "Europe/London", name: "Лондон", offset: "UTC+0/+1" },
  { id: "America/New_York", name: "Нью-Йорк", offset: "UTC-5/-4" },
  { id: "America/Los_Angeles", name: "Лос-Анджелес", offset: "UTC-8/-7" },
  { id: "Asia/Dubai", name: "Дубай", offset: "UTC+4" },
  { id: "Asia/Tokyo", name: "Токио", offset: "UTC+9" },
  { id: "Asia/Shanghai", name: "Шанхай", offset: "UTC+8" },
  { id: "Asia/Singapore", name: "Сингапур", offset: "UTC+8" },
  { id: "Australia/Sydney", name: "Сидней", offset: "UTC+10/+11" },
];
