// Free, rule based sorter for one line drops (English + Hinglish). Runs on the phone, no API cost.
// It only guesses: every guess is shown on the card and can be fixed, so wrong is cheap, slow is not.

export type Bucket = 'Home' | 'Admin' | 'Errands' | 'Family' | 'Us';

export type Sorted = {
  title: string;
  bucket: Bucket;
  /** Shown on the card, e.g. "15 min call". */
  effort: string;
  /** Effort weight for the balance, never shown as a number. */
  weight: number;
  /** Plain words, e.g. "tomorrow", "by Friday", "this week". */
  when: string;
  /** The line reads like a shared plan ("hum dono", "together", a trip). */
  together: boolean;
};

// Order matters: the first bucket whose words match wins. The job beats the person it is for,
// so "fix the tap before mom visits" is Home and "papa's insurance" is Admin.
const BUCKETS: [Bucket, RegExp][] = [
  ['Home', /\b(electrician|plumber|carpenter|painter|fix|repair|service|servicing|light|fan|ac|geyser|fridge|washing machine|ro|purifier|wifi|router|internet|leak|leaking|tap|pipe|paint|seepage|pest|cockroach|termite|chimney|inverter|door|lock|switch|socket|maid|bai|cook|cleaning|deep clean|society|parking|gas cylinder|cylinder)\b/i],
  ['Admin', /\b(bill|bills|renew|renewal|insurance|passport|visa|rent|agreement|tax|itr|gst|bank|kyc|aadhaar|aadhar|pan card|license|licence|rc|emi|loan|policy|form|documents?|paperwork|pf|epf|fd|sip|electricity bill|recharge|subscription|registration|challan)\b/i],
  ['Family', /\b(mom|mum|mummy|maa|dad|papa|parents|in[- ]?laws?|sasural|wedding|shaadi|birthday|nani|nana|dadi|dada|cousin|bhai|didi|bhabhi|chacha|mama|mausi|bua|puja|pooja|diwali|rakhi|family)\b/i],
  ['Us', /\b(trip|goa|vacation|holiday|date|dinner|anniversary|gift|surprise|movie|hum dono|together|saath|honeymoon|staycation|weekend getaway)\b/i],
  ['Errands', /\b(return|parcel|pick ?up|drop off|buy|order|courier|collect|grocer(y|ies)|shopping|amazon|flipkart|tailor|dry ?clean|laundry pickup|pharmacy|medicine|dawai|bazaar|market|exchange|refund|kharid(na)?|lana|le aana)\b/i],
];

const CALL = /\b(call|phone|ring|bulana|bula|baat karni|baat karna|book|booking|appointment|schedule)\b/i;
const VISIT = /\b(visit|go to|jaana|jana|office|bank|rto|passport seva)\b/i;
const BIG = /\b(plan|planning|research|shortlist|compare|organise|organize|shift|move|renovat\w*|wedding|shaadi|trip)\b/i;
const TOGETHER = /\b(together|hum dono|dono|saath( mein)?|both of us|with me)\b/i;

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_SHORT: Record<string, string> = { sun: 'sunday', mon: 'monday', tue: 'tuesday', tues: 'tuesday', wed: 'wednesday', thu: 'thursday', thur: 'thursday', thurs: 'thursday', fri: 'friday', sat: 'saturday' };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function whenOf(raw: string): string {
  const t = raw.toLowerCase();
  if (/\b(today|aaj|tonight|aaj raat)\b/.test(t)) return 'today';
  if (/\b(tomorrow|kal|tmrw|tmr)\b/.test(t)) return 'tomorrow';
  if (/\b(parso|day after tomorrow)\b/.test(t)) return 'day after tomorrow';
  if (/\b(next week|agle hafte|agle week)\b/.test(t)) return 'next week';
  if (/\b(this weekend|weekend)\b/.test(t)) return 'by the weekend';
  if (/\b(next month|agle mahine)\b/.test(t)) return 'next month';
  if (/\b(this month|is mahine)\b/.test(t)) return 'this month';
  const day = t.match(/\b(sun|mon|tues?|wed|thu(?:rs?)?|fri|sat)(?:day|nesday|rsday|urday)?\b/);
  if (day) {
    const full = DAYS.find((d) => d.startsWith(day[1])) ?? DAY_SHORT[day[1]];
    // "before sat" means it has to be done by the day before.
    if (/\bbefore\b/.test(t)) {
      const prev = DAYS[(DAYS.indexOf(full) + 6) % 7];
      return `by ${cap(prev)}`;
    }
    return `by ${cap(full)}`;
  }
  if (/\b(urgent|asap|jaldi|abhi)\b/.test(t)) return 'today';
  return 'this week';
}

function effortOf(raw: string, bucket: Bucket): { effort: string; weight: number } {
  if (BIG.test(raw)) return { effort: '1 hr', weight: 4 };
  if (CALL.test(raw)) return { effort: '15 min call', weight: 2 };
  if (VISIT.test(raw)) return { effort: '1 hr visit', weight: 3 };
  if (bucket === 'Admin') return { effort: '10 min', weight: 1 };
  if (bucket === 'Us') return { effort: '30 min', weight: 3 };
  return { effort: '15 min', weight: 1 };
}

// Spoken filler that adds nothing to a card title.
const FILLER = /\b(need to|have to|gotta|please|pls|karna hai|karni hai|karna|karni|hai|ko|ka|ki|ke)\b/gi;

export function titleOf(raw: string): string {
  const cleaned = raw.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
  return cap(cleaned || raw.trim());
}

export function splitDrop(text: string): string[] {
  return text
    .split(/,|;|\n|\.\s|\band then\b|\band\b|\baur\b|\bphir\b|\balso\b/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

export function sortLine(raw: string): Sorted {
  const bucket = BUCKETS.find(([, re]) => re.test(raw))?.[0] ?? 'Errands';
  return { title: titleOf(raw), bucket, ...effortOf(raw, bucket), when: whenOf(raw), together: TOGETHER.test(raw) };
}

export const sortDrop = (text: string): Sorted[] => splitDrop(text).map(sortLine);
