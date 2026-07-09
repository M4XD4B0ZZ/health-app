# Zera — Journal Domain: Was ist ein Journal-Eintrag?

Status: `draft` — erste fachliche Grundlage der Journal Domain, noch nicht freigegeben
Ebene: Domänenmodell (unterhalb der Product Bible, oberhalb konkreter
`ROADMAP.md`-Implementierungstasks)
Voraussetzung: [`ZERA_FOUNDING_BRIEF.md`](../vision/ZERA_FOUNDING_BRIEF.md) (Prinzip 0,
Drei-Schichten-Modell),
[`ZERA_PRODUCT_BIBLE.md`](../vision/ZERA_PRODUCT_BIBLE.md) (Abschnitt 3: Datenverantwortung,
Abschnitt 6: profilunabhängige App-Teile)

---

## 1. Zweck dieses Dokuments

Dies ist die erste fachliche Frage der Journal Domain (`ROADMAP.md`): **Was ist ein
Journal-Eintrag in Zera?** — nicht als UI-Frage, nicht als Datenbankschema, sondern als
Domänenbegriff.

Anders als die beiden Vision-Dokumente entsteht dieses Dokument **nicht im luftleeren Raum**:
Zera hat bereits einen funktionierenden, gut getesteten Journal-Kern (`FoodEntry`,
P1-001 bis P1-005, 717 grüne Tests). Die Aufgabe hier ist nicht, eine Wunscharchitektur zu
erfinden, sondern das akzeptierte Konzept (Prinzip 0, Food Catalog → Journal → Evaluation
Engine) mit der bestehenden Code-Realität abzugleichen — genau wie sich das
Drei-Schichten-Modell in Review R2 als Formalisierung von bereits Existierendem
herausstellte, nicht als Neuerfindung.

Dieses Dokument ist **kein Implementierungsplan**. Es enthält kein Datenbankschema, keine
Migration, keine konkreten TypeScript-Interfaces als Vorgabe — nur das fachliche Modell und
die Spannungen, die vor einer Implementierung bewusst entschieden werden müssen.

---

## 2. Ausgangsfrage: Was ist ein Journal-Eintrag?

Nach Prinzip 0 und dem Drei-Schichten-Modell (Founding Brief Abschnitt 5) ist ein
Journal-Eintrag die atomare Antwort auf genau eine Frage:

> **Was wurde von wem, wann, in welcher Menge gegessen — bezogen auf welches
> Food-Catalog-Lebensmittel?**

Ein Journal-Eintrag ist **kein**:

- Bewertungsobjekt (keine Aussage darüber, ob die Wahl "gut" oder "schlecht" war)
- Eigentümer von Lebensmitteleigenschaften (Makros, Lebensmittelgruppen etc. gehören dem
  Food Catalog, siehe Abschnitt 4.3)
- Zielwert-Träger (Kalorienziele, Makro-Korridore gehören der Evaluation Engine)

Ein Journal-Eintrag ist stattdessen ein **Faktum mit Zeitstempel**, das auf einen
Food-Catalog-Eintrag verweist und eine Menge dazu angibt.

---

## 3. Was schon gut zum Zielbild passt (Ist-Zustand-Abgleich)

Die Recherche des bestehenden `FoodEntry`-Modells
(`src/features/nutrition/domain/models/NutritionTypes.ts`) zeigt, dass mehrere
Kernentscheidungen bereits im Sinne des akzeptierten Konzepts getroffen wurden, ohne dass
es damals so benannt war:

- **Gruppierung ist bereits flach und modellunabhängig.** `groupId`/`groupLabel`
  (P1-003C) sind einfache Geschwisterfelder auf mehreren `FoodEntry`-Zeilen, es gibt keine
  eigene "Meal"-Elternentität. Das passt zum Prinzip, dass eine Gruppe nur eine
  Anzeige-Projektion über flache Fakten ist, keine eigene Bewertungsebene.
- **Saved Meals sind bereits reine Vorlagen.** `LogSavedMealToDateUseCase` expandiert eine
  `SavedMealTemplate` bei jeder Nutzung in frische, unabhängige `FoodEntry`-Zeilen; es gibt
  keine Rückreferenz von einem Eintrag zu seiner Vorlage. Das entspricht exakt Product
  Bible Abschnitt 6 ("Saved Meals als Erfassungs-Vorlagen... kein Bewertungsobjekt").
- **Makros werden zum Erfassungszeitpunkt eingefroren, nicht live nachgeschlagen.**
  `calcBreakdown.per100g` + `gramsUsed` + `multiplier` machen die Berechnung nachvollziehbar
  und reproduzierbar — im Sinne von Prinzip 0 ändert sich ein einmal geloggter Fakt nicht
  rückwirkend, nur weil sich z. B. eine BLS-Quelle später aktualisiert. Das ist im Kern
  bereits faktentreu.
- **Zero-Macro-Blocker verhindert bereits "leere" Fakten.** Kein Eintrag mit `calories <= 0`
  wird je persistiert — ein bestehender Qualitätsstandard für Fakten.

---

## 4. Konkrete Spannungen zum akzeptierten Konzept

Vier Punkte im heutigen Code stehen in echter Spannung zu Prinzip 0 / dem
Drei-Schichten-Modell. Diese werden hier **bewusst nicht entschieden** — sie sind der
eigentliche Kern dieses ersten Domänen-Reviews.

### 4.1 Mutation statt unveränderlicher Fakten

`EditFoodEntryFromNaturalLanguageUseCase`, `ApplyNaturalLanguageEditUseCase` und
`DeleteFoodEntryUseCase` verändern bzw. löschen bestehende `FoodEntry`-Zeilen **in place**
(gleiche `id`, überschriebene Felder, hartes Löschen ohne Tombstone). Es gibt kein
Ereignis-/Versionsprotokoll — nur `lastModifiedAt` als schwacher Hinweis, dass etwas
passiert ist, aber nicht, was vorher galt.

**Spannung:** Prinzip 0 sagt "Fakten ändern sich nicht rückwirkend durch Interpretation" —
das bezieht sich auf die Evaluation Engine. Es beantwortet aber nicht, was mit einem Fakt
passiert, wenn sich herausstellt, dass er **falsch erfasst** wurde (z. B. Tippfehler bei der
Menge). Zwei denkbare Philosophien:

- **Korrektur überschreibt** (heutiger Zustand): Ein falsch erfasster Fakt wird durch den
  richtigen ersetzt, die Historie kennt nur den aktuellen Stand.
- **Korrektur ist ein neuer Fakt** (Event-Modell): Der ursprüngliche Eintrag bleibt
  sichtbar/nachvollziehbar, eine Korrektur ist ein zweites, verknüpftes Faktum
  ("ursprünglich erfasst als X, korrigiert zu Y um HH:MM"). Näher an "Journal ist
  Historie", aufwändiger.

### 4.2 Silent-Correction-Merge (30-Minuten-Fenster)

`LogFoodFromRawInputUseCase.findCorrectionCandidate` erkennt automatisch, wenn ein neuer
Log-Vorgang innerhalb von 30 Minuten denselben Food-Key trifft und der vorherige Eintrag auf
einer Annahme (nicht auf expliziten Gramm-Angaben) beruhte — und **überschreibt den alten
Eintrag automatisch**, ohne dass der Nutzer eine explizite Korrektur-Aktion ausgelöst hat.

**Spannung:** Das ist strukturell dasselbe Problem wie 4.1, aber verschärft: Die
Überschreibung geschieht **implizit**, aus einer Heuristik heraus, nicht aus einer
bewussten Nutzerhandlung. Für ein Journal, das als verlässliche Fakten-Historie gelten soll
(insbesondere unter Variante B, wo alte Tage jederzeit neu bewertet werden können — Product
Bible Abschnitt 2a), ist eine unsichtbare rückwirkende Veränderung eines Fakts ohne
Nutzeraktion ein Vertrauensrisiko, unabhängig davon, wie Frage 4.1 beantwortet wird.

### 4.3 Keine belastbare Food-Catalog-Referenz

`FoodEntry` hat **kein** Feld, das auf einen konkreten Food-Catalog-Eintrag verweist. Der
Resolver liefert intern ein `CanonicalFood` mit `id`/`source`/`sourceId`, aber
`resolveCanonicalFood()` reduziert das sofort auf `{ per100g }` — die Katalog-Identität wird
verworfen, bevor sie den Journal-Eintrag erreicht. Übrig bleiben nur lose,
nicht-referenzielle Herkunftsangaben (`sourceType`, `resolverDecisionSummary.source`,
`chosenName`).

**Spannung:** Das Drei-Schichten-Modell sagt "Journal referenziert Food Catalog, dupliziert
dessen Daten aber nicht" (Product Bible Abschnitt 3). Heute ist es umgekehrt: reine
Duplikation (eingefrorene Makros), keine Referenz. Das ist für die reinen Makro-Fakten
unproblematisch (siehe 3. oben — Einfrieren ist sogar erwünscht). Es wird aber zum Problem,
sobald ein künftiges Evaluation Profile zusätzliche Food-Catalog-Daten braucht, die zum
Erfassungszeitpunkt noch gar nicht existierten (z. B. Lebensmittelgruppen-Klassifikation für
ein Mediterranean-Profile, siehe Product Bible Abschnitt 5) — ohne Referenz lässt sich ein
alter Eintrag nicht nachträglich mit neuen Food-Catalog-Eigenschaften anreichern, selbst
wenn die Menge/Makros unverändert bleiben sollen.

**Zu klären:** Sollte ein Journal-Eintrag zusätzlich zum eingefrorenen Makro-Snapshot eine
optionale Food-Catalog-Referenz (ID) führen — nicht um die Fakten zu ersetzen, sondern um
später zusätzliche, damals nicht vorhandene Food-Catalog-Eigenschaften nachschlagen zu
können, ohne den ursprünglichen Fakt zu verändern?

### 4.4 Fragmentierte Food-Catalog-Schicht im Code

Es existieren aktuell **drei verschiedene, gleichnamige oder ähnlich benannte** Konzepte:

1. `domain/catalog/FoodCatalogSource.ts` → `CanonicalFood { id, name, macrosPer100g,
source, sourceId }` — der eigentliche, quellen-übergreifende Katalogeintrag.
2. `domain/models/FoodCatalogTypes.ts` → ein zweites, einfacheres `CanonicalFood { id,
displayName, per100g }` für den älteren deterministischen Suchpfad.
3. `domain/catalog/CanonicalFood.ts` → trotz identischen Dateinamens etwas völlig anderes:
   eine statische DE/EN-Alias-Wörterliste (`CanonicalFoodEntity`) für Textnormalisierung,
   keine Makro-tragende Katalogzeile.

**Spannung:** Das Drei-Schichten-Modell benennt "Food Catalog" als eine einzelne,
eigenständige Schicht. Im Code ist diese Schicht heute in drei nicht klar abgegrenzte
Konzepte zersplittert, zwei davon mit demselben Typnamen `CanonicalFood`. Das ist kein
Bruch mit dem Konzept, aber eine Konsolidierungsarbeit, die ansteht, bevor "Food Catalog"
als klar adressierbare Schicht (z. B. für 4.3) existieren kann.

---

## 5. Einordnung: Resolutions-Metadaten sind keine Bewertung

Ein möglicher Einwand: `FoodEntry` enthält bereits heute `confidenceScore`,
`confidenceReason`, `assumptions`, `resolverDecisionSummary`, `logDecision` — ist das nicht
schon "Interpretation" im Journal, ein Verstoß gegen Prinzip 0?

**Einordnung:** Nein — diese Felder beschreiben, **wie sicher/nachvollziehbar der Fakt
selbst zustande kam** ("wir haben 'Ei' anhand von BLS mit Konfidenz 0.92 aufgelöst"), nicht,
**ob die Wahl gut war** ("Ei war eine gute Entscheidung"). Das erste ist
Erfassungsqualität (gehört zum Journal), das zweite wäre Bewertung (gehört zur Evaluation
Engine). Diese Trennung sollte im künftigen Domänenmodell explizit benannt bleiben, damit
sie nicht versehentlich verwischt, wenn neue Felder ergänzt werden.

---

## 6. Vorschlag: Fachliche Kernstruktur eines Journal-Eintrags

Ohne Anspruch auf ein finales Schema — als Diskussionsgrundlage, gruppiert nach fachlicher
Verantwortung statt nach heutigem flachen Feld-Set:

- **Identität:** eindeutige Kennung, Erfassungszeitpunkt.
- **Food-Catalog-Bezug:** eingefrorener Makro-Snapshot (wie heute) **plus** optionale
  Referenz auf den Food-Catalog-Eintrag, aus dem er stammt (offen, siehe 4.3).
- **Menge:** eine kanonische Gramm-Angabe mit Herkunfts-Reason-Code (`EXPLICIT_GRAMS`,
  `PORTION_KNOWLEDGE_HINT`, ...) statt der heutigen drei teilweise überlappenden Felder
  (`quantityGrams`, `grams`, `calcBreakdown.gramsUsed`).
- **Korrektur-Historie:** offen, ob In-Place-Überschreibung (heutiger Zustand) oder
  nachvollziehbare Korrektur-Kette (siehe 4.1) — explizit **nicht** mehr automatisch/still
  (siehe 4.2).
- **Gruppierung:** `groupId`/`groupLabel` unverändert übernehmen — funktioniert bereits gut.
- **Erfassungsqualität (nicht Bewertung):** Konfidenz/Annahmen/Resolver-Herkunft, klar
  getrennt gehalten von allem, was später zur Evaluation Engine gehören könnte (siehe
  Abschnitt 5).

---

## 7. Was dieses Dokument nicht entscheidet

- Keine Antwort auf 4.1 (Mutation vs. Korrektur-Kette) — das ist die wichtigste offene
  Frage dieser Domäne und sollte vor jeder Implementierung explizit entschieden werden.
- Keine Antwort auf 4.2 (ob/wie der Silent-Correction-Merge erhalten bleibt).
- Keine Antwort auf 4.3 (ob eine Food-Catalog-Referenz ergänzt wird).
- Keine Migrationsstrategie für bestehende, bereits persistierte `FoodEntry`-Daten.
- Keine Aussage zur Konsolidierung der drei `CanonicalFood`-Konzepte (4.4) — das ist
  eigentlich eine Food-Catalog-Domain-Frage, wird hier nur benannt, weil sie die
  Journal-Referenzierbarkeit blockiert.

---

## 8. Nächste Schritte

1. Entscheidung zu Abschnitt 4.1–4.4 herbeiführen (vermutlich als eigene, fokussierte
   Diskussion je Punkt, nicht alle vier gleichzeitig — 4.1 und 4.2 hängen zusammen und
   sollten zuerst geklärt werden, da sie das grundlegendste Vertrauensversprechen des
   Journals betreffen).
2. Erst danach: konkrete `ROADMAP.md`-Tasks für die Journal Domain formulieren
   (Datenmodell-Änderungen, Migration, betroffene Use Cases).
3. Food-Catalog-Konsolidierung (4.4) als eigene, vorgelagerte Aufgabe einordnen — sie
   berührt auch andere Domänen (z. B. künftige Evaluation-Profile-Regeln mit
   Food-Catalog-Zusatzbedarf, Product Bible Abschnitt 5).
