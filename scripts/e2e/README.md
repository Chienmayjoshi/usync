# Two phone end to end check (web build)

1. `scripts/sql.sh scripts/e2e/test-users.sql` creates two confirmed test accounts.
2. `npx expo export --platform web`, serve `dist/` on port 8133.
3. `node scripts/e2e/two-phones.js <out dir>` signs both in, pairs them, drops a line on one phone and
   checks it lands on both, then takes a card. Screenshots go to the out dir.
4. `scripts/sql.sh scripts/e2e/cleanup.sql` removes the test accounts and their space.
