window.TOPICS = window.TOPICS || [];
{
const C = String.raw;
const T = (rows) => `<table class="t"><tr><th>French</th><th>English</th></tr>${rows.map(([f, e]) => `<tr><td>${f}</td><td>${e}</td></tr>`).join("")}</table>`;

/* ============================================================
   DAILY LIFE, SCHOOL & HOBBIES
   ============================================================ */
TOPICS.push({
  id: "dailylife", subject: "french", unit: 3, title: "Daily life, school & hobbies",
  blurb: "Describing your daily routine with reflexive verbs, regular -er verb conjugation, school subjects and opinions, and talking about hobbies and free time.",
  level: "Beginner",
  syllabus: [
    ["3.1", "Conjugate regular -er verbs in the present tense", 0],
    ["3.2", "Describe a daily routine using reflexive verbs", 1],
    ["3.3", "Talk about school subjects and give opinions using them", 2],
    ["3.4", "Talk about hobbies and free-time activities", 3],
    ["3.5", "Use frequency expressions and time phrases", 4]
  ],
  sections: [
    { h: "Regular -er verbs in the present tense", body: C`
<p class="lead">Most French verbs end in <b>-er</b> in the infinitive (the "to..." form) and follow a regular pattern: remove <i>-er</i>, add the ending that matches the subject.</p>
<table class="t"><tr><th>Subject</th><th>Ending</th><th>parler (to speak)</th><th>aimer (to like)</th></tr>
<tr><td>je</td><td>-e</td><td>je parle</td><td>j'aime</td></tr>
<tr><td>tu</td><td>-es</td><td>tu parles</td><td>tu aimes</td></tr>
<tr><td>il/elle/on</td><td>-e</td><td>il parle</td><td>elle aime</td></tr>
<tr><td>nous</td><td>-ons</td><td>nous parlons</td><td>nous aimons</td></tr>
<tr><td>vous</td><td>-ez</td><td>vous parlez</td><td>vous aimez</td></tr>
<tr><td>ils/elles</td><td>-ent</td><td>ils parlent</td><td>elles aiment</td></tr></table>
<p>Other common regular -er verbs: <i>jouer</i> (to play), <i>regarder</i> (to watch), <i>écouter</i> (to listen), <i>manger</i> (to eat), <i>habiter</i> (to live), <i>travailler</i> (to work), <i>détester</i> (to hate).</p>
<div class="callout warn"><b class="t">Silent endings</b>-e, -es and -ent are all <b>silent</b> when spoken: je parle, tu parles and ils parlent all sound the same. Only -ons and -ez change the pronunciation — this is why spelling the verb endings correctly matters so much in writing.</div>
<details class="check"><summary>Conjugate "écouter" (to listen) for "nous" and "ils".</summary><div>nous écoutons; ils écoutent.</div></details>`},

    { h: "Reflexive verbs and daily routine", body: C`
<p class="lead">Reflexive verbs describe an action you do <b>to yourself</b> and need a reflexive pronoun before the verb: <i>me, te, se, nous, vous, se</i>.</p>
<table class="t"><tr><th>se laver (to wash oneself)</th></tr>
<tr><td>je me lave</td></tr><tr><td>tu te laves</td></tr><tr><td>il/elle se lave</td></tr><tr><td>nous nous lavons</td></tr><tr><td>vous vous lavez</td></tr><tr><td>ils/elles se lavent</td></tr></table>
${T([
  ["se réveiller", "to wake up"],
  ["se lever", "to get up"],
  ["se laver", "to wash (oneself)"],
  ["s'habiller", "to get dressed"],
  ["se brosser les dents", "to brush one's teeth"],
  ["se coucher", "to go to bed"],
  ["se reposer", "to rest"],
  ["se doucher", "to shower"]
])}
<div class="callout ex"><b class="t">A typical routine</b><i>Je me réveille à sept heures. Je me lève, je me douche et je m'habille. Je prends le petit déjeuner, puis je me brosse les dents. Le soir, je me couche à dix heures.</i></div>
<details class="check"><summary>Write "She gets up at half past six" in French.</summary><div>Elle se lève à six heures et demie.</div></details>`},

    { h: "School subjects and opinions", body: C`
${T([
  ["les maths", "maths"],
  ["le français / l'anglais", "French / English"],
  ["les sciences", "science"],
  ["l'histoire-géo", "history-geography"],
  ["l'EPS (éducation physique et sportive)", "PE"],
  ["la technologie", "technology"],
  ["les arts plastiques", "art"],
  ["la musique", "music"],
  ["l'informatique", "IT/computing"],
  ["la récréation", "break time"],
  ["la cantine", "the canteen"],
  ["les devoirs", "homework"],
  ["le/la prof(esseur)", "teacher"],
  ["l'emploi du temps", "timetable"]
])}
<p><b>Giving opinions</b> with reasons (always say <i>why</i> for full marks):</p>
${T([
  ["J'aime / Je n'aime pas...", "I like / I don't like..."],
  ["J'adore / Je déteste...", "I love / I hate..."],
  ["Je préfère... à...", "I prefer ... to ..."],
  ["parce que c'est intéressant/ennuyeux", "because it's interesting/boring"],
  ["parce que c'est facile/difficile", "because it's easy/difficult"],
  ["parce que le prof est sympa/sévère", "because the teacher is nice/strict"],
  ["À mon avis...", "In my opinion..."]
])}
<div class="callout key"><b class="t">Subject gender</b>School subjects all need an article: <i>le français, les maths, l'histoire</i>. "J'aime les maths" uses the plural article because "maths" is plural in French too.</div>`},

    { h: "Hobbies and free time", body: C`
${T([
  ["jouer au foot/tennis/basket", "to play football/tennis/basketball"],
  ["jouer aux cartes/échecs", "to play cards/chess"],
  ["jouer d'un instrument", "to play an instrument"],
  ["faire du sport", "to do sport"],
  ["faire du vélo", "to cycle"],
  ["faire de la natation", "to swim"],
  ["faire les magasins", "to go shopping"],
  ["lire un livre/une BD", "to read a book/comic"],
  ["regarder la télé/un film", "to watch TV/a film"],
  ["écouter de la musique", "to listen to music"],
  ["surfer sur Internet", "to surf the internet"],
  ["sortir avec des amis", "to go out with friends"],
  ["aller au cinéma", "to go to the cinema"]
])}
<div class="callout warn"><b class="t">Jouer à vs jouer de</b>Use <i>jouer à</i> + sport/game (<i>jouer au foot</i>), but <i>jouer de</i> + musical instrument (<i>jouer du piano</i>). Remember "à + le = au" and "de + le = du".</div>`},

    { h: "Frequency and time expressions", body: C`
${T([
  ["tous les jours", "every day"],
  ["le week-end", "at the weekend"],
  ["souvent", "often"],
  ["quelquefois / parfois", "sometimes"],
  ["de temps en temps", "from time to time"],
  ["rarement", "rarely"],
  ["ne... jamais", "never"],
  ["une fois par semaine", "once a week"],
  ["d'habitude", "usually"],
  ["puis / ensuite", "then / next"],
  ["après", "after"],
  ["avant de + infinitive", "before ...ing"]
])}
<p>These words usually go <b>after</b> the verb in a simple sentence: <i>Je fais du sport souvent</i>, or at the start of the sentence for emphasis: <i>Le week-end, je joue au foot.</i></p>`}
  ],
  worked: [
    { q: C`Conjugate "regarder" (to watch) fully in the present tense.`,
      steps: [C`Remove -er: regard-.`, C`Add endings: je regarde, tu regardes, il/elle regarde, nous regardons, vous regardez, ils/elles regardent.`]},
    { q: C`Translate: "I get up at seven o'clock, then I get dressed and I eat breakfast."`,
      steps: [C`"I get up" is reflexive: <i>je me lève</i>.`, C`"then" = puis; "I get dressed" = <i>je m'habille</i>.`, C`"I eat breakfast" = <i>je prends le petit déjeuner</i>.`, C`Full sentence: <i>Je me lève à sept heures, puis je m'habille et je prends le petit déjeuner.</i>`]},
    { q: C`Give an opinion on maths with a reason, using "parce que".`,
      steps: [C`Choose an opinion: <i>J'aime les maths</i>.`, C`Add a reason: <i>parce que c'est intéressant</i>.`, C`Full answer: <i>J'aime les maths parce que c'est intéressant.</i>`]}
  ],
  formulas: [["-er present endings", "-e, -es, -e, -ons, -ez, -ent"], ["Reflexive pronoun order", "me/te/se/nous/vous/se + verb"], ["jouer à vs de", "à + sport, de + instrument"], ["Opinion + reason", "J'aime... parce que..."]],
  cards: [
    ["je parle", "I speak"],
    ["nous aimons", "we like"],
    ["ils regardent", "they watch"],
    ["se lever", "to get up"],
    ["se coucher", "to go to bed"],
    ["je me réveille", "I wake up"],
    ["les devoirs", "homework"],
    ["l'EPS", "PE"],
    ["J'aime... parce que...", "I like... because..."],
    ["ennuyeux", "boring"],
    ["jouer au foot", "to play football"],
    ["jouer du piano", "to play the piano"],
    ["faire du sport", "to do sport"],
    ["souvent", "often"],
    ["ne... jamais", "never"],
    ["tous les jours", "every day"],
    ["le week-end", "at the weekend"],
    ["d'habitude", "usually"]
  ],
  quiz: [
    { type: "mcq", marks: 1, q: C`The "nous" form of "jouer" is`, opts: ["joue", "joues", "jouons", "jouez"], ans: 2, why: C`-ons ending.` },
    { type: "mcq", marks: 1, q: C`"Je me lève" means`, opts: ["I wash myself", "I get up", "I go to bed", "I get dressed"], ans: 1, why: C`Se lever = to get up.` },
    { type: "mcq", marks: 1, q: C`"jouer ___ piano" needs`, opts: ["à", "au", "du", "de la"], ans: 2, why: C`Instruments take "de" (+ le = du).` },
    { type: "mcq", marks: 1, q: C`"ne... jamais" means`, opts: ["sometimes", "often", "never", "always"], ans: 2, why: C`Negative frequency.` },
    { type: "struct", marks: 2, q: C`Conjugate "aimer" for "tu" and "vous".`, ms: C`<b>B1</b> tu aimes<br><b>B1</b> vous aimez` },
    { type: "struct", marks: 3, q: C`Translate: "I watch TV every evening but I never do sport."`, ms: C`<b>B1</b> Je regarde la télé tous les soirs<br><b>B1</b> mais je ne fais jamais de sport<br><b>B1</b> correct negative structure (ne...jamais)` },
    { type: "struct", marks: 3, q: C`Give your opinion of science and geography, with a reason for each.`, ms: C`<b>B1</b> correct opinion phrase for science<br><b>B1</b> correct opinion phrase for geography<br><b>B1</b> both include "parce que" + a reason` },
    { type: "struct", marks: 2, q: C`Translate: "She brushes her teeth and then she goes to bed."`, ms: C`<b>B1</b> Elle se brosse les dents<br><b>B1</b> et puis elle se couche` }
  ],
  exam: [
    { d: 1, type: "struct", marks: 1, q: C`Give the "je" form of "habiter".`, ms: C`<b>B1</b> j'habite` },
    { d: 1, type: "mcq", marks: 1, q: C`"les maths" in French needs which article?`, opts: ["le", "la", "les", "l'"], ans: 2, why: C`Maths is plural.` },
    { d: 1, type: "struct", marks: 2, q: C`Translate: "I like English but I hate PE."`, ms: C`<b>B1</b> J'aime l'anglais<br><b>B1</b> mais je déteste l'EPS` },
    { d: 2, type: "struct", marks: 3, q: C`Conjugate "se coucher" fully for je, tu and ils.`, ms: C`<b>B1</b> je me couche<br><b>B1</b> tu te couches<br><b>B1</b> ils se couchent` },
    { d: 2, type: "struct", marks: 3, q: C`Translate: "At the weekend, I play football with my friends and I watch films."`, ms: C`<b>B1</b> Le week-end, je joue au foot avec mes amis<br><b>B1</b> et je regarde des films<br><b>B1</b> correct word order` },
    { d: 2, type: "mcq", marks: 1, q: C`Which sentence is grammatically correct?`, opts: ["Je me réveille à sept heures.", "Je réveille à sept heures.", "Je me réveilles à sept heures.", "Je réveiller à sept heures."], ans: 0, why: C`Correct reflexive pronoun and ending.` },
    { d: 3, type: "struct", marks: 5, q: C`Write a paragraph (4–5 sentences) describing your typical school day: when you wake up, two subjects with opinions and reasons, and what you do in the evening.`, ms: C`<b>B1</b> correct reflexive verb for waking up<br><b>B1</b> correct -er verb conjugation for at least one other action<br><b>B1</b> two subjects named with opinion phrases<br><b>B1</b> at least one "parce que" reason given<br><b>B1</b> overall accuracy and a logical sequence (puis/ensuite/après)` },
    { d: 3, type: "struct", marks: 3, q: C`Translate: "My sister never does her homework, but I always do mine before dinner."`, ms: C`<b>B1</b> Ma sœur ne fait jamais ses devoirs<br><b>B1</b> mais je fais toujours les miens<br><b>B1</b> avant le dîner, correct structure throughout` }
  ]
});
}
