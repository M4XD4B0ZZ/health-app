import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import container from '../../../infrastructure/di/container';

const DashboardScreen: React.FC = () => {
  const summary = container.getDashboardSummary.execute();
  const sleepHours = summary.sleepDurationMinutes
    ? (summary.sleepDurationMinutes / 60).toFixed(1)
    : '–';

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Dashboard</Text>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Heutige Zusammenfassung</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Kalorien heute</Text>
          <Text style={styles.summaryValue}>{summary.todayCalories} kcal</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Letzter Schlaf</Text>
          <Text style={styles.summaryValue}>{sleepHours} h</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Schritte heute</Text>
          <Text style={styles.summaryValue}>{summary.todaySteps?.count ?? 0}</Text>
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
    backgroundColor: '#4a90e2',
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
