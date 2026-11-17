// Production release guard: refuse to ship a checkout that lost the admin email manager.
// The Vercel project build command invokes this independently of package.json.
import { readFileSync } from 'node:fs';

const requirements = [
  ['src/App.tsx', [
    /path=["']\/admin-email["'][\s\S]{0,180}\/admin-panel-nikhil\?tab=email/,
    /path=["']\/admin-panel-nikhil["']/,
  ]],
  ['src/pages/AdminPanelNikhil.tsx', [
    /import\s*\{\s*AdminMailflareStudio\s*\}/,
    /id:\s*['"]email['"][\s\S]{0,80}Email Manager/,
    /<TabsContent\s+value=["']email["'][\s\S]{0,300}<AdminMailflareStudio/,
  ]],
  ['src/pages/Admin.tsx', [/<AdminMailflareStudio\b/]],
  ['src/components/admin/AdminMailflareStudio.tsx', [/syncResendInbox/, /Sync Resend/, /CUSTOMER_EMAIL_TEMPLATES/]],
  ['src/lib/mailflareClient.ts', [/retro_hello/, /resend-inbox-sync/]],
  ['supabase/functions/resend-inbox-sync/index.ts', [/Admin access required/, /api\.resend\.com\/emails\/receiving/]],
];

let failed = false;
for (const [file, checks] of requirements) {
  let contents;
  try { contents = readFileSync(file, 'utf8'); }
  catch { console.error(`Email Manager release guard: missing ${file}`); failed = true; continue; }
  for (const check of checks) {
    if (!check.test(contents)) {
      console.error(`Email Manager release guard: required integration missing in ${file}: ${check}`);
      failed = true;
    }
  }
}
if (failed) {
  console.error('Production build stopped. Merge the current Email Manager and Resend sync before deploying.');
  process.exit(1);
}
console.log('Email Manager release guard passed.');
