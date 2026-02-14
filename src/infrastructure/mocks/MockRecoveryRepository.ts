import { RecoveryRepository } from '../../domain/repositories/RecoveryRepository';
import { Sleep, SleepSummary } from '../../domain/models/Sleep';
import { Steps, StepsSummary } from '../../domain/models/Steps';
import { HeartRatePoint, HeartRateSeries, HeartRateSummary } from '../../domain/models/HeartRate';

/**
 * Mock-Implementierung des RecoveryRepository mit deterministischen Testdaten
 */
export class MockRecoveryRepository implements RecoveryRepository {
  // Mock-Daten
  private sleepData: Sleep[] = [
    {
      id: 'sleep-1',
      startTime: new Date(new Date().setHours(23, 30, 0, 0) - 24 * 60 * 60 * 1000), // Gestern 23:30
      endTime: new Date(new Date().setHours(7, 0, 0, 0)), // Heute 7:00
      durationMinutes: 450, // 7.5 Stunden
      quality: 85,
      deepSleepMinutes: 120,
      remSleepMinutes: 90,
      lightSleepMinutes: 240
    },
    {
      id: 'sleep-2',
      startTime: new Date(new Date().setHours(23, 0, 0, 0) - 2 * 24 * 60 * 60 * 1000), // Vorgestern 23:00
      endTime: new Date(new Date().setHours(6, 30, 0, 0) - 24 * 60 * 60 * 1000), // Gestern 6:30
      durationMinutes: 450,
      quality: 80,
      deepSleepMinutes: 110,
      remSleepMinutes: 85,
      lightSleepMinutes: 255
    }
  ];

  private stepsData: Steps[] = [
    {
      id: 'steps-1',
      date: new Date(new Date().setHours(0, 0, 0, 0)), // Heute
      count: 8500,
      distanceMeters: 6800,
      caloriesBurned: 320
    },
    {
      id: 'steps-2',
      date: new Date(new Date().setHours(0, 0, 0, 0) - 24 * 60 * 60 * 1000), // Gestern
      count: 10200,
      distanceMeters: 8160,
      caloriesBurned: 380
    },
    {
      id: 'steps-3',
      date: new Date(new Date().setHours(0, 0, 0, 0) - 2 * 24 * 60 * 60 * 1000), // Vorgestern
      count: 7800,
      distanceMeters: 6240,
      caloriesBurned: 290
    }
  ];

  private heartRateData: HeartRatePoint[] = [
    {
      id: 'hr-1',
      timestamp: new Date(new Date().setHours(8, 0, 0, 0)), // Heute 8:00
      beatsPerMinute: 62,
      measurementType: 'resting'
    },
    {
      id: 'hr-2',
      timestamp: new Date(new Date().setHours(12, 30, 0, 0)), // Heute 12:30
      beatsPerMinute: 78,
      measurementType: 'active'
    },
    {
      id: 'hr-3',
      timestamp: new Date(new Date().setHours(18, 0, 0, 0)), // Heute 18:00
      beatsPerMinute: 72,
      measurementType: 'active'
    },
    {
      id: 'hr-4',
      timestamp: new Date(new Date().setHours(8, 0, 0, 0) - 24 * 60 * 60 * 1000), // Gestern 8:00
      beatsPerMinute: 64,
      measurementType: 'resting'
    }
  ];

  // Schlaf-Methoden
  getSleepById(id: string): Sleep | null {
    return this.sleepData.find(sleep => sleep.id === id) || null;
  }

  getLastSleep(): Sleep | null {
    return this.sleepData.length > 0 ? this.sleepData[0] : null;
  }

  getSleepsByDateRange(startDate: Date, endDate: Date): Sleep[] {
    return this.sleepData.filter(sleep => 
      sleep.startTime >= startDate && sleep.endTime <= endDate
    );
  }

  getSleepSummary(): SleepSummary {
    return {
      lastSleep: this.getLastSleep(),
      averageDurationLastWeek: 450, // 7.5 Stunden im Durchschnitt
      averageQualityLastWeek: 82
    };
  }

  // Schritt-Methoden
  getStepsById(id: string): Steps | null {
    return this.stepsData.find(steps => steps.id === id) || null;
  }

  getStepsByDate(date: Date): Steps | null {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    return this.stepsData.find(steps => {
      const stepsDate = new Date(steps.date);
      stepsDate.setHours(0, 0, 0, 0);
      return stepsDate.getTime() === targetDate.getTime();
    }) || null;
  }

  getStepsByDateRange(startDate: Date, endDate: Date): Steps[] {
    return this.stepsData.filter(steps => 
      steps.date >= startDate && steps.date <= endDate
    );
  }

  getStepsSummary(): StepsSummary {
    const today = this.getStepsByDate(new Date());
    
    return {
      today,
      weeklyAverage: 8800,
      weeklyTotal: 61600,
      monthlyAverage: 8500
    };
  }

  // Herzfrequenz-Methoden
  getHeartRatePointById(id: string): HeartRatePoint | null {
    return this.heartRateData.find(hr => hr.id === id) || null;
  }

  getHeartRateSeriesByDate(date: Date): HeartRateSeries | null {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    const points = this.heartRateData.filter(hr => {
      const hrDate = new Date(hr.timestamp);
      hrDate.setHours(0, 0, 0, 0);
      return hrDate.getTime() === targetDate.getTime();
    });
    
    if (points.length === 0) return null;
    
    const bpms = points.map(p => p.beatsPerMinute);
    
    return {
      date: targetDate,
      points,
      averageBpm: bpms.reduce((sum, bpm) => sum + bpm, 0) / bpms.length,
      minBpm: Math.min(...bpms),
      maxBpm: Math.max(...bpms),
      restingBpm: points.find(p => p.measurementType === 'resting')?.beatsPerMinute
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
      current.timestamp > latest.timestamp ? current : latest
    );
  }

  getRestingHeartRate(): number | null {
    const restingPoints = this.heartRateData.filter(hr => hr.measurementType === 'resting');
    if (restingPoints.length === 0) return null;
    
    // Neueste Ruhepulsmessung zurückgeben
    const latestResting = restingPoints.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );
    
    return latestResting.beatsPerMinute;
  }

  getHeartRateSummary(): HeartRateSummary {
    return {
      today: this.getHeartRateSeriesByDate(new Date()),
      restingHeartRate: this.getRestingHeartRate(),
      weeklyAverageResting: 63,
      weeklyTrend: 'stable'
    };
  }
}