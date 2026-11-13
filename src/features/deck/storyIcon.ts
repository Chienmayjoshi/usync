// Which icon a line of a card's story gets in the open card's timeline (Figma 319:26369). The
// lines are written by the app and the database ("Chinmay took it from the table", "Undone",
// "Done"...), so this reads their wording. The icon itself is drawn by CardDetail.

export type StoryIcon = 'added' | 'asked' | 'undone' | 'took' | 'back' | 'done' | 'together' | 'note' | 'waiting' | 'surprise' | 'date' | 'other';

const RULES: [RegExp, StoryIcon][] = [
  [/\bundone\b|\bdeclined\b|\bsaid no\b|\bkept it\b|\bnot now\b/, 'undone'],
  [/\badded\b|\bdropped\b/, 'added'],
  [/\btogether\b/, 'together'],
  [/\basked\b|\bwants\b/, 'asked'],
  [/\bput it back\b|\bback on the table\b|\bopen table\b|\bgave it away\b/, 'back'],
  [/\btook\b|\btaken\b/, 'took'],
  [/\bcomplete\b|\bdone\b|\bfinished\b/, 'done'],
  [/\bwaiting\b/, 'waiting'],
  [/\bsurprise\b/, 'surprise'],
  [/\breveal\b|\bpostpone|\btomorrow\b|\bday later\b/, 'date'],
  [/\bupdate\b|\bnote\b|[“"]/, 'note'],
];

export function storyIcon(line: string): StoryIcon {
  const l = line.toLowerCase();
  for (const [re, icon] of RULES) if (re.test(l)) return icon;
  return 'other';
}
