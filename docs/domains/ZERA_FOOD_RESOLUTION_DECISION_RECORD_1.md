# Zera — Food Resolution Decision Record 1: AI-First Interpretation, Source-Grounded Data, Deterministic Calculation

Status: `accepted` — Architekturautorität für die Food-Resolution-Pipeline (Resolver V2 → V3)
Ebene: Architektur-/Domänen-Entscheidung (unterhalb `SSOK.md`/`AGENTS.md`, oberhalb der
`ROADMAP.md`-Tasks der Epics "Resolver V2 – Multi-Source Fusion Architecture" und
"Resolver V3 – AI-First Interpretation & Source-Grounded Retrieval")
Voraussetzung: `SSOK.md` (DACH Data Strategy, Product Principles), `AGENTS.md`, `ROADMAP.md`
(Resolver V2 Epic, Decisions Log), [`ZERA_PRODUCT_BIBLE.md`](../vision/ZERA_PRODUCT_BIBLE.md)
(Abschnitt 2–3: Food Catalog / Journal / Evaluation Engine Trennung),
[`ZERA_JOURNAL_DECISION_RECORD_1.md`](ZERA_JOURNAL_DECISION_RECORD_1.md) (Format-Vorbild)

> **Freigabe:** Dieses Dokument ist ab sofort fachliche Autorität für die Weiterentwicklung der
> Food-Resolution-Pipeline. `accepted` bedeutet **nicht** `final`: Änderungen erfordern einen
> bewussten Review-/Revisionsprozess, keine stillen Edits. Dieses Dokument ersetzt **keine**
> bestehende Entscheidung stillschweigend — Abschnitt 4 benennt den einen Konflikt mit der
> bisherigen Entscheidungslage explizit und löst ihn auf, statt ihn zu verschweigen.

---

## 1. Zweck und Anlass

Externe Produktevidenz (Amy Food Journal — ein KI-first Food-Logging-Produkt) wurde als Anlass
genommen, die bisherige Food-Resolution-Strategie ("deterministisch normalisieren → mehrere
Quellen durchsuchen → ranken → KI nur als spätes Fallback") gegen eine neue Hypothese zu prüfen:
**KI als erster semantischer Verarbeitungsschritt für unbekannte Eingaben (Verständnis +
Suchplanung), gefolgt von quellenbasierter Datenbeschaffung, deterministischer Berechnung und
persistentem Lernen aus validierten Ergebnissen.**

Dieses Dokument ist **kein Implementierungsplan**. Es enthält keine Codeänderungen am
produktiven Resolver. Es legt die fachlichen/architektonischen Entscheidungen fest, an denen
sich die in `ROADMAP.md` neu angelegten Resolver-V3-Tasks messen müssen.

---

## 2. Amy-Produktevidenz — eingestuft nach Belastbarkeit

Amy ist **keine neutrale oder wissenschaftliche Quelle**. Evidenz wurde direkt an den
verlinkten URLs geprüft (nicht aus Trainingswissen übernommen) und in fünf Kategorien getrennt.

### 2.1 Verifizierbare Produktmerkmale (direkt geprüft)

- `amyfoodjournal.com/accuracy` ist eine Astro-Seite, deren eigentlicher Inhalt in einem
  iframe (`/accuracy-report.html`) liegt — ein separat gehosteter, 70-Fälle-Benchmark-Report.
- Der Report enthält pro Testfall: Referenzwert (USDA FoodData Central / offizielle
  Restaurant-Nährwertangaben / Kultur-Datenbanken), Amy-Ergebnis, MyFitnessPal-Ergebnis,
  verwendetes Modell (`perplexity/sonar`, für jeden der 70 Fälle explizit angegeben) und
  Latenz pro Aufruf (2.2–6.3 s).
- Testkategorien: Simple (Einzel-Lebensmittel), Homemade (Mehrzutaten-Gerichte, ±20%
  Toleranz), Restaurant (Kettenrestaurant-Angaben), International (nicht-US-Gerichte, ±25%
  Toleranz, gegen MEXT/KFCT/Thai FCD/PhilFCT/TurKomp/FAO/CARICOM), Typos (absichtliche
  Tippfehler), Portions (exakte Gramm-/Maßangaben).
- Amy-Gesamtscore 85/100 (64/70 bestanden), MyFitnessPal 62/100 (44/70 bestanden) — gegen die
  **von Amys eigenem System gewählten** Referenzwerte und Gewichtung (Kalorien 40 %, Protein
  25 %, Kohlenhydrate 20 %, Fett 15 %).
- `feedback.amyfoodjournal.com` (Board "Autocomplete Suggestions", Dez. 2025) zeigt einen
  Nutzerwunsch nach automatischer Wiederverwendung bereits berechneter Einträge ("automatically
  save all measurements in some kind of a hidden database" — explizit zur Kostensenkung), mit
  Entwicklerantwort "Working on a solution here because I'm facing the same issue" (22.12.2025).
- Board "Incorrect nutrition data" zeigt vier unabhängige, thematisch verschiedene
  Nutzerberichte: Tag-zu-Tag-Inkonsistenz bei identischer Eingabe ("From one day to the other
  the calories aren't the same even though the food and quantities are exactly the same"),
  Wunsch nach Zutaten-Zerlegung statt Ganzgericht-Schätzung ("Complex meal breakdown on
  ingredients"), DACH-Regionalfehler ("Zwiebelrostbraten with Spätzle and sauce" → 1300 kcal
  statt ~800 kcal laut erster geprüfter Quelle — **~60 % Überschätzung bei einem deutschen
  Gericht**), und Locale-Verwechslung (UK-McDonald's-Frühstück ~400 kcal niedriger als von Amy
  vorhergesagt, vermutlich US-Referenzwerte).

### 2.2 Aussagen des Entwicklers (Chris Raroque, feedback board, 08.03.2026 — Primärquelle)

Wörtlich zitiert, als Entwickleraussage gekennzeichnet, **nicht** als unabhängig verifizierter
Fakt behandelt:

> "Its actually using perplexity sonar under the hood and running a search across a few
> databases (the same ones myfitnesspal and others use)"

> "its extremely expensive and costs me almost 1 cent every time someone logs food"

> "the quality of the input will define the quality of the output. So if you type in something
> like pizza, it's going to have a much harder time understanding [...] Honestly similar to just
> typing pizza in myfitnesspal and selecting the first option. If you type in something like
> 'two slices of pizza from Pizza Hut,' then the accuracy goes up tremendously."

> "I actually have an internal benchmark that I've run internally of about a hundred different
> items in different categories and I compare the results of Amy against the best option in
> MyFitnessPal [...] I'm working on cleaning up the benchmark and publishing it [...] EDIT: ill
> just publish the benchmark now [...] https://amyfoodjournal.com/accuracy"

Diese letzte Aussage **beweist direkt**, dass der später veröffentlichte 70-Fälle-Report
(Abschnitt 2.1) aus dem ursprünglich internen ~100-Item-Entwickler-Benchmark hervorgegangen ist
— exakt der im Auftrag genannte Ausgangshinweis, hiermit anhand der Primärquelle bestätigt statt
nur vermutet.

### 2.3 Selbst veröffentlichte Benchmarks (Amys eigener Report)

Der `/accuracy`-Report behauptet Neutralität ("scoring system operated with no knowledge of
which tool it was evaluating [...] no bias introduced at any stage") und ruft zur
Selbstprüfung auf ("audit this benchmark yourself"). Das ändert nichts an der grundsätzlichen
Einordnung: **Testfallauswahl, Referenzquellenwahl, Toleranzbänder, Gewichtung und die
Entscheidung, welches MFP-Ergebnis als Vergleich zählt, liegen vollständig bei Amy selbst.**
Der MFP-Vergleich wurde zudem nicht durch reale Nutzerinteraktion erzeugt, sondern durch
Browser-Automatisierung eines LLM-Agenten, der "instructed to choose the most accurate option
for MyFitnessPal in every case" war — an einer Stelle als bestmögliche MFP-Chance beschrieben,
an anderer Stelle als bloße Nachbildung ("replicating the experience a real user would have").
Diese zwei Beschreibungen der MFP-Methodik sind nicht deckungsgleich und wurden nicht
aufgelöst. **Fazit: reales, prüfbares Signal zu Modellverhalten (siehe 2.1), aber kein
unabhängiger Qualitätsnachweis.**

### 2.4 Marketingbehauptungen

- `/accuracy`-Meta-Description: "Real accuracy data from independent testing" — **widerspricht
  der eigenen Methodik-Offenlegung** auf derselben Seite (kein Human-in-the-loop, kein
  Drittanbieter-Audit, Amy definiert die eigene Referenz und Gewichtung). Wird hier explizit
  als unbelegte Marketingaussage eingestuft, nicht übernommen.
- `vs/myfitnesspal`: "AI photo estimates are 90-95% accurate for calories on typical meals" —
  unbelegte Eigenaussage ohne verlinkte Methodik für diese spezifische Zahl.
- `vs/cronometer`: Amy positioniert sich selbst als Trade-off gegen Cronometers Tiefe
  ("Cronometer [tracks] 82+ nutrients [...] 750,000+ foods [...] Amy [...] intentionally omits
  micronutrient tracking, covering only calories, protein, carbs, fat, fiber") — als
  Eigenaussage plausibel und intern konsistent, aber ebenfalls eine Positionierung, kein
  Prüfergebnis.

### 2.5 Nutzerfeedback / dokumentierte Fehlermuster (siehe 2.1 letzter Punkt)

Bereits oben mit den vier Board-Posts eingeordnet. Diese vier Muster — **Inkonsistenz bei
Wiederholung, fehlende Zerlegung mehrteiliger Mahlzeiten, DACH-Regionalfehler, Locale-Fehler**
— sind unabhängig vom Amy-eigenen Benchmark entstanden (echte Nutzerberichte) und damit
belastbarer als Amys eigene Erfolgszahlen.

### 2.6 Einstufung der Ausgangshinweise aus dem Auftrag

| Hinweis                                                                                                | Einstufung                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Flow: natürliche Eingabe → Suche → automatische Berechnung                                             | **Belastbar** (Report + Entwickleraussage stimmen überein)                                                                                                                  |
| Perplexity Sonar, mehrere Datenbanken                                                                  | **Belastbar** (Primärquelle: Entwicklerzitat + jede Report-Zeile nennt `perplexity/sonar`)                                                                                  |
| Reale Kosten pro Log (~1 Cent)                                                                         | **Belastbar** (Entwicklerzitat, nicht extern geprüft, aber Primärquelle)                                                                                                    |
| Qualität abhängig von Eingabespezifität                                                                | **Belastbar** (Entwicklerzitat + durch Report-Datenmuster plausibilisiert: vage/komplexe Fälle haben durchgehend niedrigere Confidence-Werte, 68–75 statt 92–100)           |
| Benchmark aus internem ~100-Item-Benchmark hervorgegangen                                              | **Belastbar, jetzt direkt belegt** (Entwicklerzitat vom 08.03., Link identisch mit später veröffentlichtem Report)                                                          |
| Amy nutzt trotz AI-first weiterhin große Lebensmitteldatenbank                                         | **Belastbar** (Entwicklerzitat: "search across a few databases (the same ones myfitnesspal and others use)"; `/vs/cronometer` nennt "500,000+ foods")                       |
| Schwächen bei regionalen Speisen, vagen Beschreibungen, Mengen, gemischten Gerichten, Wiederholbarkeit | **Belastbar** (vier unabhängige, thematisch verschiedene Nutzerberichte, nicht aus Amys eigenem Benchmark)                                                                  |
| Persistente Wiederverwendung verbessert Geschwindigkeit/Konsistenz/Kosten                              | **Plausibel, produktseitig unbewiesen** (Nutzerwunsch + Entwickler-"working on it", aber noch nicht ausgeliefert — kein Nachweis, dass es bei Amy tatsächlich funktioniert) |
| Cronometer als Gegenmodell (Tiefe vs. Friktion)                                                        | **Plausibel** (Amys eigene Positionierung, intern konsistent, aber Eigenaussage)                                                                                            |

**Nicht übernommen:** "Real accuracy data from independent testing" (2.4) und die 90–95 %-Zahl
ohne Methodik (2.4) werden **nicht** als Repository-Fakt oder Zielmetrik verwendet.

---

## 3. Aktueller Zera-Resolver — empirischer Stand

Direkt aus dem Code verifiziert (Stand dieses Branches), nicht aus `ROADMAP.md`-Status-Feldern
übernommen, wo Code gegenprüfbar war:

- **Einstiegspunkt:** [`SequentialFoodCatalogResolver.resolve()`](../../src/features/nutrition/application/services/SequentialFoodCatalogResolver.ts)
  — dünner Wrapper um `resolveInternal()`, der danach fire-and-forget einen
  `ResolverRunLogger`-Eintrag schreibt (RESOLVER-V2-006, teilweise).
- **Keine Früh-Übersetzung:** `normalizeText()` normalisiert nur (Kleinschreibung, Umlaute,
  Interpunktion). Pro Quelle liefert `getSourceQuery()` eine quellen-native Query (BLS/OFF
  erhalten deutschen Text unverändert, USDA erhält bei bekanntem kanonischem Treffer die
  englische Entsprechung).
- **Source-Routing:** `determineSourceRoutingStrategy()` — Branded-Input → OFF zuerst;
  DE-Locale (generisch oder mehrdeutig) → BLS zuerst (`user, bls, off, usda, ai`); sonst
  Standard-Reihenfolge `user, off, bls, usda, ai`. `'ai'` ist bereits Teil der Prioritätsliste,
  aber **keine Quelle vom Typ `'ai'` ist aktuell in `container.ts` registriert** — der
  AI-Fallback-Slot existiert strukturell, ist aber leer.
- **Zwei deterministische Fast-Paths ohne Cross-Source-Vergleich:** (1) User-Alias-Treffer
  (`source.type === 'user'`) — sofortige Rückgabe. (2) BLS-„DACH-Wahrheit" — bei
  `locale === 'de'` und generischem/mehrdeutigem Input mit `score ≥ 0.75`/`0.85` wird ohne
  OFF/USDA-Vergleich akzeptiert. Beide sind **bewusste, mit dem Menschen abgestimmte
  Ausnahmen** von der sonst geltenden "alle Quellen liefern, dann fusionieren"-Regel
  (RESOLVER-V2-003-Implementierungsnotiz).
- **Fusion/Scoring:** [`ScoreCalculator`](../../src/features/nutrition/application/services/ScoreCalculator.ts)
  berechnet für jeden Kandidaten `matchScore`/`dataQualityScore`/`kcalConsistencyScore`/
  `sourceTrustScore`/`finalScore`; [`ResolverDecisionPolicy.buildResolverDecision()`](../../src/features/nutrition/application/services/ResolverDecisionPolicy.ts)
  klassifiziert danach in `accepted` (Score ≥ 0.75, Abstand zum Zweiten ≥ 0.08),
  `ambiguous` (Score ≥ 0.7, Abstand < 0.08) oder `rejected`.
- **AI-Reranking existiert bereits als Port, ist aber nicht verdrahtet:**
  [`AiRerankingProvider`](../../src/features/nutrition/application/ports/AiRerankingProvider.ts) +
  [`RateLimitedAiReranker`](../../src/features/nutrition/application/services/RateLimitedAiReranker.ts)
  (RESOLVER-V2-007-A, `done`) implementieren exakt das im Auftrag beschriebene
  Nicht-Ziel-konforme Muster — nur unterhalb einer Confidence-Schwelle (Default 0.6),
  rate-limitiert (20/min Default), fällt bei jedem Fehler/ungültiger Permutation auf die
  ursprüngliche Reihenfolge zurück, kann **nur vorhandene Kandidaten umsortieren, nie neue
  erfinden oder Makrodaten anfassen**. RESOLVER-V2-007-B (Provider-Wahl) und -C
  (Nutzungspersistenz) sind `todo`; ein Benchmark-Harness für Provider-Vergleich existiert
  bereits (`scripts/benchmark-ai-reranking-providers.mjs` + `scripts/lib/ai-reranking-benchmark-*.mjs`),
  ist aber nicht Teil der Jest-Suite (braucht echte API-Keys).
- **Provider-Neutralität ist bereits gelebte Praxis, nicht nur Regel:** kein Modell-/
  Providername in Domain/Application; `AiRerankingProvider` ist ein reines Interface,
  Provider-Auswahl ist ausdrücklich vertagt (RESOLVER-V2-007-B).
- **Knowledge-Layer-Tabellen existieren bereits live in Supabase** (RESOLVER-V2-005,
  Discovery 2026-07-10): `food_catalog_items`, `user_food_aliases`, `food_resolver_runs`,
  `food_query_cache_results`, `food_sources` — als Schema-Drift entstanden, jetzt per
  Migration dokumentiert. **Es existiert noch keine `corrections`-Tabelle** und **kein
  Lesepfad, der `food_resolver_runs`/`food_query_cache_results` für Wiederverwendung
  konsultiert** — Schreiben (Logging) existiert, Lesen (Cache-Reuse) nicht.
- **Journal-Persistenz hat bereits ein Provenienz-/Snapshot-Fundament:**
  [`NutritionTypes.ts`](../../src/features/nutrition/domain/models/NutritionTypes.ts) trägt
  seit J-002 (`done`) ein optionales `nutritionSnapshot: {kcal, protein, carbs, fat}` und
  optionales `foodCatalogRef: {source, sourceId, displayName, confidence}`; seit J-003
  (`done`) einen Append-only Correction Log + Soft-Delete (Tombstone) statt Hard-Delete —
  beides bereits exakt das, was der Auftrag als „Provenienz, Confidence, Editierbarkeit,
  Nutzerkorrekturen verbessern künftige Auflösungen" fordert, allerdings **auf
  Journal-Ebene**, nicht auf Resolver-Cache-Ebene (kein Rückkanal von Korrekturen in den
  Knowledge Layer).
- **Vorhandener AI-Einsatz für Interpretation (Präzedenzfall, kein Neuland):**
  `FakeAiMealParser`/`FakeAiFoodMapper` (in `container.ts` verdrahtet) sind bereits das
  Interface-Muster für „KI zerlegt komplexe Eingabe" — heute als Fake/Deterministic-Fallback
  implementiert, nicht als echter Provider. Das ist der bestehende Ankerpunkt für das neue
  AI-Interpretationscontract (Abschnitt 5.2), keine architektonische Neuerfindung.
- **BLS-Schwächen sind bereits proaktiv diagnostiziert und teils behoben**
  (RESOLVER-V2-008/009/010, alle `done`): generische Lebensmittel wie „Himbeeren"/
  „Haferflocken" wurden fälschlich auf verarbeitete Varianten (Dessert/Milchsuppe) gemappt,
  gefixt durch Matching-Regeln in `BlsLookupEngine`. „Speck" ist **bewiesen mehrdeutig**
  (drei nährwertlich verschiedene BLS-Cluster, bis zu 6,2× Kalorienunterschied) und löst
  heute über eine dedizierte Klärungs-UI auf (`SpeckAmbiguity.ts` + `JournalScreen.tsx`) —
  ein **direktes, produktives Vorbild** für das im Auftrag geforderte „gezielte kleinste
  Rückfrage bei Unsicherheit" (Abschnitt 5.6). Dies korreliert mit dem Amy-Nutzerbericht zu
  „Zwiebelrostbraten" (2.1): DACH-Regionalgerichte sind eine bekannte Schwachstelle in
  **beiden** Systemen, nicht amy-spezifisch.

---

## 4. Konflikt mit bestehender Entscheidung — explizit benannt und aufgelöst

`ROADMAP.md`s Decisions Log enthält:

> **Deterministic-first:** No LLM calls in core logging pipeline. AI only for complex
> multi-item parsing when deterministic logic is insufficient.

Und die "Resolver Rules (Global)":

> AI is assistive only, never authoritative.

Und RESOLVER-V2 Core Principle #6:

> Optional AI (strictly limited): ONLY for re-ranking low-confidence cases and semantic
> similarity. NEVER for macro calculation or silent decisions.

**Das ist der eine echte Widerspruch zur neuen Richtung**, und er wird hier nicht stillschweigend
übergangen: Die neue Hypothese verlangt, dass KI für unbekannte Eingaben der **erste**
semantische Schritt ist (Verständnis + Suchplanung), nicht ein **letzter** Ausweg unterhalb
einer Confidence-Schwelle.

**Auflösung:**

1. **Die tiefere Invariante bleibt vollständig erhalten und wird hier bekräftigt:** KI ist
   niemals autoritativ über Nährwerte, niemals Ersatz für deterministische Berechnung, immer
   nachvollziehbar/rate-limitiert/geloggt, und ein validierter Fast-Path geht ihr immer vor.
   Das war schon vor diesem Dokument so (RateLimitedAiReranker, `AiRerankingProvider`) und
   bleibt die bindende Grenze für **jeden** KI-Kontaktpunkt, alt wie neu.
2. **Was sich ändert, ist ausschließlich die Reihenfolgen-Prämisse für den Zweig „neue oder
   nicht ausreichend bekannte Eingabe":** „AI only … when deterministic logic is insufficient"
   wird nicht negiert, sondern präzisiert. Für den validierten Fast-Path (bekannte Eingabe,
   Alias-Cache, gespeicherte Mahlzeiten, BLS-DACH-Wahrheit) bleibt „deterministic-first"
   uneingeschränkt gültig und wird durch die neue, zu bauende persistente
   Wiederverwendung (Abschnitt 5.1) sogar gestärkt — mehr Eingaben werden künftig ohne
   KI-Aufruf gelöst als heute. Für den Zweig „Eingabe scheitert am Fast-Path" wird die KI
   **zeitlich vorgezogen**: sie interpretiert und plant die Suche, **bevor** deterministische
   Quellenabfrage/Scoring/Berechnung laufen — sie ersetzt diese Schritte nicht, sie geht ihnen
   voraus. Das ist eine Erweiterung des bestehenden `FakeAiMealParser`-Präzedenzfalls
   („KI zerlegt komplexe Mehrteil-Eingaben"), keine neue Kategorie.
3. **RESOLVER-V2-007 (KI-Reranking unterhalb Confidence-Schwelle) wird nicht verworfen.** Es
   bleibt ein gültiger, unabhängiger KI-Kontaktpunkt (Umsortierung bereits gefundener,
   bereits gescorter Kandidaten) und wird durch die neue KI-Interpretations-/Suchplanungs-Rolle
   **ergänzt**, nicht ersetzt — beide dürfen nebeneinander existieren, weil sie unterschiedliche
   Probleme lösen (Reranking = welche vorhandene Quelle ist gemeint; Interpretation/Planung =
   was wird überhaupt gesucht).
4. **„AI is assistive only, never authoritative" gilt unverändert** — auch im AI-first-Zweig
   erzeugt die KI ein typisiertes strukturiertes Objekt (Abschnitt 5.2), niemals einen
   Nährwert. Nährwerte kommen ausschließlich aus BLS/OFF/USDA/Rezeptzusammensetzung, berechnet
   deterministisch (Abschnitt 5.5).

**Verbindliche Umformulierung für zukünftige Referenzen:** „Deterministic-first" bedeutet ab
sofort _„validierter Fast-Path und Nährwertberechnung sind immer deterministisch; KI-Nutzung
ist für unbekannte Eingaben as Interpretations-/Suchplanungsschritt zulässig, sofern
quellenbasiert, typisiert, nachvollziehbar, rate-limitiert und niemals autoritativ über
Nährwerte."_ Dieses Dokument ist die verbindliche Quelle für diese Umformulierung; `ROADMAP.md`
verweist in seinem Decisions Log künftig hierher, statt die alte Kurzformel unkommentiert
stehen zu lassen (siehe Abschnitt 9 für die konkrete `ROADMAP.md`-Änderung).

---

## 5. Zielarchitektur — geprüft gegen vorhandenen Code, nicht blind übernommen

Die im Auftrag vorgeschlagene siebenstufige Pipeline wurde gegen den tatsächlichen Code
abgeglichen. Für jede Stufe: was existiert bereits, was fehlt konkret.

### 5.1 Validierter Fast Path

**Existiert bereits:** User-Alias-Quelle (`SupabaseUserAliasSource`), Saved Meals (SM-Epic,
mehrere Tasks `done`), BLS-DACH-Wahrheit-Fast-Path, Negative Cache
(`NegativeCacheHelper`). **Fehlt konkret:** ein Lesepfad, der `food_resolver_runs`/
`food_query_cache_results` (bereits live, RESOLVER-V2-005) für Wiederverwendung _fremder_
bereits validierter Query→Food-Zuordnungen konsultiert, nicht nur eigene Alias-Treffer. Das
ist die konkrete Lücke, kein Neubau des gesamten Fast-Path-Konzepts.

### 5.2 AI Interpretation und Search Planning (neu)

**Fehlt vollständig als eigenständige Fähigkeit**, hat aber einen direkten Präzedenzfall im
`FakeAiMealParser`/`AiRerankingProvider`-Portmuster. Verbindlich: typisiertes Ausgabeobjekt
(kein freier Text), enthält mindestens erkannte Einzel-Lebensmittel + Mengen + Einheiten,
Marken-/Zubereitungserkennung, explizite Unsicherheiten/fehlende Informationen, vorgeschlagene
Quellentypen und source-native Suchanfragen. Provider-neutral wie `AiRerankingProvider` — kein
Modellname in Domain/Application (AGENTS.md „Prohibited": „No model names or provider names in
domain or application layer code").

### 5.3 Source-grounded Retrieval

**Existiert bereits vollständig als wiederverwendbare Infrastruktur:** `BlsStaticSource`,
`SupabaseEdgeOffSource`, `SupabaseEdgeUsdaSource`, source-native Query-Adaption
(`getSourceQuery()`). Neu ist nur, dass die AI-Interpretationsstufe (5.2) zusätzliche,
gezielte Suchanfragen an dieselben, bestehenden Quellen liefern kann — keine neuen
Quellenadapter, kein Ersatz der bestehenden.

### 5.4 Evidenzbasierte Kandidatenentscheidung

**Existiert bereits als `ScoreCalculator`/`ResolverDecisionPolicy`.** Muss um die im Auftrag
genannten zusätzlichen Dimensionen erweitert werden, die heute nicht abgedeckt sind: explizite
Widerspruchsbehandlung zwischen Quellen, Einbezug bekannter Nutzerhistorie. Kein „No-Average
Rule"-Verstoß (bereits `SSOK.md` §6 Prinzip, bleibt bindend).

### 5.5 Deterministische Nährwertberechnung

**Unverändert bindend, bereits Realität:** `nutritionSnapshot`/`foodCatalogRef` (J-002),
Portionsskalierung und Summenbildung laufen bereits vollständig deterministisch außerhalb
jeder KI-Komponente. Dieses Dokument ändert daran nichts — es bekräftigt es als Grenze für die
neuen Resolver-V3-Tasks.

### 5.6 Unsicherheit und Recovery

**Existiert bereits ein direktes Vorbild:** `ResolverDecision.status`
(`accepted`/`ambiguous`/`rejected`) plus die produktive Speck-Klärungs-UI
(RESOLVER-V2-010). Neue Resolver-V3-Arbeit soll dieses Muster **generalisieren** (gezielte
kleinste Rückfrage), nicht neu erfinden. Wichtiger bereits dokumentierter Architektur-Gap
(RESOLVER-V2-010-Planung): `LogFoodFromRawInputUseCase` liest `decision.status` heute nicht,
gatet nur auf `score >= 0.7` — ein bestehendes „totes Signal", das für die generalisierte
Unsicherheitsbehandlung geschlossen werden muss.

### 5.7 Persistenter Knowledge Layer

**Tabellen existieren bereits live** (RESOLVER-V2-005-Discovery). Fehlt: `corrections`-Tabelle,
Lesepfad für Wiederverwendung (5.1), und — **explizit nicht Teil dieses Dokuments, eigene
spätere Task** — eine Datenschutz-Grenzziehung zwischen (a) privaten Journal-/Verhaltensdaten,
(b) persönlichem Wiederverwendungs-Cache, (c) potenziell global nutzbarem, anonymisiertem
Resolver-Wissen. Dieses Dokument **entscheidet diese Grenzziehung nicht** — es verbietet
lediglich (Abschnitt 7 Nicht-Ziele), dass rohe persönliche Daten ohne diese Entscheidung
automatisch global werden.

---

## 6. Was bleibt / was ändert sich / was wird ersetzt / was hängt vom Benchmark ab

| Bestehende Entscheidung (aus Auftrag)                       | Status                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Erfassung und Bewertung bleiben getrennt                 | **Bleibt.** Bereits Product-Bible-Architekturprinzip (Food Catalog / Journal / Evaluation Engine), von dieser Arbeit nicht berührt.                                                                                                                                              |
| 2. BLS bleibt zentrale DACH-Quelle                          | **Bleibt, wird gestärkt.** BLS-Fast-Path unverändert; RESOLVER-V2-008/009/010 zeigen aktive Investition, kein Abbau.                                                                                                                                                             |
| 3. Nährwertberechnungen bleiben deterministisch             | **Bleibt, unangetastet.** Abschnitt 5.5.                                                                                                                                                                                                                                         |
| 4. Provenienz, Confidence, Editierbarkeit bleiben erhalten  | **Bleibt, wird erweitert.** J-002/J-003 bereits vorhanden; Erweiterung um Resolver-Cache-Provenienz ist neue Arbeit (5.7), keine Abkehr.                                                                                                                                         |
| 5. Provider-Neutralität bleibt erhalten                     | **Bleibt, unverändert bindend.** `AiRerankingProvider`-Muster ist der Bauplan für den neuen Interpretationscontract.                                                                                                                                                             |
| 6. Nutzerkorrekturen müssen künftige Auflösungen verbessern | **Bleibt Ziel, aktuell nicht vollständig erfüllt.** Correction Log existiert (J-003), aber kein Rückkanal in den Knowledge Layer — konkrete neue Aufgabe (RESOLVER-V3-009).                                                                                                      |
| 7. Wiederholte identische Eingaben sollen konsistent sein   | **Bleibt Ziel, aktuell nicht vollständig erfüllt.** Kein Reuse-Lesepfad heute (5.1) — konkrete neue Aufgabe (RESOLVER-V3-008). Amy-Nutzerbericht (2.1) zeigt, dass dieses Problem beim Wettbewerber ungelöst ist — kein Grund zur Entwarnung, sondern Bestätigung der Priorität. |
| 8. Zera behält Nährstofftiefe/Evaluationsfähigkeit          | **Bleibt, unangetastet.** Product-Bible-Prinzip; Amys bewusste Beschränkung auf Kalorien+wenige Makros wird explizit **nicht** übernommen.                                                                                                                                       |
| 9. Nutzerfriktion bleibt zentrale Metrik                    | **Bleibt.** `SSOK.md` Product Principles unverändert gültig.                                                                                                                                                                                                                     |

### Bestehende RESOLVER-V2-Tasks — Disposition (nicht ungültig, sondern eingeordnet)

| Task                    | Status                                                 | Disposition                                                                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RESOLVER-V2-001..004    | `done`                                                 | **Weiterhin gültig, wird direkt wiederverwendet.** Source-native Queries, Multi-Source-Retrieval, Fusion Layer sind die Grundlage von Abschnitt 5.3/5.4, kein Ersatz nötig.                                                                                              |
| RESOLVER-V2-005         | `todo` (Schema-Drift dokumentiert)                     | **Bleibt gültig, wird erweitert.** Fehlende `corrections`-Tabelle + Lesepfad sind jetzt explizit RESOLVER-V3-008/009.                                                                                                                                                    |
| RESOLVER-V2-006         | `todo` (Schreibpfad `done`, Korrektur-Rückkanal offen) | **Bleibt gültig, wird erweitert.** Rückkanal ist RESOLVER-V3-009.                                                                                                                                                                                                        |
| RESOLVER-V2-007-A       | `done`                                                 | **Bleibt gültig, unverändert.** Eigenständiger KI-Kontaktpunkt (Reranking), koexistiert mit dem neuen Interpretationscontract (Abschnitt 4 Punkt 3).                                                                                                                     |
| RESOLVER-V2-007-B/C     | `todo`                                                 | **Bleibt gültig, abhängig vom Benchmark.** Provider-Wahl für Reranking ist eine andere Entscheidung als Provider-Wahl für Interpretation/Suchplanung — beide sollten denselben Benchmark-Prozess (Abschnitt 7) durchlaufen, müssen aber nicht denselben Provider wählen. |
| RESOLVER-V2-008/009/010 | `done`                                                 | **Abgeschlossen, bereits durch aktuelle Implementierung erledigt.** Keine Änderung nötig; RESOLVER-V2-010s Klärungs-UI ist Vorbild für 5.6.                                                                                                                              |

---

## 7. Benchmark-first — verbindlich vor jedem produktiven Umbau

Kein großflächiger Ersatz des produktiven Resolvers, bevor ein reproduzierbarer Vergleich aus
mindestens drei Varianten vorliegt:

- **A — Aktueller Zera-Resolver:** die tatsächlich gemergte `SequentialFoodCatalogResolver`-
  Implementierung, unverändert.
- **B — Direkte KI-Schätzung:** bewusst einfache KI-only-Referenz (Kontrollgruppe, **nicht**
  automatisch Zielsystem) — die Amy-artige Variante, absichtlich als Vergleichspunkt gebaut,
  nicht als Ziel.
- **C — AI-first, source-grounded Hybrid:** Abschnitt 5 vollständig (Interpretation/Planung →
  bestehende Quellenadapter → evidenzbasierte Entscheidung → deterministische Berechnung →
  persistente Wiederverwendung).

**Corpus:** eigener, DACH-spezifischer Korpus — orientiert an Amys Kategorien (2.1) als
**Inspiration für Kategorien**, nicht als Ground Truth (Abschnitt 2.3 Einschränkung gilt
verbindlich). Mindestens: generische Lebensmittel, Stück-/Haushaltsmaße, Markenprodukte,
Grammangaben, mehrteilige Mahlzeiten, selbstgekochte Gerichte, regionale DACH-Speisen
(explizit inkl. eines „Zwiebelrostbraten"-artigen Falls, siehe 2.1), Restaurantgerichte, vage
Eingaben, widersprüchliche/unvollständige Eingaben, Wiederholungen, schwierige Mengen-/
Zubereitungsfälle.

**Ground Truth:** je nach Fall BLS, Herstelleretikett, offizielle Restaurantangabe,
dokumentiertes Rezept, kuratierte Zutaten/Mengen, oder explizit als Schätzbereich
gekennzeichnete Referenz — niemals Amys eigener Report.

**Metriken:** Lebensmittelidentifikation, Mehrteil-Zerlegung, Mengen-/Einheitengenauigkeit,
Energie-/Makrofehler, weitere Nährstoffe soweit verfügbar, regionale Trefferqualität,
Nutzerkorrekturbedarf, Abstentions-/Rückfragenquote, falsche sichere Entscheidungen,
Wiederholungskonsistenz, p50/p95-Latenz, Kosten pro neuem Log, Kosten pro validiertem Log,
Cache-Hit-Rate, Provenienz-Vollständigkeit, Verhalten bei Quellenausfällen.

**Wiederverwendbare Infrastruktur:** `scripts/benchmark-ai-reranking-providers.mjs` +
`scripts/lib/ai-reranking-benchmark-{scoring,fixtures,providers}.mjs` (RESOLVER-V2-007-B) ist
ein bereits existierendes, strukturell passendes Vorbild für den neuen Harness (reines
`fetch()`, keine neue Dependency, env-var-basierte Modellauswahl, `node:test` für reine
Scoring-Logik) — kein Neubau der Grundstruktur, sondern Wiederverwendung des Musters für einen
neuen, breiteren Zweck.

---

## 8. Nicht-Ziele dieses Dokuments

- Kein Amy-Klon; Amys Beschränkung auf Kalorien+wenige Makros wird nicht übernommen.
- Keine voreilige Provider-Auswahl (Perplexity oder sonst). Perplexitys Nutzung durch Amy ist
  Produktevidenz für die Marktrealität „source-grounded LLM-Suche funktioniert produktiv", keine
  Zera-Providerentscheidung.
- Keine unkontrollierte LLM-Ausgabe als Nährwertwahrheit — Abschnitt 4 Punkt 4 bindend.
- Kein Entfernen der BLS-Integration.
- Keine vollständige Resolver-Neuentwicklung in einem PR.
- Keine Datenbankmigration ohne eigenen autorisierten Task.
- Keine neue Dependency ohne ausdrückliche Notwendigkeit und Governance-Freigabe.
- Keine Vermischung von Logging und Evaluation (Product-Bible-Prinzip bleibt bindend).
- Keine Behauptung, Amys Benchmark sei unabhängig (siehe 2.3/2.4).
- Keine globale Speicherung persönlicher Rohdaten ohne eigenes, spezifisches
  Datenschutzkonzept (5.7 — bewusst offen gelassen, nicht heimlich entschieden).

---

## 8.1 Präzisierung des persistenten Lernens

Die Idee des persistenten Lernens aus validierten Ergebnissen wird verbindlich durch [`ZERA_RESOLUTION_KNOWLEDGE_GROWTH_DECISION_RECORD_1.md`](ZERA_RESOLUTION_KNOWLEDGE_GROWTH_DECISION_RECORD_1.md) präzisiert. Der neue Record erweitert diese Entscheidung; er schreibt weder die source-grounded Nährwertwahrheit noch deterministische Berechnung oder das Benchmark-/Production-Wiring-Gate um.

## 9. Folgeänderungen an `ROADMAP.md`

Dieses Dokument wird durch einen Verweis im `ROADMAP.md`-Decisions-Log verbindlich verankert
(neuer Eintrag, bestehende Einträge bleiben unverändert stehen) und durch eine neue Epic
"Resolver V3 – AI-First Interpretation & Source-Grounded Retrieval (Benchmark-Gated)"
umgesetzt. Die neuen Tasks (RESOLVER-V3-001 ff.) sind bewusst benchmark-gated: keiner davon
ersetzt den produktiven Resolver, bevor Abschnitt 7 abgeschlossen ist.
