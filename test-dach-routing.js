// Quick test script for DACH routing correction
const {
  BlsStaticSource,
} = require('./src/features/nutrition/infrastructure/catalog/sources/BlsStaticSource');
const { detectInputType } = require('./src/features/nutrition/application/utils/detectInputType');

async function testDachRouting() {
  console.log('=== DACH Routing Correction Test ===\n');

  // Test 1: Input Type Detection
  console.log('1. Input Type Detection:');
  console.log(`   ei: ${detectInputType('ei')}`);
  console.log(`   quark: ${detectInputType('quark')}`);
  console.log(`   nutella: ${detectInputType('nutella')}`);
  console.log('');

  // Test 2: BLS Source Tests
  console.log('2. BLS Source Tests:');
  const blsSource = new BlsStaticSource();

  // Test ei (ambiguous) - should now work
  console.log('   Testing ei (ambiguous):');
  try {
    const eiResults = await blsSource.search({
      raw: 'ei',
      locale: 'de',
      inputType: 'ambiguous',
      normalized: 'ei',
      traceId: 'test-ei',
    });
    console.log(`   ✅ ei found ${eiResults.length} results`);
    if (eiResults.length > 0) {
      console.log(`   ✅ Best match: ${eiResults[0].food.name}`);
    }
  } catch (error) {
    console.log(`   ❌ ei failed: ${error.message}`);
  }

  // Test quark (generic) - should still work
  console.log('   Testing quark (generic):');
  try {
    const quarkResults = await blsSource.search({
      raw: 'quark',
      locale: 'de',
      inputType: 'generic',
      normalized: 'quark',
      traceId: 'test-quark',
    });
    console.log(`   ✅ quark found ${quarkResults.length} results`);
    if (quarkResults.length > 0) {
      console.log(`   ✅ Best match: ${quarkResults[0].food.name}`);
    }
  } catch (error) {
    console.log(`   ❌ quark failed: ${error.message}`);
  }

  // Test nutella (branded) - should be skipped
  console.log('   Testing nutella (branded):');
  try {
    const nutellaResults = await blsSource.search({
      raw: 'nutella',
      locale: 'de',
      inputType: 'branded',
      normalized: 'nutella',
      traceId: 'test-nutella',
    });
    console.log(`   ✅ nutella found ${nutellaResults.length} results (should be 0)`);
  } catch (error) {
    console.log(`   ❌ nutella failed: ${error.message}`);
  }

  // Test English input - should be skipped
  console.log('   Testing egg (English):');
  try {
    const eggResults = await blsSource.search({
      raw: 'egg',
      locale: 'en',
      inputType: 'generic',
      normalized: 'egg',
      traceId: 'test-egg',
    });
    console.log(`   ✅ egg found ${eggResults.length} results (should be 0)`);
  } catch (error) {
    console.log(`   ❌ egg failed: ${error.message}`);
  }

  console.log('\n=== Test Complete ===');
}

testDachRouting().catch(console.error);
