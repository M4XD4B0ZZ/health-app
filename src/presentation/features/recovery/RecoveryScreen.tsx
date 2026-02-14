import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';

const RecoveryScreen: React.FC = () => {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Erholung</Text>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Schlafanalyse</Text>
        <View style={styles.sleepStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>7.5h</Text>
            <Text style={styles.statLabel}>Schlafdauer</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>85%</Text>
            <Text style={styles.statLabel}>Schlafqualität</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>23:30</Text>
            <Text style={styles.statLabel}>Schlafenszeit</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Stresslevel</Text>
        <View style={styles.stressContainer}>
          <View style={styles.stressBar}>
            <View style={[styles.stressLevel, { width: '65%' }]} />
          </View>
          <Text style={styles.stressText}>Moderat</Text>
        </View>
        <Text style={styles.tipText}>
          Tipp: Versuchen Sie heute eine 10-minütige Atemübung, um Ihren Stresslevel zu reduzieren.
        </Text>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Erholungsübungen</Text>
        <View style={styles.exerciseItem}>
          <Text style={styles.exerciseName}>Tiefe Atmung</Text>
          <Text style={styles.exerciseTime}>5 Minuten</Text>
        </View>
        <View style={styles.exerciseItem}>
          <Text style={styles.exerciseName}>Progressive Muskelentspannung</Text>
          <Text style={styles.exerciseTime}>15 Minuten</Text>
        </View>
        <View style={styles.exerciseItem}>
          <Text style={styles.exerciseName}>Leichte Dehnung</Text>
          <Text style={styles.exerciseTime}>10 Minuten</Text>
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
  stressContainer: {
    marginTop: 8,
  },
  stressBar: {
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    marginVertical: 8,
    overflow: 'hidden',
  },
  stressLevel: {
    height: '100%',
    backgroundColor: '#ff9800',
    borderRadius: 6,
  },
  stressText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ff9800',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 12,
    lineHeight: 20,
  },
  exerciseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  exerciseName: {
    fontSize: 16,
    color: '#333',
  },
  exerciseTime: {
    fontSize: 16,
    color: '#9c27b0',
    fontWeight: '500',
  },
});

export default RecoveryScreen;