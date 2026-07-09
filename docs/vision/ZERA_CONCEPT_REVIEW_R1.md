# Zera Concept Review — Runde 1

Status: `review-result` — keine Freigabe, keine Implementierung, kein Auto-Rewrite der
Quelldokumente
Geprüfte Dokumente: [`ZERA_FOUNDING_BRIEF.md`](./ZERA_FOUNDING_BRIEF.md),
[`ZERA_PRODUCT_BIBLE.md`](./ZERA_PRODUCT_BIBLE.md)
Ergebnis: **Nicht freigabereif.** Grundidee (Journal/Evaluation-Trennung) bleibt richtig und
intern konsistent. Drei Änderungen werden vor Freigabe empfohlen — alle drei stammen aus der
eigenen Kritik am Entwurf und sind sachlich berechtigt. Zusätzlich ein vierter, eigenständig
gefundener Punkt.

Dieses Dokument ist das Review-Ergebnis, keine überarbeitete Fassung. Ob die Empfehlungen in
Founding Brief/Product Bible eingearbeitet werden, ist eine separate Entscheidung.

---

## 1. Kurzfazit

| #   | Punkt                                                             | Herkunft      | Schwere                                             |
| --- | ----------------------------------------------------------------- | ------------- | --------------------------------------------------- |
| 1   | "Model" → "Evaluation Profile" + Regel-Ebene einziehen            | eigene Kritik | hoch — löst einen echten Widerspruch                |
| 2   | Zielgruppen motivationsbasiert statt diätform-basiert formulieren | eigene Kritik | mittel                                              |
| 3   | Statelessness-Regel für Profile explizit machen                   | eigene Kritik | mittel — aktuell nur implizit                       |
| 4   | Lebensmittelgruppen-Klassifikation: Zuständigkeit unklar          | eigener Fund  | mittel — potenzieller Bruch der Journal-Neutralität |

Keiner der vier Punkte stellt die Grundarchitektur (Journal neutral / Evaluation Engine
austauschbar) infrage. Alle vier sind Präzisierungen innerhalb dieser Architektur.

---

## 2. Antworten auf die fünf Leitfragen

### 2.1 Gibt es Widersprüche zwischen Founding Brief und Product Bible?

Kein harter Widerspruch. Eine Ungenauigkeit: Founding Brief Abschnitt 6 gruppiert "Low Carb"
und "Mediterran" unter einer gemeinsamen Persona ("Ernährungsphilosophie/-stil"), während die
Product Bible (Abschnitt 5) sie als zwei getrennte Modell-Kandidaten führt. Das ist per se
kein Fehler (eine Persona kann mehrere Profile speisen), aber es fehlt eine explizite
Zuordnung Zielgruppe → Profil(e). Siehe Empfehlung 5.

### 2.2 Ist Journal wirklich vollständig modellunabhängig?

Grundsätzlich ja — Abschnitt 6/7 der Product Bible sind hier sauber. Eine Lücke: Abschnitt 5
(Mediterranean) nennt "Lebensmittelgruppen-Klassifikation pro Journal-Eintrag" als
zusätzlichen Datenbedarf, ohne zu klären, _wo_ diese Klassifikation lebt. Hängt sie direkt am
Journal-Eintrag als Attribut, das nur für ein Profil Bedeutung hat, ist das ein Bruch der
deklarierten Journal-Neutralität — auch wenn klein. Details unter Punkt 4.

### 2.3 Sind Evaluation Profiles sauber vom Logging getrennt?

Strukturell ja (Product Bible Abschnitt 2–4). Aber die Statelessness-Anforderung — die in
der Rückmeldung sehr präzise als `Journal + Profil + Einstellungen → Bewertung/Insights/
Warnungen/Empfehlungen/Zielerreichung` formuliert wurde — steht in der Bible bisher nur
indirekt: "abgeleitet, jederzeit neu berechenbar" (Abschnitt 3) und "darf Journaldaten nicht
schreiben" (Abschnitt 4). Es fehlt die explizite Aussage, dass ein Profil auch **keinen
eigenen Datenspeicher außerhalb des Journals** führen darf (z. B. kein Profil-eigener Cache,
der zur Nebenwahrheit wird). Das ist ein anderes Risiko als "Journal beschreiben" und sollte
getrennt benannt werden.

### 2.4 Gibt es implizite Annahmen, die spätere Erweiterungen erschweren?

Ja, die wichtigste: Alle Modell-Beispiele (Diagramm in Abschnitt 2, Liste in Abschnitt 5) sind
als feste, sich gegenseitig ausschließende Klassen dargestellt — implizit "wähle genau eines".
Das widerspricht dem eigenen "User-defined Goals"-Kandidaten in Abschnitt 5, der bereits
freie Kombination verspricht. Das genannte Beispiel (Protein hoch + Zucker niedrig + Salz
niedrig + Mediterrane Gewichtung + Kalorien egal) lässt sich mit "ein Modell = eine
Klasse" nicht abbilden — es ist per Definition keine der sieben gelisteten Klassen, sondern
eine Komposition. Die aktuelle Modell-Metadaten-Struktur (Abschnitt 4: ID, Name,
Zielgruppenbeschreibung, Zusatzdatenbedarf, Reifegrad) ist für benannte Einzelklassen
gedacht, nicht für komponierbare Einheiten.

Eine zweite, kleinere Annahme: Das Architektur-Diagramm und der Fließtext sprechen
durchgehend von "das aktive Modell" (Singular). Ob genau ein Profil gleichzeitig aktiv sein
kann oder mehrere kombinierbar sind, ist in Abschnitt 10 der Bible bereits als offene Frage
markiert — das ist konsistent, wird aber durch Punkt 1 unten direkt berührt (Rule-basierte
Profile machen "mehrere gleichzeitig" natürlicher, weil es strukturell näher an "ein Profil
= eine Regelkombination" liegt).

### 2.5 Ist das Konzept offen genug für künftige Profile, ohne den Kern zu ändern?

Journal-seitig: sehr gut (Abschnitt 6/7 Bible, keine Änderung nötig). Engine-seitig: mit
"Modell" als starrer, benannter Klasse nur bedingt — jedes neue Profil bräuchte im Zweifel
eigene Sonderlogik statt Wiederverwendung bereits vorhandener Regeln. Mit der vorgeschlagenen
Profile/Regel-Ebene (siehe unten) deutlich besser: neue Profile entstehen dann primär durch
_Kombination bestehender Regeln_, nicht durch neuen Code pro Profil.

---

## 3. Bewertung der drei eingebrachten Kritikpunkte

### 3.1 Nutzergruppen: Motivation statt Diätform

Zustimmung. Die aktuelle Liste (Founding Brief Abschnitt 6) beschreibt teils
Ernährungsformen ("Low Carb oder Mediterran") statt der dahinterliegenden Motivation
("ich will verstehen, ob meine Ernährung gut ist", "ich will X verbessern"). Die
vorgeschlagene Ich-Perspektive-Formulierung ist nicht nur sprachlich natürlicher, sie macht
auch sichtbar, dass eine Motivation potenziell zu mehreren Profilen passt (z. B. "ich möchte
meine Blutwerte verbessern" kann sowohl Cholesterol-Fokus als auch eine
Low-Carb-Komponente auslösen) — was wiederum Punkt 3.3 stützt.

### 3.2 Evaluation Model strikt datengetrieben (kein eigener Speicher)

Zustimmung. Der Geist der Bible entspricht dem bereits (Abschnitt 4: "Was ein Modell
niemals darf"), aber die konkrete Ein-/Ausgabe-Formulierung aus der Rückmeldung ist präziser
als der aktuelle Text und schließt eine Lücke, die der aktuelle Text offenlässt (eigener
Profil-Speicher außerhalb des Journals, siehe 2.3). Empfehlung: diese Ein-/Ausgabe-Formel
wörtlich in Abschnitt 4 übernehmen, plus die explizite "kein eigener Speicher"-Regel
ergänzen.

### 3.3 "Model" → "Evaluation Profile" + Regel-Ebene

Wichtigster Punkt, volle Zustimmung. Begründung über die reine Begriffsfrage hinaus: Es
löst den unter 2.4 beschriebenen echten Widerspruch zwischen "sieben feste Modell-Klassen"
und "User-defined Goals soll freie Komposition erlauben". Mit der vorgeschlagenen Schichtung

```
Evaluation Engine
        │
        ▼
Evaluation Profile   (Preset ODER Custom)
        │
        ▼
Regelsammlung         (z. B. "Protein hoch", "Zucker niedrig", "Mediterrane Gewichtung")
        │
        ▼
Bewertung
```

werden die bisher als "Modelle" gelisteten Kandidaten (Weight Loss, Muscle Gain, Low Carb,
Mediterranean, Cholesterol Focus, Evidence-based Standard) zu **kuratierten Regel-Bündeln**,
keine eigenen Algorithmen mehr. "User-defined Goals" wird dadurch kein Sonderfall mehr,
sondern der Normalfall der Architektur (ein Custom Profile ist strukturell dasselbe wie ein
Preset — nur nutzerkomponiert statt kuratiert). Das ist eine echte Vereinfachung, keine
zusätzliche Komplexität: Es gibt am Ende nur noch _eine_ Profil-Mechanik statt sechs
Spezialfälle plus einem Sonderfall "User-defined".

Nebenwirkung, die vor Übernahme bewusst sein sollte: Die "Regel" wird damit zur eigentlichen
atomaren, wiederverwendbaren Einheit der Erweiterbarkeit — nicht das Profil. Das verschiebt
die in Product Bible Abschnitt 8 beschriebene Erweiterbarkeit ("neues Modell wird
registriert") auf eine granularere Ebene ("neue Regel wird registriert, neue/bestehende
Profile können sie nutzen"). Das ist im Sinne der Vision klar stärker, sollte aber als
bewusste Konsequenz benannt werden, nicht nebenbei mitlaufen.

---

## 4. Zusätzlicher Fund: Lebensmittelgruppen-Klassifikation

Product Bible Abschnitt 5 (Mediterranean) nennt "Lebensmittelgruppen-Klassifikation pro
Journal-Eintrag" als zusätzlichen Datenbedarf, ohne Zuständigkeit zu klären. Zwei denkbare
Verortungen mit unterschiedlicher Konsequenz:

- **Am Journal-Eintrag gespeichert:** verletzt die deklarierte Journal-Neutralität, weil
  diese Information nur für bestimmte Profile Bedeutung hat.
- **In der deterministischen Food-Catalog-/Resolver-Schicht** (dort, wo heute schon Makros
  aus BLS/OFF/USDA aufgelöst werden): korrekt, weil die Lebensmittelgruppen-Zugehörigkeit
  eine **Eigenschaft des Lebensmittels** ist (wie Makros), nicht eine Bewertung. Sie ist
  unabhängig vom aktiven Profil und entsteht deterministisch aus der Food-Auflösung —
  genau wie Gramm/Makros heute. Jedes Profil, das sie braucht, liest sie einfach mit,
  Profile, die sie nicht brauchen, ignorieren sie.

Empfehlung: Diese Unterscheidung ("Eigenschaft des Lebensmittels" vs. "profilspezifische
Bewertung") explizit in der Bible verankern — sie betrifft nicht nur Mediterranean, sondern
jeden künftigen Datenbedarf, der über reine Makros hinausgeht (z. B. Fettsäureprofile für
Cholesterol Focus).

---

## 5. Empfehlung

**Nicht freigeben in aktueller Fassung.** Vor Festschreibung als fachliche Autorität sollten
folgende fünf Änderungen eingearbeitet werden:

1. Terminologie durchgängig: "Evaluation Model" → "Evaluation Profile", neue Zwischenebene
   "Regel"/"Rule" einführen; Architekturdiagramm in Product Bible Abschnitt 2 entsprechend
   umzeichnen (Engine → Profile → Regelsammlung → Bewertung); bestehende sieben Kandidaten
   werden zu Preset-Profilen (Regel-Bündeln), "User-defined Goals" wird zum Custom-Profile-
   Normalfall statt Sonderfall.
2. Zielgruppen in Founding Brief Abschnitt 6 motivationsbasiert/Ich-Perspektive
   umformulieren.
3. Explizite Statelessness-Regel in Product Bible Abschnitt 4 ergänzen: Ein-/Ausgabe-Formel
   übernehmen, plus "kein eigener Datenspeicher außerhalb des Journals".
4. Klarstellung ergänzen: lebensmittel-intrinsische Zusatzdaten (Lebensmittelgruppen,
   Fettsäureprofile etc.) gehören zur deterministischen Food-Catalog-Schicht, nicht zur
   Evaluation Engine.
5. Explizite Zuordnung Zielgruppe(n) ↔ Profil(e) ergänzen (n:m, nicht 1:1).

Diese Überarbeitung wird hier bewusst **nicht** automatisch vorgenommen — passend zum
Review-only-Vorgehen. Rückmeldung dazu, ob und in welcher Form (direkte Einarbeitung in
beide Dokumente vs. weitere Rückfragen vs. zweite Review-Runde) gewünscht ist, steht noch
aus.
