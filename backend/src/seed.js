import path from 'node:path';
import { config } from './config.js';
import { db } from './db.js';
import { createEvent } from './events.js';
import { saveMediaFromFile } from './media.js';

const assets = path.join(config.root, 'seed/assets');
const media = (file) => saveMediaFromFile(path.join(assets, file)).url;

/** The kabaddi championship from the reference templates, as a starting event. */
export function kabaddiEvent() {
  return {
    name: 'Gujarat Kabaddi Championship 2026',
    city: 'Ahmedabad',
    round: 'State Final',
    date: '15 Nov 2026',
    venue: 'EKA Arena, Ahmedabad',
    theme: {
      primary: '#1a2a5e',
      primaryDeep: '#101a3d',
      accent: '#f26a21',
      accentSoft: '#fdba74',
      ink: '#1b2033',
      surface: '#fff1e3',
      surfaceSoft: '#fff8f1',
      headingFont: 'Oswald',
    },
    images: { emblem: media('emblem.png'), hero: media('hero.png'), footer: media('footer.png') },
    roles: [
      {
        key: 'winner', label: 'Winner', tier: 'gold', tagline: 'One raid stood above the rest.',
        kind: 'Winner · Physical Certificate', summary: 'won the {round} of the {event}',
        resultLabel: 'Result', detailsTitle: 'Winner & Event Details', momentTitle: 'The Winning Moment',
      },
      {
        key: '1st-runner-up', label: '1st Runner-Up', tier: 'silver', tagline: 'A breath away from the top.',
        kind: '1st Runner-Up · Physical Certificate', summary: 'is 1st Runner-Up in the {round} of the {event}',
        resultLabel: 'Result', detailsTitle: 'Result & Event Details', momentTitle: 'Their Moment',
      },
      {
        key: '2nd-runner-up', label: '2nd Runner-Up', tier: 'bronze', tagline: 'On the podium, earned raid by raid.',
        kind: '2nd Runner-Up · Physical Certificate', summary: 'is 2nd Runner-Up in the {round} of the {event}',
        resultLabel: 'Result', detailsTitle: 'Result & Event Details', momentTitle: 'Their Moment',
      },
      {
        key: 'participant', label: 'Participant', tier: 'rose', tagline: 'Every raid tells a story.',
        kind: 'Participant · Physical Certificate', summary: 'took part in the {round} of the {event}',
        resultLabel: 'Role', detailsTitle: 'Certificate & Event Details', momentTitle: 'Their Moment',
      },
      {
        // Referees get no category and no "in their words" section, as in the template.
        key: 'referee', label: 'Referee', tier: 'rose', tagline: 'Every call fair, every raid watched.',
        kind: 'Referee', summary: 'refereed the {round} of the {event}',
        resultLabel: 'Role', detailsTitle: 'Certificate & Event Details', fields: ['team'],
      },
    ],
    fields: [
      { key: 'category', label: 'Category', type: 'select', display: 'fact', required: true, options: ["Men's Open", "Women's Open", 'Under-19 Boys', 'Under-19 Girls'] },
      { key: 'team', label: 'Team / District', type: 'text', display: 'fact', placeholder: 'e.g. Surat Strikers' },
      { key: 'remark', label: 'In their words', type: 'textarea', display: 'moment', placeholder: 'As written at the booth: their best raid, their team, and what the day meant.' },
    ],
    authSponsor: {
      name: 'Just Drive', logo: media('just-drive-logo.svg'), url: '#', offer: '₹1,000 off',
      terms: 'On rentals above ₹5,000', validTill: '31 Dec 2026', code: 'JDKABADDI26', cta: 'Book a rental',
      banner: media('sponsor-banner.png'),
    },
    sponsors: [
      { tag: 'Sponsor', name: 'MYBYK', logo: media('mybyk-logo.svg'), text: 'Bicycle rentals across Ahmedabad. Proud sponsor of the Gujarat Kabaddi Championship 2026.', url: '#', cta: 'Visit MYBYK' },
      { tag: 'Organiser', name: 'Sports Authority of Gujarat', logo: media('sag-logo.png'), text: "Proud to back Gujarat's kabaddi players at the Gujarat Kabaddi Championship 2026.", url: '#', cta: 'Visit SAG' },
    ],
    partners: [
      { label: 'Sponsor', name: 'MYBYK', logo: media('mybyk-logo.svg') },
      { label: 'Organiser', name: 'Sports Authority of Gujarat', logo: media('sag-logo.png') },
      { label: 'Authentication Sponsor', name: 'Just Drive', logo: media('just-drive-logo.svg') },
      { label: 'Venue Partner', name: 'EKA Arena by TransStadia', logo: media('transstadia-logo.png') },
    ],
    officials: {
      title: 'Meet the Referees',
      people: [
        { name: 'Kripa Shankar Sharma', title: 'Referee, Pro Kabaddi League · Best Referee, Seasons 5 & 7', photo: media('referees/kripa-shankar-sharma.jpg') },
        { name: 'Sasmita Das', title: 'Referee, Pro Kabaddi League since Season 2', photo: media('referees/sasmita-das.jpg') },
        { name: 'Ajit Kumar Bidhuri', title: 'Referee, Pro Kabaddi League', photo: media('referees/ajit-kumar-bidhuri.jpg') },
        { name: 'Damayanti Boro', title: 'Referee, Pro Kabaddi League', photo: media('referees/damayanti-boro.jpg') },
      ],
    },
  };
}

export function seedIfEmpty() {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM events').get();
  if (n > 0) return;
  const event = createEvent(kabaddiEvent());
  console.log(`Seeded sample event "${event.name}" (${event.id})`);
}
