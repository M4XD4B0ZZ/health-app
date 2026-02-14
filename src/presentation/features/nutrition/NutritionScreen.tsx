import React from 'react';
import { StyleSheet, Text, View, ScrollView, FlatList } from 'react-native';
import container from '../../../infrastructure/di/container';

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const NutritionScreen: React.FC = () => {
  const summary = container.getNutritionSummary.execute();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Ernährung</Text>
      </View>
      
      <View style={styles.summaryCard}>
        <Text style={styles.cardTitle}>Tagesübersicht</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.dailySummary.totalCalories}</Text>
            <Text style={styles.summaryLabel}>Kalorien</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.listContainer}>
        <Text style={styles.sectionTitle}>Heutige Mahlzeiten</Text>
        <FlatList
          data={summary.todayEntries}
          renderItem={({ item }) => (
            <View style={styles.mealItem}>
              <View>
                <Text style={styles.mealTitle}>{item.name}</Text>
                <Text style={styles.mealTime}>{formatTime(item.timestamp)}</Text>
              </View>
              <Text style={styles.mealCalories}>{item.calories} kcal</Text>
            </View>
          )}
          keyExtractor={item => item.id}
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
