import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import container from '../../../infrastructure/di/container';
import { TimeRange } from '../../../domain/models/TimeRange';
import { RecoverySummaryResult } from '../../../application/usecases/GetRecoverySummary';

const RecoveryScreen: React.FC = () => {
  const [range, setRange] = useState<TimeRange>('today');
  const [summary, setSummary] = useState<RecoverySummaryResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(
    (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        setError(null);
        const nextSummary = container.getRecoverySummary.execute(range);
        setSummary(nextSummary);
      } catch {
        setError('Fehler beim Laden der Erholungsdaten.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [range],
  );

  useEffect(() => {
    loadSummary(false);
  }, [loadSummary]);

  const lastSleep = summary?.lastSleep;
  const sleepHours = lastSleep ? (lastSleep.durationMinutes / 60).toFixed(1) : '–';

  if (loading && !summary) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9c27b0" />
        <Text style={styles.loadingText}>Lade Erholung…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => loadSummary(true)} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerText}>Erholung</Text>
      </View>

      <View style={styles.segmentedControl}>
        <Pressable
          style={[styles.segmentButton, range === 'today' && styles.segmentButtonActive]}
          onPress={() => setRange('today')}
        >
          <Text style={[styles.segmentText, range === 'today' && styles.segmentTextActive]}>
            Heute
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segmentButton, range === 'last7days' && styles.segmentButtonActive]}
          onPress={() => setRange('last7days')}
        >
          <Text style={[styles.segmentText, range === 'last7days' && styles.segmentTextActive]}>
            7 Tage
          </Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {range === 'today' ? 'Schlaf (letzte Nacht)' : 'Schlaf (7 Tage)'}
        </Text>
        <View style={styles.sleepStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{sleepHours}h</Text>
            <Text style={styles.statLabel}>Schlafdauer</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{lastSleep?.quality ?? '–'}%</Text>
            <Text style={styles.statLabel}>Schlafqualität</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {((summary?.sleepSummary.averageDurationLastWeek ?? 0) / 60).toFixed(1)}h
            </Text>
            <Text style={styles.statLabel}>Ø 7 Tage</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {range === 'today' ? 'Heutige Aktivität' : 'Aktivität (7 Tage)'}
        </Text>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Schritte</Text>
          <Text style={styles.metricValue}>
            {summary?.todaySteps?.count ?? 0} / {summary?.stepGoal ?? 0}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Herzfrequenz</Text>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Ruhepuls</Text>
          <Text style={styles.metricValue}>{summary?.restingHeartRate ?? '–'} bpm</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
  },
  header: {
    padding: 16,
    backgroundColor: '#9c27b0',
    marginBottom: 16,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  segmentedControl: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#f3e9f5',
    borderRadius: 8,
    padding: 2,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#9c27b0',
  },
  segmentText: {
    color: '#9c27b0',
    fontWeight: '500',
  },
  segmentTextActive: {
    color: '#fff',
  },
  errorText: {
    marginHorizontal: 16,
    marginBottom: 12,
    color: '#b00020',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  sleepStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#9c27b0',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 16,
    color: '#333',
  },
  metricValue: {
    fontSize: 16,
    color: '#9c27b0',
    fontWeight: '500',
  },
});

export default RecoveryScreen;
