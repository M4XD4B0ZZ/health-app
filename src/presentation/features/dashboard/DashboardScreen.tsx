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
import { DashboardSummary } from '../../../application/usecases/GetDashboardSummary';

const DashboardScreen: React.FC = () => {
  const [range, setRange] = useState<TimeRange>('today');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback((isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      setError(null);
      const nextSummary = container.getDashboardSummary.execute(range);
      setSummary(nextSummary);
    } catch {
      setError('Fehler beim Laden der Dashboard-Daten.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range]);

  useEffect(() => {
    loadSummary(false);
  }, [loadSummary]);

  const sleepHours = summary?.sleepDurationMinutes
    ? (summary.sleepDurationMinutes / 60).toFixed(1)
    : '–';

  if (loading && !summary) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a90e2" />
        <Text style={styles.loadingText}>Lade Dashboard…</Text>
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
        <Text style={styles.headerText}>Dashboard</Text>
      </View>

      <View style={styles.segmentedControl}>
        <Pressable
          style={[styles.segmentButton, range === 'today' && styles.segmentButtonActive]}
          onPress={() => setRange('today')}
        >
          <Text style={[styles.segmentText, range === 'today' && styles.segmentTextActive]}>Heute</Text>
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
          {range === 'today' ? 'Heutige Zusammenfassung' : 'Zusammenfassung (7 Tage)'}
        </Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Kalorien</Text>
          <Text style={styles.summaryValue}>{summary?.todayCalories ?? 0} kcal</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Letzter Schlaf</Text>
          <Text style={styles.summaryValue}>{sleepHours} h</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Schritte</Text>
          <Text style={styles.summaryValue}>{summary?.todaySteps?.count ?? 0}</Text>
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
    backgroundColor: '#4a90e2',
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
    backgroundColor: '#e6eef8',
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
    backgroundColor: '#4a90e2',
  },
  segmentText: {
    color: '#4a90e2',
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4a90e2',
  },
});

export default DashboardScreen;
