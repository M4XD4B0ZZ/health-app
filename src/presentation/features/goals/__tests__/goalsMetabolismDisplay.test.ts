import {
  ENERGY_SECTION_TITLE,
  MAINTENANCE_LABEL,
  MAINTENANCE_EXPLANATION,
  BASAL_LABEL,
  BASAL_EXPLANATION,
  CALCULATION_DISCLOSURE_LABEL,
  formatKcalPerDay,
  germanStepTitle,
  buildEnergyInputRows,
} from '../goalsMetabolismDisplay';
import { MetabolismProfile } from '../../../../features/goals';

describe('GE-011 goalsMetabolismDisplay', () => {
  it('renames the section to a body-data + energy-need title (no „Metabolismus-Profil")', () => {
    expect(ENERGY_SECTION_TITLE).toBe('Körperdaten & Energiebedarf');
    expect(ENERGY_SECTION_TITLE).not.toContain('Metabolismus-Profil');
  });

  it('explains the maintenance need in plain German (activity-dependent, estimate)', () => {
    expect(MAINTENANCE_LABEL).toBe('Geschätzter Erhaltungsbedarf');
    expect(MAINTENANCE_EXPLANATION).toContain('hält dein aktuelles Gewicht');
    expect(MAINTENANCE_EXPLANATION).toContain('Aktivitätsniveau');
  });

  it('explains Grundumsatz as rest energy and states it is not a recommended target', () => {
    expect(BASAL_LABEL).toBe('Grundumsatz');
    expect(BASAL_EXPLANATION).toContain('vollständiger Ruhe');
    expect(BASAL_EXPLANATION).toContain('kein empfohlenes Tagesziel');
  });

  it('uses the required disclosure label', () => {
    expect(CALCULATION_DISCLOSURE_LABEL).toBe('So wurden die Werte berechnet');
  });

  it('formats an energy value as rounded kcal pro Tag', () => {
    expect(formatKcalPerDay(2449)).toBe('2449 kcal pro Tag');
    expect(formatKcalPerDay(1580.4)).toBe('1580 kcal pro Tag');
    expect(formatKcalPerDay(1580.6)).toBe('1581 kcal pro Tag');
  });

  it('maps the technical step keys to clear German titles (no raw enum keys)', () => {
    expect(germanStepTitle('bmr_formula')).toBe('Formel (Mifflin-St-Jeor)');
    expect(germanStepTitle('bmr_substitution')).toBe('Grundumsatz');
    expect(germanStepTitle('activity_multiplier')).toBe('Aktivitätsfaktor');
    expect(germanStepTitle('tdee_result')).toBe('Erhaltungsbedarf');
  });

  describe('buildEnergyInputRows', () => {
    const profile = (overrides: Partial<MetabolismProfile> = {}): MetabolismProfile => ({
      id: 'p1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      weightKg: 75,
      heightCm: 180,
      ageYears: 30,
      sex: 'male',
      activityLevel: 'moderate',
      ...overrides,
    });

    it('renders the stored body data as clear German label/value rows', () => {
      expect(buildEnergyInputRows(profile())).toEqual([
        { label: 'Gewicht', value: '75 kg' },
        { label: 'Größe', value: '180 cm' },
        { label: 'Alter', value: '30 Jahre' },
        { label: 'Geschlecht', value: 'Männlich' },
        { label: 'Aktivitätsniveau', value: 'Moderat (1–3× / Woche Sport)' },
      ]);
    });

    it('translates sex and activity level (never leaks internal enum values)', () => {
      const rows = buildEnergyInputRows(profile({ sex: 'female', activityLevel: 'low' }));
      const flat = rows.map((r) => r.value).join(' | ');
      expect(flat).toContain('Weiblich');
      expect(flat).toContain('Niedrig (wenig Bewegung)');
      expect(flat).not.toContain('female');
      expect(flat).not.toContain('low');
    });

    it('maps the high activity level', () => {
      const rows = buildEnergyInputRows(profile({ activityLevel: 'high' }));
      expect(rows[4].value).toBe('Hoch (4–7× / Woche Sport)');
    });
  });
});
