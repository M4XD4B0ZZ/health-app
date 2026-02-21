import { calculateBmr, calculateTdee } from '../application/calculators/MetabolismCalculator';
import { MetabolismProfile } from '../domain/models/MetabolismTypes';

describe('MetabolismCalculator', () => {
  describe('calculateBmr', () => {
    it('should calculate BMR correctly for male', () => {
      const profile: MetabolismProfile = {
        id: 'test-1',
        createdAt: '2026-02-15T12:00:00Z',
        updatedAt: '2026-02-15T12:00:00Z',
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
        sex: 'male',
        activityLevel: 'moderate',
      };

      const { bmr, steps } = calculateBmr(profile);

      // Formula: 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
      expect(bmr).toBe(1780);
      expect(steps).toHaveLength(2);
      expect(steps[0].key).toBe('bmr_formula');
      expect(steps[1].key).toBe('bmr_substitution');
      expect(steps[1].result).toBe(1780);
    });

    it('should calculate BMR correctly for female', () => {
      const profile: MetabolismProfile = {
        id: 'test-1',
        createdAt: '2026-02-15T12:00:00Z',
        updatedAt: '2026-02-15T12:00:00Z',
        weightKg: 65,
        heightCm: 165,
        ageYears: 28,
        sex: 'female',
        activityLevel: 'low',
      };

      const { bmr, steps } = calculateBmr(profile);

      // Formula: 10*65 + 6.25*165 - 5*28 - 161 = 650 + 1031.25 - 140 - 161 = 1380.25 => 1380
      expect(bmr).toBe(1380);
      expect(steps).toHaveLength(2);
      expect(steps[1].result).toBe(1380);
    });

    it('should round BMR to whole numbers', () => {
      const profile: MetabolismProfile = {
        id: 'test-1',
        createdAt: '2026-02-15T12:00:00Z',
        updatedAt: '2026-02-15T12:00:00Z',
        weightKg: 70.5,
        heightCm: 172.5,
        ageYears: 25,
        sex: 'male',
        activityLevel: 'moderate',
      };

      const { bmr } = calculateBmr(profile);

      expect(Number.isInteger(bmr)).toBe(true);
    });
  });

  describe('calculateTdee', () => {
    it('should calculate TDEE with low activity multiplier (1.2)', () => {
      const profile: MetabolismProfile = {
        id: 'test-1',
        createdAt: '2026-02-15T12:00:00Z',
        updatedAt: '2026-02-15T12:00:00Z',
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
        sex: 'male',
        activityLevel: 'low',
      };

      const bmr = 1780;
      const { tdee, steps } = calculateTdee(profile, bmr);

      // 1780 * 1.2 = 2136
      expect(tdee).toBe(2136);
      expect(steps).toHaveLength(2);
      expect(steps[0].key).toBe('activity_multiplier');
      expect(steps[1].key).toBe('tdee_result');
    });

    it('should calculate TDEE with moderate activity multiplier (1.55)', () => {
      const profile: MetabolismProfile = {
        id: 'test-1',
        createdAt: '2026-02-15T12:00:00Z',
        updatedAt: '2026-02-15T12:00:00Z',
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
        sex: 'male',
        activityLevel: 'moderate',
      };

      const bmr = 1780;
      const { tdee } = calculateTdee(profile, bmr);

      // 1780 * 1.55 = 2759
      expect(tdee).toBe(2759);
    });

    it('should calculate TDEE with high activity multiplier (1.725)', () => {
      const profile: MetabolismProfile = {
        id: 'test-1',
        createdAt: '2026-02-15T12:00:00Z',
        updatedAt: '2026-02-15T12:00:00Z',
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
        sex: 'male',
        activityLevel: 'high',
      };

      const bmr = 1780;
      const { tdee } = calculateTdee(profile, bmr);

      // 1780 * 1.725 = 3070.5 => 3071
      expect(tdee).toBe(3071);
    });

    it('should round TDEE to whole numbers', () => {
      const profile: MetabolismProfile = {
        id: 'test-1',
        createdAt: '2026-02-15T12:00:00Z',
        updatedAt: '2026-02-15T12:00:00Z',
        weightKg: 75,
        heightCm: 175,
        ageYears: 35,
        sex: 'female',
        activityLevel: 'moderate',
      };

      const bmr = 1456;
      const { tdee } = calculateTdee(profile, bmr);

      expect(Number.isInteger(tdee)).toBe(true);
    });
  });
});
