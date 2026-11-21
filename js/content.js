export const RANKS = [{r:'E',xp:0},{r:'D',xp:1200},{r:'C',xp:3600},{r:'B',xp:8000},{r:'A',xp:15000},{r:'S',xp:30000}];
export const rankOf = xp => RANKS.reduce((k, x, i) => xp >= x.xp ? i : k, 0);
export const levelOf = xp => 1 + Math.floor(xp / 150);
export const STAT_KEYS = ['breath', 'pace', 'retrieval', 'composure', 'resilience'];
export const STAT_N = {breath:'Breath', pace:'Pace', retrieval:'Word flow', composure:'Composure', resilience:'Courage'};
export const ENERGY = ['Fresh', 'Good', 'Flat', 'Tired', 'Spent'];
export const FLU = ['Blocked often', 'Bumpy', 'Mixed', 'Mostly smooth', 'Smooth'];
/* Fixed XP per session type (spec 3). Ratings never change these amounts. */
export const XP = {breath:20, ritual:20, read:25, raid:25, cold:30, field:60, boss:100, reeval:50, quest:40, comeback:25, week:60, debrief:10};
/* Daily Quest: a breath item and a speak item. Session types that complete each one. */
export const QUEST_ITEMS = [{id:'breath', n:'Breathe', d:'One breathing session'}, {id:'speak', n:'Speak', d:'One speaking drill'}];
export const BREATH_TYPES = ['breath', 'ritual'];
export const SPEAK_TYPES = ['read', 'raid', 'cold', 'boss', 'field'];
/* Titles, each earned once at a milestone. */
export const TITLES = [
  {id:'first-step', n:'The One Who Spoke First'},
  {id:'week', n:'Seven Days'}
].concat(RANKS.slice(1).map(x => ({id:'rank-' + x.r, n:'Rank ' + x.r + ' Speaker'})));
/* Plain names used in UI copy and the log. Keys are the stored session types and never change. */
export const TYPE_N = {breath:'Breathe', read:'Read aloud', raid:'Word warm-up', cold:'Practice question', boss:'Challenge round', ritual:'I’m about to speak', debrief:'Debrief', field:'Real-world step', reeval:'Weekly re-record'};
export const DRILL_N = {breath:'Breathe', read:'Read aloud', raid:'Word warm-up', cold:'Practice question'};
export const PATTERNS = {
  sigh:{n:'Cyclic sighing', inS:3, outS:6, speak:false, d:'Two nasal inhales, then a long mouth exhale', ev:'In a 2023 Stanford trial (Balban et al.), five minutes of cyclic sighing lowered anxiety more than mindfulness.'},
  speak:{n:'Breathe and speak', inS:3, outS:7, speak:true, d:'3 seconds in, a phrase on a 7 second exhale', ev:'Practises starting your voice softly on an easy out-breath, a core speech-therapy skill.'},
  box:{n:'Box breathing', inS:4, hold1:4, outS:4, hold2:4, speak:false, d:'4 in, 4 hold, 4 out, 4 hold', ev:'Even four-part pacing anchors attention when your mind is racing.'},
  slow:{n:'Extended exhale', inS:4, outS:8, speak:false, d:'4 seconds in, 8 out', ev:'A longer out-breath slows heart rate and settles tension before rest.'},
  resonance:{n:'Resonance breathing', inS:5, outS:5, speak:false, d:'About 6 light breaths a minute (5 in, 5 out)', ev:'HRV-biofeedback meta-analyses find slow breathing near 6 breaths a minute steadily reduces stress.'},
  gentle:{n:'Gentle breathing', inS:4, outS:6, speak:false, d:'4 seconds in, 6 out', ev:'An easy, unhurried pace for a short daily reset.'}
};
export const BREATH_GOALS = [
  {id:'calm', n:'Calm now', pat:'sigh', d:'Cyclic sighing · two nasal inhales, long exhale'},
  {id:'speak', n:'Before speaking', pat:'speak', d:'Breathe and speak · a phrase on the exhale'},
  {id:'focus', n:'Focus', pat:'box', d:'Box breathing · 4 in, 4 hold, 4 out, 4 hold'},
  {id:'wind', n:'Wind down', pat:'slow', d:'Extended exhale · 4 in, 8 out'}
];
export const BREATH_ALL = ['sigh', 'speak', 'box', 'slow', 'resonance', 'gentle'];
export const PHRASES = ['Let me start with the headline.', 'Here is what changed since last week.', 'My recommendation is to hold steady.', 'The main risk is timing.', 'I will confirm the numbers by Thursday.', 'Thanks for joining, everyone.', 'There are three things to cover.', 'I prefer the second option.', 'That depends on two things.', 'The short answer is yes.'];
export const CONTEXTS = [
  {id:'work', n:'Work meetings and calls', d:'Updates, standups, decisions and pushback'},
  {id:'phone', n:'Phone calls and services', d:'Appointments, support, orders and callbacks'}
];
export const WPM = [70, 80, 90, 100, 115, 130, 145];
export const PASSAGES = [
  {ctx:'work', t:'Team standup update', x:'Good morning, everyone. Let me start with the headline. Our main milestone is on track for Friday, and the design review finished yesterday. One blocker sits with the external handoff, so I will follow up right after this call. If timing shifts, I will share an updated plan before the end of the day.'},
  {ctx:'work', t:'Project check-in', x:'Thanks for joining this check-in. I want to cover three things: progress against target, open risks, and next steps. Delivery is steady, although testing took a day longer on Tuesday. My ask today is simple. Please confirm the sign-off date by Thursday, and I will update the schedule right after that.'},
  {ctx:'work', t:'Explaining a delay', x:'Last month the rollout slipped by a week. Here is what happened. A late change landed earlier than planned, and our checklist did not catch it. We have fixed the step and added a quick weekly review with the team. I am confident the next release will be smoother, and I will share the result as soon as it lands.'},
  {ctx:'work', t:'Handing a decision back', x:'I have looked at both options, and I prefer the second one. It costs a little more, but it removes the biggest risk. If the group agrees, I can start next week. If you see a problem I have missed, please tell me now, because it is much easier to change course today than a month from now.'},
  {ctx:'phone', t:'Booking an appointment', x:'Hello, I would like to book an appointment for next week, please. Any morning between nine and eleven works well for me. My date of birth is ready if you need it to pull up my record. Could you also confirm the address and whether I should arrive ten minutes early? Thank you.'},
  {ctx:'phone', t:'Calling customer support', x:'Hi, I am calling about an order I placed on Tuesday. I have the reference number right in front of me whenever you are ready. The delivery update has not moved since yesterday morning, so I wanted to check if there is a delay. Could you let me know the new arrival window?'},
  {ctx:'phone', t:'Returning a missed call', x:'Hello, I am returning a missed call from this number earlier today. I was in a meeting when you rang, so I wanted to catch you while I have a quiet five minutes. Could you let me know who I should ask for, or the best time to call back?'},
  {ctx:'phone', t:'A quiet morning', x:'It was a quiet morning in the city. The first bus arrived on time, and a few people stood waiting under the awning. Somewhere nearby a vendor was setting up his stall, arranging oranges in neat rows. The air smelled of rain and fresh bread. It was the kind of morning that made every task feel possible.'}
];
export const QUESTIONS = [
  {ctx:'work', t:'Walk me through what changed since last week.'},
  {ctx:'work', t:'What is the biggest risk to this project right now?'},
  {ctx:'work', t:'Explain your current work to a colleague in thirty seconds.'},
  {ctx:'work', t:'What do you need from my team to make this move faster?'},
  {ctx:'work', t:'Who owns this decision, and by when does it need to be made?'},
  {ctx:'work', t:'Why did that plan slip last month, and what changed?'},
  {ctx:'work', t:'If you could watch only one metric, which one and why?'},
  {ctx:'work', t:'What would you stop doing to free up capacity?'},
  {ctx:'work', t:'What is your recommendation, and how confident are you?'},
  {ctx:'work', t:'Tell me about a plan of yours that did not work. What did you change?'},
  {ctx:'work', t:'What is the cheapest way to test this idea before we commit?'},
  {ctx:'work', t:'Where do you disagree with the current approach?'},
  {ctx:'work', t:'What would make you change your recommendation?'},
  {ctx:'work', t:'Where does this project stand, and what is blocking it?'},
  {ctx:'work', t:'What trade-off are we making if we approve this?'},
  {ctx:'work', t:'Give me one thing to do this quarter and one thing not to do.'},
  {ctx:'work', t:'You have three requests and time for one. How do you choose?'},
  {ctx:'work', t:'What data are we missing to make this call?', u:1},
  {ctx:'work', t:'I disagree with that point. Convince me.'},
  {ctx:'work', t:'Summarize where we landed in two sentences.'},
  {ctx:'phone', t:'The receptionist asks: “How can I help you today?” Say your name and why you are calling.'},
  {ctx:'phone', t:'Customer support asks you to spell your name and explain the issue in two sentences.'},
  {ctx:'phone', t:'A restaurant asks for your reservation time, party size, and phone number. Give them clearly.'},
  {ctx:'phone', t:'The clinic says Thursday is full. Ask calmly for the next available morning slot.'},
  {ctx:'phone', t:'Leave a short voicemail: your name, why you called, and when to reach you back.'},
  {ctx:'phone', t:'A shop tells you an item is out of stock. Ask when it returns or for an alternative.'},
  {ctx:'phone', t:'The line is noisy and the agent says “Sorry, I missed that.” Repeat your key point slowly.'},
  {ctx:'phone', t:'You are calling to reschedule a delivery. Give your order date and preferred window.'}
];
export const STALL = ['Let me think about that for a second.', 'Good question. My first read is…', 'The short answer is… and the detail is…', 'I want to be accurate, so I will confirm by Thursday.', 'It depends on two things. First…', 'What decision does this feed?', 'My instinct is… and I would validate it against…'];
export const LETTERS = 'ABCDEFGHIJKLMNOPRSTUVW'.split('');
export const CATS = ['Animals', 'Countries', 'Cities', 'Foods', 'Professions', 'Things in a house', 'Sports', 'Things at an office', 'Planning and ops terms', 'Things you can carry'];
export const MISSIONS = [
  {id:'m1', ctx:'phone', t:'Greet someone you pass, aloud, on one breath', d:'Low stakes. Soft start, slow pace.'},
  {id:'m2', ctx:'phone', t:'Make a small request: order, ask a price, or phone a shop', d:'Have your first words ready.'},
  {id:'m3', ctx:'phone', t:'Book or confirm an appointment by phone', d:'Say your name softly on the out-breath.'},
  {id:'m4', ctx:'work', t:'Ask one question in a small meeting', d:'Write the question as one sentence first.'},
  {id:'m5', ctx:'work', t:'Give your update first on a team call', d:'Use your opening line from Settings.'},
  {id:'m6', ctx:'work', t:'Open a call with your prepared opening line', d:'Use I’m about to speak just before it.'},
  {id:'m7', ctx:'work', t:'Answer pushback without deferring', d:'Hold your position, then say what would change it.'},
  {id:'m8', ctx:'work', t:'Lead a segment for a senior audience', d:'Slow pace, planned pauses.'}
];
export const TWISTS = [
  'Stand up while you practice.',
  'Practice as if you were on a phone call: look away from the screen.',
  'Speak to an imagined senior leader, not to yourself.',
  'Use normal office volume, not a whisper.',
  'Walk slowly while you practice.',
  'Practice in a different room than usual.'
];
export const ANCHORS = ['after my morning tea or coffee', 'before my first call', 'after lunch', 'right after my last call of the day', 'on my commute'];
export const DEFAULT_OPENER = 'Hi everyone, thanks for joining. Let me start with the headline.';
export const BASELINE_PASSAGE = {
  t:'Baseline check',
  x:'Good morning, everyone. Let me start with the main point. We looked closely at both options this week, and the second plan is simpler to run. If anything changes before Friday, I will send a quick note so we stay aligned.'
};
export const TECH_CHECKS = {
  read:['Soft start on the first word', 'Steady pace through each phrase', 'Paused at the ▾ marks', 'Started on an easy exhale'],
  speak:['Breathed in quietly first', 'Started the phrase softly on the exhale', 'Kept shoulders and jaw loose'],
  cold:['Paused to breathe before answering', 'Led with a clear position', 'Paused instead of dodging a word']
};
export const TECH_DEMOS = {
  read:'What good sounds like: the first syllable of each phrase comes out like a soft sigh, with a unhurried breath at every ▾ mark rather than rushing to finish.',
  speak:'What good sounds like: a quiet nose inhale, then the sentence riding smoothly out on the exhale without pushing from the throat.',
  cold:'What good sounds like: a calm beat of silence before your first word, one clear sentence up front, and pausing openly if a word catches.'
};
