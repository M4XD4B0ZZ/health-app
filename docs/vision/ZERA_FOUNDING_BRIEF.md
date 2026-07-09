# Zera — Founding Brief

Status: `accepted` — fachliche Autorität für Zera (freigegeben nach Concept Review R1/R2/R3)
Ebene: Strategische Vision (steht über `ROADMAP.md`, nicht darunter)
Zugehöriges Dokument: [`ZERA_PRODUCT_BIBLE.md`](./ZERA_PRODUCT_BIBLE.md) (Architektur- und Profil-Ebene)

> **Freigabe:** Dieses Dokument ist ab sofort fachliche Autorität für Zera — alle künftigen
> Produktentscheidungen werden an ihm gemessen. `accepted` bedeutet **nicht** `final`:
> Produktvisionen entwickeln sich weiter. Änderungen erfordern künftig einen bewussten
> Review-/Revisionsprozess (wie R1/R2/R3), keine stillen Edits.

> Revision R1: Nach [`ZERA_CONCEPT_REVIEW_R1.md`](./ZERA_CONCEPT_REVIEW_R1.md) überarbeitet
> — Terminologie "Evaluation Model" → "Evaluation Profile" (Profile sind konfigurierbare
> Bündel aus Regeln, keine festen Algorithmus-Klassen) und Zielgruppen von Ernährungsform
> auf Nutzer-Motivation umgestellt.
>
> Revision R2/R3: Nach [`ZERA_CONCEPT_REVIEW_R2.md`](./ZERA_CONCEPT_REVIEW_R2.md) überarbeitet
> — Food Catalog als dritte, vorgelagerte Schicht (Food Catalog → Journal → Evaluation
> Engine) ergänzt, Prinzip 0 ("kein Profile verändert jemals Fakten") eingeführt, sowie ein
> Hinweis, dass "Evaluation Profile" reine Architektursprache ist. Details zur vollständigen
> Profil-/Regel-/Origin-Architektur: siehe Product Bible.

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
technische/produktseitige Ausarbeitung der Evaluation Profiles folgt in der
[Product Bible](./ZERA_PRODUCT_BIBLE.md). Mit der Freigabe beider Dokumente (siehe
Abschnitt 11) beginnt die Zerlegung von Journal, Saved Meals, Goals und Dashboard in
konkrete `ROADMAP.md`-Tasks — als eigene Domänen-Phasen, nicht mehr als vier gleichrangige
Platzhalter.

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

> **Prinzip 0 (oberstes Architekturprinzip, Review R2/R3):** Kein Evaluation Profile darf
> jemals Fakten verändern. Es interpretiert ausschließlich objektive Daten aus Food Catalog
> und Journal. 100 g Haferflocken bleiben immer 100 g Haferflocken — unabhängig davon,
> welches Ziel gerade aktiv ist. Nur die Interpretation dieser 100 g ändert sich.

Aus Prinzip 0 folgt eine Struktur mit **drei**, nicht zwei Verantwortungsbereichen:

| Bereich                           | Frage, die er beantwortet                           | Charakter                                          |
| --------------------------------- | --------------------------------------------------- | -------------------------------------------------- |
| **Food Catalog**                  | "Was ist dieses Lebensmittel objektiv?"             | Neutral, benutzerunabhängig, dauerhaft             |
| **Journal (Food Logging)**        | "Was wurde tatsächlich gegessen, wann, wie viel?"   | Neutral, faktenbasiert, profilunabhängig           |
| **Evaluation Engine (Bewertung)** | "Was bedeutet das für _dieses_ Ziel dieser Person?" | Austauschbar, zielgruppenabhängig, interpretierend |

Der Food Catalog kennt keinen Benutzer und keinen Zeitpunkt — er enthält nur objektive
Lebensmitteleigenschaften (Makros, Lebensmittelgruppen usw.). Das Journal baut auf dem Food
Catalog auf (wer hat wann wie viel wovon gegessen) und ist die **Wahrheitsquelle über
Fakten**. Die Evaluation Engine ist die **austauschbare Interpretationsschicht** darüber.
Alle drei arbeiten auf denselben, unveränderten Fakten — ein Wechsel des aktiven Evaluation
Profiles erzeugt keine neue Datenerfassung, sondern nur eine neue Sicht auf bereits
vorhandene Fakten (Details und Begründung: Product Bible, Abschnitt 2a).

Diese Trennung ist der eigentliche Kern dieses Founding Briefs. Alles Weitere (Zielgruppen,
Profil-Kandidaten, Datenverantwortung) leitet sich aus ihr ab.

**Hinweis zur Sprache (Review R2/R3):** "Evaluation Profile" ist reine Architektursprache.
In der Produktoberfläche sprechen wir nie von einem "Profil", das Nutzer:innen auswählen
müssten, sondern von einem **Ziel**, **Ernährungsziel** oder **Fokus** (siehe Product Bible,
Abschnitt 4b, für die vollständige Begriffszuordnung).

---

## 6. Zielgruppen

Zera adressiert nicht eine Zielgruppe mit einem Ziel, sondern mehrere Motivationen, die
teils gleichzeitig bestehen — verbunden durch dasselbe reibungsarme Logging-Fundament. Die
Zielgruppen sind bewusst aus der **Nutzer-Motivation** heraus formuliert, nicht aus der
Ernährungsform: Eine Ernährungsform-Formulierung ("Low-Carb-Zielgruppe") verschleiert, dass
dieselbe Motivation oft mehrere Evaluation Profiles gleichzeitig berührt (z. B. berührt "ich
möchte meine Blutwerte verbessern" sowohl einen Cholesterin- als auch einen
Low-Carb-orientierten Regelbedarf — siehe Product Bible, Abschnitt 5):

1. **"Ich möchte mich gesünder ernähren"** — kein konkretes Körper- oder Diätziel, Wunsch
   nach Orientierung anhand anerkannter Referenzwerte.
2. **"Ich möchte Gewicht verlieren"** — Kaloriendefizit, Fokus auf Sättigung und
   Proteinerhalt.
3. **"Ich möchte Muskeln aufbauen"** — Kalorienüberschuss, Proteinverteilung über den Tag,
   Trainingsbezug.
4. **"Ich möchte meine Blutwerte verbessern"** — medizinisch/ärztlich motiviert (z. B.
   Cholesterin auf Anraten einer Ärztin). Höhere Ansprüche an Nachvollziehbarkeit und
   Datenqualität, aber explizit **kein** Ersatz für medizinische Beratung (siehe Offene
   Fragen in der Product Bible).
5. **"Ich folge einer bestimmten Ernährungsweise"** — z. B. Low Carb oder Mediterran, wo
   nicht primär Kalorien, sondern Zusammensetzung und Lebensmittelqualität zählen.
6. **"Ich habe meine eigenen Ziele"** — will kein vorgefertigtes Profil, sondern eigene
   Prioritäten (z. B. Protein hoch, Zucker niedrig, Kalorien egal) frei kombinieren.

Diese Liste ist nicht abschließend. Sie beschreibt Motivationen, keine Evaluation Profiles —
mehrere Motivationen können auf dasselbe Profile zulaufen, und eine Motivation kann mehrere
Profile gleichzeitig berühren. Die konkrete Zuordnung Motivation ↔ Evaluation Profile ist
Teil der Product Bible (Abschnitt 5). Wichtig ist an dieser Stelle nur: Es handelt sich um
**mehrere gleichrangige Motivationen**, nicht um eine Hauptzielgruppe mit Sonderfällen.

---

## 7. Verantwortung des Journals

Das Journal ist dafür zuständig:

- Lebensmittel reibungsarm, natürlichsprachlich erfassbar zu machen (bestehende
  Input-Philosophie aus `README.md` bleibt unverändert gültig).
- Fakten dauerhaft und profilunabhängig zu speichern: wer, wann, wie viel — als Referenz
  auf einen Food-Catalog-Eintrag, nicht als eigene Kopie von dessen Eigenschaften.
- Korrekturen und Nachbearbeitung zu ermöglichen, ohne dass ein Evaluation Profile
  involviert sein muss.

Die objektiven Lebensmitteleigenschaften selbst (Makros, Lebensmittelgruppen, Herkunft
usw.) gehören zum **Food Catalog**, einer eigenen, dem Journal vorgelagerten Schicht — das
Journal referenziert sie, führt sie aber nicht selbst (Details: Product Bible, Abschnitt 3).

Das Journal ist **explizit nicht** dafür zuständig, zu bewerten, ob eine Mahlzeit "gut" oder
"schlecht" für ein bestimmtes Ziel war. Diese Neutralität ist Bedingung dafür, dass mehrere
Evaluation Profiles auf denselben Daten arbeiten können, ohne dass das Journal für jedes
neue Profil angepasst werden muss.

---

## 8. Verantwortung der Evaluation Engine

Die Evaluation Engine ist dafür zuständig:

- Journaldaten im Kontext eines aktiven Evaluation Profiles zu interpretieren.
- Zielfortschritt, Insights, Warnungen/Hinweise und (perspektivisch) Coaching-Impulse aus
  denselben Journaldaten abzuleiten.
- Profile austauschbar zu machen, ohne dass historische Journaldaten verändert oder erneut
  erfasst werden müssen.

Details zu Evaluation Profiles, den zugrunde liegenden Regeln, Datenverantwortung und
Erweiterbarkeit sind bewusst **nicht** Teil dieses Dokuments — siehe
[Product Bible](./ZERA_PRODUCT_BIBLE.md).

---

## 9. Warum das eine stärkere Produktvision ist

- **Bindung entsteht durch Personalisierung, nicht durch Zwang zur Erfassungsdisziplin.**
  Klassische Tracking-Apps verlieren Nutzer:innen, wenn Logging zur Last wird. Zera macht
  Logging leicht _und_ liefert danach einen individuellen Grund weiterzumachen.
- **Zielwechsel ohne Datenverlust.** Ändert sich das Ziel einer Person, ändert sich nur das
  aktive Evaluation Profile — nicht die Notwendigkeit, neu zu beginnen. Auch bereits
  vergangene Tage werden dabei automatisch neu bewertet, nicht nur zukünftige Einträge —
  eine bewusste Entscheidung (Product Bible, Abschnitt 2a), die z. B. die Frage "Wie hätte
  mein letzter Monat unter einem anderen Ziel ausgesehen?" beantwortbar macht.
- **Erweiterbarkeit als Produktstrategie, nicht nur als Architekturdetail.** Neue
  Motivationen lassen sich langfristig durch neue oder kombinierte Evaluation Profiles
  erschließen, ohne den Logging-Kern (das eigentliche technische Alleinstellungsmerkmal)
  anzufassen.
- **Basis für spätere Erweiterungen** (Dashboard, Insights, Reports, AI Coach) wird vom
  aktiven Evaluation Profile bestimmt statt hart codiert — das eröffnet perspektivisch auch
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
unverändert). Dieses Dokument und die Product Bible stehen **über** der weiteren
Domänen-Zerlegung, nicht daneben oder darunter — mit ihrer Freigabe (Status `accepted`)
gilt die bisherige "Tier 1 Planning Targets"-Platzhalterliste als abgelöst durch die
Phasenstruktur `Nutrition Evaluation Foundation → Journal Domain → Saved Meals Domain →
Goals & Evaluation → Dashboard & Insights` (Details: `ROADMAP.md`). Die vier
Domänen-Phasen sind damit für Zerlegung in konkrete `ROADMAP.md`-Tasks freigegeben, aber
noch nicht zerlegt — jede Domäne beginnt mit einer fachlichen Grundfrage (z. B. Journal:
"Was ist ein Journal-Eintrag in Zera?"), nicht mit UI/Implementierung.

---

## 12. Nicht-Ziele dieses Dokuments

- Keine Implementierung, keine Code-Architektur, keine Datenbank-/API-Schnittstellen.
- Keine Festlegung konkreter `ROADMAP.md`-Task-IDs für Journal/Saved Meals/Dashboard/Goals.
- Keine abschließende Liste aller jemals unterstützten Evaluation Profiles — die Product
  Bible beschreibt einen initialen, bewusst kleinen Profil-Kandidatensatz.
- Keine Entscheidung über Monetarisierung/Freemium-Grenzen zwischen Profilen.
- Keine Aussage zur vollständigen Umbenennung von Repo/Package zu "Zera" (separater Task).
