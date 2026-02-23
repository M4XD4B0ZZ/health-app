# ROADMAP.md  
Health App – Master Roadmap (SSOK Controlled)

Status: Active  
Architecture: Clean Architecture + Deterministic-First Nutrition Engine  
UI State: Warm-Neutral Light-Only MVP Skin Implemented  
Default Mode: Action Mode (Protokoll / Natural Language Logging)

---

# ROADMAP RESET — FUNCTIONAL CORE FIRST

Aktueller Zustand laut Screens:
- Parsing falsch
- Multi-Item Struktur kaputt
- Resolver greift nicht
- Makros = 0
- Review Flow erzwingt Confirm
- Debug-Texte sichtbar
- Default Tab falsch
- Core Logging nicht vertrauenswürdig

**Das ist kein Stabilisieren. Das ist: Core funktioniert noch nicht.**
Also hören wir auf mit „Sprint 2“, „Trust Layer“, „Premium Feel“.
Wir gehen zurück zu: **PHASE 0 — CORE MUSS ÜBERHAUPT FUNKTIONIEREN**

---

# PHASE 0 — LOGGING MUST WORK

## P0-001 Disable Multi-Item Structuring
Status: SOFORT

- Temporär Multi-Item AI-Strukturierung deaktivieren.
- Kein „AI structured multi-item meal“ Text mehr.
- Keine künstliche Aufteilung, solange deterministic parser nicht sauber ist.

**Ziel:** Ein einzelnes Item sauber durch Pipeline bekommen.

---

## P0-002 Single Item → Resolver → Makros Pipeline
Status: SOFORT

Minimal funktionierende Kette:
1. Input: "ei"
2. Pipeline:
   - Raw Input
   - Deterministic normalization
   - Resolver call
   - USDA/OFF match
   - Makros berechnen
   - Journal speichern
   - SummaryBar aktualisieren

- Kein Review Modal.
- Kein Confirm All.
- Kein Fancy Layer.

**Nur:** Input → echtes Essen → echte kcal.

**Gate:** 5 einzelne Lebensmittel liefern korrekte Makros.

---

## P0-003 Remove Review Modal Completely (Temporary)
Status: SOFORT

- Review Entries deaktivieren.
- Confirm All entfernen.
- Direkt speichern nach erfolgreichem Match.
- Falls kein Match → Fehlermeldung.

**Ziel:** Flow verkürzen. Fehlerquellen reduzieren.

---

## P0-004 Zero-Macro Blocker
Status: SOFORT

- Wenn: `kcal == 0`
- Dann:
  - Speichern blockieren.
  - Fehler anzeigen.
  - Kein Success-Status.

---

## P0-005 Hard Default to Protokoll Tab
Status: SOFORT

- Protokoll = Tab 1
- `initialRouteName` = Protokoll
- App startet im Input
- Kein Dashboard zuerst.

---

# ERST WENN P0 STABIL IST:

Dann:

## PHASE 1 — Deterministic Multi-Item Parsing

- Split bei “und”, “mit”, “,”
- Zahlwörter normalisieren
- Pro Item Resolver erzwingen

---

# AKTUELLER FOKUS

**Nicht:**
- Confidence
- UX Polishing
- Warm Neutral Feinschliff
- Goals
- Insights
- Health Sync

**Nur:** Core Logging Pipeline.

### Definition von „funktioniert“

Wenn diese 5 Inputs korrekt funktionieren, ohne Review, ohne 0 kcal:
1. `ei`
2. `zwei eier`
3. `200g quark`
4. `buttertoast`
5. `zwei scheiben schinken`

Erst dann reden wir über Multi-Item.
