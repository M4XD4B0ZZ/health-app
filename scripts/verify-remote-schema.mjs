const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in environment variables.");
    process.exit(1);
}

const tables = ['food_query_cache', 'food_catalog_items'];

async function verifyTableExists(tableName) {
    console.log(`Checking table: ${tableName}...`);
    const endpoint = `${url}/rest/v1/${tableName}?select=id&limit=1`;

    const res = await fetch(endpoint, {
        method: "GET",
        headers: {
            "apikey": key,
            "Authorization": `Bearer ${key}`
        }
    });

    const status = res.status;

    // 404 means the table does not exist at all on the remote database.
    if (status === 404) {
        console.error(`❌ FAILED: Table '${tableName}' does not exist on the remote database (404 Not Found).`);
        console.error(`Please run the SQL migration manually in your Supabase Dashboard to create it.`);
        process.exit(1);
    }

    // 200 means the table exists and anon can read it (though our RLS usually blocks it if no session).
    // 401/403 means the table exists but RLS correctly blocks anonymous reads. Both are passing states for existence.
    if (status === 200 || status === 401 || status === 403) {
        console.log(`✅ PASSED: Table '${tableName}' exists (HTTP ${status}).`);
        return;
    }

    // Any other status is unexpected
    console.error(`❌ FAILED: Unexpected status ${status} checking ${tableName}.`);
    const text = await res.text();
    console.error(text);
    process.exit(1);
}

async function run() {
    console.log(`Verifying Database Schema against REMOTE Supabase at Domain: ${new URL(url).hostname}\n`);
    try {
        for (const table of tables) {
            await verifyTableExists(table);
        }
        console.log("\n🎉 All schema existence tests passed! The tables are ready for Edge Functions.");
    } catch (err) {
        console.error("Runtime error checking schema:", err);
        process.exit(1);
    }
}

run();
