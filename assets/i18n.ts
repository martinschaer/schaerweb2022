type LanguageCode = string
type I18nDictionary = Record<LanguageCode, Record<string, string>>

const dict : I18nDictionary = {
  en: {
    '{0} seconds ago': '{0} seconds ago',
    '{0} minutes ago': '{0} minutes ago',
    '{0} hours ago': '{0} hours ago',
    '{0} days ago': '{0} days ago',
    '{0} weeks ago': '{0} weeks ago',
  },
  es: {
    '{0} seconds ago': 'hace {0} segundos',
    '{0} minutes ago': 'hace {0} minutos',
    '{0} hours ago': 'hace {0} horas',
    '{0} days ago': 'hace {0} días',
    '{0} weeks ago': 'hace {0} semanas',
  },
}

namespace I18n {
  let language = 'en'

  export const setLanguage = (lang: string) => {
    language = lang
  }

  export const t = (s: string, lang?: string) => {
    let l = lang ?? language
    const sepIndex = l.indexOf('-')
    if (dict[l] === undefined && sepIndex !== -1) {
      l = l.substring(0, sepIndex)
    }
    const translated = dict[l]?.[s]
    if (!translated) {
      // eslint-disable-next-line no-console
      console.warn(`i18n|${s}|${l}`)
    }
    return translated ?? s
  }
}

export const { t, setLanguage } = I18n
