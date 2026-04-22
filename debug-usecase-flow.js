// Debug Test für den kompletten UseCase Flow mit "zwei scheiben schinken"

// Simuliere die UseCase-Logik
function simulateUseCaseFlow() {
  console.log('=== USECASE FLOW SIMULATION ===');
  
  const rawInput = 'zwei scheiben schinken';
  console.log(`1. Raw Input: "${rawInput}"`);
  
  // Parser Mock
  const parsed = { name: 'schinken', quantityCount: 2 };
  console.log(`2. Parser Result:`, parsed);
  
  // Canonical Entity Detection
  const canonicalEntity = {
    id: 'ham',
    aliases: { de: ['schinken'], en: ['ham'] },
    defaultPortion: { unit: 'gram', grams: 30 }
  };
  console.log(`3. Canonical Entity:`, canonicalEntity);
  
  // Quantity Calculation Logic (nach dem Fix)
  let quantityGrams = 0;
  let confidenceScore = 0.35;
  
  if (parsed.quantityGrams !== undefined) {
    // Gramm-Angabe vorhanden
    quantityGrams = parsed.quantityGrams;
    confidenceScore = 0.5;
    console.log(`4a. Explicit grams path: quantityGrams=${quantityGrams}`);
  } else if (
    parsed.quantityCount !== undefined &&
    canonicalEntity?.defaultPortion?.grams
  ) {
    // Support both 'piece' and 'gram' units for quantityCount (FIXED)
    quantityGrams = parsed.quantityCount * canonicalEntity.defaultPortion.grams;
    confidenceScore = 0.5;
    console.log(`4b. ✅ Count with defaultPortion path: quantityGrams=${quantityGrams}`);
  } else if (parsed.quantityCount !== undefined) {
    // Nur Count, keine Gramm-Angabe
    quantityGrams = 0;
    confidenceScore = 0.35;
    console.log(`4c. ❌ Count without defaultPortion path: quantityGrams=${quantityGrams}`);
  } else {
    // Weder Gramm noch Count
    quantityGrams = 0;
    confidenceScore = 0.35;
    console.log(`4d. ❌ No quantity path: quantityGrams=${quantityGrams}`);
  }
  
  console.log(`5. Final quantityGrams: ${quantityGrams}`);
  console.log(`6. Final confidenceScore: ${confidenceScore}`);
  
  // Resolver Mock (würde erfolgreich sein)
  const resolverResult = {
    best: {
      food: {
        id: 'bls-schinken-001',
        name: 'Schinken, gekocht',
        macrosPer100g: { kcal: 125, protein: 20.5, carbs: 0.5, fat: 4.2 }
      },
      score: 0.82
    }
  };
  console.log(`7. Resolver Result: SUCCESS`);
  
  // Macro Calculation (resolvePortionGrams + computeTotals)
  const targetGrams = quantityGrams; // Simplified
  const macrosPer100g = resolverResult.best.food.macrosPer100g;
  const finalMacros = {
    kcal: Math.round((macrosPer100g.kcal * targetGrams) / 100),
    protein: Math.round((macrosPer100g.protein * targetGrams) / 100 * 10) / 10,
    carbs: Math.round((macrosPer100g.carbs * targetGrams) / 100 * 10) / 10,
    fat: Math.round((macrosPer100g.fat * targetGrams) / 100 * 10) / 10
  };
  console.log(`8. Target Grams: ${targetGrams}`);
  console.log(`9. Final Macros:`, finalMacros);
  
  // Zero-Macro Check
  const hasValidMacros = finalMacros.kcal > 0;
  console.log(`10. Zero-Macro Check: ${hasValidMacros ? '✅ PASS' : '❌ FAIL'}`);
  
  // Success Determination
  const success = hasValidMacros;
  console.log(`\n=== FINAL RESULT ===`);
  console.log(`Success: ${success}`);
  console.log(`Reason: ${success ? 'Valid macros calculated' : 'Zero macros - would be blocked'}`);
  
  return { success, quantityGrams, finalMacros };
}

simulateUseCaseFlow();