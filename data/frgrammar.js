window.TOPICS = window.TOPICS || [];
{
const C = String.raw;
const T = (rows) => `<table class="t"><tr><th>French</th><th>English</th></tr>${rows.map(([f, e]) => `<tr><td>${f}</td><td>${e}</td></tr>`).join("")}</table>`;

/* ============================================================
   GRAMMAR ESSENTIALS: VERBS & TENSES
   ============================================================ */
TOPICS.push({
  id: "frgrammar", subject: "french", unit: 6, title: "Grammar essentials: verbs & tenses",
  blurb: "The verbs être and avoir, -ir and -re verb patterns, the three key irregular verbs faire/pouvoir/vouloir, negatives, the imperfect tense, and choosing the right tense.",
  level: "Intermediate",
  syllabus: [
    ["6.1", "Conjugate être and avoir in the present tense and use them correctly", 0],
    ["6.2", "Conjugate regular -ir and -re verbs", 1],
    ["6.3", "Use the key irregular verbs faire, pouvoir, vouloir, devoir", 2],
    ["6.4", "Form negative sentences with ne... pas and other negatives", 3],
    ["6.5", "Form and use the imperfect tense for descriptions in the past", 4],
    ["6.6", "Choose the correct tense: present, near future, perfect or imperfect", 5]
  ],
  sections: [
    { h: "Être and avoir: the two essential verbs", body: C`
<p class="lead"><b>Être</b> (to be) and <b>avoir</b> (to have) are the two most important irregular verbs: they appear constantly, and are also the auxiliary verbs used to build the perfect tense.</p>
<table class="t"><tr><th>être (to be)</th><th>avoir (to have)</th></tr>
<tr><td>je suis</td><td>j'ai</td></tr><tr><td>tu es</td><td>tu as</td></tr><tr><td>il/elle/on est</td><td>il/elle/on a</td></tr>
<tr><td>nous sommes</td><td>nous avons</td></tr><tr><td>vous êtes</td><td>vous avez</td></tr><tr><td>ils/elles sont</td><td>ils/elles ont</td></tr></table>
<div class="callout warn"><b class="t">Idioms with avoir, not être</b>French uses <i>avoir</i> where English uses "to be": <i>avoir faim</i> (to be hungry), <i>avoir soif</i> (to be thirsty), <i>avoir chaud/froid</i> (to be hot/cold), <i>avoir peur</i> (to be afraid), <i>avoir raison/tort</i> (to be right/wrong), <i>avoir ... ans</i> (to be ... years old). Saying "je suis froid" by mistake actually claims you are a cold <i>person</i>, not that you feel cold!</div>`},

    { h: "Regular -ir and -re verbs", body: C`
<table class="t"><tr><th>Subject</th><th>finir (to finish)</th><th>vendre (to sell)</th></tr>
<tr><td>je</td><td>finis</td><td>vends</td></tr>
<tr><td>tu</td><td>finis</td><td>vends</td></tr>
<tr><td>il/elle/on</td><td>finit</td><td>vend</td></tr>
<tr><td>nous</td><td>finissons</td><td>vendons</td></tr>
<tr><td>vous</td><td>finissez</td><td>vendez</td></tr>
<tr><td>ils/elles</td><td>finissent</td><td>vendent</td></tr></table>
<p>Other regular -ir verbs: <i>choisir</i> (to choose), <i>remplir</i> (to fill). Other regular -re verbs: <i>attendre</i> (to wait), <i>répondre</i> (to answer), <i>perdre</i> (to lose).</p>
<div class="callout key"><b class="t">Spotting the pattern</b>-ir verbs insert <b>-iss-</b> before the plural endings (nous finiss<b>ons</b>); -re verbs simply drop the final -re and add endings, with <b>no ending at all</b> for il/elle (il vend, not "il vends").</div>`},

    { h: "Key irregular verbs: faire, pouvoir, vouloir, devoir", body: C`
<table class="t"><tr><th></th><th>faire (do/make)</th><th>pouvoir (can)</th><th>vouloir (want)</th><th>devoir (must)</th></tr>
<tr><td>je</td><td>fais</td><td>peux</td><td>veux</td><td>dois</td></tr>
<tr><td>tu</td><td>fais</td><td>peux</td><td>veux</td><td>dois</td></tr>
<tr><td>il/elle</td><td>fait</td><td>peut</td><td>veut</td><td>doit</td></tr>
<tr><td>nous</td><td>faisons</td><td>pouvons</td><td>voulons</td><td>devons</td></tr>
<tr><td>vous</td><td>faites</td><td>pouvez</td><td>voulez</td><td>devez</td></tr>
<tr><td>ils/elles</td><td>font</td><td>peuvent</td><td>veulent</td><td>doivent</td></tr></table>
<p>These are all followed directly by an <b>infinitive</b> when combined with another action: <i>je peux venir</i> (I can come), <i>je veux manger</i> (I want to eat), <i>je dois partir</i> (I must leave).</p>
<details class="check"><summary>Translate: "We must finish our homework but we want to watch TV."</summary><div>Nous devons finir nos devoirs mais nous voulons regarder la télé.</div></details>`},

    { h: "Negatives", body: C`
${T([
  ["ne... pas", "not"],
  ["ne... jamais", "never"],
  ["ne... plus", "no longer/no more"],
  ["ne... rien", "nothing"],
  ["ne... personne", "nobody"],
  ["ne... que", "only"]
])}
<p>The two parts wrap <b>around the verb</b>: <i>Je <b>ne</b> mange <b>pas</b> de viande.</i> In the near future and perfect tenses, they wrap around the <b>first (conjugated) verb only</b>: <i>Je <b>ne</b> vais <b>pas</b> manger.</i> / <i>Je <b>n'</b>ai <b>pas</b> mangé.</i></p>
<div class="callout warn"><b class="t">Elision</b>"ne" becomes "n'" before a vowel or silent h: <i>je n'aime pas, il n'a pas</i>.</div>`},

    { h: "The imperfect tense: descriptions in the past", body: C`
<p class="lead">The <b>imperfect</b> (l'imparfait) describes what things <b>used to be like</b>, ongoing/repeated past actions, or sets the scene — unlike the perfect tense, which describes a single completed event.</p>
<div class="callout key"><b class="t">Forming the imperfect</b>Take the <b>nous</b> form of the present tense, remove <b>-ons</b>, and add these endings: -ais, -ais, -ait, -ions, -iez, -aient.</div>
<table class="t"><tr><th></th><th>avoir (nous avons → av-)</th><th>être (irregular stem: ét-)</th></tr>
<tr><td>je/j'</td><td>avais</td><td>étais</td></tr><tr><td>tu</td><td>avais</td><td>étais</td></tr><tr><td>il/elle</td><td>avait</td><td>était</td></tr>
<tr><td>nous</td><td>avions</td><td>étions</td></tr><tr><td>vous</td><td>aviez</td><td>étiez</td></tr><tr><td>ils/elles</td><td>avaient</td><td>étaient</td></tr></table>
<div class="callout ex"><b class="t">Perfect vs imperfect</b><i>Quand j'étais petit, j'habitais à Paris et j'allais à l'école à pied tous les jours.</i> ("When I was little, I lived in Paris and I used to walk to school every day" — all background/repeated, so imperfect.) Compare: <i>Hier, je suis allé à l'école en bus.</i> ("Yesterday I went to school by bus" — one specific completed event, so perfect.)</div>
<details class="check"><summary>Conjugate "faire" in the imperfect for "il" (hint: nous faisons → fais-).</summary><div>il faisait.</div></details>`},

    { h: "Choosing the right tense", body: C`
<table class="t"><tr><th>Tense</th><th>Used for</th><th>Clue words</th></tr>
<tr><td>Present</td><td>What happens now / routines</td><td>maintenant, d'habitude, tous les jours</td></tr>
<tr><td>Near future (aller + infinitive)</td><td>What you're going to do soon</td><td>demain, bientôt, la semaine prochaine</td></tr>
<tr><td>Perfect (passé composé)</td><td>A single completed past action</td><td>hier, l'année dernière, un jour</td></tr>
<tr><td>Imperfect</td><td>Descriptions, background, repeated past actions</td><td>quand j'étais petit, tous les jours (in the past), autrefois</td></tr></table>
<div class="callout key"><b class="t">Exam strategy</b>Scan the English for time clues before translating: "every day" in a <i>past</i> paragraph usually signals the <b>imperfect</b>, not the present; "yesterday" or "last week" signals the <b>perfect</b>. Mixing these up is one of the most common ways marks are lost at this level.</div>`}
  ],
  worked: [
    { q: C`Translate: "I am hungry and I am thirsty, but I don't have any money."`,
      steps: [C`Hunger/thirst use avoir: <i>j'ai faim et j'ai soif</i>.`, C`"I don't have any" = <i>je n'ai pas d'argent</i> (de after a negative).`, C`Full: <i>J'ai faim et j'ai soif, mais je n'ai pas d'argent.</i>`]},
    { q: C`Translate using the imperfect: "When I was young, I used to play football every Saturday."`,
      steps: [C`"When I was young" = <i>Quand j'étais jeune</i> (imperfect of être).`, C`"I used to play" = repeated past action, imperfect: <i>je jouais</i>.`, C`Full: <i>Quand j'étais jeune, je jouais au foot tous les samedis.</i>`]},
    { q: C`Choose perfect or imperfect: "It was raining (___) when we arrived (___) at the hotel."`,
      steps: [C`"was raining" = background/ongoing action: imperfect, <i>il pleuvait</i>.`, C`"arrived" = single completed event: perfect, <i>nous sommes arrivés</i>.`, C`Full: <i>Il pleuvait quand nous sommes arrivés à l'hôtel.</i>`]}
  ],
  formulas: [["être / avoir", "irregular, used as auxiliaries"], ["-ir verbs", "+ -iss- in plural"], ["Negative", "ne + verb + pas"], ["Imperfect stem", "nous-form minus -ons"], ["Imperfect endings", "-ais,-ais,-ait,-ions,-iez,-aient"]],
  cards: [
    ["je suis / j'ai", "I am / I have"],
    ["avoir faim", "to be hungry"],
    ["avoir raison", "to be right"],
    ["nous finissons", "we finish"],
    ["il vend", "he sells"],
    ["je peux", "I can"],
    ["je veux", "I want"],
    ["je dois", "I must"],
    ["ne... jamais", "never"],
    ["ne... rien", "nothing"],
    ["ne... que", "only"],
    ["j'étais", "I was/used to be"],
    ["il faisait", "it was/used to be (weather)"],
    ["quand j'étais petit(e)", "when I was little"],
    ["tous les jours (past)", "clue for the imperfect"],
    ["hier", "clue for the perfect"]
  ],
  quiz: [
    { type: "mcq", marks: 1, q: C`"to be afraid" in French uses`, opts: ["être", "avoir", "faire", "aller"], ans: 1, why: C`Avoir peur.` },
    { type: "mcq", marks: 1, q: C`The "il/elle" form of "vendre" is`, opts: ["vends", "vend", "vendit", "vendent"], ans: 1, why: C`-re verbs: no ending for il/elle.` },
    { type: "mcq", marks: 1, q: C`"Je dois" means`, opts: ["I want", "I can", "I must", "I do"], ans: 2, why: C`Devoir = must.` },
    { type: "mcq", marks: 1, q: C`The imperfect stem comes from`, opts: ["the infinitive", "the je form of the present", "the nous form of the present", "the past participle"], ans: 2, why: C`Nous form minus -ons.` },
    { type: "mcq", marks: 1, q: C`"Quand j'étais petit" signals which tense for the next verb, typically?`, opts: ["present", "near future", "perfect", "imperfect"], ans: 3, why: C`Background description → imperfect.` },
    { type: "struct", marks: 2, q: C`Conjugate "finir" for "je" and "nous".`, ms: C`<b>B1</b> je finis<br><b>B1</b> nous finissons` },
    { type: "struct", marks: 3, q: C`Translate: "I can't come because I must finish my homework."`, ms: C`<b>B1</b> Je ne peux pas venir<br><b>B1</b> parce que je dois finir<br><b>B1</b> mes devoirs` },
    { type: "struct", marks: 3, q: C`Translate using the imperfect: "Every summer, we used to go to the beach and the weather was always nice."`, ms: C`<b>B1</b> Chaque été, nous allions à la plage<br><b>B1</b> et il faisait toujours beau<br><b>B1</b> correct imperfect endings throughout` },
    { type: "struct", marks: 2, q: C`Translate: "He has nothing and he knows nobody here."`, ms: C`<b>B1</b> Il n'a rien<br><b>B1</b> et il ne connaît personne ici` }
  ],
  exam: [
    { d: 1, type: "struct", marks: 1, q: C`Give the "nous" form of "être".`, ms: C`<b>B1</b> nous sommes` },
    { d: 1, type: "mcq", marks: 1, q: C`"je veux" means`, opts: ["I can", "I must", "I want", "I do"], ans: 2, why: C`Vouloir = to want.` },
    { d: 1, type: "struct", marks: 2, q: C`Translate: "I am right and you are wrong."`, ms: C`<b>B1</b> J'ai raison<br><b>B1</b> et tu as tort` },
    { d: 2, type: "struct", marks: 3, q: C`Translate: "We never eat meat and we only drink water."`, ms: C`<b>B1</b> Nous ne mangeons jamais de viande<br><b>B1</b> et nous ne buvons que de l'eau<br><b>B1</b> correct negative constructions` },
    { d: 2, type: "struct", marks: 3, q: C`Put the verb in brackets into the imperfect: "Quand j'(être) petit, je (jouer) dans le jardin tous les jours."`, ms: C`<b>B1</b> j'étais<br><b>B1</b> je jouais<br><b>B1</b> correct endings matching the subject` },
    { d: 2, type: "mcq", marks: 1, q: C`Which sentence correctly uses the near future with a negative?`, opts: ["Je ne vais pas manger.", "Je vais ne pas manger.", "Je ne vais manger pas.", "Je vais pas ne manger."], ans: 0, why: C`Ne...pas wraps around the conjugated "vais".` },
    { d: 3, type: "struct", marks: 5, q: C`Translate the following paragraph, choosing the correct tense for each verb: "Last year I went to France. Every day the weather was nice and I used to swim in the sea. One day it rained, so we visited a museum instead."`, ms: C`<b>B1</b> L'année dernière je suis allé(e) en France (perfect, single event)<br><b>B1</b> Chaque jour il faisait beau (imperfect, repeated)<br><b>B1</b> et je nageais dans la mer (imperfect, repeated)<br><b>B1</b> Un jour il a plu (perfect, single event)<br><b>B1</b> donc nous avons visité un musée (perfect, single event)` },
    { d: 3, type: "struct", marks: 3, q: C`Translate: "She used to be shy, but now she is very talkative."`, ms: C`<b>B1</b> Elle était timide avant<br><b>B1</b> mais maintenant elle est très bavarde<br><b>B1</b> correct contrast between imperfect and present` }
  ]
});
}
