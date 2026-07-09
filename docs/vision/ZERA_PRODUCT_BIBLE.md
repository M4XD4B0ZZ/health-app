# Zera — Product Bible: Evaluation Engine

Status: `draft` — überarbeitet nach Concept Review R1 und R2/R3, weiterhin nicht freigegeben
Ebene: Produkt-/Architekturkonzept (unterhalb des Founding Brief, oberhalb der
`ROADMAP.md`-Task-Zerlegung)
Voraussetzung: [`ZERA_FOUNDING_BRIEF.md`](./ZERA_FOUNDING_BRIEF.md) (Vision, Zielgruppen,
Kernprinzip)

> Revision R1: "Evaluation Model" → "Evaluation Profile" + Regel-Ebene, explizite
> Statelessness-Regel, Zuständigkeit für lebensmittel-intrinsische Zusatzdaten geklärt,
> Motivation-↔-Profil-Zuordnung ergänzt (siehe
> [`ZERA_CONCEPT_REVIEW_R1.md`](./ZERA_CONCEPT_REVIEW_R1.md)).
>
> Revision R2/R3: Food Catalog als eigenständige, dritte Architekturschicht (statt
> Journal-Unterpunkt) eingezogen; historische Neubewertung ("Variante B") als bewusste,
> begründete Produktentscheidung dokumentiert; "Evaluation Profile" als rein interne
> Architektursprache mit expliziter Produktoberflächen-Zuordnung deklariert;
> Profil-Herkunft von binär (Preset/Custom) auf eine offene Origin-Taxonomie
> (Preset/User/Professional/Community/AI) erweitert; Prinzip 0 ergänzt (siehe
> [`ZERA_CONCEPT_REVIEW_R2.md`](./ZERA_CONCEPT_REVIEW_R2.md)).

---

## 1. Zweck dieses Dokuments

Das Founding Brief beantwortet _warum_ Zera Datenerfassung und Bewertung trennt. Dieses
Dokument beantwortet _wie_ diese Trennung produktseitig aussieht — als Brücke zwischen
Vision und der späteren Zerlegung von Journal, Saved Meals, Dashboard und Goals in konkrete
`ROADMAP.md`-Tasks.

Auch dieses Dokument ist **kein Implementierungsplan**. Es definiert Verantwortlichkeiten,
Datenkategorien und Konzepte auf Produktebene — keine Datenbankschemata, keine
TypeScript-Interfaces, keine konkreten Dateien. Diese Ebene folgt erst in den späteren
P1-Tasks, nachdem dieses Konzept freigegeben ist.

---

## 2. Architekturprinzip

> **Prinzip 0 (oberstes Architekturprinzip):** Kein Evaluation Profile darf jemals Fakten
> verändern. Es interpretiert ausschließlich objektive Daten aus Food Catalog und Journal.
>
> Beispiel: 100 g Haferflocken bleiben immer 100 g Haferflocken — unabhängig davon, welches
> Profil gerade aktiv ist. Nur die _Interpretation_ dieser 100 g ändert sich.

Zera besteht aus **drei Schichten, nicht zwei**. Diese Dreiteilung ist keine Wunscharchitektur,
sondern gleicht das fachliche Modell an eine Architektur an, die im Code bereits existiert:
Food-Auflösung (BLS/OFF/USDA, Resolver, Kandidaten-Fusion) ist schon heute von der
Journal-Persistenz (`FoodEntry`) getrennt — dieses Konzept macht diese Trennung nur explizit:

```text
┌───────────────────────────────────┐
│             Food Catalog             │
│        (objektive Wahrheit)          │
│                                       │
│  Makros, Mikros, Lebensmittelgruppen,│
│  NOVA, GI, Allergene, BLS/OFF/USDA,  │
│  Herkunft, Portionsgrößen, ...       │
│                                       │
│  Kennt keinen Benutzer.              │
└───────────────────────────────────┘
                    │  liest nur
                    ▼
┌───────────────────────────────────┐
│               Journal                 │
│        (objektive Historie)          │
│                                       │
│  Wer? Wann? Wie viel?                │
│  Referenz auf Food-Catalog-Eintrag   │
│  + Menge + Zeitpunkt + Korrekturen   │
│                                       │
│  Enthält niemals "gut", "schlecht"   │
│  oder sonstige Bewertungen.          │
│  Kennt kein Evaluation Profile.      │
└───────────────────────────────────┘
                    │  liest nur
                    ▼
┌───────────────────────────────────┐
│           Evaluation Engine           │
│                                       │
│  aktives Evaluation Profile           │
│  (Origin: Preset, User, Professional,│
│   Community, AI — siehe Abschnitt 4) │
│              │                       │
│              ▼                       │
│         Regelsammlung                 │
│  ("Protein hoch", "Zucker niedrig")  │
│              │                       │
│              ▼                       │
│           Bewertung                   │
└───────────────────────────────────┘
                    │
                    ▼
       Dashboard · Goals · Insights · Reports · (später) AI Coach
```

**Food Catalog** enthält objektive, benutzerunabhängige Lebensmitteleigenschaften. **Journal**
enthält die objektive Erfassungshistorie (wer/wann/wie viel), referenziert den Food Catalog,
dupliziert dessen Daten aber nicht. **Evaluation Engine** enthält ausschließlich
Interpretation — Scores, Ziele, Hinweise, Warnungen, Dashboard, Reports, künftig AI Coach.

Ein Evaluation Profile hat eine **Origin** (Herkunft): `Preset` (von Zera kuratiert), `User`
(nutzerkomponiert — entspricht dem bisherigen "Custom Profile"), sowie die vorgesehenen,
noch nicht implementierten Herkunftskategorien `Professional` (z. B. von Arzt/Trainer
erstellt), `Community` und `AI` (algorithmisch komponiert). Details: Abschnitt 4 und 5.

Ein Profilwechsel ist ein reiner Lesekontext-Wechsel, kein Datenmigrationsschritt — siehe
Abschnitt 2a für die direkte Konsequenz daraus (historische Neubewertung).

### 2a. Historische Neubewertung: Variante B (bewusste Produktentscheidung)

Bei einem Wechsel des aktiven Evaluation Profiles gibt es zwei denkbare Philosophien:

- **Variante A (verworfen):** Vergangene Bewertungen bleiben an das damals aktive Profil
  gebunden. Ein Januar-Tag, der unter "Weight Loss" mit Score 82 bewertet wurde, bleibt bei
  82, auch nach einem späteren Wechsel zu "Muscle Gain".
- **Variante B (gewählt):** Jede Bewertung wird bei jeder Anfrage neu aus Food Catalog,
  Journal und aktivem Profile berechnet. Derselbe Januar-Tag zeigt unter "Muscle Gain"
  z. B. Score 61 — nicht weil sich die Fakten geändert hätten, sondern weil sich die
  Interpretation ändert.

**Zera wählt explizit Variante B.** Das ist keine beliebige Voreinstellung, sondern folgt
zwingend aus Prinzip 0 und der Statelessness-Formel in Abschnitt 4: Die Evaluation Engine
besitzt keinen eigenen Zustand, sie berechnet Bewertungen immer aus
`Food Catalog + Journal + Profil`. Eine an einen Zeitpunkt "eingefrorene" Bewertung wäre ein
Bewertungs-Cache außerhalb dieser Formel — genau das, was Abschnitt 4 explizit verbietet
("kein eigener Datenspeicher außerhalb des Journals").

Variante B eröffnet zusätzlich eine Produktfähigkeit, die mit Variante A nicht möglich
wäre: Nutzer:innen können jederzeit fragen "Wie hätte mein letzter Monat unter einer
mediterranen Ernährung ausgesehen?", ohne dass historische Daten dafür erneut erfasst oder
migriert werden müssten — dieselbe Food-Catalog-/Journal-Grundlage wird einfach durch ein
anderes Profil neu interpretiert (siehe die "Perspektiven"-Idee in Abschnitt 10 — dort noch
unentschieden, aber durch Variante B bereits architektonisch möglich, ohne dass die
Architektur dafür geändert werden müsste).

---

## 3. Datenverantwortung: Food Catalog / Journal / Evaluation Engine

| Datenkategorie                      | Gehört zu         | Charakter                                                                            | Beispiele                                                                |
| ----------------------------------- | ----------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Objektive Lebensmitteleigenschaften | Food Catalog      | dauerhaft, deterministisch, kennt keinen Benutzer                                    | Makros, Mikros, Lebensmittelgruppen, NOVA, GI, Allergene, Portionsgrößen |
| Rohangaben aus der Erfassung        | Journal           | dauerhaft, unveränderlich durch Profile                                              | Rohtext, Zeitpunkt, Menge/Einheit wie eingegeben                         |
| Journal-Eintrag (Referenz + Menge)  | Journal           | dauerhaft, deterministisch; referenziert Food Catalog, dupliziert dessen Daten nicht | Food-Catalog-Referenz, aufgelöste Menge in Gramm, Zeitpunkt, Nutzer      |
| Nutzer-Korrekturen                  | Journal           | dauerhaft, Teil der Fakten-Historie                                                  | Manuell angepasste Menge, korrigierte Zuordnung                          |
| Gruppierungsmetadaten               | Journal           | dauerhaft, profilunabhängig                                                          | `groupId`/`groupLabel` aus P1-003C (composite-dish)                      |
| Zielwerte/Referenzbereiche          | Evaluation Engine | profilabhängig, austauschbar                                                         | Kalorienziel, Makro-Korridor, Cholesterin-Grenzwert                      |
| Bewertungen/Scores                  | Evaluation Engine | abgeleitet, jederzeit neu berechenbar (Variante B, siehe 2a)                         | "Tag im Zielkorridor", Ampel-Status                                      |
| Insights/Hinweise                   | Evaluation Engine | abgeleitet, profilabhängig                                                           | "Zu wenig Ballaststoffe für Cholesterin-Fokus"                           |
| Fortschrittsverlauf ggü. Ziel       | Evaluation Engine | abgeleitet aus Food Catalog + Journal + aktivem Profile                              | Trendlinie Gewicht vs. Kalorienbilanz                                    |

Faustregel (dreistufig, Empfehlung aus Review R2/R3): **Ist ein Datenpunkt eine Eigenschaft
des Lebensmittels selbst, unabhängig davon, wer/wann/wie viel davon gegessen wurde, gehört
er zum Food Catalog. Beschreibt er eine konkrete Erfassungsinstanz (wer/wann/wie viel),
gehört er zum Journal. Darf er beim Löschen/Wechsel des Evaluation Profiles verschwinden,
gehört er zur Evaluation Engine.** Alles, was zur Evaluation Engine gehört, muss aus Food
Catalog plus Journal plus aktivem Profile **neu berechenbar** sein.

---

## 4. Evaluation Profile — Konzeptvertrag

Jedes Evaluation Profile folgt konzeptionell demselben Vertrag (kein Code, nur
Verantwortlichkeiten). Der Vertrag ist bewusst als strikte Ein-/Ausgabe-Formel gefasst,
damit "datengetrieben, kein eigener Speicher" nicht nur Geist, sondern explizite Regel ist:

```text
Food Catalog + Journal + Benutzerprofil + Profileinstellungen
                            │
                            ▼
   Bewertung + Insights + Warnungen + Empfehlungen + Zielerreichung
```

**Eingaben, die ein Profile erhalten darf:**

- Food-Catalog-Daten der referenzierten Lebensmittel (nur lesend) — Makros, Lebensmittelgruppen, etc.
- Journaldaten des betrachteten Zeitraums (nur lesend)
- Benutzerprofil-Basisdaten, sofern relevant (z. B. Gewicht, Aktivitätslevel für
  Kalorienbedarf — bereits vorhanden über `MetabolismCalculator`/`GoalsUseCases`)
- Profileinstellungen: die aktive Regelauswahl plus deren Parameter (z. B.
  Ziel-Cholesterin-Obergrenze für eine "Cholesterin niedrig"-Regel, eigene Makro-Ranges bei
  einem User-Profile)

**Ausgaben, die ein Profile liefern muss:**

- Bewertung (z. B. Ampel-/Fortschrittsstatus für Dashboard-Anzeige)
- Insights (kurz, nachvollziehbar, keine "stille" Bewertung ohne erklärbare Basis —
  konsistent mit dem bestehenden Determinismus-Prinzip)
- Warnungen
- Empfehlungen
- Zielerreichung (Ziel-Fortschritt für Goals-Anzeige)

**Was ein Profile niemals darf:**

- Fakten verändern (Prinzip 0) — weder Food-Catalog-Daten noch Journaldaten schreiben,
  löschen oder umformen
- **Einen eigenen Datenspeicher außerhalb des Journals führen** — kein Profil-eigener
  Cache, keine Parallel-Datenbank, keine Zwischenspeicherung, die zur Nebenwahrheit werden
  könnte. Jede Ausgabe muss bei jeder Anfrage erneut aus der obigen Formel berechenbar sein
  (siehe Abschnitt 2a).
- Voraussetzungen an das Erfassungsformat stellen (z. B. "Nutzer muss X anders eingeben,
  damit dieses Profile funktioniert") — Journal bleibt für alle Profile identisch nutzbar
- Andere Profile in ihrer Verfügbarkeit oder ihren Ergebnissen beeinflussen

**Profil-Metadaten (konzeptionell, keine Schema-Festlegung):**

- Eindeutige Kennung und Name
- **Origin** (Herkunft): `Preset` | `User` | `Professional` | `Community` | `AI`. Ersetzt
  das bisherige binäre Typ-Feld Preset/Custom (Review R1) — `User` entspricht dem in
  Abschnitt 5 beschriebenen "Custom Profile". `Professional`, `Community` und `AI` sind
  vorgesehene, aber noch nicht implementierte Herkunftskategorien (z. B. von Arzt/Trainer
  erstellt, community-geteilt, KI-generiert) — sie werden hier nur als offene Erweiterungsachse
  reserviert, nicht abschließend spezifiziert (siehe offene Fragen, Abschnitt 10).
- Zusammensetzung: welche Regeln dieses Profile aktiviert (bei `Preset` kuratiert
  vorgegeben, bei `User` vom Nutzer gewählt, bei künftigen Origins entsprechend deren
  Autor:in)
- Zielgruppenbeschreibung/Motivation (aus Founding Brief Abschnitt 6 abgeleitet)
- Reifegrad (z. B. "Kandidat", "MVP", "vollständig")

### 4a. Regel — Konzeptvertrag

Die **Regel** ist die atomare, wiederverwendbare Bewertungseinheit — nicht das Profile. Ein
Profile ist ein benanntes Bündel von Regeln, kein eigener Algorithmus. Jede Regel:

- hat eine eindeutige Kennung, einen Namen und eine kurze, nachvollziehbare
  Bewertungslogik-Beschreibung (z. B. "Protein hoch": bewertet Tagesprotein gegen einen
  Zielkorridor)
- deklariert ihren Datenbedarf über die Journal-Basisdaten hinaus, sofern vorhanden (z. B.
  Ballaststoffdaten für eine "Netto-Carbs"-Regel) — dieser Datenbedarf wird, falls
  lebensmittel-intrinsisch, im Food Catalog gedeckt (siehe Abschnitt 3), nicht von der
  Regel selbst gespeichert
- ist unabhängig von jedem konkreten Profile nutzbar und kann in mehreren Profilen
  gleichzeitig vorkommen, unabhängig von deren Origin (z. B. kann "Zucker niedrig" sowohl
  in einem Preset- als auch in einem User-Profile stecken)
- folgt demselben Statelessness-Vertrag wie ein Profile (Abschnitt 4): rein lesend,
  reproduzierbar, kein eigener Speicher

### 4b. Interne Architektur vs. Produktoberfläche

"Evaluation Profile", "Regel", "Preset", "Origin" sind **ausschließlich interne
Architektursprache**. Sie dürfen in der Produktoberfläche nicht wörtlich auftauchen.
Nutzer:innen wählen niemals ein "Profil" — sie wählen ein Ziel:

| Intern (Architektur)                   | Produktoberfläche                                             |
| -------------------------------------- | ------------------------------------------------------------- |
| Evaluation Profile                     | Ziel / Ernährungsziel / Fokus                                 |
| Preset-Origin-Profile                  | vorgeschlagenes Ziel                                          |
| User-Origin-Profile (vormals "Custom") | eigenes/individuelles Ziel                                    |
| Regel                                  | kein direktes UI-Pendant; bei eigenen Zielen ggf. "Priorität" |
| Regelsammlung                          | kein direktes UI-Pendant; ergibt sich implizit aus dem Ziel   |

Diese Tabelle legt keine finalen UI-Texte fest (das ist Implementierungsdetail, nicht Teil
dieses Dokuments) — sie legt nur fest, **dass** diese Trennung existieren muss, nicht wie
sie im Detail formuliert wird.

---

## 5. Kandidaten-Evaluation-Profiles

Diese Liste ist der initiale, bewusst kleine Kandidatensatz aus dem Founding Brief,
übersetzt in Preset-Origin-Profile (kuratierte Regel-Bündel, keine eigenen Algorithmen —
siehe Abschnitt 4/4a). Sie ist **nicht** final und **nicht** priorisiert für die
Umsetzungsreihenfolge — diese Priorisierung ist Teil der späteren Tier-1-Zerlegung.

### Evidence-based Standard (Origin: Preset)

- **Motivation (Founding Brief 6.1):** "Ich möchte mich gesünder ernähren."
- **Fokus:** Ausgewogenheit gemäß anerkannten Referenzwerten (z. B. DACH-Referenzwerte),
  keine aggressive Kalorienrestriktion.
- **Rolle:** Dient als **Default-Profile** — neutralste Bewertung, sinnvoll auch als
  Fallback, wenn (noch) kein spezifisches Profile gewählt wurde.
- **Zusätzlicher Datenbedarf:** Keiner über Food-Catalog-/Journal-Basisdaten hinaus.

### Weight Loss (Origin: Preset)

- **Motivation (Founding Brief 6.2):** "Ich möchte Gewicht verlieren."
- **Fokus:** Kaloriendefizit, Proteinerhalt zum Muskelschutz, Sättigungsaspekte.
- **Zusätzlicher Datenbedarf:** Zielgewicht/-tempo, ggf. Aktivitätslevel (bereits über
  bestehenden `MetabolismCalculator` verfügbar).

### Muscle Gain (Origin: Preset)

- **Motivation (Founding Brief 6.3):** "Ich möchte Muskeln aufbauen."
- **Fokus:** Kalorienüberschuss, Proteinverteilung über den Tag, nicht nur Tagessumme.
- **Zusätzlicher Datenbedarf:** Trainingsbezug/-frequenz (optional, spätere Ausbaustufe).

### Low Carb (Origin: Preset)

- **Motivation (Founding Brief 6.5):** "Ich folge einer bestimmten Ernährungsweise."
- **Fokus:** Kohlenhydratlimits, ggf. Netto-Kohlenhydrate.
- **Zusätzlicher Datenbedarf:** Ballaststoffdaten für Netto-Carb-Berechnung (Food Catalog,
  siehe Abschnitt 3) — abhängig von Datenqualität der Quellen (BLS/OFF/USDA), siehe offene
  Frage in Abschnitt 10.

### Mediterranean (Origin: Preset)

- **Motivation (Founding Brief 6.5):** "Ich folge einer bestimmten Ernährungsweise."
- **Fokus:** Lebensmittelgruppen-Qualität (Gemüse-/Fischanteil, Fettqualität) statt reiner
  Makro-Zielwerte.
- **Zusätzlicher Datenbedarf:** Lebensmittelgruppen-Klassifikation pro Lebensmittel (Food
  Catalog, siehe Abschnitt 3 — **nicht** profilspezifisch am Journal-Eintrag) — existiert
  aktuell nicht und wäre ein eigener Vorlauf-Task (nicht Teil dieses Dokuments).

### Cholesterol Focus (Origin: Preset)

- **Motivation (Founding Brief 6.4):** "Ich möchte meine Blutwerte verbessern."
- **Fokus:** Gesättigte Fette, Ballaststoffe, ggf. spezifische Lebensmittelgruppen.
- **Zusätzlicher Datenbedarf:** Detailliertere Fettsäure-/Ballaststoffdaten (Food Catalog,
  siehe Abschnitt 3) als aktuell durchgängig verfügbar.
- **Besonderheit:** Höchste Sorgfaltsanforderung an Nachvollziehbarkeit; explizit **kein**
  Ersatz für ärztliche Beratung — siehe offene Frage in Abschnitt 10. Ein künftiges
  `Professional`-Origin-Profile (von einer Ärztin erstellt) wäre ein qualitativ anderer Fall
  als dieses Preset und müsste eigene Vertrauens-/Verifikationsanforderungen erfüllen.

### User Profile (Origin: User, vormals "Custom Profile")

- **Motivation (Founding Brief 6.6):** "Ich habe meine eigenen Ziele."
- **Charakter:** Kein weiteres Preset, sondern der **Normalfall der Architektur**: eine frei
  vom Nutzer komponierte Regelauswahl (z. B. Protein hoch + Zucker niedrig + Salz niedrig +
  Mediterrane Gewichtung + Kalorien egal). Strukturell identisch zu einem Preset-Profile
  (Abschnitt 4), nur nutzerkomponiert statt kuratiert — löst den in Review R1
  identifizierten Widerspruch, dass freie Komposition mit festen Modell-Klassen nicht
  abbildbar war.
- **Zusätzlicher Datenbedarf:** Keiner über Food-Catalog-/Journal-Basisdaten und die von den
  gewählten Regeln jeweils deklarierten Datenbedarfe hinaus; Zielparameter kommen
  vollständig vom Nutzer.

### Zuordnung Motivation ↔ Profile

Die Zuordnung ist n:m, nicht 1:1 — eine Motivation kann mehrere Profile/Regeln berühren,
ein Profile kann mehrere Motivationen bedienen:

| Motivation (Founding Brief 6) | Passende Preset-Profile                         |
| ----------------------------- | ----------------------------------------------- |
| 6.1 Gesünder ernähren         | Evidence-based Standard                         |
| 6.2 Gewicht verlieren         | Weight Loss                                     |
| 6.3 Muskeln aufbauen          | Muscle Gain                                     |
| 6.4 Blutwerte verbessern      | Cholesterol Focus, ggf. Low-Carb-Regeln einzeln |
| 6.5 Bestimmte Ernährungsweise | Low Carb, Mediterranean                         |
| 6.6 Eigene Ziele              | User Profile (beliebige Regelkombination)       |

Weitere Origins (`Professional`, `Community`, `AI`) haben noch keine konkreten Preset-
Kandidaten — sie sind Erweiterungsachsen (Abschnitt 4), keine ausgearbeiteten Profile.

---

## 6. Profil-/Regel-unabhängige App-Teile

Diese Bereiche dürfen **niemals** Wissen über ein spezifisches Evaluation Profile oder eine
spezifische Regel enthalten, damit neue Profile/Regeln ergänzt werden können, ohne sie
anzufassen:

- **Food Catalog** (BLS/OFF/USDA-Anbindung, Kandidaten-Fusion, objektive
  Lebensmitteleigenschaften — eigene Architekturschicht, siehe Abschnitt 2/3)
- **Journal-Erfassung** (Input-Pipeline, Resolver, Portion Knowledge — der gesamte
  bisherige Tier-1-Resolver-Kern aus P1-001 bis P1-005)
- **Saved Meals als Erfassungs-Vorlagen** — eine gespeicherte Mahlzeit ist eine
  Logging-Beschleunigung, kein Bewertungsobjekt; sie muss unabhängig vom aktiven Profile
  identisch funktionieren
- **Journal-Anzeige der reinen Fakten** (was wurde wann gegessen) — unabhängig davon, ob
  überhaupt ein Evaluation Profile aktiv ist

## 7. Profil-abhängige App-Teile

Diese Bereiche lesen Food-Catalog- und Journaldaten **und** das aktive Evaluation Profile
(und dessen Regelsammlung) und werden durch Letzteres bestimmt:

- **Dashboard** — Zusammenfassung/Fortschritt gemäß aktivem Profile
- **Goals** — Zielwerte und Zielfortschritt kommen vom aktiven Profile, nicht aus einem
  festen Schema
- **Insights/Reports** — Ableitungen, die ohne ein Profile keine Bedeutung hätten
- **AI Coach (später)** — konsumiert Profil-Output, trifft aber gemäß bestehendem
  KI-Prinzip (`SSOK.md`) keine stillen Bewertungsentscheidungen selbst

---

## 8. Erweiterbarkeit: Neue Profile und Regeln ohne Änderung des Logging-Kerns

Konzeptionelle Anforderungen an künftige Erweiterbarkeit (keine Implementierungsdetails):

1. Eine neue Regel wird **registriert** — die atomare, wiederverwendbare Einheit (siehe
   Abschnitt 4a). Ein neues Profile wird als Kombination bestehender (oder neuer) Regeln
   registriert, unabhängig von seiner Origin. Beides ohne Eingriff in
   Journal-/Food-Catalog-Logik.
2. Weder eine neue Regel noch ein neues Profile darf eine Änderung an Journal- oder
   Food-Catalog-Datenerfassung/-Speicherung voraussetzen. Falls eine Regel zusätzliche
   Datenqualität benötigt (z. B. Lebensmittelgruppen für eine "Mediterrane
   Gewichtung"-Regel), ist das ein **optionaler Anreicherungs-Task auf der
   Food-Catalog-Schicht** (Abschnitt 3), der allen Profilen zugutekommt, die diese Regel
   nutzen — nicht eine profilspezifische Änderung.
3. Regeln und Profile sind untereinander **unabhängig**: Das Hinzufügen einer neuen Regel
   oder eines neuen Profils darf bestehende Profile nicht verändern.
4. Historische Neubewertung folgt Variante B — siehe Abschnitt 2a für die vollständige
   Begründung.
5. Profile jeder Origin (Preset, User, Professional, Community, AI) folgen exakt demselben
   Mechanismus — kein separater Codepfad, keine Sonderbehandlung nach Herkunft (abgesehen
   von künftigen Vertrauens-/Verifikationsstufen, siehe Abschnitt 10).

---

## 9. Auswirkung auf die vier Tier-1-Platzhalter

Zusätzlich zu den vier Platzhaltern etabliert dieses Konzept den **Food Catalog** als
eigenständige, vorgelagerte Datendomäne (Abschnitt 2/3) — er ist kein fünfter Platzhalter
im bisherigen Sinne, sondern die Grundlage, auf der Journal aufbaut. Diese Trennung reframt
die vier offenen Module wie folgt (weiterhin **keine** Zerlegung in Tasks — das folgt
separat nach Freigabe):

- **Journal** wird zur reinen, profilunabhängigen Erfassungs- und Fakten-Anzeigeschicht,
  die auf dem Food Catalog aufbaut, statt Lebensmitteleigenschaften selbst zu führen.
- **Saved Meals** bleibt profilunabhängige Logging-Beschleunigung, keine Bewertungsfunktion.
- **Dashboard** wird zur Ansicht, die vollständig vom aktiven Evaluation Profile bestimmt
  wird — nicht zu einem festen, generischen Kalorien-/Makro-Screen.
- **Goals** wird zur Zielkonfiguration/-anzeige innerhalb eines Profiles, statt eines
  einzelnen festen Zielschemas.

---

## 10. Offene Fragen (bewusst vertagt)

Diese Fragen werden **nicht** in diesem Dokument entschieden, sondern markieren bewusst
offene Punkte für spätere, gezielte Entscheidungen:

- **"Perspektiven"-Idee (Review R2/R3, noch unentschieden):** Statt (oder zusätzlich zu)
  einem einzelnen "aktiven" Profile könnten Journal-Einträge gleichzeitig unter mehreren
  Profilen angezeigt werden (z. B. "Health Perspective: 72/100", "Muscle Gain Perspective:
  84/100", "Mediterranean Perspective: 31/100"). Wichtig: Das wäre **keine neue
  Architekturfähigkeit**, sondern folgt bereits kostenlos aus Variante B (Abschnitt 2a) und
  der Statelessness-Formel (Abschnitt 4) — dieselbe Formel lässt sich mit beliebig vielen
  Profilen gegen dieselben Food-Catalog-/Journaldaten aufrufen, ohne dass irgendetwas an der
  Architektur geändert werden müsste. Noch nicht entschieden: ob es weiterhin ein
  einzelnes "primäres" Profile für Goals/Dashboard gibt und Perspektiven nur eine
  Vergleichsansicht sind, oder ob das Konzept eines einzelnen "aktiven" Profiles dadurch
  vollständig ersetzt wird. Vertagt auf eine eigene Runde.
- Wie wird der Wechsel des aktiven Profiles in der UX gestaltet (Onboarding-Frage,
  jederzeit änderbar, mehrere gespeicherte Profile)?
- Welche Regeln erfordern zusätzliche Datenqualität, die die bestehenden Quellen
  (BLS/OFF/USDA) aktuell nicht durchgängig liefern (z. B. Lebensmittelgruppen für eine
  Mediterranean-Regel, detaillierte Fettsäuren für eine Cholesterol-Regel)?
- Wie granular sollten Regeln sein (z. B. eine Regel pro Nährstoff-Grenzwert vs. größere
  thematische Bündel)? Das betrifft direkt, wie leicht sich User-Profile komponieren lassen.
- Wie wird bei medizinisch geprägten Profilen/Regeln (Cholesterol Focus, künftige
  `Professional`-Origin-Profile) mit Haftungs- und Vertrauensfragen umgegangen (Disclaimer,
  keine Diagnosefunktion, ärztliche Rücksprache, Autorenschafts-Verifikation)?
- Wie werden `Community`- und `AI`-Origin-Profile qualitätsgesichert bzw. moderiert, bevor
  sie anderen Nutzer:innen vorgeschlagen werden?
- Werden einzelne Profile Teil eines Freemium-/Monetarisierungsmodells? (Explizit nicht
  Teil des Founding Brief oder dieses Dokuments.)
- Wie wird der spätere AI Coach konkret an Profil-Output angebunden?

---

## 11. Nächste Schritte

1. Freigabe von Founding Brief und dieser Product Bible.
2. Erst danach: Zerlegung von Journal, Saved Meals, Dashboard und Goals in konkrete,
   verifizierbare `ROADMAP.md`-Tasks unter expliziter Berücksichtigung der hier
   festgelegten Food-Catalog-/Journal-/Evaluation-Engine-Trennung.
3. Auswahl eines ersten MVP-Profiles (vermutlich Evidence-based Standard als neutraler
   Default) für die erste konkrete Evaluation-Engine-Implementierung — Priorisierung folgt
   in der Tier-1-Zerlegung, nicht hier.
4. Food Catalog als eigenständige erste Datendomäne vorsehen (nicht Teil dieses Dokuments)
   — die Zerlegung in Abschnitt 9 und eine mögliche künftige Tier-Phasen-Struktur sollten
   dies explizit berücksichtigen.
