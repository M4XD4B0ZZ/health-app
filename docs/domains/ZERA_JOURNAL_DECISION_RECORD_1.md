# Zera — Journal Decision Record 1: Was darf ein Journal-Eintrag sein?

Status: `accepted` — fachliche Autorität für die Journal Domain
Ebene: Domänen-Entscheidung (unterhalb
[`ZERA_JOURNAL_DOMAIN_MODEL.md`](./ZERA_JOURNAL_DOMAIN_MODEL.md), oberhalb konkreter
`ROADMAP.md`-Implementierungstasks)
Voraussetzung: [`ZERA_FOUNDING_BRIEF.md`](../vision/ZERA_FOUNDING_BRIEF.md) (Prinzip 0),
[`ZERA_PRODUCT_BIBLE.md`](../vision/ZERA_PRODUCT_BIBLE.md) (Abschnitt 2a: Variante B),
[`ZERA_JOURNAL_DOMAIN_MODEL.md`](./ZERA_JOURNAL_DOMAIN_MODEL.md) (Abschnitt 4: die vier
Spannungen, die dieses Dokument entscheidet)

> **Freigabe:** Dieses Dokument ist ab sofort fachliche Autorität für die Journal Domain —
> künftige Journal-Implementierungstasks werden an ihm gemessen. `accepted` bedeutet
> **nicht** `final`: Änderungen erfordern einen bewussten Review-/Revisionsprozess, keine
> stillen Edits.

---

## 1. Zweck und Geltungsbereich

Dieses Dokument entscheidet die vier in der Journal Domain Model (Abschnitt 4) bewusst
offen gelassenen Spannungen zwischen dem akzeptierten Konzept (Prinzip 0,
Food Catalog → Journal → Evaluation Engine) und der heutigen `FoodEntry`-Implementierung.

Dieses Dokument ist **kein Implementierungsplan**. Es enthält:

- keine Codeänderungen,
- keine `ROADMAP.md`-Task-Zerlegung,
- kein Datenbankschema oder Migrationsskript.

Es legt ausschließlich die fachlichen Entscheidungen fest, an denen sich eine spätere
Implementierung ausrichten muss.

---

## 2. Entscheidung 1: Mutation vs. Historie → Korrektur überschreibt, aber protokolliert

**Entscheidung:** Ein Journal-Eintrag bleibt korrigierbar. Eine Korrektur überschreibt den
aktuellen Fakt (eine gültige Version pro Eintrag, kein Event-Sourcing). Jede Änderung und
jede Löschung schreibt zusätzlich einen unveränderlichen Korrektur-Log-Eintrag
(`{timestamp, vorherigeWerte, ausgelöstDurch}`). Löschen wird Soft-Delete (Tombstone) statt
Hard-Delete.

**Präzisierung:** Das Correction Log ist im MVP **primär internes Audit-/Undo-Fundament**,
nicht automatisch schon eine sichtbare Änderungshistorie in der Nutzeroberfläche. Ob und
wie eine "Änderungshistorie anzeigen"-Funktion später auf diesem Log aufbaut, ist eine
eigene, spätere UX-Entscheidung — dieses Dokument verpflichtet nur zum Mitschreiben des
Logs, nicht zu dessen Anzeige.

**Erwogene Alternativen:**

- Volles Event-Sourcing (jede Änderung als eigenständiger Fakt, aktueller Stand als
  Projektion) — verworfen: zu aufwändig für MVP, keine erkennbare Notwendigkeit.
- Reines stilles Überschreiben ohne Log (heutiger Zustand) — verworfen: keine
  Nachvollziehbarkeit, keine Undo-Fähigkeit, keine Grundlage für Entscheidung 3.
- Entry-Supersession-Kette (neuer Eintrag verweist auf abgelösten alten Eintrag) —
  verworfen für MVP: unnötige Komplexität gegenüber einem einfachen Log.

**Auswirkung auf Prinzip 0:** Konform. Prinzip 0 betrifft die Evaluation Engine, nicht
Nutzerkorrekturen an Fehlerfassungen. Das Log stärkt die Nachvollziehbarkeit des aktuellen
Fakts.

**Auswirkung auf rückwirkende Neubewertung (Variante B):** Neutral. Variante B bewertet den
jeweils aktuellen Fakt neu — unabhängig davon, ob er zwischenzeitlich korrigiert wurde.

**Auswirkung auf bestehenden Code:** Additive Änderung an
`EditFoodEntryFromNaturalLanguageUseCase`, `ApplyNaturalLanguageEditUseCase` und
`DeleteFoodEntryUseCase` (Log-Eintrag ergänzen, Hard-Delete durch Tombstone ersetzen).
Neues optionales Feld, keine breaking Migration bestehender Daten.

---

## 3. Entscheidung 2: Silent Correction Merge → sichtbar, umkehrbar, 2-Minuten-Fenster

**Entscheidung:** Die automatische Zusammenführung (`findCorrectionCandidate`) bleibt
grundsätzlich bestehen (Zero-Friction-Priorität bleibt gewahrt), wird aber:

1. **sichtbar** gemacht (nicht-blockierende UI-Rückmeldung unmittelbar nach dem Merge, z. B.
   "Toast auf 300 g aktualisiert"),
2. **umkehrbar** gemacht (Undo-Aktion auf derselben Rückmeldung),
3. im Correction Log aus Entscheidung 1 protokolliert, mit Kennzeichnung
   "systemseitig ausgelöst" (unterscheidbar von einer expliziten Nutzerkorrektur),
4. auf ein deutlich engeres Zeitfenster begrenzt.

**Präzisierung:** Das Zeitfenster startet im MVP konservativ bei **2 Minuten** (nicht
2–5 Minuten wie im Vorschlag). Ein größeres Fenster (bis hin zu den bisherigen 30 Minuten)
kann sich wie eine nachträgliche stille Veränderung anfühlen; 2 Minuten deckt den Fall "ich
habe mich gerade eben vertippt" ab, ohne in "das System verändert etwas, das ich vor einer
Weile erfasst habe" umzuschlagen. Eine spätere Anpassung erfolgt datengetrieben aus dem
Correction Log (Entscheidung 1), nicht durch erneutes Raten.

**Erwogene Alternativen:**

- Status quo (still, 30 Minuten) — verworfen: genau das identifizierte Problem.
- Nur sichtbar machen, ohne Undo (ursprünglicher Vorschlag) — als schwächere Variante
  verworfen zugunsten von sichtbar **und** umkehrbar, näher an "bewusst" statt "weniger
  still".
- Blockierender Bestätigungsdialog vor jedem Merge — verworfen für MVP: verletzt die
  Zero-Friction-Priorität; vorgemerkt als mögliche spätere Eskalationsstufe, falls das
  Correction Log zeigt, dass Nutzer:innen die Undo-Funktion auffällig oft nutzen.

**Auswirkung auf Prinzip 0:** Verbessert die Konformität — aus einer stillen wird eine
sichtbare, umkehrbare, protokollierte Änderung.

**Auswirkung auf Variante B:** Keine direkte, stärkt aber das Vertrauen in die Fakten, die
Variante B neu bewertet.

**Auswirkung auf bestehenden Code:** `findCorrectionCandidate`/`isCorrectionCandidate`
bleiben strukturell erhalten; Zeitfenster-Konstante auf 2 Minuten senken; Aufruf von
`updateEntryById` um UI-Event (Undo-fähige Rückmeldung) und Log-Eintrag ergänzen.

---

## 4. Entscheidung 3: Food-Catalog-Referenz wird ergänzt, wenn vorhanden

**Entscheidung:** Ein Journal-Eintrag erhält ein optionales Feld
`foodCatalogRef: { source, sourceId, displayName, confidence }`, zusätzlich zum bereits
bestehenden eingefrorenen Makro-Snapshot (künftig explizit als `nutritionSnapshot: { kcal,
protein, carbs, fat }` benannt statt loser Top-Level-Felder). `foodCatalogRef` wird gesetzt,
wenn der Resolver tatsächlich eine Food-Catalog-Zeile geliefert hat; es bleibt leer bei
reinem KI-Fallback oder manueller Eingabe ohne Katalogtreffer.

`source`/`sourceId` verweisen auf eine **stabile Identität**, nicht auf eine
"Katalog-Version" — Versionierung des Food Catalog selbst ist explizit nicht Teil dieser
Entscheidung (siehe Abschnitt 7).

**Erwogene Alternativen:**

- Verpflichtende Referenz für jeden Eintrag — verworfen: nicht immer verfügbar
  (KI-Fallback/manuelle Eingabe ohne Katalogtreffer).
- Katalog-Versionierung jetzt mitbauen — verworfen: gehört zur späteren, eigenständigen
  Food-Catalog-Domain, hier verfrüht.

**Auswirkung auf Prinzip 0:** Stärkt es direkt — die Referenz ändert keine eingefrorenen
Fakten, sie ermöglicht nur spätere Anreicherung mit zusätzlichen Food-Catalog-Eigenschaften.

**Auswirkung auf Variante B:** Der wichtigste Hebel dieser Entscheidungsrunde. Ohne
Referenz ist Variante B nur für ursprünglich erfasste Makros möglich. Mit Referenz wird sie
auch für später hinzukommende Food-Catalog-Eigenschaften möglich (z. B.
Lebensmittelgruppen-Klassifikation für ein künftiges Mediterranean-Profile).

**Auswirkung auf bestehenden Code:** Lokal begrenzt.
`LogFoodFromRawInputUseCase.resolveCanonicalFood()` muss aufhören, `id`/`source`/`sourceId`
wegzuwerfen (Daten liegen zum Zeitpunkt des Aufrufs bereits vor). `SerializedFoodEntry`
erhält ein neues optionales Feld, abwärtskompatibel zu bestehenden persistierten Einträgen.
**Abhängig von Entscheidung 4** (siehe unten) für die konkrete Bedeutung von
`source`/`sourceId`.

---

## 5. Entscheidung 4: CanonicalFood-Konsolidierung — eng begrenzt

**Entscheidung:** Vor Entscheidung 3 wird eine eng begrenzte "Food Catalog Identity
Cleanup"-Vorarbeit durchgeführt: Zusammenführung/Umbenennung der bestehenden, teils
gleichnamigen `CanonicalFood`-Typen (`FoodCatalogSource.ts`, `FoodCatalogTypes.ts`,
`catalog/CanonicalFood.ts`) auf eine einzige, eindeutige Identität. Ausdrücklich **keine**
neue Funktionalität (keine Lebensmittelgruppen, NOVA, GI, Allergene — das bleibt eigene,
spätere Food-Catalog-Domain-Arbeit gemäß Product Bible).

**Erwogene Alternativen:**

- Vollständiger Food-Catalog-Domain-Entwurf jetzt — verworfen: sprengt den Rahmen, blockiert
  die Journal Domain unnötig lange.
- Konsolidierung überspringen, Entscheidung 3 auf dem heutigen, mehrdeutigen Zustand
  aufbauen — verworfen: die neue Referenz stünde von Anfang an auf brüchigem Fundament.

**Auswirkung auf Prinzip 0:** Indirekt — reduziert das Risiko einer mehrdeutigen Referenz
in Entscheidung 3.

**Auswirkung auf Variante B:** Indirekter Ermöglicher für spätere Katalog-Anreicherung.

**Auswirkung auf bestehenden Code:** Mechanisches Refactoring über die drei genannten
Dateien und ihre Aufrufstellen (Resolver-Services, Alias-Erkennung) — moderater Umfang,
geringes architektonisches Risiko, abgesichert durch die bestehenden 717 Tests.

---

## 6. Future Compatibility Principle

Als generalisierende Regel über die vier Einzelentscheidungen hinaus, mit Blick auf
absehbare künftige Erweiterungen (Vitamine, NOVA, Allergene, CO₂/Nachhaltigkeit u. Ä.):

> **Journal-Einträge dürfen in Zukunft um neue optionale Fakten ergänzt werden (z. B.
> weitere Food-Catalog-Referenzen oder zusätzliche Metadaten). Bereits gespeicherte Fakten
> dürfen dadurch jedoch niemals ihre ursprüngliche Bedeutung verlieren oder ungültig
> werden.**

Kurzform: **Neue Informationen dürfen ergänzt werden. Bereits gespeicherte Fakten dürfen
dadurch nicht umgedeutet werden.**

Das ist keine fünfte, eigenständige Entscheidung, sondern die explizite Verallgemeinerung
dessen, was `foodCatalogRef` (Entscheidung 3) und das Correction Log (Entscheidung 1)
bereits demonstrieren: Erweiterung geschieht durch **Ergänzung**, nie durch rückwirkende
**Umdeutung**. Jedes künftige neue optionale Feld auf `FoodEntry` muss so entworfen sein,
dass sein Fehlen bei älteren Einträgen ein gültiger, unveränderter Zustand bleibt — nie ein
Migrationszwang oder eine implizite Neuinterpretation des ursprünglichen Fakts. Das ist
eine direkte Verlängerung von Prinzip 0 in die Journal Domain hinein.

---

## 7. Umsetzungsreihenfolge

1. **Food Catalog Identity Cleanup** (Entscheidung 4) — Voraussetzung für Entscheidung 3,
   schnell, mechanisch.
2. **Korrektur-Modell** (Entscheidungen 1+2 zusammen) — Correction Log + sichtbarer,
   umkehrbarer, auf 2 Minuten begrenzter Auto-Merge. Unabhängig von Schritt 1, hier aus
   Fokus-Gründen danach sequenziert.
3. **Food-Catalog-Referenz auf Journal-Einträgen** (Entscheidung 3) — abhängig von Schritt 1.
4. Erst danach: konkrete `ROADMAP.md`-Tasks für die Journal Domain formulieren — und damit
   auch die davon abhängigen Bereiche entblocken, die auf der Journal-Eintragsform aufbauen.

---

## 8. Was dieses Dokument nicht entscheidet

- Keine Katalog-Versionierung (wann/ob sich ein referenzierter Food-Catalog-Eintrag
  rückwirkend ändern darf) — eigene, spätere Food-Catalog-Domain-Frage.
- Keine vollständige Food-Catalog-Domain (Lebensmittelgruppen, NOVA, GI, Allergene).
- Keine UI-Gestaltung der Korrektur-/Undo-Rückmeldung (Wording, Platzierung, Timing) —
  Implementierungsdetail einer späteren Task.
- Keine Entscheidung, ob/wann das Correction Log zu einer sichtbaren
  Änderungshistorie in der Nutzeroberfläche ausgebaut wird (siehe Präzisierung in
  Abschnitt 2).
- Keine `ROADMAP.md`-Task-IDs oder Implementierungsplanung — folgt erst nach Freigabe
  dieses Dokuments.
