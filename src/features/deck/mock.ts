import type { DeckState } from './model';

// Sprint 1 mock data: Rahul's phone, paired with Meera.
export const initialDeck: DeckState = {
  weeksInSync: 3,
  undo: null,
  lastDoneId: null,
  album: [{ id: 'tap', title: 'The leaky tap saga', when: 'Sep 2026', together: false }],
  cards: [
    {
      id: 'gas', title: 'Pay the gas bill', bucket: 'Admin', effort: '5 min', when: 'by Friday',
      detail: 'Quick admin, and you’re lighter this week.', owner: 'me', status: 'deal', traded: false, weight: 1,
      story: ['Meera dropped it on Monday', 'Dealt to you in the morning hand'],
    },
    {
      id: 'goa', title: 'Shortlist Goa stays for December', bucket: 'Us', effort: '30 min', when: 'this month',
      detail: 'You love planning trips. Meera votes before anything is booked.', owner: 'me', status: 'deal', traded: false, weight: 3,
      story: ['You dropped it by voice', 'Dealt to you: you love planning trips'],
    },
    {
      id: 'parcel', title: 'Return the Amazon parcel', bucket: 'Errands', effort: '10 min', when: 'by Thursday',
      detail: 'Pickup slot closes Thursday. Quick one, then your deck breathes.', owner: 'me', status: 'active', traded: false, weight: 1,
      story: ['Sat on the open table for 48 hours', 'You grabbed it'],
    },
    {
      id: 'router', title: 'Fix the wifi router', bucket: 'Home', effort: '15 min call', when: 'this week',
      detail: 'Call the ISP; ask for a replacement unit. Meera traded it: she’s travelling.', owner: 'me', status: 'deal', traded: true, weight: 2,
      story: ['You dropped it before Meera joined', 'Dealt to Meera', 'Meera traded it: travelling till Thursday'],
    },
    {
      id: 'electrician', title: 'Book an electrician', bucket: 'Home', effort: '15 min call', when: 'back Tue 11am',
      detail: 'Wiring fault. Needs a spare part.', owner: 'partner', status: 'waiting', traded: true, weight: 2,
      story: ['You dropped it by voice', 'Traded to Meera: you were travelling', 'Meera booked Sat 11am', 'Visit 1: wiring fault, needs a part'],
    },
    {
      id: 'society', title: 'Call the society office about parking', bucket: 'Admin', effort: '15 min call', when: 'this week',
      detail: '', owner: 'partner', status: 'active', traded: false, weight: 2, story: [],
    },
  ],
};
