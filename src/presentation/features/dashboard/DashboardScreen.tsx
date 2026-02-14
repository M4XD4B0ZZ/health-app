import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';

const DashboardScreen: React.FC = () => {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Dashboard</Text>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Aktivitätsübersicht</Text>
        <Text style={styles.cardContent}>
          Hier werden Ihre täglichen Aktivitäten und Fortschritte angezeigt.
          Diese Ansicht wird später mit echten Daten gefüllt.
        </Text>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Gesundheitswerte</Text>
        <Text style={styles.cardContent}>
          Übersicht Ihrer wichtigsten Gesundheitswerte und Trends.
        </Text>
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
    marginBottom: 8,
    color: '#333',
  },
  cardContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default DashboardScreen;