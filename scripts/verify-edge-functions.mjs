const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in environment variables.");
    process.exit(1);
}

const functions = ['food-off-search', 'food-usda-search'];

async function testQuery(funcName, query, expectedStatus) {
    console.log(`Testing ${funcName} with query: "${query}" (Expected: ${expectedStatus})`);
    const endpoint = `${url}/functions/v1/${funcName}`;
    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key}`
        },
        body: JSON.stringify({ query })
    });

    const status = res.status;
    if (status === 401) {
        console.error(`❌ FAILED on ${funcName}: Received 401 Invalid JWT. Ensure the correct project is linked and verify_jwt=false is deployed.`);
        process.exit(1);
    } else if (status !== expectedStatus) {
        console.error(`❌ FAILED on ${funcName}: Expected ${expectedStatus}, got ${status}`);
        const text = await res.text();
        console.error(text);
        process.exit(1);
    }

    console.log(`✅ PASSED (${status})`);
}

async function run() {
    console.log(`Verifying Edge Functions against REMOTE Supabase at Domain: ${new URL(url).hostname}\n`);
    try {
        for (const fn of functions) {
            await testQuery(fn, 'apple', 200);   // Good query (passes validation)
            await testQuery(fn, 'a', 400);       // Bad query (caught by guardrail)
            console.log('');
        }
        console.log("🎉 All remote endpoint tests passed successfully!");
    } catch (err) {
        console.error("Runtime error checking endpoints:", err);
        process.exit(1);
    }
}

run();
