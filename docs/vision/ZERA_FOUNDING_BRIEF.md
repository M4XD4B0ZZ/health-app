# Zera — Founding Brief

Status: `draft` — zur Freigabe vor weiterer Tier-1-Zerlegung
Ebene: Strategische Vision (steht über `ROADMAP.md`, nicht darunter)
Zugehöriges Dokument: [`ZERA_PRODUCT_BIBLE.md`](./ZERA_PRODUCT_BIBLE.md) (Architektur- und Modell-Ebene)

> Namenskonvention: Das Produkt heißt ab sofort **Zera**. Repo-Name (`health-app`) und
> `package.json`-Name (`health-dashboard`) bleiben aus historischen Gründen vorerst
> unverändert ("HealthApp" war ein Arbeitsname, bevor es einen Produktnamen gab).
> Die vollständige Umbenennung von Repo/Package/Code ist ein separater, bewusst
> vertagter Task und **nicht** Teil dieses Dokuments.

---

## 1. Warum dieses Dokument existiert

Bevor die vier verbleibenden Tier-1-Platzhalter (Journal, Saved Meals, Dashboard, Goals)
in konkrete, umsetzbare Aufgaben zerlegt werden, muss eine grundlegendere Frage geklärt
sein: **Wofür ist Zera eigentlich da, und welche Struktur folgt daraus?**

Der gleiche Fehler, den wir bei der Vision App Factory gemacht und korrigiert haben, drohte
sich hier zu wiederholen: zuerst die Plattform/Features im Detail spezifizieren, obwohl die
eigentliche Vision noch gar nicht sauber formuliert war. Dieses Dokument holt das nach —
**vor** der weiteren Implementierungsplanung, nicht parallel dazu.

Dieses Dokument definiert **keine** Implementierung, keine Tasks und keine Code-Architektur.
Es beantwortet ausschließlich die Frage nach Produktvision, Zielgruppen und der
grundsätzlichen Verantwortungsteilung zwischen Datenerfassung und Bewertung. Die
technische/produktseitige Ausarbeitung der Bewertungsmodelle folgt in der
[Product Bible](./ZERA_PRODUCT_BIBLE.md). Die Zerlegung von Journal/Saved Meals/Dashboard/
Goals in `ROADMAP.md`-Tasks folgt **erst nach** Freigabe beider Dokumente.

---

## 2. Von der Kernfunktion zur Vision

Die ursprüngliche Leitidee war:

> "Eine App, in der man Lebensmittel per natürlicher Sprache erfassen kann."

Das war lange Zeit gleichzeitig Vision _und_ Differenzierungsmerkmal, weil reibungsarme,
natürlichsprachliche Erfassung selten gut gelöst ist. Der bisherige Fortschritt (P1-001 bis
P1-005, DACH-first Resolver, Portion Knowledge) hat dieses Versprechen technisch eingelöst.

Genau dadurch wird sichtbar: **Natural-Language-Logging ist eine Kernfunktion, keine
Vision.** Eine Kernfunktion beantwortet "Wie erfasst man Daten reibungsarm?". Eine Vision
beantwortet "Warum sollte jemand langfristig bei Zera bleiben, und wofür?" — und darauf gibt
"man kann Essen per Text eingeben" keine Antwort mehr, sobald das Problem gelöst ist.

---

## 3. Vision Statement

> **Zera hilft Menschen mit völlig unterschiedlichen Ernährungszielen, ihre Ernährung zu
> verstehen und zu verbessern — ohne den Aufwand klassischer Tracking-Apps.**

Daraus folgt eine klare Rollenteilung im Produkt:

- **Logging ist der Einstieg** — die Hürde, die gesenkt werden muss, damit Menschen
  überhaupt anfangen und dranbleiben.
- **Personalisierte Bewertung ist die eigentliche Bindung** — der Grund, warum jemand nach
  Woche 2 noch da ist, obwohl das Erfassen selbst irgendwann Routine wird.

Klassische Tracking-Apps optimieren fast ausschließlich für Ersteres (Erfassung) und
behandeln Bewertung als Nebenprodukt (eine feste Kalorienbilanz, ein starres
Makro-Ziel). Zera dreht dieses Verhältnis absichtlich um: Erfassung ist neutrale
Infrastruktur, Bewertung ist das eigentliche Produkt.

---

## 4. Warum klassisches Tracking an dieser Stelle scheitert

- **One-size-fits-all-Bewertung:** Ein Kaloriendefizit-Dashboard ist für jemanden im
  Muskelaufbau irreführend, ein Muskelaufbau-Dashboard für jemanden mit
  Cholesterin-Fokus irrelevant. Die meisten Apps bilden genau ein implizites Zielmodell ab
  (meist Gewichtsverlust) und zwingen alle Nutzer:innen hinein.
- **Bewertung ist fest im Journal verdrahtet:** Ändert sich das Ziel einer Person (z. B. von
  Abnehmen zu Muskelaufbau, oder von allgemeiner Gesundheit zu einem ärztlich empfohlenen
  Cholesterin-Fokus), verlangen die meisten Apps faktisch einen Neuanfang der Bewertungslogik
  — die historischen Daten bleiben, aber ihre Interpretation nicht.
  Reibung entsteht nicht bei der ersten Eingabe, sondern beim Verstehen der eigenen Daten
  und bei der Anpassung an ein neues Ziel.
- **Kein Raum für Spezialisierung:** Medizinisch motivierte Ziele (Cholesterin, perspektivisch
  z. B. Blutzucker) oder kulturell/ernährungsphilosophisch geprägte Ziele (Mediterran,
  Low Carb) passen nicht in ein einziges generisches Makro-Dashboard.

---

## 5. Kernprinzip: Trennung von Datenerfassung und Bewertung

Zera trennt strikt zwischen zwei Verantwortungsbereichen:

| Bereich                           | Frage, die er beantwortet                           | Charakter                                          |
| --------------------------------- | --------------------------------------------------- | -------------------------------------------------- |
| **Journal (Food Logging)**        | "Was wurde tatsächlich gegessen, wann, wie viel?"   | Neutral, faktenbasiert, modellunabhängig           |
| **Evaluation Engine (Bewertung)** | "Was bedeutet das für _dieses_ Ziel dieser Person?" | Austauschbar, zielgruppenabhängig, interpretierend |

Das Journal ist die **Wahrheitsquelle über Fakten**. Die Evaluation Engine ist die
**austauschbare Interpretationsschicht** darüber. Beide arbeiten auf denselben
Journaldaten — ein Wechsel des Bewertungsmodells erzeugt keine neue Datenerfassung,
sondern nur eine neue Sicht auf bereits vorhandene, unveränderte Fakten.

Diese Trennung ist der eigentliche Kern dieses Founding Briefs. Alles Weitere (Zielgruppen,
Modell-Kandidaten, Datenverantwortung) leitet sich aus ihr ab.

---

## 6. Zielgruppen

Zera adressiert nicht eine Zielgruppe mit einem Ziel, sondern mehrere Zielgruppen mit
unterschiedlichen, teils widersprüchlichen Zielen — verbunden durch dasselbe
reibungsarme Logging-Fundament:

1. **Gewichtsreduktion** — klassisches Kaloriendefizit-Ziel, Fokus auf Sättigung und
   Proteinerhalt.
2. **Muskelaufbau / Leistung** — Kalorienüberschuss, Proteinverteilung über den Tag,
   Trainingsbezug.
3. **Allgemeine Gesundheit ohne konkretes Körperziel** — will verstehen, ob die eigene
   Ernährung "gut" ist, ohne Diät-Ziel im engeren Sinn (Evidence-based Standard).
4. **Ernährungsphilosophie/-stil** — z. B. Low Carb oder Mediterran, wo nicht primär
   Kalorien, sondern Zusammensetzung und Lebensmittelqualität zählen.
5. **Medizinisch/ärztlich motivierte Nutzer:innen** — z. B. Cholesterin-Fokus auf Anraten
   einer Ärztin. Höhere Ansprüche an Nachvollziehbarkeit und Datenqualität, aber explizit
   **kein** Ersatz für medizinische Beratung (siehe Offene Fragen in der Product Bible).
6. **Selbstbestimmte Nutzer:innen mit eigenen Zielwerten** — wollen kein vorgefertigtes
   Modell, sondern eigene Makro-/Nährstoff-Zielkorridore definieren.

Diese Liste ist nicht abschließend und wird in der Product Bible in konkrete
Bewertungsmodell-Kandidaten übersetzt. Wichtig ist an dieser Stelle nur: Es handelt sich um
**mehrere gleichrangige Zielgruppen**, nicht um eine Hauptzielgruppe mit Sonderfällen.

---

## 7. Verantwortung des Journals

Das Journal ist dafür zuständig:

- Lebensmittel reibungsarm, natürlichsprachlich erfassbar zu machen (bestehende
  Input-Philosophie aus `README.md` bleibt unverändert gültig).
- Fakten dauerhaft und modellunabhängig zu speichern (was, wann, wie viel, in welcher
  Portion/Einheit, aus welcher Quelle aufgelöst).
- Korrekturen und Nachbearbeitung zu ermöglichen, ohne dass ein Bewertungsmodell involviert
  sein muss.

Das Journal ist **explizit nicht** dafür zuständig, zu bewerten, ob eine Mahlzeit "gut" oder
"schlecht" für ein bestimmtes Ziel war. Diese Neutralität ist Bedingung dafür, dass mehrere
Bewertungsmodelle auf denselben Daten arbeiten können, ohne dass das Journal für jedes neue
Modell angepasst werden muss.

---

## 8. Verantwortung der Evaluation Engine

Die Evaluation Engine ist dafür zuständig:

- Journaldaten im Kontext eines aktiven Bewertungsmodells zu interpretieren.
- Zielfortschritt, Insights, Warnungen/Hinweise und (perspektivisch) Coaching-Impulse aus
  denselben Journaldaten abzuleiten.
- Modelle austauschbar zu machen, ohne dass historische Journaldaten verändert oder erneut
  erfasst werden müssen.

Details zu Modellen, Datenverantwortung und Erweiterbarkeit sind bewusst **nicht** Teil
dieses Dokuments — siehe [Product Bible](./ZERA_PRODUCT_BIBLE.md).

---

## 9. Warum das eine stärkere Produktvision ist

- **Bindung entsteht durch Personalisierung, nicht durch Zwang zur Erfassungsdisziplin.**
  Klassische Tracking-Apps verlieren Nutzer:innen, wenn Logging zur Last wird. Zera macht
  Logging leicht _und_ liefert danach einen individuellen Grund weiterzumachen.
- **Zielwechsel ohne Datenverlust.** Ändert sich das Ziel einer Person, ändert sich nur das
  aktive Modell — nicht die Notwendigkeit, neu zu beginnen.
- **Erweiterbarkeit als Produktstrategie, nicht nur als Architekturdetail.** Neue
  Zielgruppen lassen sich langfristig durch neue Bewertungsmodelle erschließen, ohne den
  Logging-Kern (das eigentliche technische Alleinstellungsmerkmal) anzufassen.
- **Basis für spätere Erweiterungen** (Dashboard, Insights, Reports, AI Coach) wird vom
  aktiven Bewertungsmodell bestimmt statt hart codiert — das eröffnet perspektivisch auch
  Optionen wie B2B/Coaching-Kontexte, ohne dass das hier bereits festgelegt wird.

---

## 10. Was sich dadurch nicht ändert

- Die bestehende Input-Philosophie (`README.md`: natürliche Sprache zuerst, Reibung
  minimieren, Näherung am Eingabepunkt akzeptabel, Korrektur danach möglich) bleibt
  unverändert gültig — sie betrifft ausschließlich das Journal.
- Das Prinzip "deterministische Logik wird nicht durch KI-Logik ersetzt" (`SSOK.md`) gilt
  unverändert für den Resolver/Journal-Kern. KI ist gemäß bestehendem Resolver-V2-Konzept
  weiterhin nur für eng begrenzte, nachvollziehbare Aufgaben vorgesehen (z. B. Re-Ranking
  unsicherer Kandidaten) — nicht für Makroberechnung oder stille Entscheidungen.
- Bereits abgeschlossene Tier-1-Resolver-Arbeit (P1-001 bis P1-005) bleibt vollständig
  gültig — sie gehört zur Journal-Schicht und wird durch dieses Konzept nicht berührt.

---

## 11. Verhältnis zu ROADMAP.md

`ROADMAP.md` bleibt die einzige verbindliche Aufgaben- und Prioritätenquelle (SSOK-Regel,
unverändert). Dieses Dokument und die Product Bible stehen **über** der Tier-1-Zerlegung,
nicht daneben oder darunter: Die vier Platzhalter-Module (Journal, Saved Meals, Dashboard,
Goals) werden erst dann in konkrete `ROADMAP.md`-Tasks zerlegt, wenn dieses Konzept
freigegeben ist. Bis dahin bleibt ihr Status in `ROADMAP.md` als `blocked` (abhängig von
dieser Konzeptfreigabe) markiert, nicht als `todo`.

---

## 12. Nicht-Ziele dieses Dokuments

- Keine Implementierung, keine Code-Architektur, keine Datenbank-/API-Schnittstellen.
- Keine Festlegung konkreter `ROADMAP.md`-Task-IDs für Journal/Saved Meals/Dashboard/Goals.
- Keine abschließende Liste aller jemals unterstützten Bewertungsmodelle — die Product Bible
  beschreibt einen initialen, bewusst kleinen Modell-Kandidatensatz.
- Keine Entscheidung über Monetarisierung/Freemium-Grenzen zwischen Modellen.
- Keine Aussage zur vollständigen Umbenennung von Repo/Package zu "Zera" (separater Task).
