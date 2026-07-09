# Zera Concept Review — Runde 2 (Produktsicht)

Status: `review-result` — keine Freigabe, keine Implementierung, kein Auto-Rewrite der
Quelldokumente
Geprüfte Dokumente: [`ZERA_FOUNDING_BRIEF.md`](./ZERA_FOUNDING_BRIEF.md),
[`ZERA_PRODUCT_BIBLE.md`](./ZERA_PRODUCT_BIBLE.md) — beide im Stand nach Einarbeitung von
[`ZERA_CONCEPT_REVIEW_R1.md`](./ZERA_CONCEPT_REVIEW_R1.md)
Fokus dieser Runde: **Produktsicht** (Runde 1 war Architektursicht) — fünf vorgegebene
Fragen plus die "letzte Empfehlung" zur Tier-Phasen-Struktur
Ergebnis: **Nicht freigabereif.** Ein hochrelevanter Strukturfund (Frage 5), ein
hochrelevanter Entscheidungsfund (Frage 2), zwei mittlere Klarstellungsbedarfe (Fragen 1, 4),
ein Gewichtungsfund (Frage 3 — Inhalt bereits vorhanden, aber nicht prominent genug).

---

## 1. Kurzfazit

| #   | Punkt                                                                                                                                                     | Schwere                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 5   | Drei-Schichten-Modell (Food Catalog / Journal / Evaluation Engine) fehlt explizit                                                                         | hoch — sauberer als aktuelles Zwei-Schichten-Modell, deckt sich mit bestehendem Code |
| 2   | Profilwechsel-Historie: Entscheidung bereits getroffen, aber als Erweiterbarkeits-Detail versteckt statt als bewusste Produktentscheidung mit Alternative | hoch — betrifft Nutzervertrauen in historische Bewertungen                           |
| 1   | Keine explizite Trennung interne Architektursprache vs. Produktoberfläche                                                                                 | mittel — Risiko, dass "Profil" 1:1 in die UI durchsickert                            |
| 4   | Profil-Herkunft/Autorenschaft (Arzt/Trainer/Community/Wissenschaft/KI) nicht vorgesehen                                                                   | mittel — keine Sackgasse, aber unadressierte Erweiterungsachse                       |
| 3   | "Profile verändert nie Fakten" inhaltlich vorhanden, aber nicht oberstes Prinzip                                                                          | niedrig — reine Gewichtungs-/Platzierungsfrage                                       |

Keiner der fünf Punkte widerspricht der nach Runde 1 überarbeiteten Architektur. Punkt 5 ist
eine echte Verfeinerung (dritte Schicht statt Unterpunkt), Punkt 2 deckt eine bisher
unkommentierte, aber folgenreiche Produktentscheidung auf.

---

## 2. Antworten auf die fünf Produktfragen

### 2.1 Ist das Konzept für normale Nutzer verständlich?

Nein, noch nicht ausreichend abgesichert. Founding Brief Abschnitt 6 wurde nach Runde 1
bereits auf Ich-Perspektive/Motivation umgestellt — das ist der richtige Schritt für die
Vision-Ebene. Aber: Kein Abschnitt in beiden Dokumenten sagt explizit, dass Begriffe wie
"Evaluation Profile", "Regel", "Preset" **reine Architektursprache** sind und in der
Produktoberfläche nicht auftauchen dürfen. Product Bible Abschnitt 7 z. B. formuliert
"Goals — Zielwerte und Zielfortschritt kommen vom aktiven Profile" — technisch korrekt, aber
ohne Gegenprobe, wie das für Nutzer:innen aussieht (vermutlich: "Ziel: Gewicht verlieren",
nie "Profil: Weight Loss"). Ohne diese Trennung besteht das Risiko, dass eine spätere
Implementierung die interne Terminologie ungefiltert in UI-Texte übernimmt.

### 2.2 Ist die Motivation dauerhaft stabil? Was passiert mit historischen Bewertungen bei Profilwechsel?

Teilweise beantwortet, aber problematisch platziert. Product Bible Abschnitt 8, Punkt 4,
sagt bereits: "Ein Wechsel des aktiven Profils muss **rückwirkend** auf bestehende
Journaldaten anwendbar sein (Neubewertung historischer Tage), ohne erneute Erfassung." Das
ist faktisch schon eine Antwort auf die gestellte Frage — aber:

1. Sie steht als **Erweiterbarkeits-Anforderung** (Abschnitt 8: "Erweiterbarkeit: Neue
   Profile und Regeln ohne Änderung des Logging-Kerns"), nicht als bewusst getroffene
   **Produktentscheidung** mit Alternative und Begründung.
2. Die Alternative wird nirgends diskutiert: Statt globaler rückwirkender Neubewertung
   (heutiges Profil bewertet auch vergangene Tage neu) wäre auch eine
   **periodengebundene Bewertung** denkbar (der Januar-Tag wird weiterhin nach dem im
   Januar aktiven Profil bewertet, nicht nach dem im März aktiven). Beispiel: Jemand
   wechselt im März von Weight Loss zu Muscle Gain — soll die Rückschau auf Januar dann
   rückwirkend so aussehen, als sei Januar bereits eine Aufbauphase gewesen? Das kann
   gewollt sein (einfacher, konsistent mit "Journal ist neutral, Bewertung ist immer
   aktuell") oder unerwünscht (Nutzer verliert den historischen Kontext, in dem eine
   Entscheidung damals sinnvoll war).
3. Die aktuelle Faustregel in Product Bible Abschnitt 3 ("Evaluation-Daten müssen aus
   Journal + aktivem Profile reproduzierbar sein") schließt eine periodengebundene
   Bewertung nicht zwingend aus — dafür müsste lediglich "welches Profil war an Tag X
   aktiv" als **Faktum** (nicht als Bewertung) im Journal-Kontext mitgeführt werden. Das
   wäre kein Bruch der Statelessness-Regel, sondern eine reine Historiendaten-Frage, die
   aber bisher gar nicht als Option benannt ist.

Diese Frage sollte als bewusste, benannte Produktentscheidung behandelt werden, nicht als
Nebensatz in einer Erweiterbarkeits-Anforderung entschieden bleiben.

### 2.3 Ist die Engine wirklich evidenzbasiert — verändert ein Profil niemals Fakten?

Inhaltlich ja, bereits an zwei Stellen verankert: Product Bible Abschnitt 2 ("Zentrale
Regel: Die Evaluation Engine liest Journaldaten, sie besitzt sie nicht... darf
Journaldaten nicht verändern, löschen oder duplizieren") und Abschnitt 4 ("Was ein Profile
niemals darf: Journaldaten schreiben, löschen oder umformen"). Der Sache nach ist die Frage
also bereits positiv beantwortet.

Was fehlt: die von dir vorgeschlagene Prominenz. Aktuell steht dieses Prinzip als eine
Regel unter mehreren, mittig im Dokument, ohne konkretes Beispiel. Ein "100 g Haferflocken
bleiben immer 100 g Haferflocken, unabhängig vom aktiven Profil"-Beispiel würde das Prinzip
sofort greifbar machen und eignet sich, um es als **Prinzip 0** vor die restliche Struktur
zu stellen — sowohl im Founding Brief (vor oder in Abschnitt 5, Kernprinzip) als auch in der
Product Bible (vor Abschnitt 2).

### 2.4 Wie entstehen neue Profile — ist die Tür für Arzt/Trainer/Community/Wissenschaft/KI offen?

Nicht versperrt, aber auch nicht vorgesehen. Product Bible Abschnitt 4, "Profil-Metadaten",
kennt aktuell nur `Typ: Preset (kuratiert) oder Custom (nutzerkomponiert)` — ein binäres
Feld. Die genannten Fälle passen in keine der beiden Kategorien sauber hinein:

- Ein **Trainer-erstelltes Profil für einen bestimmten Klienten** ist weder von Zera
  kuratiert (Preset) noch vom Nutzer selbst komponiert (Custom) — es ist
  drittautorisiert, aber nicht selbst erstellt.
- Ein **Arzt-erstelltes Profil** hätte vermutlich andere Vertrauens-/Haftungsanforderungen
  als ein Community-Profil oder ein KI-generiertes Profil — diese Unterscheidung fehlt in
  den Profil-Metadaten komplett.

Das binäre Preset/Custom-Feld sollte um eine orthogonale **Herkunfts-/Vertrauensdimension**
erweitert werden (Kuratiert intern, Nutzer, Fachperson, Community, Wissenschaftlich validiert,
KI-generiert o. ä.) — nicht um sie jetzt vollständig auszudefinieren, sondern um
sicherzustellen, dass das aktuelle Schema diese Fälle später nicht ausschließt. Das betrifft
auch die bestehende Cholesterol-Focus-Warnung ("kein Ersatz für ärztliche Beratung", Abschnitt 5) — ein tatsächlich _arzt-autorisiertes_ Profil wäre ein qualitativ anderer Fall als diese
Warnung heute abdeckt.

### 2.5 Ist die Grenze zwischen Journal und Food Catalog sauber gezogen?

Nein — das ist der wichtigste Fund dieser Runde, und die Kritik ist berechtigt. Nach Runde 1
wurde der Food-Catalog-Gedanke zwar eingeführt (Product Bible Abschnitt 3, Zeile
"Lebensmittel-intrinsische Zusatzdaten | Journal (**Food-Catalog-Schicht**)"), aber er wurde
als **Unterpunkt des Journals** modelliert, nicht als eigene dritte Schicht. Das
vorgeschlagene Modell

```text
Food Catalog
        │
        ▼
Journal
        │
        ▼
Evaluation Engine
```

ist sauberer und trifft sich außerdem mit der bestehenden Code-Realität: Food-Auflösung
(BLS/OFF/USDA, `CanonicalFood.ts`, Resolver) ist im Code bereits ein eigenständiger Baum,
getrennt von der Journal-Persistenz (`FoodEntry`, `PersistedFoodEntryRepository`) — das
Konzept würde damit nur nachvollziehen, was strukturell schon existiert, statt etwas neu zu
erfinden. Konkret ließe sich Abschnitt 3 der Product Bible sauberer gliedern:

- **Food Catalog:** objektive Lebensmitteleigenschaften — Makros, Mikros,
  Lebensmittelgruppen, Fettsäuren, Portionshinweise. Unabhängig von jedem einzelnen
  Journal-Eintrag oder Nutzer.
- **Journal:** wer/wann/wie viel — ein Journal-Eintrag referenziert einen
  Food-Catalog-Eintrag plus Menge, Zeitpunkt, Nutzer, Korrekturen.
- **Evaluation Engine:** ausschließlich Interpretation, wie bisher.

Die aktuelle Tabellenzeile "Aufgelöste Fakten" (Product Bible Abschnitt 3) vermischt beide
Ebenen (das Lebensmittel selbst vs. die konkrete Journal-Instanz davon) und sollte in dieser
Überarbeitung aufgeteilt werden.

---

## 3. Bewertung der "letzten Empfehlung" (Tier-Phasen-Restrukturierung)

Der Vorschlag

1. Nutrition Evaluation Foundation
2. Journal Domain
3. Saved Meals Domain
4. Goals & Evaluation
5. Dashboard & Insights

ist inhaltlich stimmig mit dem überarbeiteten Konzept: Journal und Saved Meals sind
Datendomänen (mit dem in Frage 5 vorgeschlagenen Food Catalog als dritter, noch nicht
genannter Datendomäne darunter), Goals und Dashboard sind Ausprägungen der Evaluation
Engine. Das spiegelt die Architektur besser als die bisherige flache Tier-1-Liste.

Dieser Punkt betrifft jedoch `ROADMAP.md`, nicht die beiden Konzeptdokumente selbst — er
gehört zur **Zerlegung nach Freigabe**, nicht zur Freigabe-Grundlage. Empfehlung: nach
Freigabe von Founding Brief/Product Bible in `ROADMAP.md` umsetzen (inkl. Food Catalog als
eigener, expliziter erster Baustein, falls Frage 5 übernommen wird), nicht vorher.

---

## 4. Empfehlung

**Nicht freigeben in aktueller Fassung.** Für eine dritte Runde bzw. vor Freigabe werden
fünf konkrete Änderungen vorgeschlagen:

1. Neuer Abschnitt "Interne Architektur vs. Produktoberfläche" mit expliziter
   Begriffs-Gegenüberstellung (intern: Evaluation Profile/Regel/Preset ↔ produktseitig:
   Ziel/Motivation/Empfehlung), inkl. der expliziten Aussage "Nutzer wählt nie ein
   technisches Profil, sondern ein Ziel."
2. Profilwechsel-Historie als **explizite, benannte Produktentscheidung** ausformulieren
   (nicht als Nebensatz in der Erweiterbarkeits-Anforderung): entweder rückwirkende
   Neubewertung bewusst begründen, oder als offene Frage mit beiden Optionen
   (rückwirkend vs. periodengebunden) in Abschnitt 10 führen.
3. "Profile verändert nie Fakten" als **Prinzip 0** vor die bestehende Struktur stellen,
   mit konkretem Beispiel (100 g Haferflocken), in beiden Dokumenten.
4. Profil-Metadaten um eine Herkunfts-/Vertrauensdimension erweitern (Platz vorsehen, nicht
   abschließend spezifizieren) + entsprechende offene Frage ergänzen.
5. Food Catalog als **eigene, dritte Schicht** einziehen (Food Catalog → Journal →
   Evaluation Engine), Abschnitt 3 der Product Bible entsprechend in drei statt zwei
   Zuständigkeitsebenen aufteilen; Architekturdiagramm in Abschnitt 2 erweitern.

Diese Überarbeitung wird hier bewusst **nicht** automatisch vorgenommen — passend zum
Review-only-Vorgehen dieser Runde. Rückmeldung zur weiteren Vorgehensweise steht aus.
