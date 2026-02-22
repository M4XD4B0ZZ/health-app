import {
  calculateBmrMifflinStJeor,
  calculateMetabolismBreakdown,
  getActivityFactor,
} from '../domain/metabolism/MetabolismCalculator';

describe('MetabolismCalculator', () => {
  it('calculates known male example correctly', () => {
    const bmr = calculateBmrMifflinStJeor({
      sex: 'male',
      ageYears: 30,
      heightCm: 180,
      weightKg: 80,
      activityLevel: 'moderate',
    });
    expect(bmr).toBe(1780);

    const breakdown = calculateMetabolismBreakdown({
      sex: 'male',
      ageYears: 30,
      heightCm: 180,
      weightKg: 80,
      activityLevel: 'moderate',
    });
    expect(breakdown.tdeeKcal).toBe(2759);
  });

  it('maps activity levels to deterministic factors', () => {
    expect(getActivityFactor('low')).toBe(1.2);
    expect(getActivityFactor('moderate')).toBe(1.55);
    expect(getActivityFactor('high')).toBe(1.725);
  });
});
