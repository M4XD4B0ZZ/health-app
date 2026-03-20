import { logResolvedNutritionInput } from '../application/logResolvedNutritionInput';

describe('logResolvedNutritionInput - Bugfix Tests', () => {
  describe('duplicate execution prevention', () => {
    it('should not execute toast twice for "2 Eier und Toast"', async () => {
      const input = '2 Eier und Toast';
      const result = await logResolvedNutritionInput(input);

      // Verify that we have ready requests for both items
      expect(result.dispatch.readyRequests.length).toBeGreaterThan(0);
      
      // Verify toast is only processed once in persisted entries
      const toastPersisted = result.persistedEntries.filter(entry =>
        entry.rawInput.toLowerCase().includes('toast')
      );
      expect(toastPersisted.length).toBeLessThanOrEqual(1);
      
      // Verify no duplicate execution by checking that persisted entries <= ready requests
      expect(result.persistedEntries.length).toBeLessThanOrEqual(result.dispatch.readyRequests.length);
    });

    it('should have non-zero kcal for recognized entries', async () => {
      const input = '2 Eier und Toast';
      const result = await logResolvedNutritionInput(input);

      // All persisted entries should have calories > 0
      result.persistedEntries.forEach(entry => {
        expect(entry.calories).toBeGreaterThan(0);
      });

      // Should have at least one persisted entry with calories
      expect(result.persistedEntries.length).toBeGreaterThan(0);
      
      // Check that recognized items have proper calories if they exist
      if (result.persistedEntries.length > 0) {
        const hasValidCalories = result.persistedEntries.some(entry => entry.calories > 0);
        expect(hasValidCalories).toBe(true);
      }
    });
  });

  describe('partial success handling', () => {
    it('should handle "Eier und mysteryfood" correctly', async () => {
      const input = 'Eier und mysteryfood';
      const result = await logResolvedNutritionInput(input);

      // Should have some ready requests and some unresolved
      expect(result.dispatch.readyRequests.length + result.dispatch.unresolvedRequests.length).toBeGreaterThan(0);
      
      // Should have unresolved requests for unknown items
      expect(result.dispatch.unresolvedRequests.length).toBeGreaterThan(0);
      
      // Any persisted entries should have proper calories
      result.persistedEntries.forEach(entry => {
        expect(entry.calories).toBeGreaterThan(0);
      });
      
      // Verify mysteryfood is in unresolved
      const hasMysteryfood = result.dispatch.unresolvedRequests.some(req =>
        req.rawName.toLowerCase().includes('mysteryfood')
      );
      expect(hasMysteryfood).toBe(true);
    });
  });

  describe('zero macro prevention', () => {
    it('should not include zero-macro entries in persistedEntries', async () => {
      const input = 'unknown food item';
      const result = await logResolvedNutritionInput(input);

      // Should have no persisted entries for unknown food
      expect(result.persistedEntries).toHaveLength(0);
      
      // But should have unresolved requests
      expect(result.dispatch.unresolvedRequests.length).toBeGreaterThan(0);
    });
  });
});