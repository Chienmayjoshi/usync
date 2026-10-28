# usync: product thinking + MVP build plan

## Context

Repo `chienmayjoshi/usync` is empty (no commits on `claude/gallant-bohr-s0xwkr`). Chinmay wants a couples app that splits household work fairly, nudges at the right time, groups work into buckets automatically, and strengthens the relationship. Explicitly NOT a list app, habit tracker, or reminder app. Input must be one line: log it and forget it. The AI owns effort, timing, assignment, and grouping.

## 0. Interview decisions (Oct 24, override anything below that conflicts)

* **Ambition**: a real business, launched as a store app; the case study is a by product.
* **Market**: urban India first. English UI; Drop understands **English + Hinglish** ("kal electrician ko bulana hai"). WhatsApp only for the invite link; **push is the only nudge channel**.
* **Scope shift: no daily chores.** Dishes, laundry, cooking are settled habits and rarely traded. usync is for **non daily life admin**: repairs and service visits, bookings, calls, paperwork, renewals, big purchases, returns, family events, travel planning, gifts. All dishes/laundry examples and the 12 chore calibration deck are replaced.
  * Calibration becomes **10 life admin styles** (phone calls, bookings, paperwork, repairs, big purchases, bills and renewals, family events, travel planning, returns, gifts): Love / Fine / Hate. Reveal example: "You both hate phone calls. Rahul secretly loves planning trips."
  * Buckets: **Home** (repairs, services), **Admin** (paperwork, renewals, bills), **Errands** (buy, return, pick up), **Family** (events, in laws, visits), **Us**.
  * Recurring stays, aimed at **renewals and servicing** (insurance, car service, AC service, rent agreement): the AI resurfaces the card ahead of time and rotates the owner.
* **Multi step jobs** = one card, AI suggested steps on its back (tickable; individual steps can be handed to the partner). The deck never floods.
* **AI assists, never acts**: drafts the WhatsApp to the electrician, suggests whom to call, builds document checklists. Humans press send. No booking or messaging on anyone's behalf.
* **No money in v1**: no amounts, no splitting, no balances.
* **No calendar integration in v1**: free windows come from calibration and behaviour.
* **Couples**: married or not, living together or apart, including newly married with in laws. Design must not assume one shared home (be home cards go to whoever is local).
* **Partner visibility**: glance, not inspect. The Us tab shows what they're on and what's waiting; never due dates, slips or history detail.
* **Exit**: either partner can leave anytime; shared history freezes read only for 30 days, then deletes. Neutral copy only ("Meera left the space").
* **Privacy**: voice is transcribed then audio deleted; no document uploads in v1; card text encrypted at rest; AI provider with no training on user data.
* **Business**: couple subscription (one plan covers both). Price is not decided: test willingness to pay at the end of beta. A free tier with a weekly cap on AI sorts covers AI cost.
* **Team and timeline**: Chinmay designs, Claude writes most code, Chinmay reviews. ~12 weeks to a TestFlight / Play internal beta with 20 to 30 couples.
* **Beta success** = % of couples where **both** partners act weekly in week 4, plus thanks sent per week.
* **Name**: "usync" is a working name; run a naming sprint (trademark, domain, store availability) before the store listing.

## 0b. Interactivity + gamification and build approach (Oct 24)

### Gamification: co-op only, never a scoreboard
Principle: every game mechanic is **the two of you vs. life admin**, never partner vs. partner. Nothing ranks, counts or compares partners (rule F2 stands). Ceremony scales inversely with frequency.

Mechanics (MVP):
1. **Physical deck play**: deal-in animation, swipe with tilt + haptics, plunk press, flip to card back, drag a card onto the partner avatar to trade. The deck behaves like real cards.
2. **Hand cleared**: when your daily hand is empty, a short co-op moment ("Hand cleared. Meera's on her last one.") Your partner's progress is shown as a glance, never a number.
3. **Story album (collectibles)**: every closed saga becomes a collectible story card in a shared album ("The electrician saga, Oct 2026"). Rare cards for together jobs and secrets revealed. This is memory, not points.
4. **Weeks in sync**: one shared, forgiving counter of Sundays both completed. Missing a week pauses it, never resets or shames ("Paused. Pick it up next Sunday").
5. **Unlockable art**: the seesaw / balance scene evolves with shared milestones (first saga, first trip planned, 10 weeks in sync). Chinmay's illustrations as Rive states; the reward is beauty, not badges.
6. **Surprise moments**: secret card reveals, mutual Sync reveal, the calibration reveal. Variable reward used only for positive, shared moments.
Banned: individual points, leaderboards, per person streaks, loss framing, confetti on routine actions.

### Build approach (recommended): code the MVP now, Figma as reference only
* We have 34 frames, tokens and components mapped 1:1 to code. That is enough to build the whole core loop.
* Interactivity and gamification live in motion, gesture and haptics, which static Figma frames cannot validate. Designing them as frames then rebuilding in code doubles the work; prototyping them in Expo on a real phone is the faster and truer test.
* Rule going forward: **new UI is designed in code** (Chinmay reviews on device via Expo Go). Figma is used only for (a) illustration/Rive art, (b) quick low fi frames when a flow decision is ambiguous, (c) syncing finalized components back for the case study later.
* Remaining Figma polish (widow on 21, + icon, calibration tone, onboarding 01) is folded into code, not redrawn.

### Decisions locked (Oct 24): co-op gamification only; code the MVP now; must be testable on Chinmay's Android and iPhone.

### Device testing path (both platforms)
* **Phase 1, weeks 1 to 3: Expo Go on both phones, zero accounts or fees.** Code stays Expo Go compatible: Reanimated, Gesture Handler, Skia, expo-haptics, expo-av all run in Expo Go. Two swaps from the earlier stack to keep that true: theme = plain typed `theme/tokens.ts` + `StyleSheet` (not Unistyles v3, which needs a native build), and Rive deferred (balance scene drawn in Skia for now).
  * How Chinmay runs it: `git pull`, `npm install`, `npx expo start` on his laptop, scan the QR code with Expo Go on the iPhone (Camera app) and on Android (Expo Go app), both on the same Wi-Fi. Fallback when not on the same network: `npx expo start --tunnel`.
  * The cloud container cannot run simulators or reach phones, so every push is verified by `tsc`, lint and unit tests here, and by Chinmay on device.
* **Phase 2, from week 4: EAS development builds** once native modules arrive (Rive, push notifications, Unistyles if we still want it). Android: an installable APK link, no account fee. iPhone: needs the Apple Developer Program ($99/yr) and the device registered for internal distribution; TestFlight later for beta couples. Requires a free Expo account for EAS.

### First 2 weeks of build
1. Expo (SDK current) + Expo Router + TypeScript scaffold; `theme/tokens.ts` generated from the Figma variables (names 1:1 with Figma code syntax), Fraunces + Manrope via expo-google-fonts, `phosphor-react-native` icons. `eas.json` and `app.config.ts` committed now so Phase 2 is a config flip.
2. `ui/` primitives with motion: PopButton (plunk press + haptic), PopCard/DealCard (Skia edges), SwipeDeck (Reanimated + Gesture Handler: swipe right/left/up, tilt, deal-in), card flip.
3. Clickable Deck + Drop + Deal + Done/Thanks with local mock data (no backend yet), so the feel can be judged on device in week 1.
4. Then Supabase schema, pairing, sort edge function (Claude Haiku), push.

Sprint 1 deliverable (pushed to `claude/gallant-bohr-s0xwkr`): a mock data app Chinmay opens in Expo Go on both phones with Deck (swipe right take / left trade / up together, deal-in, haptics), card flip to JobStory, Drop sheet (typed line → fake sort shimmer → card), Done + Thanks with the hand cleared moment, and a stub Sync replay. Verification here: `npx tsc --noEmit`, ESLint, Jest tests for the deck state reducer and trade rules (one trade, then table). Verification on device: Chinmay's checklist per screen (feel of swipe, haptics, text fit on both phones).

## 0c. Phone only testing (Oct 25, Chinmay has no laptop at hand)

Context: Expo Go normally loads the app from `npx expo start` on a laptop. Chinmay wants to test from his phone alone, and the push is blocked (403, no GitHub access).

1. **Unblock GitHub (Chinmay, in phone browser)**: open https://claude.ai/connect-github, reconnect, install the Claude GitHub App on `Chienmayjoshi/usync`. Then I push the existing local commit.
2. **Today, zero setup: web preview link.** Rebuild `npx expo export --platform web`, publish the `dist/` folder as a private Artifact (index.html + `_expo/` JS + fonts via `files`). Chinmay opens it in Safari / Chrome on his phone: touch swipes, flip, Drop sheet and hand cleared all work; haptics and native feel do not. Good for flow and copy review, not for gesture feel.
3. **Real native app on phone, no laptop: EAS Update into Expo Go.** Chinmay (phone browser): create a free Expo account at expo.dev, make an access token, add it as `EXPO_TOKEN` in this environment's secrets, and allow `api.expo.dev`, `u.expo.dev`, `expo.dev` in the environment network policy. I then run `npx eas-cli@latest init` + `eas update --branch preview` from the container and send him the Expo Go link / QR. Every later change ships the same way. Needs `expo-updates` added and `runtimeVersion` / `updates.url` in app.json (config only, still Expo Go compatible).

Verification: web link opens and swipes on his phone; after step 3, the update link opens in Expo Go on both iPhone and Android with haptics.

### 0d. Laptop available (Oct 27)

The laptop path replaces 0c step 3 (no EAS needed). Blocker is still the 403 push: Chinmay reconnects GitHub, I push, he runs `git checkout claude/gallant-bohr-s0xwkr`, `npm install`, `npx expo start` (or `--tunnel`) and scans with Expo Go on both phones. His device notes (swipe threshold, haptics, flip vs hold, title fit) drive the next sprint, starting with drag a card onto the partner avatar to trade.

## 0e. MVP to real device testing (Oct 27, overrides polish work)

Context: Chinmay wants the MVP finished and tested with real scenarios on real phones before any more aesthetics. Polish (plate titles, art, motion tuning) is frozen until M5.

### Where we are
Oct 27 update 3: M3 built and verified server side. Budget lives in Postgres (`0003_m3.sql`): a pg_cron tick every 10 minutes queues new hands (09:00 and 18:00 local, max 2 a day, never your own drops) and nudges (one card untouched 3+ days, max 2 a day, 4h apart, 10:00 to 20:00), triggers queue thanks and the Sync reveal immediately, quiet hours (22:00 to 08:00, per member `tz`) hold everything, and pg_net posts straight to Expo's push API. No edge function needed. Verified: `scripts/e2e/push-check.sql` (all four kinds, budget holds on a second tick, quiet hold to 08:00, dead tokens pruned from Expo's DeviceNotRegistered answer, RLS) and the two phone web e2e. App registers its token after pairing; phones without push (Expo Go on Android, web) get the same messages as in app banners on open. EAS project `@chienmayjoshis-team/usync` linked, EAS Update configured (channel `preview`). Blocked on Chinmay: Firebase for Android push (steps below), then one preview APK build. iPhone gets push inside Expo Go.

Oct 27 update 2: M4 done and verified end to end (hold to update with waiting detection, waiting list on Us with Back on track / Done, thanks hearts delivered live, Sunday Sync replay + sealed appreciations + next hand, weeks in sync, leave space, delete account). Remaining: M3 notifications (needs EXPO_TOKEN as an environment variable and expo.dev, api.expo.dev, u.expo.dev, exp.host allowed), then M5 real test.

Oct 27 update: M1 core is built and verified end to end on the web build against the real Supabase project (sign in, name, start or join a space by code, live shared deck, fairness dealing, server enforced moves with undo). Supabase has `Confirm email` on until Chinmay turns it off. Next: EAS Update link (needs Expo token) or laptop testing, then M2/M3.

Done: a front end prototype on mock data, 2 commits on `claude/gallant-bohr-s0xwkr` (Deck swipe take/trade/together/later/done, drag to Meera, flip to job story, Drop with fake keyword sort, undo/thanks toasts, hand cleared, Us glance + open table + album, Sync stub).
Not real yet: no accounts, no partner, no shared data, no AI, no push, everything resets on reload.

### MVP cut (what a couple needs to live with it for 2 weeks)
In: email code sign in, name + color, pair by invite code (WhatsApp share), Drop text (voice via keyboard mic) → free rule based sort (split, bucket, effort, when) + owner by load, live shared deck on both phones (take, trade once → table, together, later, done, grab, undo), card back job story + hold to add a one line update → Waiting, thanks heart to partner, push (new hand max 2/day, thanks, nudge max 2/day, quiet hours), Sunday Sync (week list, one appreciation each, mutual reveal), leave space + delete account.
Deferred: calibration deck, recurring, secret cards, AI follow ups, renegotiate, unlockable art, Apple/Google sign in, real voice capture.

### Zero cost rule (Oct 27)
Testing must cost nothing. Every service below is on a free tier; no Apple Developer Program, no paid AI credits, no paid builds.

| Need | Free route | Limit to know |
|---|---|---|
| Backend, auth, realtime, edge functions, cron | Supabase free project | Pauses after ~1 week with no activity; one click to resume |
| App on both phones without a laptop running | Expo Go + EAS Update (free Expo account) | iPhone stays in Expo Go for the whole test |
| Android push | Free EAS dev build APK (free tier build quota, slower queue) | A few builds a month is enough |
| iPhone alerts | Expo Go. Remote push in iOS Expo Go on SDK 58 is unverified: check docs first. If unsupported, iPhone gets in app banners + a badge when opened, Android gets real push | No $99 iOS build |
| AI sort | Upgraded rule based sorter (English + Hinglish word lists, split, bucket, effort, when) running in the edge function, no API cost | Less smart than Claude; Claude Haiku stays a one line switch for later |
| Email sign in codes | Supabase built in email (free, rate limited to a few emails an hour) | Fine for two people |

### Milestones (each ends with something testable on both phones)
* **M1 Backend + pairing + shared deck.** Supabase tables couples, members, tasks, task_events, thanks, sync_entries, push_tokens; RLS so only the two members read their couple; realtime on tasks. App: email code sign in, name + color, pair by invite code shared on WhatsApp, `DeckProvider` reads/writes Supabase with optimistic updates; trade once rule enforced in a Postgres function. Ship via EAS Update so both phones open it in Expo Go anytime.
* **M2 Sort + fairness.** Edge function `sort-drop` with the rule sorter (port and extend `fakeSort` / `splitDrop` from `src/features/deck/model.ts`), owner chosen by 7 day load in `lib/fairness.ts` (+ tests). Claude call behind an env flag, off.
* **M3 Notifications.** expo-notifications; Android dev APK gets real push (new hand max 2/day, thanks, nudge max 2/day, quiet hours, enforced by a cron edge function). iPhone: push if Expo Go supports it, else in app banners.
* **M4 Loop closers.** Hold to add a one line update → Waiting + job story events, thanks heart, Sunday Sync (week list, one appreciation each, mutual reveal), leave space, delete account.
* **M5 Real scenario test.** Chinmay + partner for 7 days with a scripted checklist (electrician saga with a spare part delay, Goa trip together, Amazon return left 48h to the open table, one trade bounce) plus their real admin; bugs as GitHub issues. Then 2 to 3 friend couples (Android APK; iPhone via Expo Go link).

### Chinmay's steps (all free, in order)
1. Create a free Supabase project (region Mumbai). Add a Supabase personal access token as `SUPABASE_ACCESS_TOKEN` in this environment's secrets, send me the project URL. Allow `*.supabase.co` and `api.supabase.com` in the environment network policy.
2. Create a free Expo account, add a token as `EXPO_TOKEN` in environment secrets, allow `expo.dev`, `api.expo.dev`, `u.expo.dev`.
3. Install Expo Go on both phones (already done if you tested Sprint 1).
4. After each milestone: open the Expo Go link I send (no laptop needed), run the milestone checklist, report bugs.
5. Android push (M3, free): in the Firebase console create a project, add an Android app with package `com.usync.app`, download `google-services.json` and send it to me (it is a client config, safe to commit). Then Project settings → Service accounts → Generate new private key, and upload that JSON at expo.dev → usync → Credentials → Android → FCM V1 service account key (keep this one private, never commit it). I then add `android.googleServicesFile` and run one `preview` APK build.

Verification per milestone: tsc, lint, jest (reducer, fairness, sorter on ~30 real English/Hinglish lines), SQL checks that one couple cannot read another, then the two phone check.

## 0f. First two phone test feedback (Oct 28)

Built on top of M3. Migration `0004_first_feedback.sql` must be applied before this app build is opened (the app reads `members.color`, `members.avatar`, `thanks.note`, `thanks.seen_at`).
* Deck: Deck / All cards toggle (every open card, grouped, no decision needed to see the rest); swipe down skips a deal to the back; Options sheet under the deck with every move as a button (mark done straight from a deal, trade or table a card already on my deck, later).
* Drop: round floating button on Deck and Us only (not Sync), tap to type, hold to talk. Voice uses the phone's own recognizer (`expo-speech-recognition`, en-IN): works in a dev build and on web, Expo Go falls back to the keyboard mic.
* Keyboard: every sheet and scrolling screen uses `KeyboardAvoidingView` with `padding` on Android too (edge to edge windows no longer resize).
* Profile: pick a color (six, never the partner's) and an optional emoji avatar, at sign up and in Settings behind the avatar pair. Account actions moved there from Sync.
* Us: Now / Table / Album. Now holds the partner glance, wins to thank, new from partner, doing together, waiting. Table is a two column card grid. Album groups story cards by month with who did each.
* Thanks: a heart can carry a line, goes out any day (from Us, or the banner when the partner finishes something), and arrives as a full screen moment that stays until read.
* Push: partner drops (max 4 a day) and finished jobs (max 6 a day), quiet hours respected; hand pushes skip cards a drop push already announced.
* Sign in: Apple (native, iOS) and Google (Supabase OAuth in an in app browser) buttons appear once each provider is switched on in Supabase.
* Sync: Replay / Thanks / Next as steps, one on screen at a time; long replays fold.

## 1. The real problem (reframe)

The pain is not "we forget tasks." It is **mental load**: one partner (usually) carries the invisible job of noticing, remembering, planning and delegating. That partner resents it; the other feels nagged. Every list app makes this worse because the noticer is still the one typing, assigning and chasing.

So usync's job: **move the mental load from a person to the app.** Whoever notices a thing dumps it in one line; the app becomes the neutral third party that plans, assigns and chases. Nobody nags; the app does, playfully.

Closest prior art (I'm fairly confident these exist, verify before positioning): Eve Rodsky's Fair Play card system (owns the "invisible labor" framing, but is manual and heavy), Paired (bonding quizzes, no chores), generic shared lists (Todoist, Google Keep). The gap: zero effort capture + AI as neutral planner + bonding built into the chore loop instead of bolted on.

## 2. Product principles

1. **One line in, nothing else.** No fields for date, effort, owner, priority, bucket. Text or voice only.
2. **The app proposes, humans consent.** AI never silently assigns. A deal is a card your partner accepts or trades with one swipe. An AI that orders your partner around creates "the app said so" resentment.
3. **Fair, not equal.** Splitting by count is wrong (taking out trash is not doing taxes). Balance is weighted by effort, and by preference (some people like cooking).
4. **No scoreboard.** Scorekeeping is poison in relationships. Balance is shown as a shared shape that tilts, never as "You 14, Her 9."
5. **Appreciation is the bonding engine.** Every completion pings the partner with a one tap thank you. Gratitude loops do more for bonding than date night prompts.
6. **Playful, not childish.** Motion, tactility and wit; no confetti spam, streaks or badges (that's the habit app trap).

## 3. Core loop (the whole MVP)

1. **Drop**: "fix leaky tap before mom visits sat" (type or voice).
2. **Sort** (AI, invisible): infers bucket (Home), effort (medium, 45 min), deadline (Friday, because "before Sat"), skill tag (handy), and who should own it from history + preferences + current load.
3. **Deal**: a card lands on the suggested owner's deck: "Tap duty? You're lighter this week." Swipe right accept, left to trade back, up to "do it together."
4. **Nudge**: reminder arrives at a moment the person is likely free, written in a playful voice; partner can send a "poke" which the app rewrites kindly.
5. **Done + Thanks**: swipe done; partner gets "Rahul fixed the tap" with a heart tap. That moment is the product.
6. **Sunday Sync** (5 minutes, weekly ritual): the app shows the week's balance shape, what each did, one appreciation prompt each, and proposes next week's plan. This is where bonding is deliberate.

## 3b. UX spec: journey, core loop, constraints

### A. User journey (first 7 days)

1. **First open (solo, ~60s).** One screen: "usync works with two. Start now, invite your person." Sign in with Apple / Google. Name, then pick your color by tapping Ember or Lagoon (partner gets the other). No tutorial carousel.
2. **Parked mode (before partner joins).** You can Drop immediately. Cards are sorted by AI but sit "parked" in a stack labelled "Dealing starts when M joins." This gives value in minute one and builds a hand worth inviting someone into. Invite = share sheet link (WhatsApp first for India).
3. **Partner joins via link.** Lands on "R invited you to share the load," signs in, gets the remaining color. Sees how many cards are waiting (count, not a guilt list).
4. **Calibration, done separately on each phone (~2 min).** A 12 card swipe deck of chore archetypes (cooking, dishes, laundry, groceries, bills, bathroom, trash, repairs, plants, family calls, admin, planning dates): swipe Love / Fine / Hate. Plus two taps: free windows (weekday mornings, weekday evenings, weekends) and nudge style (gentle, normal, keep me honest).
5. **The reveal (first bonding moment).** When both finish: "You both hate dishes. R secretly loves groceries." Playful matches, never a judgement.
6. **First hand is dealt.** Parked cards animate out like a dealer's hand, split using calibration. Each partner accepts or trades. This is the aha moment.
7. **First done + first thanks.** Activation = paired + first thank you sent within 72 hours.
8. **First Sunday Sync** closes week one and sets the ritual.

### B. Core loop and task lifecycle

```
Drop ─► Sorting (AI, <2s, card shows raw text + shimmer)
     ─► Dealt to X ──accept──► Active ──done──► Done ─► Thanks prompt to partner ─► into week's Sync
              │ trade (once) ─► Dealt to Y ──trade again──► Together or Open table
              │ swipe up ─────► Together (Active for both)
              │ no answer 48h ► Open table (visible to both, first to grab owns it)
     Active ── "not this week" ─► Later pile (AI resurfaces)
     Active ── slipped past due ─► Renegotiate card: "Still yours, or trade?" (private, never shown to partner)
```

Rules inside the loop:
* **Drop**: one global PopButton, reachable from every screen; hold to talk. One line can hold many tasks ("groceries, call plumber, book flights") and the AI splits it into 3 cards. Offline drops queue and sort on reconnect.
* **AI never asks follow up questions in the flow.** It guesses, shows its guess on the card ("Money · 15 min"), and tapping the guess fixes it. Corrections train it.
* **Dedupe**: if both drop the same thing, merge and say so ("M beat you to it").
* **Who can do what**: either partner can mark any card done; credit goes to the doer ("Actually, I did it"). Only the dropper can delete; anyone can mark "not needed" which asks the dropper once.
* **Deck size**: max 5 cards visible per person per day, ordered by AI (due soon, then quick wins). Overflow lives in Later with a count. Overwhelm is a bug.
* **Recurring chores (MVP, decided)**: AI detects "every Sunday" / "weekly" and re deals each cycle, rotating owner by load. Data model adds `tasks.recurrence` (rrule text) and a cron that spawns the next instance.
* **Secret tasks (MVP, decided, Us bucket only)**: AI flags "gift for M" or user taps secret; hidden from partner until done, then revealed as a surprise card. Never allowed outside Us, so it can't hide chores. Data model adds `tasks.secret_from` (member id), enforced in Postgres RLS.

* **AI follow ups**: when a done card implies a next step (electrician booked → "be home Sat 11am"), the AI drops one follow up card and deals it like any other. Max one follow up per card, so it never snowballs.
* **Ongoing jobs (no threads, no comments)**: real tasks wander (electrician finds a second problem, needs a spare part, comes back Tuesday). Updates use the same zero effort input as Drop: **hold any card and say one line** ("he needs a spare part, back Tuesday 11am"). The AI turns it into structure:
  * a **Waiting** state ("waiting on electrician · back Tue 11am"). External delays never trigger Renegotiate, never count as a slip, nudges pause.
  * at most one **spawned card** when the update implies new work ("buy the spare part"), dealt fairly like any card, linked to the parent.
  * the follow up date moves ("be home Tue 11am" re dealt to whoever is free then).
  * on the expected date, one check in to the owner: "Electrician due today 11am. Did they show?" (Yes / Rescheduled / Not needed).
  * **The card's back (flip it) is the job story**: an AI written, read only timeline of one liners (Tue dropped · Wed booked · Sat visit, needs a part · Tue back). That is the "thread", authored by the app, never a chat. Either partner can add an update; the partner is only notified when something needs them.
  * Waiting cards leave the 5 card deck and sit in a collapsed "Waiting on others" strip.
  * **Credit follows the saga**: each update adds effort to whoever handled it, so wrangling a messy job counts in the balance. Sync replay names it as a story ("M wrangled the electrician saga"), not a number.
  * **Thanks fires once, when the whole job closes** (parent + linked cards), not per step. This also fixes the double thanks found in the story lane.
  * If a job passes ~3 weeks or ~5 updates, the AI suggests "This turned into a project. Do it together?"
  * Data model: `task_events` (task_id, actor, kind, text, at), `tasks.parent_id`, `tasks.waiting_on`, `tasks.waiting_until`.
* **Loop closures (decided)**: Thanks is optional (Done flows to Sync either way). Renegotiate offers keep it (back to Active) or trade it, which spends the card's one trade. Later resurfaces into Dealt. Open table cards still unclaimed on Sunday are dealt together in Sync's Next hand, never silently.

Decisions locked with Chinmay: parked mode before pairing; secret tasks in Us only; lightweight recurring in MVP; unanswered deals go to Open table after 48h.

### C. Notification budget

* New deals are batched into at most two "new hand" pushes a day (morning, evening), never one per task.
* Max 2 nudges per person per day, inside their free windows, outside quiet hours (22:00 to 08:00 default).
* Pokes: a partner can poke a card once per day; the app rewrites it in the app's playful voice. The partner never sends raw nagging through usync.
* Thanks and Sync are always delivered immediately (positive news has no budget).

### D. Sunday Sync (async, 5 min, mutual reveal)

1. **Replay**: the BalanceShape animates through the week; highlights what each person carried, no numbers.
2. **Appreciate**: pick one thing your partner did, add one line or a voice note.
3. **Next hand**: AI proposes next week's split; each can swap before locking.
Each partner does it on their own time; appreciations reveal only when both finish (or Monday morning if one skips, so effort is never wasted).

### E. Navigation

Three tabs only: **Deck** (home, your cards), **Us** (partner's deck at a glance, buckets, Us ideas), **Sync**. Drop floats above all tabs. Settings live behind the avatar pair.

### F. Non negotiable constraints

1. Zero required fields, ever. If a feature needs a field, the AI infers it or the feature waits.
2. No scores, counts or comparisons between partners anywhere in the UI.
3. AI proposes, humans consent. The app never assigns silently and never tells a partner someone is late.
4. No red, no overdue shaming. Slips are renegotiated privately.
5. Notification budget above is a hard cap, enforced server side.
6. Exactly two members per space in v1. Deals require both; solo is parked mode.
7. Every action is reversible for 5 seconds (undo toast); deletes are soft for 30 days.
8. Card appears instantly on Drop; AI sorting must land under 2 seconds or the card shows "sorting" without blocking.
9. Either partner can leave the space; their data leaves with them; full account deletion in app (store requirement).

### G. Edge cases to design for

Partner never joins (re invite prompt on day 2 and 5, then stay in parked mode quietly). One partner drops far more than the other (fine; dropping is noticing, and the AI credits noticing in Sync). Both trade everything (bounce rule ends in Together/Open table). Breakup / unpair (graceful, neutral copy, no shared history exposed after leaving). Third party tasks ("call my mom" defaults to dropper).

## 4. Structure and visual language

* **Buckets are auto clustered**, never created by users at first: Home, Errands, Money, Family, Us. "Us" is special: date ideas, gifts, plans; the app quietly seeds it so the relationship itself gets tasks.
* **Home screen = "The Deck"**: today's 3 to 5 cards for you, stacked like playing cards. Not a list. Overflow is hidden, which kills overwhelm.
* **Balance visual = a seesaw / shared plant** that tilts or droops when one side carries too much. One metaphor, pick one in design exploration.
* **Partner presence**: small avatar of partner's deck, so you see what they're carrying without a list.

### Visual direction v0: CRED inspired, warmed up

Borrow CRED's craft, not its temperature. CRED is cold, premium and finance flavored; a couples app needs warmth. What to take:
* **Dark, deep canvas** with high contrast type and one or two saturated accents (pick a warm accent pair, one per partner, instead of CRED's neon).
* **NeoPOP style tactility**: buttons and cards with hard offset "plunk" shadows that physically press in on tap. Perfect for swipeable task cards.
* **Haptics on every meaningful action** (deal accepted, done, thanks received). This is half of why CRED feels premium.
* **Choreographed motion**: cards deal in like a dealer's hand, done cards flip and fly to the partner's side.
* **Editorial type pairing**: expressive display serif for moments (Sunday Sync, thanks), clean geometric sans for UI.

What to leave: CRED's density of promos, its aloof copy tone, and the all black monotony. Our copy voice is warm and witty.

Implementation rule: all of this lives in a token + primitive layer (`theme/`, `ui/`) so iterating away from CRED later means editing tokens and primitives, not screens. CRED open sourced NeoPOP; check its license and current React Native support before borrowing anything directly, otherwise rebuild the plunk effect ourselves (it's just two offset layers + Reanimated).

## 5. Biggest risks and how the design answers them

1. **AI assigns badly → fights.** Consent swipe on every deal; learn from trades; explain each deal in one line ("you're lighter this week").
2. **One partner stops using it.** The app is worthless solo. Onboarding must be a two person moment (invite link, both answer a 6 card "what do you love / hate doing" deck). Nudges route through the app, so ignoring it means ignoring your partner.
3. **Effort inference wrong.** Let either person long press a card to say "this was bigger"; feed it back.
4. **Feels like another chore app in week 2.** Sunday Sync + thanks loop are the retention hooks; measure thank you taps per week as the north star, not tasks completed.

## 6. MVP scope

In: couple pairing, one line capture (text + voice), AI sort, deal with accept/trade/together, nudges via push, done + thanks, Sunday Sync, auto buckets incl. Us.
Also in: parked mode, calibration deck + reveal, lightweight recurring, secret Us tasks, Open table.
Out (v2): calendar sync, kids/roommates, shared shopping lists, chat, Apple Watch, home screen widget, share extension.

## 7. Technical approach (recommended)

* **App**: Expo (React Native + TypeScript), one codebase for iOS/Android; push via Expo Notifications; Reanimated + Gesture Handler for card swipes.
* **Backend**: Supabase (Postgres, auth, realtime so partner's deck updates live, edge functions, cron for nudges and Sunday Sync).
* **AI**: Claude API from a Supabase edge function. `claude-haiku-5-5` for per task sort (cheap, fast, structured JSON via tool use); `claude-sonnet-5-5` for weekly planning and Sync summaries. Load the `claude-api` skill before writing this code.
* **Data model** (Postgres): `couples`, `members` (preferences jsonb), `tasks` (raw_text, bucket, effort_points, due_hint, owner_id, status, together bool), `deals` (task_id, proposed_to, response), `thanks`, `sync_sessions`.
* **Fairness engine**: rolling 7 day weighted load per member = sum(effort_points × preference multiplier); deal goes to the lighter member unless skill/preference strongly overrides. Plain TypeScript, unit tested, AI only supplies the inputs.

### UI stack: no prebuilt component kit

Decision: build our own `ui/` primitives on small, best in class libraries. Prebuilt kits (React Native Paper, gluestack, NativeBase, Tamagui UI) ship a Material or neutral look we'd spend weeks overriding; NeoPOP tactility is our identity, so the primitives must be ours. CRED's NeoPOP ships for web, Flutter and native, but (I believe) not React Native, so we rebuild the plunk ourselves.

* **Styling/tokens**: `react-native-unistyles` v3. Typed theme object `theme.color.bg.canvas` mirrors Figma variable names and code syntax 1:1; zero runtime re-render on theme change; dark first, light mode later is just a second theme.
* **Motion + gestures**: `react-native-reanimated` v4 + `react-native-gesture-handler` (swipe deck, plunk press, card deal choreography).
* **Custom drawing**: `@shopify/react-native-skia` for the NeoPOP bevel edges, BalanceShape, and any shader polish.
* **Illustrated moments**: `rive-react-native`. Chinmay illustrates; Rive state machines give interactive characters/plant for balance + thanks moments. Lighter and more interactive than Lottie.
* **Sheets**: `@gorhom/bottom-sheet` (Drop capture sheet).
* **Haptics**: `expo-haptics`, wrapped in `theme/haptics.ts` so every primitive fires consistent patterns.
* **Fonts**: `@expo-google-fonts/fraunces`, `@expo-google-fonts/manrope`.
* **Icons**: `phosphor-react-native` (six weights incl. duotone/fill, friendly geometry that matches Manrope).
* **Lists** (Sync history, buckets): `@shopify/flash-list`.

Primitives to build in `ui/`: Text (style tokens), PopButton, PopCard (Skia bevel + pressed translate), SwipeCard, Chip, Avatar pair, Sheet wrapper, Toast. Screens import only from `ui/` and `theme/`, never directly from the libraries above, so swapping any one later is a single file change.

### iOS + Android, store ready from day one

Expo gives one TypeScript codebase that compiles to real native iOS and Android binaries. Store readiness is planned in from the first commit:
* **EAS Build** profiles in `eas.json`: `development` (dev client), `preview` (internal testers via TestFlight and Play Internal Testing), `production` (store builds).
* **EAS Submit** to push builds to App Store Connect and Google Play Console.
* **EAS Update** for over the air JS fixes between store releases.
* `app.config.ts` holds bundle id `com.usync.app` (iOS) and package `com.usync.app` (Android), versioning, icons, splash, push entitlements, microphone permission strings (voice drop).
* **Environment separation**: dev and prod Supabase projects; secrets (Claude API key) live only in Supabase edge functions, never in the app bundle.
* **Store requirements to plan for**: Sign in with Apple is mandatory on iOS if we offer Google sign in; in app account deletion (Apple requirement); privacy policy URL; Play data safety form. Needs an Apple Developer account ($99/yr) and Google Play developer account ($25 once).
* Platform parity: test every PR on both an iOS simulator and an Android emulator; Android haptics and shadows behave differently, so primitives handle both.

### Codebase layout (repo is empty)

```
app/                      Expo Router screens
  (onboarding)/pair.tsx
  (onboarding)/preferences.tsx
  (tabs)/index.tsx        The Deck
  (tabs)/sync.tsx         Sunday Sync
  drop.tsx                capture sheet (text + voice)
theme/                    tokens: colors, type, spacing, shadows, motion, haptics
ui/                       primitives: PopButton, PopCard, SwipeCard, Sheet, Text
features/                 deck/, drop/, deal/, sync/, pairing/ (hooks + feature components)
lib/                      supabase client, fairness.ts (+ fairness.test.ts), notifications
supabase/
  migrations/0001_init.sql
  functions/sort-task/  nudge/  weekly-sync/
app.config.ts  eas.json  package.json  tsconfig.json
```

## 8. Figma file (source of truth for design)

File: https://www.figma.com/design/lXS141YAO1qarbcGFlqPQp/usync (currently one empty page). Build it via the Figma MCP (`use_figma`, after loading `figma-use` + `figma-generate-library` skills) into this structure:

1. **Foundations** page: Figma variables in two collections. `color` (Dark mode first: canvas, surface, surface raised, ink primary/secondary, accent A (partner 1), accent B (partner 2), success, plunk shadow), `space` (4 based scale), `radius`, `type` styles (display serif + UI sans), effect styles for the plunk shadow. Variable names match code tokens 1:1 (`color/surface/raised` ↔ `theme.color.surface.raised`) so design and `theme/` never drift.
2. **Components** page: PopButton (primary/secondary/ghost × default/pressed/disabled), PopCard, SwipeCard (deal, active, done, together variants), BucketChip, PartnerAvatarPair, BalanceShape (balanced / tilted A / tilted B), NudgeToast, ThanksToast.
3. **Journey** page first (FigJam style flow of section 3b A and B, so the UX is agreed visually), then **Screens** page (iPhone 15 frame 393×852, plus one Android 412×915 check), in journey order: First open + color pick, Parked deck, Invite share, Partner join, Calibration swipe deck, The reveal, First hand dealt, The Deck (3 cards, overloaded with Later count), Drop sheet (text, voice listening, multi task split, sorting), Deal arrival, Renegotiate slip, Open table, Secret Us card, Done + Thanks, Sunday Sync (replay, appreciate, next hand, waiting for partner).
4. Later: Code Connect mappings from Components to `ui/` primitives.

### Next task: Journey page (Figma, design file lXS141YAO1qarbcGFlqPQp)

Built with `use_figma` (skills: figma-use + figma-generate-design), on a new page **Journey**, dark canvas, using existing variables/text styles (no new tokens).

1. **Lane 1, First week** (left to right, one node per step of 3b A): First open → Pick color → Parked deck → Invite → Partner joins → Calibration (each phone) → The reveal → First hand dealt → First done + thanks → First Sunday Sync. Each node = a PopCard style frame (title/md + body/md one liner + "screen: X" caption), tone coded: Ember = partner A action, Lagoon = partner B action, Gold = together moment, Neutral = system/AI.
2. **Lane 2, Core loop** (the 3b B state machine): Drop → Sorting → Dealt, branching to Accept→Active→Done→Thanks→Sync, Trade (once)→Dealt to other→Together/Open table, Swipe up→Together, 48h silence→Open table, Not this week→Later, Slipped→Renegotiate (private). Recurring loops back from Done to Dealt; Secret branch only from Us bucket.
3. **Lane 3, Weekly ritual**: Sync replay → Appreciate → Next hand → wait for partner → mutual reveal (or Monday fallback).
4. **Side rail**: the 9 constraints (3b F) and notification budget (3b C) as a pinned legend, so every screen review checks against them.
5. Connectors: arrows as lines with arrowheads (design file, not FigJam), labels in label/md on branch edges. Bonding moments get a gold star marker.

Verify: one screenshot per lane, check no overlapping nodes or clipped text, every 3b step represented exactly once. Then report the link and gaps spotted while mapping.

### Next task A: patch the five loop gaps (Journey page, node 17:102, Lane 2 = 18:231, Lane 3 = 19:400)

Rule decisions locked: a trade from Renegotiate spends the card's one trade; Open table cards unclaimed by Sunday are dealt in Sync's Next hand; Thanks is optional.

1. **Parked** (Neutral, "NOT PAIRED YET"): new node at col 1 row 1 under Sorting. Sorting bottom → Parked top ("not paired yet"); Parked right → elbow up into Dealt bottom ("partner joins").
2. **Done → Sync direct**: elbow under row 0 from Done bottom to Sync bottom ("thanks optional"). Thanks detail becomes "Optional. One tap to send a heart."
3. **Renegotiate exits**: bottom → back up into Active ("keep it"); bottom → Dealt to partner bottom ("trade it, uses the one trade"). Detail updated.
4. **Later → Dealt**: Later bottom → under row 2 → up into Dealt bottom right ("AI re deals it").
5. **Open table → Sync Next hand**: cross lane arrow drawn in the wrapper from Open table bottom to Lane 3 Next hand top ("unclaimed by Sunday"). Open table + Next hand details updated. Lane 2 grows to ~1180 tall, Lane 3 moves down, wrapper resized.
Also mirror these rules into section 3b B text.

### Next task A2: worked examples in the journey (Chinmay's ask)

Because examples make every node taller, Lane 2 is rebuilt (delete 18:231, rebuild with the five patches above + examples, row pitch ~340) rather than patched in place.

1. **JourneyNode gets an example box**: inner `example` frame at the bottom of the face (bg/surface fill, dashed gold stroke), "E.G." in label/md gold + body/md text. New props: `Example` (TEXT) and `Show example` (BOOLEAN, default off).
2. **Every node gets a concrete example**, mostly following one couple (R and M) and the ceiling light, with other tasks where the light doesn't hit that branch:
   * Lane 1: Parked deck "R drops: fix wifi router, pay gas bill, bedroom ceiling light." Calibration "R hates phone calls, M is fine with them." First hand "Electrician call → M. Gas bill → R."
   * Lane 2: Drop "bedroom ceiling light keeps flickering, need an electrician" (voice). Sorting "Home · 15 min call · this week". Parked "wifi router, before M joined". Secret "pottery class for M's birthday". Dealt "Electrician call is yours, you're lighter this week." Trade "R: traveling Tue to Thu" → Dealt to partner "M accepts". Together "Plan the Goa trip in December". Open table "Return the Amazon parcel, 48h, nobody answered". Active "M, nudge Wed 7pm". Later "Reorganise the store room". Renegotiate "Booking slipped; trade already used, so: keep it or do it together". Done "M booked the electrician for Sat 11am". Thanks "R: light's back, you're a star". Recurring "Water the plants every Sunday, owner rotates".
   * Lane 3: Replay "the bedroom light shows up as M's win". Appreciate "Thanks for chasing the electrician." Next hand "Be home Sat 11am → R" + "Amazon parcel from the open table".
3. **New Lane 4, "Story: the ceiling light, start to finish"**: 8 beats with day/time stamps (Tue 9:10 drop → sort → dealt to R → R trades → M accepts → Wed 7pm nudge → M books, AI spawns follow up "Be home Sat 11am for the electrician" dealt to R → Sat done + thanks → Sunday Sync). UI peeks under key beats: a DealCard instance (deal to M), Nudge Toast, Thanks Toast, with real copy overrides.
4. **New rule surfaced by the story (add to 3b B)**: *AI follow ups*. When a done card implies a next step (booking → be home for the visit), the AI drops a follow up card and deals it normally. Never more than one follow up per card.
5. Re stack lanes (1, 2, 3, 4) and the rail, redraw the cross lane Open table → Next hand arrow, resize the wrapper, one screenshot per lane.

### Next task A3: add ongoing jobs to the journey

* Lane 2: new **Waiting** node (Neutral, "EXTERNAL") off Active ("hold card + update"), returning to Active on "they showed / back on track"; a dashed "spawned card" arrow from Waiting into Dealt. Example: "Electrician found a wiring fault, needs a spare part. Back Tue 11am."
* Lane 4 story: insert beats after "Light fixed" becomes "Visit 1": Sat 11:40 M or R holds the card: "needs a spare part, back Tue" → Waiting · AI spawns "buy the spare part" dealt to R (near the hardware shop) · Tue check in "Did they show?" → Yes → job closes → one combined thanks → Sync replays "the electrician saga". Add a peek of the card back (job story timeline).
* Components: **DealCard** gets State=Waiting (muted face, "WAITING ON ELECTRICIAN · BACK TUE 11AM" label, no strips) and a new **JobStory** card back component (timeline of one liners).
* Screens list gains: Hold to update (voice), Card back / job story, Waiting strip on The Deck, Did they show? check in.

### Next task A4: align Figma with interview decisions

* BucketChip: Money → **Admin**; Home / Admin / Errands / Family / Us.
* Journey lane 1: calibration + reveal copy → life admin ("You both hate phone calls. Rahul secretly loves planning trips."); First hand example uses only non daily jobs.
* Lane 2 recurring label → "renewals: AI resurfaces ahead of time (e.g. car insurance every March)"; Later example and any chore examples swapped for life admin.
* JobStory / card back gains the AI suggested **steps** list (multi step jobs) and an "AI drafted a message" assist row.
* Rules rail: add "AI assists, never acts" and "Glance, not inspect".
* Then Batch 1 fixes (behind cards get strips, Screen 01 seesaw animates to level, hold to update affordance), then Batch 2 with the new life admin calibration deck.

### Next task C: Batch 2 fixes + Batch 3 screens (Screens page, frames 402×874, x = 100 + (n-1)·482)

Fixes:
1. Screen 03 coach mark: flip so the bubble sits above the card, pointer down at the grip; card title stays visible.
2. Screen 08 reveal: replace the three flat rows with a gold MatchCard (PopCard style, strips, Fraunces display) for the shared match, plus two smaller partner tinted cards fanned below; motion note "match card flips in first, then the two partner cards deal in".
3. Screen 11: design note that Us ideas must come from the couple's own saved/mentioned places, never generic suggestions.

Batch 3 (built from existing components + one new **DropSheet** layout, no new tokens):
* **12 Drop: typing** — bottom sheet over the deck, one input line "bedroom light flickering, call electrician, return the parcel", keyboard area placeholder, Cream "Drop it" button, caption "No dates, no owners. We'll sort it."
* **13 Drop: voice** — hold to talk state, live Hinglish transcript ("kal electrician ko bulana hai, aur parcel return karna hai"), waveform bars in Ember, "Release to drop".
* **14 Drop: split + sorting** — the one line splits into 2 cards with shimmer then guesses: "Home · 15 min call · this week" and "Errands · 10 min · by Thu", each guess tappable to fix; toast "2 cards sorted. Dealing in tonight's hand."
* **15 Deal arrival** — evening hand push style banner on top + deck with DealCard B (Meera's view) "Book an electrician", one line why, Trade / Take it, swipe hints left/up/right.
* **16 Renegotiate** — private card: "This one slipped. No drama." Keep it / Do it together (trade already used), caption "Rahul never sees this."
* **17 Open table** — Us tab section "On the table" with the Amazon parcel card, "48 hours, nobody grabbed it. First to take it owns it.", Grab it button; glance of partner deck above (glance, not inspect).
* **18 Secret Us card** — Rahul's view: gold card with a lock label "SECRET · MEERA CAN'T SEE THIS", "Book the pottery class for Meera's birthday".
* **19 Done + Thanks** — job closes: card sinks flat, Thanks toast on Meera's side "Rahul was home for the electrician · send one big thank you?" with heart button; motion note for sink + haptic success.

Verify: one composition screenshot per batch, fix clipped text/overlaps, check every screen against the Rules rail.

### Next task B: Screens page (iPhone 393×852)

Reuse: local components (PopButton 9:96, PopCard 10:58, DealCard 10:209, BucketChip 11:71, PartnerAvatarPair 11:72, BalanceShape 11:95, Toast 11:118), variables and text styles; status bar + home indicator from the attached **iOS and iPadOS 26** library via `search_design_system`.
New local components first (Components page): **AppHeader** (avatar pair + title + balance mini), **TabBar** (Active = Deck / Us / Sync) with floating **DropButton** (Cream PopButton, "+ Drop", hold to talk), **DeckStack** (top DealCard + 2 offset cards behind + "3 more later" chip), **CalibrationCard** (chore + Love / Fine / Hate), **ColorTile** (Ember / Lagoon, selected state).

Build order in batches, screenshot per batch, critique checkpoint after Batch 1:
1. **Batch 1**: First open + color pick, Parked deck, Invite share, Partner join, The Deck (normal).
2. **Batch 2**: Calibration deck, The reveal, First hand dealt, The Deck (overloaded, Later count).
3. **Batch 3**: Drop sheet (typing, voice listening, multi task split + sorting), Deal arrival, Renegotiate, Open table, Secret Us card, Done + Thanks.
4. **Batch 4**: Sunday Sync replay, appreciate, next hand, waiting for partner; one Android 412×915 check of The Deck.

Each screen: frame named `Screen / NN Name`, dark canvas fill, built from instances, every text real copy in the app's voice, checked against the Rules rail (no numbers between partners, no red, no required fields).

## 9. Suggested order of work

1. Design first in the Figma file above: Foundations → Components → the core loop screens. I draft v0 in the CRED inspired direction, Chinmay critiques and iterates. Code follows the approved frames.
2. Scaffold Expo + EAS config + theme tokens and `ui/` primitives (PopButton, SwipeCard with haptics) + Supabase schema + pairing.
3. Drop → sort edge function → card on deck (the core loop end to end with fake fairness).
4. Fairness engine + deal swipes.
5. Done + thanks + push nudges.
6. Sunday Sync.
7. Store prep: icons, screenshots, privacy policy, Apple sign in, account deletion, TestFlight + Play internal track.

## Verification

* `npx jest lib/fairness.test.ts` covers balancing edge cases (one partner overloaded, preference override, together tasks split effort).
* Sort function tested with ~30 real sample inputs; check JSON output for bucket/effort/due accuracy.
* Run two Expo clients (two simulators or device + Expo Go) logged in as a paired couple: drop a task on one, see the deal arrive live on the other, accept, complete, receive thanks.
* Trigger nudge and weekly sync cron manually via `supabase functions serve` and confirm push delivery.
