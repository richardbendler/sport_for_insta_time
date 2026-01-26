import { funFacts as deFunFacts } from "./locales/de";
import { funFacts as enFunFacts } from "./locales/en";
import { funFacts as esFunFacts } from "./locales/es";
import { funFacts as frFunFacts } from "./locales/fr";

const FUN_FACTS_BY_LANGUAGE = {
  de: deFunFacts,
  en: enFunFacts,
  es: esFunFacts,
  fr: frFunFacts,
};

const getFunFactsForLanguage = (language) => {
  if (language && FUN_FACTS_BY_LANGUAGE[language]) {
    return FUN_FACTS_BY_LANGUAGE[language];
  }
  return FUN_FACTS_BY_LANGUAGE.de ?? [];
};

const validateFunFactsConsistency = () => {
  const baseFacts = FUN_FACTS_BY_LANGUAGE.de ?? [];
  const baseIds = new Set(baseFacts.map((fact) => fact.id));

  Object.entries(FUN_FACTS_BY_LANGUAGE).forEach(([language, facts]) => {
    if (!Array.isArray(facts)) {
      console.warn(`[funFacts] Missing funFacts array for language: ${language}`);
      return;
    }

    if (facts.length !== baseFacts.length) {
      console.warn(
        `[funFacts] Count mismatch for ${language}: ${facts.length} vs ${baseFacts.length}`
      );
    }

    const ids = new Set(facts.map((fact) => fact.id));
    const missing = [...baseIds].filter((id) => !ids.has(id));
    const extra = [...ids].filter((id) => !baseIds.has(id));

    if (missing.length || extra.length) {
      console.warn(`[funFacts] ID mismatch for ${language}`, {
        missing,
        extra,
      });
    }
  });
};

const isDev = typeof __DEV__ !== "undefined"
  ? __DEV__
  : typeof process !== "undefined" && process?.env?.NODE_ENV !== "production";

if (isDev) {
  validateFunFactsConsistency();
}

export { FUN_FACTS_BY_LANGUAGE, getFunFactsForLanguage };
