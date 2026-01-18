import de, {
  weekdayLabels as deWeekdayLabels,
  monthLabels as deMonthLabels,
  numberWords as deNumberWords,
} from "./de";
import en, {
  weekdayLabels as enWeekdayLabels,
  monthLabels as enMonthLabels,
  numberWords as enNumberWords,
} from "./en";
import es, {
  weekdayLabels as esWeekdayLabels,
  monthLabels as esMonthLabels,
  numberWords as esNumberWords,
} from "./es";
import fr, {
  weekdayLabels as frWeekdayLabels,
  monthLabels as frMonthLabels,
  numberWords as frNumberWords,
} from "./fr";

const STRINGS = { de, en, es, fr };
export const TRANSLATION_RESOURCES = Object.fromEntries(
  Object.entries(STRINGS).map(([key, value]) => [key, { translation: value }])
);
export const SUPPORTED_LANGUAGES = Object.keys(STRINGS);

export const WEEKDAY_LABELS_BY_LANG = {
  de: deWeekdayLabels,
  en: enWeekdayLabels,
  es: esWeekdayLabels,
  fr: frWeekdayLabels,
};

export const DEFAULT_WEEKDAY_LABELS = deWeekdayLabels;

export const MONTH_LABELS = {
  de: deMonthLabels,
  en: enMonthLabels,
  es: esMonthLabels,
  fr: frMonthLabels,
};

export const NUMBER_WORDS = {
  de: deNumberWords,
  en: enNumberWords,
  es: esNumberWords,
  fr: frNumberWords,
};

export default STRINGS;
