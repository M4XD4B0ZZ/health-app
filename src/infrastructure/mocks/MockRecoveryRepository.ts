import { RecoveryRepository } from '../../domain/repositories/RecoveryRepository';
import { Sleep, SleepSummary } from '../../domain/models/Sleep';
import { Steps, StepsSummary } from '../../domain/models/Steps';
import { HeartRatePoint, HeartRateSeries, HeartRateSummary } from '../../domain/models/HeartRate';
import { TimeRange } from '../../domain/models/TimeRange';

/**
 * Mock-Implementierung des RecoveryRepository mit deterministischen Testdaten
 */
export class MockRecoveryRepository implements RecoveryRepository {
  private readonly DAY_MS = 24 * 60 * 60 * 1000;

  private sleepData: Sleep[] = [];
  private stepsData: Steps[] = [];
  private heartRateData: HeartRatePoint[] = [];

  constructor() {
    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));

    const sleepDurations = [450, 430, 470, 440, 460, 445, 455];
    const sleepQualities = [85, 80, 88, 82, 86, 81, 84];
    const stepsCounts = [8500, 10200, 7800, 9300, 11000, 9700, 8900];
    const restingBpms = [62, 64, 61, 63, 60, 65, 62];

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const day = new Date(today.getTime() - dayOffset * this.DAY_MS);
      const start = new Date(day.getTime() - this.DAY_MS);
      start.setHours(23, 0, 0, 0);
      const end = new Date(day);
      end.setHours(7, 0, 0, 0);

      const duration = sleepDurations[dayOffset];
      const quality = sleepQualities[dayOffset];

      this.sleepData.push({
        id: `sleep-${dayOffset}`,
        startTime: start,
        endTime: end,
        durationMinutes: duration,
        quality,
        deepSleepMinutes: Math.round(duration * 0.26),
        remSleepMinutes: Math.round(duration * 0.21),
        lightSleepMinutes: duration - Math.round(duration * 0.26) - Math.round(duration * 0.21),
      });

      const count = stepsCounts[dayOffset];
      this.stepsData.push({
        id: `steps-${dayOffset}`,
        date: new Date(day),
        count,
        distanceMeters: Math.round(count * 0.8),
        caloriesBurned: Math.round(count * 0.038),
      });

      this.heartRateData.push(
        {
          id: `hr-${dayOffset}-rest`,
          timestamp: new Date(new Date(day).setHours(8, 0, 0, 0)),
          beatsPerMinute: restingBpms[dayOffset],
          measurementType: 'resting',
        },
        {
          id: `hr-${dayOffset}-active-1`,
          timestamp: new Date(new Date(day).setHours(12, 30, 0, 0)),
          beatsPerMinute: restingBpms[dayOffset] + 14,
          measurementType: 'active',
        },
        {
          id: `hr-${dayOffset}-active-2`,
          timestamp: new Date(new Date(day).setHours(18, 0, 0, 0)),
          beatsPerMinute: restingBpms[dayOffset] + 10,
          measurementType: 'active',
        },
      );
    }
  }

  getSleep(range: TimeRange): Sleep[] {
    if (range === 'today') {
      return this.sleepData.slice(0, 1);
    }
    return this.sleepData.slice(0, 7);
  }

  getSteps(range: TimeRange): Steps[] {
    if (range === 'today') {
      return this.stepsData.slice(0, 1);
    }
    return this.stepsData.slice(0, 7);
  }

  // Schlaf-Methoden
  getSleepById(id: string): Sleep | null {
    return this.sleepData.find((sleep) => sleep.id === id) || null;
  }

  getLastSleep(): Sleep | null {
    return this.getSleep('today')[0] ?? null;
  }

  getSleepsByDateRange(startDate: Date, endDate: Date): Sleep[] {
    return this.sleepData.filter(
      (sleep) => sleep.startTime >= startDate && sleep.endTime <= endDate,
    );
  }

  getSleepSummary(): SleepSummary {
    const last7days = this.getSleep('last7days');
    const averageDurationLastWeek =
      last7days.reduce((sum, item) => sum + item.durationMinutes, 0) / last7days.length;
    const averageQualityLastWeek =
      last7days.reduce((sum, item) => sum + (item.quality ?? 0), 0) / last7days.length;

    return {
      lastSleep: this.getLastSleep(),
      averageDurationLastWeek,
      averageQualityLastWeek,
    };
  }

  // Schritt-Methoden
  getStepsById(id: string): Steps | null {
    return this.stepsData.find((steps) => steps.id === id) || null;
  }

  getStepsByDate(date: Date): Steps | null {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    return (
      this.stepsData.find((steps) => {
        const stepsDate = new Date(steps.date);
        stepsDate.setHours(0, 0, 0, 0);
        return stepsDate.getTime() === targetDate.getTime();
      }) || null
    );
  }

  getStepsByDateRange(startDate: Date, endDate: Date): Steps[] {
    return this.stepsData.filter((steps) => steps.date >= startDate && steps.date <= endDate);
  }

  getStepsSummary(): StepsSummary {
    const last7days = this.getSteps('last7days');
    const total = last7days.reduce((sum, item) => sum + item.count, 0);
    const average = total / last7days.length;
    const today = this.getSteps('today')[0] ?? null;

    return {
      today,
      weeklyAverage: average,
      weeklyTotal: total,
      monthlyAverage: average,
    };
  }

  // Herzfrequenz-Methoden
  getHeartRatePointById(id: string): HeartRatePoint | null {
    return this.heartRateData.find((hr) => hr.id === id) || null;
  }

  getHeartRateSeriesByDate(date: Date): HeartRateSeries | null {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const points = this.heartRateData.filter((hr) => {
      const hrDate = new Date(hr.timestamp);
      hrDate.setHours(0, 0, 0, 0);
      return hrDate.getTime() === targetDate.getTime();
    });

    if (points.length === 0) return null;

    const bpms = points.map((p) => p.beatsPerMinute);

    return {
      date: targetDate,
      points,
      averageBpm: bpms.reduce((sum, bpm) => sum + bpm, 0) / bpms.length,
      minBpm: Math.min(...bpms),
      maxBpm: Math.max(...bpms),
      restingBpm: points.find((p) => p.measurementType === 'resting')?.beatsPerMinute,
    };
  }

  getHeartRateSeriesByDateRange(startDate: Date, endDate: Date): HeartRateSeries[] {
    const result: HeartRateSeries[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const series = this.getHeartRateSeriesByDate(currentDate);
      if (series) result.push(series);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }

  getLatestHeartRate(): HeartRatePoint | null {
    if (this.heartRateData.length === 0) return null;

    return this.heartRateData.reduce((latest, current) =>
      current.timestamp > latest.timestamp ? current : latest,
    );
  }

  getRestingHeartRate(range: TimeRange): number | null {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(today);
    if (range === 'last7days') {
      startDate.setDate(startDate.getDate() - 6);
    }

    const endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);

    const restingPoints = this.heartRateData.filter(
      (hr) =>
        hr.measurementType === 'resting' && hr.timestamp >= startDate && hr.timestamp <= endDate,
    );

    if (restingPoints.length === 0) return null;

    if (range === 'today') {
      return restingPoints[0].beatsPerMinute;
    }

    return Math.round(
      restingPoints.reduce((sum, item) => sum + item.beatsPerMinute, 0) / restingPoints.length,
    );
  }

  getHeartRateSummary(): HeartRateSummary {
    const restingValues = this.heartRateData
      .filter((hr) => hr.measurementType === 'resting')
      .slice(0, 7)
      .map((hr) => hr.beatsPerMinute);

    const first = restingValues[restingValues.length - 1];
    const last = restingValues[0];
    const weeklyTrend: 'increasing' | 'decreasing' | 'stable' =
      last - first > 1 ? 'increasing' : first - last > 1 ? 'decreasing' : 'stable';

    return {
      today: this.getHeartRateSeriesByDate(new Date()),
      restingHeartRate: this.getRestingHeartRate('today'),
      weeklyAverageResting: Math.round(
        restingValues.reduce((sum, value) => sum + value, 0) / restingValues.length,
      ),
      weeklyTrend,
    };
  }
}
