# UT-001: Erster Externer Nutzertest — Testplan

## Ziel

Prüfen, ob echte Erstnutzer den bestehenden, seit `PR-001` bereinigten Kernfluss —
**Erfassen → Ziel festlegen → wiederkehrende Mahlzeiten nutzen → Tagesauswertung verstehen** —
ohne Anleitung verstehen und erfolgreich nutzen können, bevor weitere Produktentwicklung
beginnt. Dieses Dokument ist review-only: es legt den Testprotokoll fest, führt aber keinen
Test aus und ändert keinen Code.

Kontext: Der vorherige Product Readiness Audit und `PR-001` haben die App auf vier kohärente,
ehrliche Tabs reduziert (`Protokoll`, `Ziele`, `Vorlagen`, `Auswertung`). Dieser Test ist die
erste Gelegenheit zu prüfen, ob "kohärent für uns" auch "verständlich für einen Fremden" bedeutet.

---

## Zielgruppe und Anzahl der Testpersonen

- **5 Testpersonen.** Nielsen/Norman-Faustregel: 5 Nutzer:innen decken in einem qualitativen
  Usability-Test bereits ca. 85 % der auffindbaren Probleme auf — für einen ersten,
  schnell durchführbaren Test ausreichend; ein größerer, quantitativer Test ist ein möglicher
  späterer Schritt, kein Ersatz für diesen.
- **Deutschsprachig, ohne Ausnahme.** Die App ist vollständig auf Deutsch, der
  Lebensmittel-Resolver ist DACH-fokussiert (BLS-Priorität) — das entspricht der Roadmap-Priorität
  "DACH-first deterministic resolver". Ein nicht-deutschsprachiger Test würde hier nichts über das
  eigentliche Produkt aussagen.
- **Gezielte Durchmischung:**
  - **mind. 2 Personen ohne jede Vorerfahrung** mit Ernährungs-Tracking-Apps — prüft, ob die
    Begriffe ("Ziel", "Auswertung", "Vorlagen") ohne gelerntes Branchenvokabular verständlich sind.
  - **mind. 2 Personen mit Erfahrung in einer anderen Tracking-App** (z. B. MyFitnessPal, Yazio,
    Lifesum) — prüft, ob aus anderen Apps übernommene Erwartungen hier funktionieren oder in die
    Irre führen.
  - **Niemand, der am Projekt beteiligt war oder Entwickler:in ist** — unabhängige, unvoreingenommene
    Sicht ist der ganze Zweck dieses Tests.

---

## Testvoraussetzungen und Testdaten

- **Plattform: natives Gerät** (Expo Go oder ein interner Build), **nicht** der Web-Build. Web ist
  laut `WEB-001` (`ROADMAP.md`) ausdrücklich nur ein internes Verifikationswerkzeug, keine
  offiziell unterstützte Nutzerplattform — ein Web-basierter Test würde ein Erlebnis prüfen, das
  echte Nutzer:innen nie hätten.
- **Reale Supabase-Umgebung**, kein Platzhalter-`.env` — Auth/Persistenz müssen sich exakt wie im
  echten Betrieb verhalten.
- **Vollständig frischer Account/App-Zustand pro Testperson**: kein vorbefülltes Journal, keine
  vorgesetzten Ziele, kein Metabolismus-Profil. Der Tag-1-Zustand ist der eigentliche
  Testgegenstand — genau der Zustand, der im vorherigen Audit für `Protokoll`/`Ziele`/`Vorlagen`/
  `Auswertung` bereits als ehrlich und klar bewertet wurde und der jetzt an echten Menschen
  bestätigt werden soll.
- **Kein Tutorial, kein Onboarding-Screen vorschalten** — existiert aktuell ohnehin nicht im
  Produkt; der Test soll diese Lücke sichtbar machen, nicht künstlich überbrücken.
- **Think-Aloud-Protokoll:** Testperson wird gebeten, während der Aufgaben laut zu denken.
  Moderation greift nur bei vollständigem Stillstand (> 60 Sekunden ohne erkennbaren Fortschritt)
  ein — und jeder solche Eingriff wird selbst als Beobachtung notiert, nicht stillschweigend
  übersprungen.
- **Aufzeichnung:** Bildschirm + Ton, mit Einverständnis der Testperson; ersatzweise ein
  Beobachtungsprotokoll durch eine zweite, mitschreibende Person.
- **Geschätzte Dauer pro Sitzung:** ca. 30–40 Minuten (7 Aufgaben + Nachbefragung).

---

## Aufgaben

Bewusst als Ziele formuliert, nicht als Bedienschritte — wie genau eine Testperson eine Aufgabe
löst, ist selbst Teil dessen, was beobachtet werden soll:

1. Lege dein Ernährungsziel fest.
2. Protokolliere: "Zwei Eier und 200 g Quark".
3. Korrigiere einen der gerade erfassten Einträge.
4. Speichere eine Mahlzeit als Vorlage.
5. Logge diese Vorlage erneut.
6. Erkläre in eigenen Worten, was dir die Tagesauswertung sagt.
7. Ändere dein Bewertungsziel und erkenne, was sich dadurch ändert.

---

## Beobachtungskriterien

- Versteht die Testperson den Unterschied zwischen `Protokoll`, `Ziele` und `Auswertung` — oder
  hält sie zwei davon für dasselbe?
- Findet sie den Einstieg (erste Eingabe) ohne Erklärung?
- Versteht sie Korrekturhinweise bei Portionen (z. B. den "Portionsgewicht fehlt"-Dialog), falls
  ausgelöst?
- Erkennt sie von selbst, dass Vorlagen das erneute Erfassen beschleunigen — oder muss ihr das
  erklärt werden?
- Sind Insights/Empfehlungen in der Auswertung verständlich und wirken vertrauenswürdig, oder
  wirken sie wie eine Black Box?
- Wo zögert sie, tippt mehrfach probierend, oder erwartet eine andere Reaktion als die, die
  eintritt?
- **Zusätzlich, spezifisch zu `PR-001`:** Sucht die Testperson zu irgendeinem Zeitpunkt aktiv
  nach einem "Ernährung"- oder "Erholung"-Tab, oder wirken die vier verbliebenen Tabs für sie
  bereits vollständig? Das ist die erste echte Gegenprobe zu der Entfernungs-Entscheidung.

---

## Fragen nach dem Test

- Was war der Zweck dieser App aus deiner Sicht — in einem Satz?
- Was hat dir gut gefallen? Was hat dich verwirrt oder gestört?
- Gab es einen Moment, in dem du unsicher warst, ob deine Aktion überhaupt funktioniert hat?
- Würdest du dieser App zutrauen, deine Ernährung korrekt zu erfassen? Warum, warum nicht?
- Was hat dir in der Auswertung am meisten geholfen — was am wenigsten Sinn ergeben?
- Hättest du gewusst, wozu "Vorlagen" da sind, ohne es auszuprobieren?
- Was hättest du als Nächstes von der App erwartet, nachdem du diese Aufgaben erledigt hast?
- Gäbe es aus deiner Sicht einen Grund, die App nicht weiter zu benutzen?

---

## Release-blockierende Kriterien

Vier Schweregrade, mit konkreten Beispielen aus bereits bekannten Fehlerklassen dieses Projekts
als Kalibrierung — nicht als erschöpfende Liste:

| Grad        | Definition                                                                                                                                                                                     | Beispiel                                                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Blocker** | Aufgabe lässt sich gar nicht abschließen; falsche Daten werden als korrekt präsentiert (Vertrauensbruch); Datenverlust; Absturz; Fehlerzustand ohne Ausweg                                     | Der bereits gefundene und behobene `DI-009`-Fall (Auswertung zeigte still die Bewertung des falschen Profils) wäre, wäre er noch offen, ein Blocker |
| **Hoch**    | Aufgabe wird abgeschlossen, aber mit erheblicher Verwirrung, mehreren Fehlversuchen, oder die Testperson versteht die Kernunterscheidung `Protokoll`/`Ziele`/`Auswertung` grundsätzlich falsch | Testperson hält "Ziele" und "Auswertung" für dasselbe                                                                                               |
| **Mittel**  | Spürbare Reibung, unklare Begriffe, aber Aufgabe wird letztlich ohne fremde Hilfe gelöst                                                                                                       | Zögern bei "Vorlagen", aber selbstständig herausgefunden                                                                                            |
| **Niedrig** | Kosmetisch, Politur, kein Verständnis- oder Vertrauensproblem                                                                                                                                  | Layout-Feinheit auf einem bestimmten Gerät                                                                                                          |

**Release-blockierend im Sinne dieses Tests sind ausschließlich Blocker- und Hoch-Befunde.**
Mittel/Niedrig werden dokumentiert, aber nicht als Bedingung für weitere Produktarbeit behandelt.

---

## Dokumentation und Priorisierung

1. **Pro Sitzung:** rohes Beobachtungsprotokoll (Zeitstempel, Aufgabe, Beobachtung, wörtliches
   Zitat wo möglich) — unmittelbar nach der Sitzung, nicht nachträglich rekonstruiert.
2. **Nach allen 5 Sitzungen:** Synthese in einer Befundtabelle — pro Befund: Beschreibung,
   Häufigkeit (wie viele von 5 Testpersonen betroffen), Schweregrad (siehe oben), betroffene(r)
   Screen(s), Empfehlung. Gleiche Sorgfalt wie bei der Tier-1/Tier-2-Roadmap-Inventur: keine
   Befunde ungeprüft übernehmen, jeden anhand der tatsächlichen Beobachtung begründen.
3. **Ergebnisse werden in einem neuen Dokument** `docs/USABILITY_TEST_RESULTS_UT-001.md`
   festgehalten (mirrored an der bestehenden `docs/MANUAL_TESTING_GAPS.md`-Konvention: Datum,
   Status, Befund, Evidenz).
4. **Jeder Blocker- oder Hoch-Befund erhält eine eigene Task-ID in `ROADMAP.md`**, bevor an ihm
   gearbeitet wird — exakt das Muster, das der Manual-Testing-Sweep für `DI-009` bereits vorgemacht
   hat: Befund zuerst dokumentiert und klassifiziert, Fix als separater, review-only geplanter
   Act-Task danach.
5. **Kein Sofort-Fixen während der Testsitzungen** — Beobachtungen werden gesammelt, nicht sofort
   bearbeitet, damit spätere Testpersonen nicht auf Basis eines bereits veränderten Produkts
   getestet werden.

---

## Reset-Prozedur zwischen Sitzungen

**Befund, der diesen Nachtrag nötig macht:** Der einzige im Code vorhandene Reset-Mechanismus
(`EXPO_PUBLIC_RESET_ON_LAUNCH` in `src/presentation/App.tsx`) reicht für diesen Test nicht aus —
er ist `__DEV__`-gated (greift je nach Build-Art möglicherweise gar nicht) und löscht ausschließlich
`foodEntryRepository` (Journal-Einträge). Ziele, Metabolismus-Profil, das aktive Bewertungsprofil
und gespeicherte Vorlagen bleiben davon unberührt. Würde sich eine Moderation allein darauf
verlassen, wäre jede Testperson nach der ersten von einem bereits vorgeprägten Zustand betroffen —
genau die Vergleichbarkeit, die dieser Test braucht, wäre verloren.

**Verbindlich:**

- **Nicht auf den internen Dev-Reset verlassen.** Er ist keine geeignete Reset-Prozedur für diesen
  Test, unabhängig davon, ob er im jeweiligen Build technisch greift.
- **Zwischen jeder Testperson:** App-Daten vollständig über die Betriebssystem-Einstellungen löschen
  (iOS: Einstellungen → Allgemein → iPhone-Speicher → App → App löschen bzw. Daten löschen; Android:
  Einstellungen → Apps → App → Speicher → Daten löschen) **oder** die App deinstallieren und neu
  installieren. Diese Prozedur ist bewusst build-unabhängig — sie funktioniert identisch, ob Expo Go
  oder ein interner Build verwendet wird, und hängt an keinem `__DEV__`-Flag.
- **Danach vor jeder Sitzung verifizieren und abhaken** (Moderator-Checkliste, direkt in der App
  geprüft, nicht angenommen):
  - [ ] Journal ist leer ("Noch keine gespeicherten Einträge für heute.")
  - [ ] Keine Ziele gesetzt (Ziele-Tab zeigt das leere Metabolismus-Profil-Formular)
  - [ ] Kein Metabolismus-Profil vorhanden
  - [ ] Bewertungsmodell im Standardzustand (Auswertung-Tab zeigt die Fehlermeldung "Bitte zuerst
        im Ziele-Tab Ziele festlegen.", nicht die Bewertung einer vorherigen Sitzung)
  - [ ] Keine gespeicherten Vorlagen ("Noch keine gespeicherten Mahlzeiten.")
- **Kein neuer Build zwischen den fünf Sitzungen verteilt.** Alle fünf Testpersonen testen exakt
  denselben Produktstand — sonst ist am Ende nicht mehr feststellbar, ob eine Abweichung an der
  Person oder am Produkt lag.
- **Build-Version bzw. Commit-SHA pro Sitzung dokumentieren**, auch wenn erwartungsgemäß bei allen
  fünf identisch — das ist die Absicherung, falls doch versehentlich zwischendurch aktualisiert
  wurde.

---

## Anhang: Moderator-Spickzettel

Einseitig gedacht, direkt nutzbar während einer Sitzung — kein separates Studium nötig.

### Grundregeln

- Aufgaben wortwörtlich wie unten vorlesen — keine Funktionsnamen, Tab-Namen oder Bedienhinweise
  vorwegnehmen, die die Testperson selbst erst finden soll.
- Erst nach **60 Sekunden erkennbarem Stillstand** überhaupt eingreifen (siehe Think-Aloud-Regel
  oben) — und dann mit der niedrigsten passenden Hilfestufe, nicht direkt mit der Lösung.
- Jeder Eingriff wird selbst notiert (welche Stufe, bei welcher Aufgabe).

### Aufgaben zum Vorlesen (neutral, unverändert aus dem Hauptplan)

1. "Lege dein Ernährungsziel fest."
2. "Protokolliere: Zwei Eier und 200 Gramm Quark."
3. "Korrigiere einen der gerade erfassten Einträge."
4. "Speichere eine Mahlzeit als Vorlage."
5. "Logge diese Vorlage erneut."
6. "Erkläre mir in deinen eigenen Worten, was dir die Tagesauswertung sagt."
7. "Ändere dein Bewertungsziel und erkenne, was sich dadurch ändert."

### Standardisierte Hilfestufen

| Stufe | Bezeichnung        | Was passiert                                                                                                                                | Zählt als "ohne Hilfe gelöst"? |
| ----- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **0** | Keine Hilfe        | Testperson löst die Aufgabe selbstständig                                                                                                   | Ja                             |
| **1** | Rückfrage          | Nach 60s Stillstand offene Gegenfrage stellen, z. B. "Was würdest du als Nächstes erwarten oder versuchen?" — keine Information preisgeben  | Ja                             |
| **2** | Bereichshinweis    | Auf den richtigen Tab/Bereich hinweisen, ohne die konkrete Bedienung zu nennen, z. B. "Schau mal, ob dir einer der Tabs unten weiterhilft." | Nein                           |
| **3** | Konkrete Anleitung | Genauer Bedienschritt wird genannt                                                                                                          | Nein                           |

Stufe 2/3 bedeuten nicht automatisch einen hohen Schweregrad — das hängt zusätzlich davon ab, wie
schnell und wie sicher die Testperson danach weiterkommt. Die Stufe ist ein Rohdatum für die
spätere Auswertung, keine fertige Bewertung.

### Notizraster (pro Aufgabe, einmal je Testperson auszufüllen)

| Feld                                                          | Eintrag                             |
| ------------------------------------------------------------- | ----------------------------------- |
| Aufgabe (1–7)                                                 |                                     |
| Startzeit                                                     |                                     |
| Endzeit                                                       |                                     |
| Ohne Hilfe gelöst? (Stufe 0/1 = ja)                           | ☐ Ja ☐ Nein                         |
| Höchste Hilfestufe                                            | ☐ 0 ☐ 1 ☐ 2 ☐ 3                     |
| Sichtbares Zögern                                             |                                     |
| Wörtliches Zitat                                              |                                     |
| Verständnisproblem (Begriff/Konzept unklar)                   | ☐ Ja ☐ Nein — welches?              |
| Bedienproblem (weiß was, findet es nicht)                     | ☐ Ja ☐ Nein — wo?                   |
| Technischer Defekt (Produkt verhält sich nachweislich falsch) | ☐ Ja ☐ Nein — welcher?              |
| Vorläufiger Schweregrad (siehe Tabelle oben)                  | ☐ Blocker ☐ Hoch ☐ Mittel ☐ Niedrig |
| Freie Beobachtung                                             |                                     |

Die drei Problemtypen schließen sich nicht gegenseitig aus — ein einzelner Moment kann z. B.
gleichzeitig ein Bedienproblem UND ein Verständnisproblem sein. Ein technischer Defekt ist
etwas anderes als beides: das Produkt tut nachweislich nicht, was es laut eigener Spezifikation
tun sollte (vgl. die Beispiele in der Schweregrad-Tabelle oben) — nicht "die Testperson kam nicht
klar", sondern "das Produkt hat sich falsch verhalten".

### Vor jeder Sitzung (kurze Checkliste)

- [ ] Reset-Prozedur (siehe oben) durchgeführt und die fünf Punkte verifiziert
- [ ] Aufzeichnung (Bildschirm + Ton) läuft, Einverständnis eingeholt
- [ ] Build-Version/Commit-SHA notiert
- [ ] Notizraster (7× für die 7 Aufgaben) bereitliegend

---

## Nicht Teil dieses Plans

- Die tatsächliche Durchführung der fünf Testsitzungen (das ist der nächste, separate Schritt).
- Rekrutierung/Terminfindung der Testpersonen (organisatorisch, keine Produktentscheidung).
- Irgendeine Priorisierung oder Umsetzung von Befunden, bevor sie überhaupt existieren.
