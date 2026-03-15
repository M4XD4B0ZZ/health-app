import fs from 'fs';
import path from 'path';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
if (!url) {
  console.error('❌ EXPO_PUBLIC_SUPABASE_URL is not defined in environment variables.');
  process.exit(1);
}

let expectedProjectRef;
try {
  const parsedUrl = new URL(url);
  expectedProjectRef = parsedUrl.hostname.split('.')[0];
} catch (e) {
  console.error('❌ Invalid EXPO_PUBLIC_SUPABASE_URL format:', url);
  process.exit(1);
}

const projectRefPath = path.join(process.cwd(), 'supabase', '.temp', 'project-ref');
let linkedProjectRef = null;

if (fs.existsSync(projectRefPath)) {
  linkedProjectRef = fs.readFileSync(projectRefPath, 'utf8').trim();
}

console.log(`Expected Project Ref (from env): ${expectedProjectRef}`);
console.log(`Linked Project Ref (from CLI):   ${linkedProjectRef || 'None'}`);

if (!linkedProjectRef) {
  console.error('\n❌ FAILED: Supabase CLI is not linked to any project locally.');
  console.error(
    `Run \`npm run supabase:link\` or \`npx supabase link --project-ref ${expectedProjectRef}\` to fix.\n`,
  );
  process.exit(1);
}

if (linkedProjectRef !== expectedProjectRef) {
  console.error(
    `\n❌ FAILED: Supabase CLI is linked to a different project (${linkedProjectRef}) than the app expects (${expectedProjectRef}).`,
  );
  console.error(`Run \`npx supabase link --project-ref ${expectedProjectRef}\` to fix.\n`);
  process.exit(1);
}

console.log('\n✅ PASSED: Supabase project alignment is correct.');
