#!/usr/bin/env node

import { writeFileSync } from 'fs';

/**
 * Agent Orchestrator - Handoff Template Generator
 *
 * Erstellt ein strukturiertes Handoff-Template für die Dokumentation
 * abgeschlossener Agent-Arbeiten.
 */

const OUTPUT_PATH = '.agent/out/handoff-template.md';

function generateHandoffTemplate() {
  const timestamp = new Date().toISOString();

  return `# Agent Handoff Template

**Generiert:** ${timestamp}

---

## Task

**Task-ID:** [z.B. P0-004]
**Titel:** [Kurzer Titel des Tasks]
**Status:** [todo → in_progress → done]

---

## Was wurde geändert?

### Neue Dateien
- [ ] \`path/to/new/file.ext\` - [Zweck]
- [ ] \`path/to/another/file.ext\` - [Zweck]

### Geänderte Dateien
- [ ] \`path/to/modified/file.ext\` - [Art der Änderung]
- [ ] \`path/to/another/modified.ext\` - [Art der Änderung]

### Gelöschte Dateien
- [ ] \`path/to/deleted/file.ext\` - [Grund für Löschung]

---

## Warum?

### Problemstellung
[Beschreibung des ursprünglichen Problems oder der Anforderung]

### Lösungsansatz
[Erklärung der gewählten Lösung und Begründung]

### Alternativen
[Kurze Erwähnung verworfener Alternativen, falls relevant]

---

## Dateien

### Detaillierte Änderungen

#### \`path/to/file1.ext\`
- **Zweck:** [Was macht diese Datei?]
- **Änderungen:** [Spezifische Änderungen]
- **Abhängigkeiten:** [Neue oder geänderte Dependencies]

#### \`path/to/file2.ext\`
- **Zweck:** [Was macht diese Datei?]
- **Änderungen:** [Spezifische Änderungen]
- **Abhängigkeiten:** [Neue oder geänderte Dependencies]

---

## Checks

### Ausgeführte Verification
- [ ] \`npm run typecheck\` - [✅/❌] [Ergebnis/Hinweise]
- [ ] \`npm run lint\` - [✅/❌] [Ergebnis/Hinweise]
- [ ] \`npm run format:check\` - [✅/❌] [Ergebnis/Hinweise]
- [ ] \`npm run test\` - [✅/❌] [Ergebnis/Hinweise]
- [ ] \`npm run verify\` - [✅/❌] [Gesamtergebnis]

### Zusätzliche Checks (falls relevant)
- [ ] \`npm run typecheck:functions\` - [✅/❌] [Ergebnis]
- [ ] \`npm run verify:edge\` - [✅/❌] [Ergebnis]
- [ ] \`npm run verify:schema\` - [✅/❌] [Ergebnis]

### Manuelle Tests
- [ ] [Beschreibung des manuellen Tests] - [✅/❌] [Ergebnis]
- [ ] [Weitere manuelle Tests] - [✅/❌] [Ergebnis]

---

## Ergebnis

### Erfolgskriterien
- [x] [Kriterium 1 aus DoD erfüllt]
- [x] [Kriterium 2 aus DoD erfüllt]
- [ ] [Offenes Kriterium, falls vorhanden]

### Funktionalität
[Beschreibung der implementierten/geänderten Funktionalität]

### Performance Impact
[Einschätzung der Performance-Auswirkungen, falls relevant]

### Breaking Changes
[Liste von Breaking Changes, falls vorhanden]

---

## Risiken

### Bekannte Einschränkungen
- [Einschränkung 1 und deren Auswirkung]
- [Einschränkung 2 und deren Auswirkung]

### Potentielle Probleme
- [Problem 1 und Wahrscheinlichkeit]
- [Problem 2 und Wahrscheinlichkeit]

### Monitoring-Empfehlungen
- [Was sollte überwacht werden?]
- [Welche Metriken sind relevant?]

---

## Follow-ups

### Sofortige Nächste Schritte
- [ ] [Aktion 1 - Verantwortlich: [Name/Rolle]]
- [ ] [Aktion 2 - Verantwortlich: [Name/Rolle]]

### Mittelfristige Aufgaben
- [ ] [Task 1 - Zeitrahmen: [Schätzung]]
- [ ] [Task 2 - Zeitrahmen: [Schätzung]]

### Dokumentation Updates
- [ ] README.md aktualisieren (falls nötig)
- [ ] ROADMAP.md Task-Status auf \`done\` setzen
- [ ] Weitere Dokumentation aktualisieren

### Deployment/Release
- [ ] [Deployment-Schritte, falls nötig]
- [ ] [Release-Notizen erstellen]

---

## Zusätzliche Notizen

### Lessons Learned
[Was wurde während der Arbeit gelernt?]

### Verbesserungsvorschläge
[Vorschläge für zukünftige ähnliche Tasks]

### Referenzen
- [Link zu relevanten Dokumenten]
- [Link zu Issues oder Diskussionen]
- [Link zu externen Ressourcen]

---

*Template generiert von write-handoff-template.mjs*
*Anpassung an spezifischen Task erforderlich*
`;
}

function main() {
  try {
    console.log('📝 Erstelle Handoff-Template');

    const template = generateHandoffTemplate();
    writeFileSync(OUTPUT_PATH, template);

    console.log(`✅ Template erstellt: ${OUTPUT_PATH}`);
    console.log('\n💡 Verwendung:');
    console.log('1. Template kopieren');
    console.log('2. Spezifische Task-Details einfügen');
    console.log('3. Checkboxen entsprechend markieren');
    console.log('4. Als finale Dokumentation verwenden');
  } catch (error) {
    console.error('❌ Fehler beim Erstellen des Templates:', error.message);
    process.exit(1);
  }
}

main();
