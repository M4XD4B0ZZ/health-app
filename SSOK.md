# SSOK v2 – Roo-first Multi-Agent Governance

> **Quick Guide:** If you are unsure where something belongs:
> - workflow → `.roo/commands`
> - behavior rule → `.roo/rules`
> - project governance → `AGENTS.md`
> - verification → `VERIFY.md`
> - task ordering → `ROADMAP.md`

## 1. Zweck

Diese SSOK definiert, wie das Projekt mit VS Code + Roo + mehreren Agenten geführt wird.

Ziel:
- eine klare, dauerhafte Wahrheitsstruktur
- eindeutige Zuständigkeiten
- standardisierte Agenten-Workflows
- saubere Verify- und Git-Abschlüsse
- keine widersprüchlichen Regeln an mehreren Stellen

Diese SSOK ist bewusst **Roo-first** aufgebaut.

---

## 2. Grundsatz

**Roo ist die operative SSOK.**  
Das bedeutet:

- `.roomodes` definiert Modus- und Agentenlogik
- `.roo/rules/*.md` definiert operative Arbeitsregeln
- `.roo/commands/*.md` definiert standardisierte Ausführungs-Workflows

Die bestehenden Roo-Regeln und Commands zeigen bereits genau diese Funktion:
- globale Arbeitsdisziplin in `01-global.md`
- Code-Disziplin und Architekturgrenzen in `01-code.md`
- standardisierte Workflows für Feature, Bugfix, Review, Explain, Commit und Commit-Push in den jeweiligen Command-Dateien 

**Root-Dateien sind die strategische Projekt-SSOK.**  
Sie definieren:
- Projektziel
- Prioritäten
- Verify-Vertrag
- Roadmap
- allgemeine Projektgovernance

---

## 3. SSOK-Hierarchie

### Ebene A – Strategische Projekt-SSOK
Diese Ebene beschreibt, **was** gilt.

- `README.md` → Projektkontext, Setup, Einstieg
- `ROADMAP.md` → Prioritäten, Task-Reihenfolge, Status
- `AGENTS.md` → übergreifende Arbeitsprinzipien
- `VERIFY.md` → Done-Definition und Verify-Vertrag
- `package.json` → tatsächlich ausführbare Skripte und Verify-Befehle 

### Ebene B – Operative Roo-SSOK
Diese Ebene beschreibt, **wie** gearbeitet wird.

- `.roomodes` → Rollen / Modi / Agentenlogik
- `.roo/rules/*.md` → operative Verhaltensregeln
- `.roo/commands/*.md` → standardisierte Arbeitsabläufe

### Ebene C – Implementierungsrealität
Diese Ebene enthält die tatsächliche Umsetzung.

- `src/`
- `scripts/`
- `docs/`
- `supabase/`

---

## 4. Verbindlicher Leitsatz

**Strategische Wahrheit liegt in den Root-Dateien.**  
**Operative Wahrheit liegt in Roo.**  
**Code und Skripte setzen diese Wahrheit um.**

Daraus folgt:

- Keine operative Workflow-Logik in zufälligen Notizen oder Chat-Verläufen
- Keine widersprüchlichen Regeln zwischen Root und Roo
- Keine parallelen, konkurrierenden Prozessbeschreibungen

---

## 5. Rollen der Root-Dateien

### `README.md`
Zweck:
- Einstieg ins Projekt
- technischer Überblick
- lokale Inbetriebnahme
- Hauptverzeichnisse
- wichtigste Befehle

Nicht zuständig für:
- detaillierte Agenten-Workflows
- feingranulare Commit- oder Review-Rituale

### `ROADMAP.md`
Zweck:
- einzige verbindliche Aufgaben- und Prioritätenquelle
- stabile Task-IDs
- Status und Reihenfolge
- Verweise auf Specs oder relevante Bereiche

Regel:
- Es gibt genau **eine** operative Master-Roadmap.

### `AGENTS.md`
Zweck:
- übergreifende Governance
- Rollenverständnis
- Zusammenarbeit mehrerer Agenten
- Grundsatzregeln für Planung, Umsetzung, Review und Handoff

### `VERIFY.md`
Zweck:
- Done-Kriterien
- Pflicht-Checks
- Nachweisstruktur
- Regeln für task completion

### `package.json`
Zweck:
- ausführbare Wahrheit der Kommandos

Aktuell sind dort bereits die Kern-Checks sauber definiert:
- `typecheck`
- `lint`
- `format:check`
- `test`
- `verify`
- `verify:schema`
- `verify:edge`
- `verify:supabase:link`
- `doctor`

---

## 6. Rollen der Roo-Dateien

### `.roo/rules/`
Diese Dateien definieren das wiederkehrende Arbeitsverhalten.

Aktuell ist das schon sinnvoll getrennt:

- `01-global.md` für allgemeine Disziplin:
  - kleine, fokussierte Änderungen
  - keine unnötigen Refactors
  - bestehende Struktur respektieren
  - keine `.env`-Änderungen
  - keine unnötigen Abstraktionen

- `01-code.md` für Code-spezifische Regeln:
  - kleinste sinnvolle Änderung
  - relevante Dateien zuerst lesen
  - Architektur-Layer respektieren
  - deterministische Logik nicht durch AI ersetzen
  - keine großen Refactors ohne Auftrag

### `.roo/commands/`
Diese Dateien definieren standardisierte Agenten-Workflows.

Aktuelle operative Agenten:

- `/feature` → neues Feature implementieren
- `/bugfix` → Bug systematisch analysieren und minimal fixen
- `/refactor` → kontrolliertes Refactoring
- `/review` → strukturiertes Code Review mit Architektur- und Risikofokus
- `/explain` → Code/Architektur erklären
- `/commit` → kontrollierter Commit ohne Push
- `/commit-push` → kontrollierter Commit mit Push

### `.roomodes`
Diese Datei ist die kanonische Definition von Modus- und Agentenverhalten.
Sie bestimmt, welcher Modus für welche Aufgabe gedacht ist.

---

## 7. Agent Registry

Die operative Agent Registry lautet:

### 1. Feature Agent
Trigger:
- `/feature`

Aufgabe:
- neue Funktionalität umsetzen

Pflichtverhalten:
- betroffene Module identifizieren
- relevante Dateien lesen
- kurz planen
- minimal implementieren
- Architektur respektieren

### 2. Bugfix Agent
Trigger:
- `/bugfix`

Aufgabe:
- Ursache eines Bugs finden und gezielt beheben

Pflichtverhalten:
- Bug analysieren
- betroffene Stellen identifizieren
- Hypothese formulieren
- minimalen Fix umsetzen
- nur die tatsächliche Ursache beheben

### 3. Refactor Agent
Trigger:
- `/refactor`

Aufgabe:
- Lesbarkeit/Struktur verbessern ohne Verhaltensänderung

Pflichtverhalten:
- kleine, kontrollierte Verbesserungen
- keine Architekturwechsel
- keine neuen Dependencies
- kein funktionales Verhalten ändern

### 4. Review Agent
Trigger:
- `/review`

Aufgabe:
- Qualität, Risiken und Architekturverletzungen prüfen

Prüfkategorien:
- Lesbarkeit
- Struktur
- Komplexität
- Modulgrenzen
- Abhängigkeiten
- Edge Cases
- Bugs
- Performanceprobleme

### 5. Explain Agent
Trigger:
- `/explain`

Aufgabe:
- Verständnis herstellen

Pflichtstruktur:
- Zweck
- wichtigste Komponenten
- Ablauf / Datenfluss
- Fallstricke

### 6. Commit Agent
Trigger:
- `/commit`

Aufgabe:
- Änderungen sauber zusammenfassen und committen

Pflichtschritte:
- `git status --short`
- relevante Diffs lesen
- präzise Conventional-Commit-Message wählen
- relevante Änderungen stagen
- committen, aber nicht pushen

### 7. Commit-Push Agent
Trigger:
- `/commit-push`

Aufgabe:
- Änderungen sauber committen und pushen

Pflichtschritte:
- Commit-Workflow
- Branch ermitteln
- Push sicher durchführen
- keine `.env`, Secrets, Exporte oder irrelevanten Dateien committen

---

## 8. Modell- und Rollenlogik

Wichtig:
**Gleiches Modell bedeutet nicht gleiche Rolle.**

Mehrere Agenten dürfen dasselbe Modell verwenden, solange sie unterschiedliche Aufgabenverträge haben.

Empfohlene Zuordnung:

- Explain / kleine Verständnisfragen → schnelles günstiges Modell
- Commit / Commit-Push → schnelles günstiges Modell
- Feature → ausgewogenes Code-Modell
- Bugfix → ausgewogenes Code-Modell
- Refactor → ausgewogenes Code-Modell
- Review → stärkeres Reasoning-Modell
- komplexe Architekturentscheidungen → Planungs-/Reasoning-Modus

Regel:
Die **Rolle** ist wichtiger als das Modelllabel.

---

## 9. Verbindliche Arbeitsregeln

Diese Regeln gelten projektweit.

### 9.1 Änderungsdisziplin
- Arbeite in kleinen, fokussierten Änderungen. 
- Refactore keine unzusammenhängenden Bereiche. 
- Bevorzuge Änderungen bestehender Dateien vor neuen Strukturen. 
- Vermeide unnötige Abstraktionen und Dependencies. 

### 9.2 Architekturdisziplin
- Respektiere bestehende Modulgrenzen. 
- Domain-Logik bleibt framework-unabhängig.
- Infrastruktur darf nicht in Domain-Logik auslaufen.
- UI enthält keine Business-Logik.
- Deterministische Logik wird nicht durch AI-Logik ersetzt.

### 9.3 Sicherheitsdisziplin
- Keine `.env`-Dateien ändern.
- Keine Secrets oder Umgebungsvariablen offenlegen. 
- Keine sensiblen oder irrelevanten Dateien blind committen. 

### 9.4 Kommunikationsdisziplin
- Vor Änderungen kurz den Plan oder die Richtung nennen. 
- Kurz, präzise und evidence-basiert antworten. 

---

## 10. Verify Contract

Eine Aufgabe ist erst erledigt, wenn die relevanten Checks gelaufen sind oder dokumentiert wurde, warum das nicht möglich war.

### Standard Verify
Primärer Standard-Check:

- `npm run verify`

Dieser ruft aktuell aus:
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm run test`

### Erweiterte Verify-Fälle
Je nach Änderung zusätzlich:

- `npm run typecheck:functions`
- `npm run typecheck:all`
- `npm run verify:schema`
- `npm run verify:edge`
- `npm run verify:supabase:link`
- `npm run doctor`

### Verify-Regel
Es werden nur die **relevanten** Checks verlangt.
Nicht jede Aufgabe braucht jeden Check.
Aber jede abgeschlossene Aufgabe braucht einen klaren Verify-Nachweis.

### Verify-Nachweis muss enthalten
- geänderte Dateien
- ausgeführte Checks
- Ergebnis der Checks
- bekannte Rest-Risiken
- Follow-ups, falls nötig

---

## 11. Handoff Contract

Jeder abgeschlossene Arbeitsgang endet mit einem klaren Handoff.

Pflichtbestandteile:
1. Was wurde geändert?
2. Warum wurde es geändert?
3. Welche Dateien waren betroffen?
4. Welche Checks wurden ausgeführt?
5. Gibt es bekannte Risiken oder offene Punkte?

Kein Handoff darf so tun, als sei Arbeit vollständig validiert, wenn Verify nicht gelaufen ist.

---

## 12. Anti-Duplizierungs-Regeln

Um doppelte Wahrheit zu verhindern, gilt:

### Gehört nach `README.md`
- Einstieg
- Setup
- Hauptkommandos
- Projektüberblick

### Gehört nach `ROADMAP.md`
- Prioritäten
- Task-Status
- Reihenfolge
- nächste Schritte

### Gehört nach `AGENTS.md`
- globale Governance
- Zusammenarbeit
- übergreifende Standards

### Gehört nach `VERIFY.md`
- Done-Definition
- Prüfreihenfolge
- Nachweisregeln

### Gehört nach `.roo/rules/`
- wiederkehrende operative Verhaltensregeln
- Editierdisziplin
- Modusregeln
- allgemeine Sicherheits- und Arbeitsregeln

### Gehört nach `.roo/commands/`
- standardisierte Ablaufanweisungen
- rollenbezogene Agenten-Workflows
- klare Antwortstrukturen
- konkrete Schrittfolgen

### Gehört nicht in Chat-Verläufe
- dauerhafte Projektregeln
- wiederverwendbare Workflows
- Verify-Definitionen
- Commit-Standards

---

## 13. Änderungsregeln für die SSOK selbst

Änderungen an der SSOK sind nur sinnvoll, wenn mindestens einer dieser Fälle vorliegt:

- neuer wiederkehrender Workflow
- neue Agentenrolle
- neue Verify-Anforderung
- neue Architekturgrenze
- wiederkehrender Fehler durch unklare Regel
- Git- oder Release-Prozess wurde verbindlich geändert

Regel:
- Kleine operative Änderungen zuerst in Roo prüfen
- Strategische Änderungen in Root-Dateien spiegeln
- Keine stillen Prozessänderungen

---

## 14. Endgültige Kurzform

Die verbindliche Kurzdefinition lautet:

**`README.md`, `ROADMAP.md`, `AGENTS.md`, `VERIFY.md` und `package.json` definieren die strategische Projektwahrheit.**  
**`.roomodes`, `.roo/rules/*.md` und `.roo/commands/*.md` definieren die operative Roo-Wahrheit.**  
**`src/`, `scripts/`, `docs/` und `supabase/` setzen diese Wahrheit um.**

Oder noch kürzer:

**Projektwahrheit oben.  
Ausführungswahrheit in Roo.  
Implementierung unten.**