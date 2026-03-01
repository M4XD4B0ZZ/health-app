# Supabase Edge Functions

## Testing Edge Guardrails Locally

To test query guardrails and rate limiting locally, first ensure your local supabase environment is running:

```bash
npx supabase start
```

### 1. Good Query (Passes)
Should return 200 OK and valid JSON response:

```bash
curl -i -X POST 'http://127.0.0.1:54321/functions/v1/food-off-search' \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"query":"apple"}'
```

### 2. Bad Query (Rejected - 400 Bad Request)
Testing a query that is too short, too long, or spammy:

```bash
# Too short
curl -i -X POST 'http://127.0.0.1:54321/functions/v1/food-off-search' \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"query":"a"}'

# Spammy
curl -i -X POST 'http://127.0.0.1:54321/functions/v1/food-off-search' \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"query":"aaaa"}'
```
Expected output:
```json
{"error":"BAD_QUERY","message":"Query too short (min 2)"}
```

### 3. Rate Limit Exceeded (429 Too Many Requests)
Run this bash loop to trigger the rate limit quickly (limit is 30 per minute per client).

```bash
for i in {1..35}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST 'http://127.0.0.1:54321/functions/v1/food-off-search' \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"query":"apple"}'
done
```
The last few responses will be `429`.

### Abuse Logs
You can view the structured abuse logs indicating `ABUSE_DETECTED` inside the Supabase Studio Logs explorer or docker output via:
```bash
npx supabase functions serve
```

## Deployment

To guarantee that the functions are successfully deployed to the remote project with anonymous access (`verify_jwt = false`) enabled, use the following SSOK-compliant workflow scripts from the project root:

### 1. Identify and Link
First, verify that your local Supabase CLI is linked to the same project defined in your `.env`:
```bash
npm run verify:supabase:link
```
If this fails, link it using:
```bash
npm run supabase:link
```

### 2. Verify Database Schema (No Docker Required)
Edge Functions require specific tables to exist in your remote database to function properly without throwing `500` errors (`SUPABASE_GET_FAILED: 404`).

Run the schema verification script to ensure your remote database has the required tables:
```bash
npm run verify:schema
```

**If `verify:schema` fails (404), follow these steps to create the tables manually via the Supabase Dashboard:**
1. Open your project's [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql/new).
2. Copy the entire contents of `supabase/migrations/20260215_food_catalog_tables.sql`.
3. Paste the SQL script into the editor and click **Run**.
4. Re-run `npm run verify:schema` and verify it passes.

### 3. Deploy and Verify (Hardened)
Deploy both functions explicitly with the `--no-verify-jwt` flags, and immediately run the remote edge verification suite:
```bash
npm run deploy:edge:verify
```

### 4. Test Locally
After the scripts pass successfully, you can reset your local Expo cache and try the app:
```bash
npx expo start -c
```
