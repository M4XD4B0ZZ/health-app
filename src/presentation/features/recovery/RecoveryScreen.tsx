import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import container from '../../../infrastructure/di/container';

const RecoveryScreen: React.FC = () => {
  const summary = container.getRecoverySummary.execute();
  const lastSleep = summary.lastSleep;
  const sleepHours = lastSleep ? (lastSleep.durationMinutes / 60).toFixed(1) : '–';

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Erholung</Text>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Schlaf (letzte Nacht)</Text>
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
            <Text style={styles.statValue}>{summary.sleepSummary.averageDurationLastWeek / 60}h</Text>
            <Text style={styles.statLabel}>Ø 7 Tage</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Heutige Aktivität</Text>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Schritte</Text>
          <Text style={styles.metricValue}>{summary.todaySteps?.count ?? 0} / {summary.stepGoal}</Text>
        </View>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Herzfrequenz</Text>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Ruhepuls</Text>
          <Text style={styles.metricValue}>{summary.restingHeartRate ?? '–'} bpm</Text>
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
