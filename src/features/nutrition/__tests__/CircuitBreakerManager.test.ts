import { CircuitBreakerManager } from '../application/services/CircuitBreakerManager';
import { FoodCatalogError } from '../domain/errors/FoodCatalogError';

describe('CircuitBreakerManager', () => {
  let manager: CircuitBreakerManager;

  beforeEach(() => {
    manager = new CircuitBreakerManager(
      3, // failureThreshold
      120000, // cooldownMs (2 minutes)
      true, // enabled
    );
  });

  describe('Circuit State Management', () => {
    it('starts with circuit closed', () => {
      expect(manager.isOpen('off')).toBe(false);

      const state = manager.getState('off');
      expect(state.circuitOpen).toBe(false);
      expect(state.failureCount).toBe(0);
      expect(state.lastFailureAt).toBeNull();
      expect(state.openUntil).toBeNull();
    });

    it('opens circuit after threshold failures', () => {
      const error = FoodCatalogError.network('Network error');

      manager.recordFailure('off', error);
      expect(manager.isOpen('off')).toBe(false);

      manager.recordFailure('off', error);
      expect(manager.isOpen('off')).toBe(false);

      const circuitOpened = manager.recordFailure('off', error);
      expect(circuitOpened).toBe(true);
      expect(manager.isOpen('off')).toBe(true);

      const state = manager.getState('off');
      expect(state.circuitOpen).toBe(true);
      expect(state.failureCount).toBe(3);
      expect(state.openUntil).toBeGreaterThan(Date.now());
    });

    it('resets circuit on success', () => {
      const error = FoodCatalogError.network('Network error');

      manager.recordFailure('off', error);
      manager.recordFailure('off', error);

      let state = manager.getState('off');
      expect(state.failureCount).toBe(2);

      manager.recordSuccess('off');

      state = manager.getState('off');
      expect(state.failureCount).toBe(0);
      expect(state.lastFailureAt).toBeNull();
      expect(state.openUntil).toBeNull();
      expect(manager.isOpen('off')).toBe(false);
    });

    it('tracks circuits independently per source', () => {
      const error = FoodCatalogError.network('Network error');

      // OFF failures
      manager.recordFailure('off', error);
      manager.recordFailure('off', error);
      manager.recordFailure('off', error);

      // USDA failure
      manager.recordFailure('usda', error);

      expect(manager.isOpen('off')).toBe(true);
      expect(manager.isOpen('usda')).toBe(false);

      const offState = manager.getState('off');
      const usdaState = manager.getState('usda');

      expect(offState.failureCount).toBe(3);
      expect(usdaState.failureCount).toBe(1);
    });
  });

  describe('Countable Errors', () => {
    it('counts network errors', () => {
      const error = FoodCatalogError.network('Network error');

      manager.recordFailure('off', error);
      const state = manager.getState('off');

      expect(state.failureCount).toBe(1);
    });

    it('counts edge errors', () => {
      const error = FoodCatalogError.edge('Edge function error');

      manager.recordFailure('off', error);
      const state = manager.getState('off');

      expect(state.failureCount).toBe(1);
    });

    it('counts rate_limit errors', () => {
      const error = FoodCatalogError.rateLimit('Rate limit exceeded');

      manager.recordFailure('off', error);
      const state = manager.getState('off');

      expect(state.failureCount).toBe(1);
    });

    it('counts timeout errors', () => {
      const error = FoodCatalogError.timeout('Timeout exceeded');

      manager.recordFailure('off', error);
      const state = manager.getState('off');

      expect(state.failureCount).toBe(1);
    });

    it('does not count invalid_payload errors', () => {
      const error = FoodCatalogError.invalidPayload('Invalid payload');

      manager.recordFailure('off', error);
      const state = manager.getState('off');

      expect(state.failureCount).toBe(0);
    });

    it('does not count non-FoodCatalogError errors', () => {
      const error = new Error('Generic error');

      manager.recordFailure('off', error);
      const state = manager.getState('off');

      expect(state.failureCount).toBe(0);
    });
  });

  describe('Cooldown Behavior', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('closes circuit after cooldown period', () => {
      const error = FoodCatalogError.network('Network error');

      // Open circuit
      manager.recordFailure('off', error);
      manager.recordFailure('off', error);
      manager.recordFailure('off', error);

      expect(manager.isOpen('off')).toBe(true);

      // Advance time by half cooldown
      jest.advanceTimersByTime(60000); // 1 minute
      expect(manager.isOpen('off')).toBe(true);

      // Advance time past cooldown
      jest.advanceTimersByTime(70000); // 1 minute 10 seconds more (total 2:10)
      expect(manager.isOpen('off')).toBe(false);

      // State should be reset after cooldown
      const state = manager.getState('off');
      expect(state.circuitOpen).toBe(false);
      expect(state.failureCount).toBe(0);
    });
  });

  describe('Disabled Circuit Breaker', () => {
    it('does nothing when disabled', () => {
      const disabled = new CircuitBreakerManager(3, 120000, false);
      const error = FoodCatalogError.network('Network error');

      disabled.recordFailure('off', error);
      disabled.recordFailure('off', error);
      disabled.recordFailure('off', error);

      expect(disabled.isOpen('off')).toBe(false);

      const state = disabled.getState('off');
      expect(state.failureCount).toBe(0);
    });
  });

  describe('Reset Methods', () => {
    it('resets specific source', () => {
      const error = FoodCatalogError.network('Network error');

      manager.recordFailure('off', error);
      manager.recordFailure('off', error);
      manager.recordFailure('usda', error);

      manager.reset('off');

      const offState = manager.getState('off');
      const usdaState = manager.getState('usda');

      expect(offState.failureCount).toBe(0);
      expect(usdaState.failureCount).toBe(1);
    });

    it('resets all sources', () => {
      const error = FoodCatalogError.network('Network error');

      manager.recordFailure('off', error);
      manager.recordFailure('off', error);
      manager.recordFailure('usda', error);

      manager.resetAll();

      const offState = manager.getState('off');
      const usdaState = manager.getState('usda');

      expect(offState.failureCount).toBe(0);
      expect(usdaState.failureCount).toBe(0);
    });
  });
});
