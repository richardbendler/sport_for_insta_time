import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import { SUPPORTED_LANGUAGES, TRANSLATION_RESOURCES } from "../locales";

const detectInitialLanguage = () => {
  const locale = Localization.locale?.toLowerCase().split("-")[0];
  if (locale && SUPPORTED_LANGUAGES.includes(locale)) {
    return locale;
  }
  return "en";
};

const resources = TRANSLATION_RESOURCES;

const initialLanguage = detectInitialLanguage();

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    compatibilityJSON: "v3",
    resources,
    lng: initialLanguage,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
  });
}

export const supportedLanguages = SUPPORTED_LANGUAGES;

export default i18n;
