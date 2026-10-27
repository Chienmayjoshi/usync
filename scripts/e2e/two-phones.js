// Cloud containers ship playwright with a matching Chromium; older ones only had playwright-core.
const { chromium } = (() => { try { return require('playwright'); } catch { return require('playwright-core'); } })();
const out = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } });
  const mk = async (tag) => {
    const ctx = await b.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 1.5, ignoreHTTPSErrors: true });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => console.log(tag, 'PAGEERROR', String(e).slice(0, 200)));
    p.on('console', (m) => { if (m.type() === 'error') console.log(tag, 'CONSOLE', m.text().slice(0, 200)); });
    await p.goto('http://localhost:8133/', { waitUntil: 'networkidle' });
    return p;
  };
  const shot = (p, n) => p.screenshot({ path: `${out}/${n}.png` });
  const signIn = async (p, email, name) => {
    await p.getByText('I already have an account').click();
    await p.getByPlaceholder('you@example.com').fill(email);
    await p.getByPlaceholder('6 characters or more').fill('usync-test-1');
    await p.getByText('Sign in', { exact: true }).click();
    await p.getByPlaceholder('Rahul').waitFor({ timeout: 15000 });
    await p.getByPlaceholder('Rahul').fill(name);
    await p.getByText('Continue', { exact: true }).click();
    await p.getByText('Start our space').waitFor({ timeout: 15000 });
  };
  const r = await mk('R');
  await shot(r, 'e0-signin');
  await signIn(r, 'test-r@usync.dev', 'Rahul');
  await shot(r, 'e1-pair');
  await r.getByText('Start our space').click();
  await r.getByText('Invite your person').waitFor({ timeout: 15000 });
  await sleep(800);
  await shot(r, 'e2-solo-deck');
  const code = (await r.locator('text=/^[A-HJ-NP-Z2-9]{6}$/').first().innerText()).trim();
  console.log('code', code);
  const m = await mk('M');
  await signIn(m, 'test-m@usync.dev', 'Meera');
  await m.getByPlaceholder('K7Q2MX').fill(code);
  await m.getByText('Join with code').click();
  await m.getByText('Drop it', { exact: true }).first().waitFor({ timeout: 15000 });
  await sleep(2500);
  await shot(r, 'e3-r-after-join');
  // Rahul drops one dictated line with two jobs.
  await r.getByText('Drop it', { exact: true }).first().click();
  await r.locator('textarea').fill('kal electrician ko bulana hai aur amazon parcel return karna hai');
  await r.getByText('Drop it', { exact: true }).last().click();
  await sleep(4500);
  await shot(r, 'e4-r-after-drop');
  await shot(m, 'e5-m-live');
  // Meera takes her top card by swiping right.
  await m.mouse.move(140, 360); await m.mouse.down();
  for (let i = 1; i <= 20; i++) { await m.mouse.move(140 + 14 * i, 360); await sleep(16); }
  await m.mouse.up(); await sleep(3000);
  await shot(m, 'e6-m-took');
  await shot(r, 'e7-r-sees');
  // M4: Meera holds her card and says what changed; it parks in Waiting.
  await m.mouse.move(200, 400); await m.mouse.down(); await sleep(900); await m.mouse.up();
  await m.getByText('What changed?').waitFor({ timeout: 8000 });
  await m.locator('textarea').fill('he needs a spare part, back tuesday 11am');
  await sleep(300);
  await shot(m, 'e8-m-update');
  await m.getByText('Save update').click();
  await sleep(3000);
  await shot(r, 'e9-r-sees-waiting');
  // The technician comes back: Meera closes it from the waiting list on the Us tab.
  await m.getByText('Us', { exact: true }).click();
  await m.getByText('Done', { exact: true }).click();
  await sleep(3000);
  // Rahul sends a heart from the Us tab; Meera sees it arrive.
  await r.getByText('Us', { exact: true }).click();
  await r.getByText('Send a heart').waitFor({ timeout: 8000 });
  await shot(r, 'e10-r-us-wins');
  await r.getByText('Send a heart').click();
  await sleep(2500);
  await shot(m, 'e11-m-gets-heart');
  // Sunday Sync: notes stay sealed until both write.
  for (const [p, note] of [[r, 'Thanks for wrangling the electrician'], [m, 'Thanks for handling the parcel']]) {
    await p.getByText('Sync', { exact: true }).click();
    await p.getByPlaceholder('Thanks for chasing the electrician').fill(note);
    await p.getByText('Seal it').click();
    await sleep(2500);
  }
  await shot(r, 'e12-r-sync-revealed');
  await b.close();
})().catch((e) => { console.log('FAILED', e.message.split('\n')[0]); process.exit(1); });
