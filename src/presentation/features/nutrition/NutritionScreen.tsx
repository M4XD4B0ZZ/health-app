import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import container from '../../../infrastructure/di/container';
import { TimeRange } from '../../../domain/models/TimeRange';
import { NutritionSummaryResult } from '../../../application/usecases/GetNutritionSummary';

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const NutritionScreen: React.FC = () => {
  const [range, setRange] = useState<TimeRange>('today');
  const [summary, setSummary] = useState<NutritionSummaryResult | null>(null);
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
        const nextSummary = container.getNutritionSummary.execute(range);
        setSummary(nextSummary);
      } catch {
        setError('Fehler beim Laden der Ernährungsdaten.');
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

  if (loading && !summary) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4caf50" />
        <Text style={styles.loadingText}>Lade Ernährung…</Text>
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
        <Text style={styles.headerText}>Ernährung</Text>
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

      <View style={styles.summaryCard}>
        <Text style={styles.cardTitle}>
          {range === 'today' ? 'Tagesübersicht' : 'Übersicht (7 Tage)'}
        </Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary?.dailySummary.totalCalories ?? 0}</Text>
            <Text style={styles.summaryLabel}>Kalorien</Text>
          </View>
        </View>
      </View>

      <View style={styles.listContainer}>
        <Text style={styles.sectionTitle}>
          {range === 'today' ? 'Heutige Mahlzeiten' : 'Mahlzeiten (7 Tage)'}
        </Text>
        <FlatList
          data={summary?.todayEntries ?? []}
          renderItem={({ item }) => (
            <View style={styles.mealItem}>
              <View>
                <Text style={styles.mealTitle}>{item.name}</Text>
                <Text style={styles.mealTime}>{formatTime(item.timestamp)}</Text>
              </View>
              <Text style={styles.mealCalories}>{item.calories} kcal</Text>
            </View>
          )}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
        />
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
    backgroundColor: '#4caf50',
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
    backgroundColor: '#e9f6ea',
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
    backgroundColor: '#4caf50',
  },
  segmentText: {
    color: '#4caf50',
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
  summaryCard: {
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
    justifyContent: 'center',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4caf50',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  listContainer: {
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  mealItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  mealTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  mealTime: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  mealCalories: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4caf50',
  },
});

export default NutritionScreen;
