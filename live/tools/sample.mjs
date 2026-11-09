#!/usr/bin/env node
// fallgarden · live/tools/sample.mjs — writes live/data/sample-process.json: an EXAMPLE client process for the "your
// build" view (a law firm's new-matter intake). Its enquiries are SYNTHETIC: written from phrase templates for this demo,
// never a real client's data, and the file says so. A real client's own process and examples replace it.
import { writeFileSync } from 'node:fs';

const MATTERS = {
  employment: ['dismissed without a hearing', 'unpaid overtime from my employer', 'my contract was ended after sick leave', 'redundancy selection felt unfair',
    'discrimination at work by my manager', 'my employer cut my hours without notice', 'grievance ignored by my employer', 'constructive dismissal after a demotion'],
  property: ['my landlord is keeping my deposit', 'a boundary dispute with the neighbour', 'buying a leasehold flat and the lease is short', 'the tenant stopped paying rent',
    'damp in the rented flat the landlord will not fix', 'a right of way over our land', 'eviction notice from my landlord', 'the survey missed subsidence on the house'],
  family: ['divorce and arrangements for the children', 'a child contact order after separation', 'splitting the house after a separation', 'a prenuptial agreement before the wedding',
    'my former partner stopped child maintenance', 'adoption by a step-parent', 'a non-molestation order for my safety', 'grandparents asking to see the children'],
  commercial: ['a supplier breached our contract', 'a shareholder dispute in our company', 'a customer will not pay our invoices', 'terms and conditions for our online shop',
    'a partnership agreement for our firm', 'a franchise agreement before we sign', 'a competitor copied our product design', 'debt recovery from a business client'],
};
const OPENERS = ['Hello,', 'Hi there,', 'Good morning,', 'Dear team,', 'Hello again,'];
const ASKS = ['can you help?', 'what are my options?', 'how much would it cost to start?', 'is there a deadline?', 'can we book a call?'];
const examples = [];
for (const [label, issues] of Object.entries(MATTERS)) {
  issues.forEach((issue, i) => {
    for (let k = 0; k < 12; k++) examples.push({ text: `${OPENERS[(i + k) % OPENERS.length]} ${issue}, ${ASKS[(i * 3 + k) % ASKS.length]}`, label });
  });
}
const out = {
  company: 'Example & Co Solicitors',
  note: 'An EXAMPLE process. Its enquiries are synthetic, written from phrase templates for this demo (live/tools/sample.mjs), not real client data.',
  steps: [
    { name: 'Enquiry intake', who: 'reception' },
    { name: 'Conflict check', who: 'compliance' },
    { name: 'Matter triage', who: 'a partner', decides: Object.keys(MATTERS) },
    { name: 'Engagement letter', who: 'the fee earner' },
    { name: 'Matter opened', who: 'accounts' },
  ],
  examples,
};
writeFileSync(new URL('../data/sample-process.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(out.steps.length + ' steps, ' + examples.length + ' synthetic example enquiries');
