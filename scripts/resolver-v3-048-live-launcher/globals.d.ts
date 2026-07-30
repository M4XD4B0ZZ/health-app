/**
 * Ambient declaration for the launcher's isolated `tsc` build only. The Protocol-v4 dependency
 * graph reuses shared domain code (`FoodCatalogConfig.ts`) whose `typeof __DEV__ !== 'undefined'`
 * guard is already runtime-safe under plain Node (it falls back to `process.env.NODE_ENV`) --
 * this repository's main app build gets the ambient `__DEV__` type from Expo/React Native's own
 * generated typings, which this narrower, RN-free build intentionally does not pull in. This file
 * supplies only the missing compile-time name, changing no runtime behavior.
 */
declare const __DEV__: boolean | undefined;
