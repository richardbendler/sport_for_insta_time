const FUN_FACTS_BY_LANGUAGE = {
  de: [
    {
      id: "funfact-001",
      text: "Schon 10 Minuten Bewegung können deine Stimmung messbar verbessern.",
    },
    {
      id: "funfact-002",
      text: "Regelmäßiger Sport erhöht deine Lebenserwartung – unabhängig vom Tempo.",
    },
    {
      id: "funfact-003",
      text: "Dein Körper wird stärker, noch bevor du es siehst.",
    },
    {
      id: "funfact-004",
      text: "Bewegung senkt Stress effektiver als viele Entspannungstechniken.",
    },
    {
      id: "funfact-005",
      text: "Konsistenz schlägt Intensität – jeder kleine Schritt zählt.",
    },
    {
      id: "funfact-006",
      text: "Sport verbessert deinen Schlaf bereits nach wenigen Tagen.",
    },
    {
      id: "funfact-007",
      text: "Dein Gehirn liebt Bewegung – sie steigert Konzentration und Fokus.",
    },
    {
      id: "funfact-008",
      text: "Nach dem Training fühlst du dich fast immer besser als davor.",
    },
    {
      id: "funfact-009",
      text: "Muskeln wachsen in der Pause – Regeneration ist Teil des Erfolgs.",
    },
    {
      id: "funfact-010",
      text: "Bewegung stärkt dein Immunsystem langfristig.",
    },
    {
      id: "funfact-011",
      text: "Du musst nicht motiviert sein, um anzufangen – Bewegung erzeugt Motivation.",
    },
    {
      id: "funfact-012",
      text: "Jeder Trainingsreiz ist ein Signal an deinen Körper: Werde stärker.",
    },
    {
      id: "funfact-013",
      text: "Sport hilft nachweislich gegen Angst und innere Unruhe.",
    },
    {
      id: "funfact-014",
      text: "Heute aktiv sein macht morgen leichter.",
    },
    {
      id: "funfact-015",
      text: "Schon leichte Bewegung reduziert das Risiko vieler Krankheiten.",
    },
    {
      id: "funfact-016",
      text: "Dein Körper passt sich an – egal, auf welchem Level du startest.",
    },
    {
      id: "funfact-017",
      text: "Training verbessert dein Selbstvertrauen, nicht nur deine Fitness.",
    },
    {
      id: "funfact-018",
      text: "Du verbrennst Kalorien auch nach dem Training weiter.",
    },
    {
      id: "funfact-019",
      text: "Bewegung macht dich belastbarer – körperlich und mental.",
    },
    {
      id: "funfact-020",
      text: "Jeder Trainingsstart ist ein Sieg über Ausreden.",
    },
    {
      id: "funfact-021",
      text: "Dein Herz wird stärker mit jedem aktiven Tag.",
    },
    {
      id: "funfact-022",
      text: "Fortschritt ist nicht linear – Dranbleiben ist der Schlüssel.",
    },
    {
      id: "funfact-023",
      text: "Sport setzt Glückshormone frei – ganz ohne Nebenwirkungen.",
    },
    {
      id: "funfact-024",
      text: "Mehr Bewegung = mehr Energie im Alltag.",
    },
    {
      id: "funfact-025",
      text: "Dein Körper ist für Bewegung gemacht – nicht für Stillstand.",
    },
    {
      id: "funfact-026",
      text: "Training formt Gewohnheiten, Gewohnheiten formen dein Leben.",
    },
    {
      id: "funfact-027",
      text: "Du trainierst nicht nur für heute, sondern für dein zukünftiges Ich.",
    },
    {
      id: "funfact-028",
      text: "Jeder Schritt zählt – auch der langsame.",
    },
    {
      id: "funfact-029",
      text: "Bewegung ist eine Investition mit 100 % Rendite.",
    },
  ],
};

const getFunFactsForLanguage = (language) => {
  if (language && FUN_FACTS_BY_LANGUAGE[language]) {
    return FUN_FACTS_BY_LANGUAGE[language];
  }
  return FUN_FACTS_BY_LANGUAGE.de ?? [];
};

export { FUN_FACTS_BY_LANGUAGE, getFunFactsForLanguage };
