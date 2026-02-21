# HEALTH APP – MASTER ROADMAP (SSOK)

Version: 1.0  
Status: Active  
Architecture: Clean + Feature-First  
Principle: Deterministic-first, AI when needed

---

# 0. SINGLE SOURCE OF KNOWLEDGE (SSOK)

Dieses Dokument ist die **einzige strategische Referenzquelle** für:

- Roadmap
- Architektur
- Feature-Status
- Priorisierung
- Governance

Regeln:

1. Keine Architekturänderung ohne Update dieser Datei.
2. Jede neue Initiative erhält eine stabile ID.
3. Kein Feature ohne klar definierte Definition of Done.
4. verify muss grün sein vor Commit.

---

# 1. PROJEKTVISION

Conversation-first Nutrition Tracking.

Ziel:

- Natürlichsprachliche Eingabe als Primär-Interface
- Deterministische Berechnung
- Maximales Vertrauen durch Transparenz
- Week-1 Retention als Northstar

Differenzierung:

- Nicht database-first
- Nicht AI-Gimmick
- Sondern: System + Kontrolle + Editierbarkeit

---

# 2. ARCHITEKTUR-PRINZIPIEN (FIX)

## ARCH-01 Deterministic First

- Mathematik niemals über LLM
- Parsing → Portion → Resolver → Calculation deterministisch
- AI nur bei:
  - Cache Miss
  - Ambiguity
  - Mapping

## ARCH-02 Multi-Source Food Catalog

Priorität:

1. User Cache
2. Open Food Facts (Brand/EAN EU)
3. USDA (Global Generic Core)
4. AI-Fallback

Makros immer pro 100g speichern.

## ARCH-03 Resolver Ranking Engine

Weighted Scoring:

- Match Quality
- Data Completeness
- Plausibility
- kcal vs Macro Consistency

Configurable Weights.  
Minimum Score Threshold.  
Traffic-driven Self-healing.

## ARCH-04 Trust Layer

- Thought Process Card
- Confidence Score (numerisch)
- Silent Confidence CTA
- Natural Language Editing
- Bias Setting (-2 bis +2)

## ARCH-05 AI Cost Governance

- Cache-first Architektur
- Logging pro Modell
- Guardrails (Rate Limits)
- Dashboard AI-frei

---

# 3. AKTUELLER STATUS

## Abgeschlossen

| ID                   | Beschreibung             |
| -------------------- | ------------------------ |
| S0-ARCH              | Architektur-Freeze       |
| S1-CORE              | Core Logging Engine      |
| S2-TRUST             | Confidence + Editability |
| S3-SAVED             | Saved Meals System       |
| S5.6-PERSIST         | Persist Food Entries     |
| S5.7-RESOLVER-INJECT | Resolver DI Integration  |

---

# 4. AKTUELLER FOKUS

## S5.8 – Resolver Ranking Stabilisierung

Ziel:

- Score-Weights validieren
- Ranking deterministisch absichern
- Fuzzy-Failsafe implementieren
- Rückfragen bei Unsicherheit statt falsche Sicherheit

Definition of Done:

- Keine falsche Sicherheit bei Low Confidence
- Configurable Weighting System
- Score Logging vorhanden
- Edge Cases dokumentiert

---

# 5. NÄCHSTE PHASE – ECHTE DATENBANK

## S6 – Food Data Integration

### S6.1 USDA Integration

- Canonical Generic Foods
- Deterministische Makros
- Global skalierbar

### S6.2 Open Food Facts Integration

- EU/DE Markenprodukte
- EAN-Ready Struktur
- Brand-Layer über USDA

### S6.3 Candidate Ranking Hardening

- Logging
- Score-Tuning
- Threshold-Optimierung

---

# 6. RETENTION SYSTEM

Northstar: Week-1 Retention

| ID  | Modul                           |
| --- | ------------------------------- |
| R1  | Journal View                    |
| R2  | Calendar System                 |
| R3  | Remaining Calories Core Metric  |
| R4  | Reminder System (minimal start) |
| R5  | Saved Meals 1-Tap Logging       |
| R6  | Streaks & Badges (Phase 2)      |

Prinzip:
Friction reduzieren > Gamification hinzufügen.

---

# 7. GOALS & METABOLISM ENGINE

| ID  | Beschreibung                                               |
| --- | ---------------------------------------------------------- |
| G1  | Manuelle Zielsetzung                                       |
| G2  | BMR/TDEE Berechnung (erklärbar)                            |
| G3  | 3 Aktivitätslevel (Low/Moderate/High)                      |
| G4  | Automatische Aktivitätswahl (Schritte + Workouts, Phase 2) |

---

# 8. GLOBALISIERUNG

Start:
Deutschland

Strategie:

- OFF für EU Brands
- USDA für globalen Core

Später:

- Mehrsprachigkeit
- Regionale Normalisierung
- Globale Skalierung

---

# 9. UI & DESIGN STRATEGIE

## DESIGN-01

Kein Design-Fokus während Core-Engineering.

## DESIGN-02 Stitch Phase (später)

- Layout-System
- Design Tokens
- UI-Iteration
- Kein Einfluss auf Architektur

Design kommt NACH Resolver + Datenbank Stabilität.

---

# 10. COMPLIANCE & TRUST

- Kein Werbemodell
- Transparente Pricing-Erklärung
- AI-Kosten-Erklärung
- Export-Funktion (CSV/JSON geplant)

---

# 11. DEFINITION OF DONE (GLOBAL)

Ein Feature ist DONE wenn:

- Deterministisch korrekt
- Edge Cases behandelt
- Confidence korrekt berechnet
- UI-State sauber (`idle | processing | done | error`)
- verify Script grün
- Architekturprinzipien eingehalten

---

# 12. OFFENE STRATEGISCHE ENTSCHEIDUNGEN

| ID  | Thema                |
| --- | -------------------- |
| D1  | Subscription Modell  |
| D2  | AI Budget pro User   |
| D3  | Cloud Sync Zeitpunkt |
| D4  | Widget Launch Timing |

---

# 13. ORDNUNG & STRUKTUR

Feature-First innerhalb Clean Architecture:

src/
features/
nutrition/
domain/
application/
infrastructure/
infrastructure/
supabase/
llm/
cache/

Keine Neuarchitektur geplant.

---

# 14. STRATEGISCHE IDENTITÄT

Wir sind:

- Conversation-first
- Deterministic-first
- Transparent
- Kontrollierbar
- Editierbar
- Kein AI-Gimmick
