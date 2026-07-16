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

## Nicht Teil dieses Plans

- Die tatsächliche Durchführung der fünf Testsitzungen (das ist der nächste, separate Schritt).
- Rekrutierung/Terminfindung der Testpersonen (organisatorisch, keine Produktentscheidung).
- Irgendeine Priorisierung oder Umsetzung von Befunden, bevor sie überhaupt existieren.
