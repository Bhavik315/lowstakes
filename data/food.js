window.TOPICS = window.TOPICS || [];
{
const C = String.raw;
const T = (rows) => `<table class="t"><tr><th>French</th><th>English</th></tr>${rows.map(([f, e]) => `<tr><td>${f}</td><td>${e}</td></tr>`).join("")}</table>`;

/* ============================================================
   FOOD, SHOPPING & TOWN
   ============================================================ */
TOPICS.push({
  id: "food", subject: "french", unit: 4, title: "Food, shopping & town",
  blurb: "Food and drink vocabulary, meals, ordering in a café or restaurant, the partitive article, shops and shopping phrases, and asking for and giving directions in town.",
  level: "Beginner → Intermediate",
  syllabus: [
    ["4.1", "Name common food and drink items and the three main meals", 0],
    ["4.2", "Use the partitive article (du, de la, de l', des) correctly", 1],
    ["4.3", "Order food and drink in a café or restaurant", 2],
    ["4.4", "Name shops and use shopping phrases, including quantities", 3],
    ["4.5", "Ask for and understand directions around a town", 4]
  ],
  sections: [
    { h: "Food, drink and meals", body: C`
${T([
  ["le petit déjeuner / le déjeuner / le dîner", "breakfast / lunch / dinner"],
  ["le pain", "bread"],
  ["le fromage", "cheese"],
  ["la viande / le poulet / le bœuf", "meat / chicken / beef"],
  ["le poisson", "fish"],
  ["les légumes", "vegetables"],
  ["les fruits", "fruit"],
  ["la pomme / la banane / la fraise", "apple / banana / strawberry"],
  ["les pâtes / le riz", "pasta / rice"],
  ["le gâteau", "cake"],
  ["l'eau (minérale)", "(mineral) water"],
  ["le jus d'orange", "orange juice"],
  ["le café / le thé", "coffee / tea"],
  ["le lait", "milk"],
  ["avoir faim / avoir soif", "to be hungry / to be thirsty"]
])}`},

    { h: "The partitive article: some / any", body: C`
<p class="lead">To say "some" food or drink, French uses a <b>partitive article</b> that agrees with the noun's gender and number.</p>
<table class="t"><tr><th>Before...</th><th>Use</th><th>Example</th></tr>
<tr><td>masculine noun</td><td>du</td><td>du pain (some bread)</td></tr>
<tr><td>feminine noun</td><td>de la</td><td>de la viande (some meat)</td></tr>
<tr><td>vowel/silent h</td><td>de l'</td><td>de l'eau (some water)</td></tr>
<tr><td>plural noun</td><td>des</td><td>des légumes (some vegetables)</td></tr></table>
<div class="callout warn"><b class="t">After a negative</b>After <i>ne... pas</i>, all partitive articles become simply <b>de</b> (or <b>d'</b> before a vowel): <i>Je mange du pain</i> → <i>Je ne mange pas de pain</i>. This is one of the most heavily tested grammar points.</div>
<details class="check"><summary>Write "I don't drink coffee" in French.</summary><div>Je ne bois pas de café.</div></details>`},

    { h: "Ordering in a café or restaurant", body: C`
${T([
  ["Je voudrais...", "I would like..."],
  ["Je vais prendre...", "I'm going to have..."],
  ["L'addition, s'il vous plaît.", "The bill, please."],
  ["Qu'est-ce que vous voulez ?", "What would you like?"],
  ["Vous désirez ?", "What would you like? (said by staff)"],
  ["C'est combien ?", "How much is it?"],
  ["Ça coûte... euros.", "It costs... euros."],
  ["C'est tout, merci.", "That's all, thank you."],
  ["Avez-vous une table pour deux ?", "Do you have a table for two?"],
  ["Le menu, s'il vous plaît.", "The menu, please."]
])}
<div class="callout ex"><b class="t">Example dialogue</b><i>— Vous désirez ? — Je voudrais un croque-monsieur et un jus d'orange, s'il vous plaît. — Voilà. — Merci, l'addition s'il vous plaît.</i></div>`},

    { h: "Shops and shopping", body: C`
${T([
  ["le marché", "market"],
  ["le supermarché", "supermarket"],
  ["la boulangerie", "bakery"],
  ["la boucherie", "butcher's"],
  ["la pharmacie", "pharmacy"],
  ["le magasin de vêtements", "clothes shop"],
  ["aller faire les courses", "to go grocery shopping"],
  ["un kilo de...", "a kilo of..."],
  ["une bouteille de...", "a bottle of..."],
  ["un paquet de...", "a packet of..."],
  ["une boîte de...", "a tin/box of..."],
  ["Je cherche...", "I'm looking for..."],
  ["Avez-vous... ?", "Do you have...?"],
  ["C'est trop cher.", "That's too expensive."],
  ["bon marché", "cheap"]
])}
<div class="callout key"><b class="t">Expressions of quantity</b>After a quantity word (un kilo <b>de</b>, une bouteille <b>de</b>, trop <b>de</b>, beaucoup <b>de</b>), always use just <b>de/d'</b> — never du/de la/des. <i>beaucoup de pommes</i>, not "beaucoup des pommes".</div>`},

    { h: "Directions and the town", body: C`
${T([
  ["la ville", "town"],
  ["la banque / la poste", "bank / post office"],
  ["la gare", "station"],
  ["l'office de tourisme", "tourist office"],
  ["Où est... ? / Où se trouve... ?", "Where is...?"],
  ["Pour aller à... ?", "How do I get to...?"],
  ["Tournez à gauche / à droite.", "Turn left / right."],
  ["Allez tout droit.", "Go straight ahead."],
  ["Continuez jusqu'à...", "Continue until..."],
  ["au bout de la rue", "at the end of the street"],
  ["au feu / au rond-point", "at the traffic light / roundabout"],
  ["C'est près d'ici / loin d'ici.", "It's near here / far from here."],
  ["en face de", "opposite"],
  ["à côté de", "next to"],
  ["entre", "between"]
])}
<div class="callout warn"><b class="t">à + le / à + la</b><i>à + le</i> contracts to <b>au</b>; <i>à + les</i> contracts to <b>aux</b>; but <i>à + la</i> and <i>à + l'</i> stay the same. "I'm going to the bank" = <i>je vais à la banque</i>; "to the museum" (le musée) = <i>au musée</i>.</div>
<details class="check"><summary>Translate: "Turn right, then go straight on, and the bank is opposite the station."</summary><div>Tournez à droite, puis allez tout droit, et la banque est en face de la gare.</div></details>`}
  ],
  worked: [
    { q: C`Translate: "I would like some bread, some cheese and some water, please."`,
      steps: [C`"some bread" (masc.) = du pain.`, C`"some cheese" (masc.) = du fromage.`, C`"some water" (vowel start) = de l'eau.`, C`Full sentence: <i>Je voudrais du pain, du fromage et de l'eau, s'il vous plaît.</i>`]},
    { q: C`Make this sentence negative: "Je mange des légumes."`,
      steps: [C`After a negative, des/du/de la all become just "de".`, C`<i>Je ne mange pas de légumes.</i>`]},
    { q: C`Give directions: "Go straight on, turn left at the traffic lights, and the bakery is next to the bank."`,
      steps: [C`"Go straight on" = Allez tout droit.`, C`"turn left at the traffic lights" = tournez à gauche au feu.`, C`"next to" = à côté de.`, C`Full: <i>Allez tout droit, tournez à gauche au feu, et la boulangerie est à côté de la banque.</i>`]}
  ],
  formulas: [["du / de la / de l' / des", "some (masc./fem./vowel/plural)"], ["After a negative", "always just de/d'"], ["Quantity + de", "un kilo de, beaucoup de..."], ["à + le → au", "à + les → aux"]],
  cards: [
    ["le pain", "bread"],
    ["le fromage", "cheese"],
    ["les légumes", "vegetables"],
    ["l'eau", "water"],
    ["avoir faim", "to be hungry"],
    ["Je voudrais...", "I would like..."],
    ["L'addition, s'il vous plaît.", "The bill, please."],
    ["du / de la / des", "some"],
    ["ne... pas de", "not any"],
    ["la boulangerie", "bakery"],
    ["faire les courses", "to go shopping"],
    ["C'est trop cher.", "That's too expensive."],
    ["Où est...?", "Where is...?"],
    ["Tournez à gauche/droite.", "Turn left/right."],
    ["tout droit", "straight ahead"],
    ["en face de", "opposite"],
    ["à côté de", "next to"],
    ["au musée", "to/at the museum"]
  ],
  quiz: [
    { type: "mcq", marks: 1, q: C`"some water" in French is`, opts: ["du eau", "de la eau", "de l'eau", "des eau"], ans: 2, why: C`Vowel start → de l'.` },
    { type: "mcq", marks: 1, q: C`"Je ne mange pas ___ viande." needs`, opts: ["de la", "de", "du", "des"], ans: 1, why: C`Negative → just de.` },
    { type: "mcq", marks: 1, q: C`"à + le musée" becomes`, opts: ["à le musée", "au musée", "à la musée", "aux musée"], ans: 1, why: C`à + le = au.` },
    { type: "mcq", marks: 1, q: C`"en face de" means`, opts: ["next to", "between", "opposite", "far from"], ans: 2, why: C`Opposite.` },
    { type: "struct", marks: 2, q: C`Translate: "I would like a coffee and a cake."`, ms: C`<b>B1</b> Je voudrais un café<br><b>B1</b> et un gâteau` },
    { type: "struct", marks: 3, q: C`Translate: "I eat vegetables every day but I never eat fish."`, ms: C`<b>B1</b> Je mange des légumes tous les jours<br><b>B1</b> mais je ne mange jamais de poisson<br><b>B1</b> correct negative partitive (de, not du)` },
    { type: "struct", marks: 3, q: C`Translate: "Excuse me, where is the station? Go straight on and turn left."`, ms: C`<b>B1</b> Excusez-moi, où est la gare ?<br><b>B1</b> Allez tout droit<br><b>B1</b> et tournez à gauche` },
    { type: "struct", marks: 2, q: C`Translate: "a kilo of apples and a bottle of water"`, ms: C`<b>B1</b> un kilo de pommes<br><b>B1</b> une bouteille d'eau` }
  ],
  exam: [
    { d: 1, type: "struct", marks: 1, q: C`Translate: "I'm hungry."`, ms: C`<b>B1</b> J'ai faim.` },
    { d: 1, type: "mcq", marks: 1, q: C`"la boulangerie" is a shop that sells`, opts: ["meat", "medicine", "bread", "clothes"], ans: 2, why: C`Bakery.` },
    { d: 1, type: "struct", marks: 2, q: C`Translate: "the bill, please" and "how much is it?"`, ms: C`<b>B1</b> l'addition, s'il vous plaît<br><b>B1</b> c'est combien ?` },
    { d: 2, type: "struct", marks: 3, q: C`Translate: "I would like some bread and some cheese, but I don't want any fish."`, ms: C`<b>B1</b> Je voudrais du pain et du fromage<br><b>B1</b> mais je ne veux pas de poisson<br><b>B1</b> correct negative article (de, not du)` },
    { d: 2, type: "struct", marks: 3, q: C`Give directions in French: "Continue to the end of the street, then the bank is between the post office and the pharmacy."`, ms: C`<b>B1</b> Continuez jusqu'au bout de la rue<br><b>B1</b> puis la banque est entre la poste et la pharmacie<br><b>B1</b> correct prepositions` },
    { d: 2, type: "mcq", marks: 1, q: C`Which sentence correctly uses a quantity expression?`, opts: ["beaucoup des pommes", "beaucoup de pommes", "beaucoup de la pommes", "beaucoup du pommes"], ans: 1, why: C`Quantity + de always.` },
    { d: 3, type: "struct", marks: 5, q: C`Write a short dialogue (4–5 lines) ordering a meal in a French café, including at least two food/drink items with the correct partitive article and asking for the bill.`, ms: C`<b>B1</b> correct greeting/opening from staff or customer<br><b>B1</b> "je voudrais" + item 1 with correct article<br><b>B1</b> item 2 with correct article<br><b>B1</b> polite closing phrase (merci, s'il vous plaît)<br><b>B1</b> asks for the bill correctly` },
    { d: 3, type: "struct", marks: 3, q: C`Translate: "The supermarket is far from here, but there is a small bakery next to the post office."`, ms: C`<b>B1</b> Le supermarché est loin d'ici<br><b>B1</b> mais il y a une petite boulangerie<br><b>B1</b> à côté de la poste` }
  ]
});
}
