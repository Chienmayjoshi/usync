import { describe, expect, it } from '@jest/globals';

import { isWaiting, sortDrop, sortLine, splitDrop } from './sorter';

// Real lines the way people type or dictate them, English and Hinglish.
const cases: [string, { bucket?: string; when?: string; effort?: string; together?: boolean }][] = [
  ['bedroom ceiling light keeps flickering, need an electrician', { bucket: 'Home' }],
  ['kal electrician ko bulana hai', { bucket: 'Home', when: 'tomorrow', effort: '15 min call' }],
  ['call the plumber about the bathroom leak', { bucket: 'Home', effort: '15 min call' }],
  ['AC servicing before summer', { bucket: 'Home' }],
  ['fix leaky tap before mom visits sat', { bucket: 'Home', when: 'by Friday' }],
  ['renew car insurance', { bucket: 'Admin', effort: '10 min' }],
  ['pay the electricity bill by friday', { bucket: 'Admin', when: 'by Friday' }],
  ['passport renewal appointment book karna hai', { bucket: 'Admin', effort: '15 min call' }],
  ['rent agreement renew karna hai next month', { bucket: 'Admin', when: 'next month' }],
  ['update kyc at the bank', { bucket: 'Admin', effort: '1 hr visit' }],
  ['file ITR this month', { bucket: 'Admin', when: 'this month' }],
  ['return the amazon parcel', { bucket: 'Errands' }],
  ['aaj dry clean se kapde collect karne hai', { bucket: 'Errands', when: 'today' }],
  ['buy a new pressure cooker', { bucket: 'Errands' }],
  ['dawai le aana for papa', { bucket: 'Family' }],
  ['nani ka birthday gift', { bucket: 'Family' }],
  ['cousin ki shaadi ke liye tickets', { bucket: 'Family', effort: '1 hr' }],
  ['diwali puja ka saaman', { bucket: 'Family' }],
  ['plan the goa trip in december', { bucket: 'Us', effort: '1 hr' }],
  ['anniversary dinner book karna hai', { bucket: 'Us', effort: '15 min call' }],
  ['hum dono movie dekhne chalenge weekend', { bucket: 'Us', when: 'by the weekend', together: true }],
  ['society office ko call karo parking ke liye', { bucket: 'Home', effort: '15 min call' }],
  ['wifi router replace karwana hai urgent', { bucket: 'Home', when: 'today' }],
  ['pest control for cockroaches next week', { bucket: 'Home', when: 'next week' }],
  ['geyser not heating', { bucket: 'Home' }],
  ['gas cylinder book', { bucket: 'Home', effort: '15 min call' }],
  ['courier the documents to mumbai', { bucket: 'Admin' }],
  ['get the bike RC transferred', { bucket: 'Admin' }],
  ['parso tailor se blouse lana', { bucket: 'Errands', when: 'day after tomorrow' }],
  ['shortlist schools for riya together', { together: true, effort: '1 hr' }],
];

describe('sortLine on real lines', () => {
  it.each(cases)('%s', (line, expected) => {
    expect(sortLine(line)).toMatchObject(expected);
  });
});

describe('splitDrop', () => {
  it('splits one line into several jobs on commas and Hinglish joins', () => {
    expect(splitDrop('kal electrician ko bulana hai aur parcel return karna hai')).toEqual(['kal electrician ko bulana hai', 'parcel return karna hai']);
    expect(splitDrop('bedroom light flickering, call electrician, return the parcel')).toHaveLength(3);
    expect(splitDrop('renew insurance; then pay rent')).toHaveLength(2);
  });

  it('turns one dictated line into sorted cards with clean titles', () => {
    const cards = sortDrop('kal electrician ko bulana hai aur parcel return karna hai');
    expect(cards.map((c) => c.title)).toEqual(['Electrician bulana', 'Parcel return']);
    expect(cards.map((c) => c.bucket)).toEqual(['Home', 'Errands']);
  });
});

describe('isWaiting', () => {
  it.each([
    'he needs a spare part, back Tuesday 11am',
    'electrician will come on saturday',
    'kal aayega plumber',
    'they will call back tomorrow',
    'appointment rescheduled to next week',
    'out of stock, waiting for delivery',
  ])('spots waiting in "%s"', (line) => expect(isWaiting(line)).toBe(true));

  it.each(['called them, booked for 5pm', 'paid online', 'done, just need to file the receipt'])('plain progress "%s" is not waiting', (line) => {
    expect(isWaiting(line)).toBe(false);
  });
});
