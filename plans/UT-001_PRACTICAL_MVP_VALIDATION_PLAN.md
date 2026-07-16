# UT-001: Practical MVP Validation — Testplan

## Ziel

Prüfen, ob der bestehende, seit `PR-001` bereinigte Kernfluss — **Erfassen → Ziel festlegen →
wiederkehrende Mahlzeiten nutzen → Tagesauswertung verstehen** — technisch stabil ist und im
echten Alltag sowie für eine produktfremde Person verständlich funktioniert, bevor weitere
Produktentwicklung beginnt.

**Revision:** Diese Version ersetzt die ursprüngliche Fassung, die von fünf rekrutierten externen
Testpersonen mit festem Studienprotokoll ausging. Das entsprach nicht der tatsächlichen Situation
— einem einzelnen Entwickler mit einem Android-Gerät, einer bereitwilligen Partnerin mit einem
iPhone und Claude als technischem Prüfwerkzeug ohne echten Gerätezugriff. UT-001 ist jetzt eine
**gestaffelte praktische MVP-Validierung**, kein wissenschaftlicher Vergleichstest.

---

## Was tatsächlich zur Verfügung steht

Drei grundverschiedene Prüfarten, keine davon ersetzt die anderen:

- **Der Entwickler auf einem Android-Gerät.** Echtes Dogfooding — reale Mahlzeiten, echter
  Alltag, über mehrere Tage. Sehr wertvoll, aber kein neutraler Usability-Test: das Produkt ist
  bereits bekannt.
- **Die Partnerin auf einem iPhone.** Die einzige echte, unvoreingenommene Perspektive. Bereits
  eine einzelne Sitzung kann wichtige Verständnisprobleme aufdecken. Ob Expo Go, ein interner
  iOS-Build oder TestFlight dafür geeignet ist, ist eine offene, separat zu klärende technische
  Frage anhand des aktuellen Setups — hier nicht vorweggenommen.
- **Claude im "Emulator".** In dieser Umgebung real bedeutet das `expo start --web` +
  Headless-Playwright/Chromium (dieselbe Methode, die seit `WEB-001` in dieser Session für
  `DI-008`, `DI-009` und `PR-001` genutzt wurde) — **kein** echter nativer Android-/iOS-Simulator
  ist zugänglich. Das ist wertvolle, systematische technische QA (Navigation, Formularzustände,
  Fehlermeldungen, Layout, Reloads, Persistenz, Konsolenfehler), aber **keine echte
  Nutzerforschung**: Claude kann nicht belastbar feststellen, ob ein normaler Mensch eine Funktion
  intuitiv versteht.

---

## Phasenstruktur

### A0 — Einmalige technische Baseline (Claude)

Vor Beginn des Dogfoodings prüft Claude einmal vollständig, per `expo start --web` +
Headless-Playwright (mangels echtem Emulator-/Gerätezugriff — siehe oben):

- Kaltstart und leerer Zustand
- Navigation und alle vier Tabs (`Protokoll`, `Ziele`, `Vorlagen`, `Auswertung`)
- Kernfluss vom Zielsetzen bis zur Auswertung
- Erstellen, Loggen, Umbenennen und Löschen von Vorlagen
- Bearbeiten, Löschen, Auto-Merge und Undo im Journal
- Persistenz und Cross-Tab-Aktualisierung
- schmale und breite Bildschirmgrößen
- Lade-, Leer- und Fehlerzustände
- Konsolen- und Runtime-Fehler

**Ziel:** bekannte technische und visuelle Störungen entfernen, bevor die reale Nutzung beginnt.
**Grenze:** A0 ist ein einmaliger vollständiger Durchlauf — nicht beliebig oft wiederholbar (siehe
`A1` für den begrenzten, wiederholbaren Nachprüfungskanal während `B`).
**Reset vorher:** siehe [Reset-Prozedur](#reset-prozedur) unten — A0 muss aus einem echten
Kaltstart-Zustand geprüft werden, nicht aus einem durch frühere Sessions vorgeprägten.
**Dokumentation:** Befunde in `docs/MANUAL_TESTING_GAPS.md`-Konvention (Datum, Status, Befund,
Evidenz) oder direkt als Grundlage für gezielte Blocker-Fixes, falls A0 selbst bereits einen
Blocker findet.

### B — Reales Dogfooding (Hauptphase, mehrere Tage, Android, Entwickler)

Keine starre Aufgabenliste — Zera wird so genutzt, wie sie später tatsächlich im Alltag genutzt
würde. Beobachtungen werden festgehalten, nicht sofort bearbeitet:

| Feld                    | Bedeutung                                                    |
| ----------------------- | ------------------------------------------------------------ |
| Tatsächliche Eingabe    | Was wurde konkret getan/eingegeben?                          |
| Erwartetes Verhalten    | Was sollte passieren?                                        |
| Tatsächliches Verhalten | Was ist wirklich passiert?                                   |
| Ergebnis                | korrekt / zweifelhaft                                        |
| Problemtyp              | technischer Fehler / Bedienproblem / fehlender Produktnutzen |
| Häufigkeit & Einfluss   | Wie oft, wie störend im echten Alltag?                       |

`B` ist die wichtigste Informationsquelle, weil nur reale, wiederholte Nutzung Probleme zeigt wie:

- zu viel Aufwand bei wiederkehrenden Einträgen
- unpassende Vorschläge
- störende Korrekturschritte
- falsche oder unverständliche Bewertungen
- Funktionen, die theoretisch vorhanden sind, im Alltag aber keinen Nutzen bringen

Der dritte Problemtyp ("fehlender Produktnutzen") ist neu gegenüber der ursprünglichen Fassung —
ein aufgabenbasierter Test mit Fremden hätte das kaum zeigen können, echtes wiederholtes
Dogfooding schon.

### A1 — Gezielte technische Nachprüfung (während B, beliebig oft, aber eng begrenzt)

Wenn während `B` etwas Konkretes auffällt, prüft Claude **nur diesen einen Befund**, nicht das
gesamte Produkt erneut:

1. Der gemeldete Ablauf wird exakt reproduziert.
2. Einordnung: UI-, State-, Resolver-, Persistenz- oder Datenproblem?
3. Erst danach wird entschieden, ob daraus ein Fix-Task wird.

`A1` ist ein technischer Reproduktions- und Diagnosekanal, **kein** erneuter Gesamtaudit — dieselbe
Abgrenzung, die `DI-009`s Sweep bereits vorgemacht hat (Befund dokumentieren und klassifizieren
zuerst, Fix als separater Act-Task danach).

### Umgang mit Änderungen während B

Weder alles sofort beheben noch jede Änderung verbieten:

- **Blocker** (Datenverlust, falsche Bewertungen, nicht fortsetzbare Kernflüsse) dürfen sofort
  formalisiert, behoben und erneut geprüft werden.
- **Mittlere UX-Probleme und Verbesserungsideen** werden gesammelt, nicht sofort umgesetzt.
- **Mehrere kleine Beobachtungen** werden erst nach einer Nutzungsphase gemeinsam bewertet.
- **Nach jedem Fix** wird der verwendete Build bzw. Commit-SHA dokumentiert.

### C — Partnerin-Sitzung (unabhängige Perspektive, einmalig)

**Voraussetzung, bevor `C` stattfindet:**

- `A0` ist abgeschlossen.
- Reale Eigennutzung (`B`) hat stattgefunden.
- Aus `B` bekannte Blocker sind behoben.

Die Sitzung ist bewusst informell — **keine künstliche Laborstudie**. Der Entwickler darf helfen;
wichtig ist nur, zu notieren, **wo** Unterstützung nötig war und **warum** — kein formales
Hilfestufen-Protokoll, keine Zeitmessung pro Aufgabe.

**Beispielhafte, neutrale Formulierungen:**

> "Stell dir vor, du möchtest heute darauf achten, wie viel Protein du isst. Schau dir die App an
> und versuche, sie dafür einzurichten."

> "Trage ein, dass du zwei Eier und 200 Gramm Quark gegessen hast."

**Beobachtungsfokus:**

- Versteht sie den Zweck der App?
- Findet sie den Einstieg?
- Versteht sie die vier Tabs?
- Kann sie ohne Vorwissen etwas eintragen?
- Versteht sie Ziele und Auswertung?
- Wo benötigt sie Hilfe?
- Welche Begriffe oder Reaktionen wirken unklar?

**Plattform:** Dass sie iOS nutzt, ist ein nützlicher Nebeneffekt (erster Blick auf eine zweite
Plattform), aber **kein vollständiger iOS-Kompatibilitätstest** — das würde den Zweck der Sitzung
verwässern. Die technische Frage, wie die App zuverlässig auf ihrem Gerät läuft (Expo Go, interner
Build, TestFlight), ist separat zu klären, nicht Teil dieses Plans.

**Reset vorher:** siehe [Reset-Prozedur](#reset-prozedur) — sie soll den echten Tag-1-Zustand
sehen, nicht einen durch `A0`/`B` vorgeprägten.

---

## Reset-Prozedur

Weiterhin gültig, jetzt gezielt vor `A0` und vor `C` angewendet (nicht mehr "zwischen fünf
Sitzungen", da es keine Vergleichbarkeits-Anforderung über mehrere Testpersonen mehr gibt).

**Befund, der diese Prozedur nötig macht:** Der einzige im Code vorhandene Reset-Mechanismus
(`EXPO_PUBLIC_RESET_ON_LAUNCH` in `src/presentation/App.tsx`) ist `__DEV__`-gated und löscht
ausschließlich `foodEntryRepository` (Journal-Einträge) — nicht Ziele, Metabolismus-Profil,
aktives Bewertungsprofil oder Vorlagen. Er reicht für einen echten Kaltstart-Zustand nicht aus.

**Verbindlich vor `A0` und vor `C`:**

- App-Daten vollständig über die Betriebssystem-Einstellungen löschen (iOS: Einstellungen →
  Allgemein → iPhone-Speicher → App → App löschen bzw. Daten löschen; Android: Einstellungen →
  Apps → App → Speicher → Daten löschen) **oder** die App deinstallieren und neu installieren.
  Build-unabhängig, funktioniert unabhängig von Expo Go vs. internem Build.
- Danach verifizieren:
  - [ ] Journal ist leer ("Noch keine gespeicherten Einträge für heute.")
  - [ ] Keine Ziele gesetzt
  - [ ] Kein Metabolismus-Profil vorhanden
  - [ ] Auswertung zeigt "Bitte zuerst im Ziele-Tab Ziele festlegen."
  - [ ] Keine gespeicherten Vorlagen

Für `B` (mehrtägiges Dogfooding) ist **kein** Reset zwischen einzelnen Nutzungsmomenten
vorgesehen — im Gegenteil, die fortlaufende, sich aufbauende Nutzung über Tage ist genau der
Punkt dieser Phase.

---

## Schweregrade (für die Auswertung von B und C)

Vier Stufen, unverändert aus der vorherigen Fassung — weiterhin die Grundlage für Priorisierung:

| Grad        | Definition                                                                                                                                         | Beispiel                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Blocker** | Aufgabe/Alltagsnutzung lässt sich nicht fortsetzen; falsche Daten werden als korrekt präsentiert; Datenverlust; Absturz; Fehlerzustand ohne Ausweg | Der behobene `DI-009`-Fall (Auswertung zeigte still die Bewertung des falschen Profils) |
| **Hoch**    | Deutliche Verwirrung oder mehrere Fehlversuche, oder die Kernunterscheidung `Protokoll`/`Ziele`/`Auswertung` wird grundsätzlich falsch verstanden  | Testperson hält "Ziele" und "Auswertung" für dasselbe                                   |
| **Mittel**  | Spürbare Reibung, aber am Ende ohne fremde Hilfe gelöst                                                                                            | Zögern bei "Vorlagen", aber selbstständig herausgefunden                                |
| **Niedrig** | Kosmetisch, kein Verständnis- oder Vertrauensproblem                                                                                               | Layout-Feinheit auf einem bestimmten Gerät                                              |

**Release-blockierend sind ausschließlich Blocker- und Hoch-Befunde.** Mittel/Niedrig werden
dokumentiert, aber nicht als Bedingung für weitere Produktarbeit behandelt.

---

## Auswertung

1. Nach ausreichend gesammelten `B`-Beobachtungen und nach der `C`-Sitzung: Befunde
   zusammenführen, wiederkehrende Muster erkennen.
2. Verständnis-, Bedien- und technische Probleme trennen (siehe Problemtyp-Feld oben).
3. Schweregrade kalibrieren (siehe Tabelle oben).
4. Jeder Blocker- oder Hoch-Befund erhält eine eigene Task-ID in `ROADMAP.md`, bevor an ihm
   gearbeitet wird — das `DI-009`-Muster: Befund zuerst dokumentiert und klassifiziert, Fix als
   separater, review-only geplanter Act-Task danach. (Blocker aus `B`/`A1`, die die
   Alltagsnutzung akut blockieren, dürfen davon abweichend sofort behoben werden — siehe
   "Umgang mit Änderungen während B" oben.)
5. Ergebnisse werden in `docs/USABILITY_TEST_RESULTS_UT-001.md` festgehalten (mirrored an der
   `docs/MANUAL_TESTING_GAPS.md`-Konvention).
6. Erst danach die nächste Implementierungsrunde priorisieren.

---

## Verbindliche Entscheidung

> UT-001 wird als gestaffelte praktische MVP-Validierung durchgeführt. Eine vollständige
> technische Emulator-Baseline (`A0`) erfolgt einmalig vor dem Dogfooding. Während des
> Dogfoodings (`B`) darf Claude konkrete Beobachtungen gezielt reproduzieren und technisch
> diagnostizieren (`A1`). Diese Nachprüfungen sind eng auf den gemeldeten Befund begrenzt und
> ersetzen keinen erneuten Gesamtaudit. Die unabhängige Prüfung durch die Partnerin (`C`) findet
> erst nach technischer Stabilisierung und realer Eigennutzung statt.

`A0` ist einmal vollständig und danach beliebig oft gezielt (`A1`) wiederholbar — aber nicht
beliebig oft vollständig.

---

## Was wir nach dieser Runde nicht behaupten können

> "Zera wurde erfolgreich mit fünf repräsentativen Nutzern validiert."

## Was wir belastbar behaupten können

> "Die Kernabläufe wurden technisch umfassend geprüft, im realen Alltag durch den Entwickler
> verwendet und durch mindestens eine produktfremde Person getestet."

Für den aktuellen Projektstand ist das ein realistischer, wertvoller nächster Schritt — nicht mehr
und nicht weniger.

---

## Nicht Teil dieses Plans

- Rekrutierung mehrerer externer Testpersonen — das ist kein Ziel von UT-001 mehr. Eine größere,
  repräsentative Beta mit mehreren Testpersonen bleibt ein mögliches **späteres** Ziel, sobald
  überhaupt Zugang zu mehr Testpersonen besteht — nicht Teil dieser Runde.
- Ein vollständiger iOS-Kompatibilitätstest im Rahmen von `C`.
- Klärung des technischen Wegs, wie die App auf dem iPhone der Partnerin läuft (Expo Go/interner
  Build/TestFlight) — separat zu klären, nicht hier vorweggenommen.
- Jede Priorisierung oder Umsetzung von Befunden, bevor sie überhaupt existieren.
