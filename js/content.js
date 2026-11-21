export const RANKS = [{r:'E',xp:0},{r:'D',xp:1200},{r:'C',xp:3600},{r:'B',xp:8000},{r:'A',xp:15000},{r:'S',xp:30000}];
export const rankOf = xp => RANKS.reduce((k, x, i) => xp >= x.xp ? i : k, 0);
export const levelOf = xp => 1 + Math.floor(xp / 150);
export const STAT_KEYS = ['breath', 'pace', 'retrieval', 'composure', 'resilience'];
export const STAT_N = {breath:'Breath control', pace:'Pace', retrieval:'Word retrieval', composure:'Composure', resilience:'Resilience'};
export const ENERGY = ['Fresh', 'Good', 'Flat', 'Tired', 'Spent'];
export const FLU = ['Blocked often', 'Bumpy', 'Mixed', 'Mostly smooth', 'Smooth'];
export const QUESTS = [
  {id:'breath', n:'Breath Gate', need:1, d:'One full breathing session'},
  {id:'read', n:'Paced Reading', need:1, d:'One passage at your pace gate'},
  {id:'raid', n:'Alphabet Raid', need:2, d:'Two rounds of word retrieval'},
  {id:'cold', n:'Cold Questions', need:2, d:'Two unrehearsed answers'}
];
export const TYPE_N = {breath:'Breath Gate', read:'Paced Reading', raid:'Alphabet Raid', cold:'Cold Question', boss:'Boss Gauntlet', ritual:'Pre-call ritual', debrief:'Debrief', field:'Field mission'};
export const DRILL_N = {breath:'Breath Gate', read:'Paced Reading', raid:'Alphabet Raid', cold:'Cold Question'};
export const PATTERNS = {
  gentle:{n:'Gentle', inS:4, outS:6, speak:false, d:'4 in, 6 out'},
  slow:{n:'Slow', inS:4, outS:8, speak:false, d:'4 in, 8 out'},
  speak:{n:'Breath and speak', inS:3, outS:7, speak:true, d:'3 in, say a phrase on the 7 second exhale'}
};
export const PHRASES = ['Let me start with the headline.', 'Here is what changed since last week.', 'My recommendation is to hold steady.', 'The main risk is timing.', 'I will confirm the numbers by Thursday.', 'Thanks for joining, everyone.', 'There are three things to cover.', 'I prefer the second option.', 'That depends on two things.', 'The short answer is yes.'];
export const WPM = [70, 80, 90, 100, 115, 130, 145];
export const PASSAGES = [
  {t:'Monday forecast review', x:'Good morning, everyone. Let me start with the headline. Volume is running four percent above plan, and most of the gap sits in two queues. I recommend we hold staffing flat this week, because the surge looks temporary. If the trend continues past Friday, I will bring a revised plan to this group. Until then, our priority is protecting service levels while we learn more.'},
  {t:'Vendor check-in', x:'Thanks for joining this check-in. I want to cover three things: performance against target, open risks, and next steps. Performance is steady, although adherence dipped on Tuesday. The main risk is attrition on the evening shift. My ask today is simple. Please confirm the hiring dates by Thursday, and I will update the plan right after that.'},
  {t:'Annual plan narrative', x:'Our annual plan rests on one idea. We grow the team only where demand is predictable, and we use partners and automation for everything else. This keeps cost under control without hurting quality. The assumptions are written down, the owners are named, and every quarter we will check them against what actually happened.'},
  {t:'Explaining a miss', x:'Last month the forecast missed by six percent. Here is what happened. A product change landed earlier than planned, and our model did not know about it. We have fixed the input and added a weekly check with the product team. I am confident the next month will be closer, and I will share the result as soon as I have it.'},
  {t:'Handing a decision back', x:'I have looked at both options, and I prefer the second one. It costs a little more, but it removes the biggest risk. If the group agrees, I can start next week. If you see a problem I have missed, please tell me now, because it is much easier to change course today than a month from now.'},
  {t:'A quiet morning', x:'It was a quiet morning in the city. The first bus arrived on time, and a few people stood waiting under the awning. Somewhere nearby a vendor was setting up his stall, arranging oranges in neat rows. The air smelled of rain and fresh bread. It was the kind of morning that made every task feel possible.'}
];
export const QUESTIONS = [
  {t:'If you had to cut vendor spend by ten percent, where would you start and why?'},
  {t:'What is the biggest risk to next year’s headcount plan?'},
  {t:'Why should we trust this forecast?'},
  {t:'Walk me through what changed since last quarter.'},
  {t:'Should we hire full-time staff or expand the vendor team? Pick one.'},
  {t:'Volume comes in twenty percent above forecast next week. What do you do first?'},
  {t:'What do you need from my team to make this work?'},
  {t:'Who owns this decision, and by when does it need to be made?'},
  {t:'Why did the forecast miss last month?'},
  {t:'If you could watch only one metric, which one and why?'},
  {t:'What would you stop doing to free up capacity?'},
  {t:'Explain this plan to a busy executive in thirty seconds.'},
  {t:'What is your recommendation, and how confident are you?'},
  {t:'Tell me about a plan of yours that did not work. What did you change?'},
  {t:'What is the cheapest way to test this idea before we commit?'},
  {t:'Where do you disagree with the current approach?'},
  {t:'What would make you change your recommendation?'},
  {t:'How do we know the vendor is performing, beyond their own reports?'},
  {t:'What will attrition look like in March?', u:1},
  {t:'Where does this project stand, and what is blocking it?'},
  {t:'What trade-off are we making if we approve this?'},
  {t:'Give me one thing to do this quarter and one thing not to do.'},
  {t:'You have three requests and time for one. How do you choose?'},
  {t:'What data are we missing to make this call?', u:1},
  {t:'How will we know in ninety days that this worked?'},
  {t:'I disagree with that number. Convince me.'},
  {t:'What is the risk if we do nothing?'},
  {t:'Which assumption in the model worries you most?'},
  {t:'What would you do with ten percent more budget?'},
  {t:'Summarize where we landed in two sentences.'}
];
export const STALL = ['Let me think about that for a second.', 'Good question. My first read is…', 'The short answer is… and the detail is…', 'I want to be accurate, so I will confirm by Thursday.', 'It depends on two things. First…', 'What decision does this feed?', 'My instinct is… and I would validate it against…'];
export const LETTERS = 'ABCDEFGHIJKLMNOPRSTUVW'.split('');
export const CATS = ['Animals', 'Countries', 'Cities', 'Foods', 'Professions', 'Things in a house', 'Sports', 'Things at an office', 'Planning and ops terms', 'Things you can carry'];
export const MISSIONS = [
  {id:'m1', t:'Greet someone you pass, aloud, on one breath', d:'Low stakes. Soft start, slow pace.'},
  {id:'m2', t:'Make a small request: order, ask a price, or phone a shop', d:'Have your first words ready.'},
  {id:'m3', t:'Ask one question in a small meeting', d:'Write the question as one sentence first.'},
  {id:'m4', t:'Give your update first on a team call', d:'Use your opening line from the Guide.'},
  {id:'m5', t:'State a recommendation in the first five minutes of a meeting', d:'Position first, reason second.'},
  {id:'m6', t:'Open a call with your prepared opening line', d:'Run the pre-call ritual before it.'},
  {id:'m7', t:'Answer pushback without deferring', d:'Hold your position, then say what would change it.'},
  {id:'m8', t:'Lead a segment for a senior audience', d:'Slow pace, planned pauses.'}
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
