window.TOPICS = window.TOPICS || [];
{
const C = String.raw;
const T = (rows) => `<table class="t"><tr><th>French</th><th>English</th></tr>${rows.map(([f, e]) => `<tr><td>${f}</td><td>${e}</td></tr>`).join("")}</table>`;

/* ============================================================
   TRAVEL, HOLIDAYS & WEATHER
   ============================================================ */
TOPICS.push({
  id: "travel", subject: "french", unit: 5, title: "Travel, holidays & weather",
  blurb: "Countries and nationalities, transport, the verb aller and immediate future (aller + infinitive), talking about holidays in the past and future, and describing the weather.",
  level: "Beginner → Intermediate",
  syllabus: [
    ["5.1", "Name countries and say where you are going using à/en", 0],
    ["5.2", "Talk about transport and how you travel", 1],
    ["5.3", "Use aller + infinitive to talk about plans (near future)", 2],
    ["5.4", "Describe past holidays using the perfect tense with être and avoir", 3],
    ["5.5", "Describe the weather in different tenses", 4]
  ],
  sections: [
    { h: "Countries, nationalities and 'to' a country", body: C`
${T([
  ["la France / français(e)", "France / French"],
  ["l'Angleterre / anglais(e)", "England / English"],
  ["l'Espagne / espagnol(e)", "Spain / Spanish"],
  ["l'Allemagne / allemand(e)", "Germany / German"],
  ["l'Italie / italien(ne)", "Italy / Italian"],
  ["les États-Unis / américain(e)", "the United States / American"],
  ["le Canada / canadien(ne)", "Canada / Canadian"],
  ["le Portugal / portugais(e)", "Portugal / Portuguese"],
  ["la Belgique / belge", "Belgium / Belgian"],
  ["la Suisse / suisse", "Switzerland / Swiss"]
])}
<div class="callout key"><b class="t">"To/in" a country</b>Feminine countries (most end in -e): use <b>en</b> — <i>en France, en Espagne</i>. Masculine countries: use <b>au</b> — <i>au Canada, au Portugal</i>. Plural countries: use <b>aux</b> — <i>aux États-Unis</i>. Towns always use <b>à</b> — <i>à Paris, à Londres</i>.</div>
<details class="check"><summary>How do you say "I am going to Spain" and "I am going to Canada"?</summary><div>Je vais en Espagne (feminine); Je vais au Canada (masculine).</div></details>`},

    { h: "The verb ALLER and transport", body: C`
<p class="lead"><b>Aller</b> (to go) is irregular and essential — it's also used to build the near future tense.</p>
<table class="t"><tr><th>aller (to go)</th></tr><tr><td>je vais</td></tr><tr><td>tu vas</td></tr><tr><td>il/elle/on va</td></tr><tr><td>nous allons</td></tr><tr><td>vous allez</td></tr><tr><td>ils/elles vont</td></tr></table>
${T([
  ["en voiture / en bus / en train", "by car / by bus / by train"],
  ["en avion / en bateau", "by plane / by boat"],
  ["à vélo / à pied", "by bike / on foot"],
  ["le billet (aller-retour / aller simple)", "ticket (return / single)"],
  ["l'aéroport / la gare / le port", "airport / station / port"],
  ["Comment vas-tu à l'école ?", "How do you get to school?"],
  ["Je vais à l'école en bus.", "I go to school by bus."]
])}
<div class="callout warn"><b class="t">en or à?</b>Use <b>en</b> for transport you travel <i>inside</i> (en voiture, en train, en bus, en avion). Use <b>à</b> for transport you travel <i>on top of</i ("exposed"): à vélo, à pied, à cheval.</div>`},

    { h: "Near future: aller + infinitive", body: C`
<p class="lead">To say what you <b>are going to do</b>, use <i>aller</i> (conjugated) + the <b>infinitive</b> of the main verb.</p>
<p class="eq">subject + aller (present) + infinitive</p>
<ul><li><i>Je vais visiter Paris.</i> — I am going to visit Paris.</li>
<li><i>Nous allons manger au restaurant.</i> — We are going to eat at the restaurant.</li>
<li><i>Elle va prendre l'avion.</i> — She is going to take the plane.</li>
<li><i>Ils ne vont pas rester ici.</i> — They are not going to stay here. (ne...pas goes around "vais/vas/va...")</li></ul>
<div class="callout ex"><b class="t">Holiday plans</b><i>Cet été, je vais aller en France avec ma famille. On va visiter Paris et on va rester dans un hôtel.</i></div>
<details class="check"><summary>Write "He is going to play football tomorrow" in French.</summary><div>Il va jouer au foot demain.</div></details>`},

    { h: "Talking about past holidays: the perfect tense", body: C`
<p class="lead">The <b>perfect tense</b> (passé composé) describes a completed action in the past: "I visited", "I went", "I ate". It has two parts: an <b>auxiliary verb</b> (avoir or être, in the present tense) + a <b>past participle</b>.</p>
<table class="t"><tr><th>Most verbs: AVOIR + past participle</th><th>Example</th></tr>
<tr><td>-er verbs → -é</td><td>j'ai visité (I visited), il a mangé (he ate)</td></tr>
<tr><td>-ir verbs → -i</td><td>j'ai fini (I finished)</td></tr>
<tr><td>-re verbs → -u</td><td>j'ai vendu (I sold)</td></tr></table>
<div class="callout key"><b class="t">The "house of être" verbs</b>14 verbs of movement/state (and their compounds) use <b>être</b> instead of avoir: <i>aller, venir, arriver, partir, entrer, sortir, monter, descendre, naître, mourir, rester, retourner, tomber, passer</i>. With être, the past participle <b>agrees</b> with the subject like an adjective: <i>elle est allée</i>, <i>ils sont partis</i>, <i>elles sont arrivées</i>.</div>
${T([
  ["je suis allé(e)", "I went"],
  ["j'ai visité", "I visited"],
  ["j'ai mangé", "I ate"],
  ["j'ai vu (voir)", "I saw"],
  ["j'ai fait (faire)", "I did/made"],
  ["j'ai pris (prendre)", "I took"],
  ["nous sommes arrivé(e)s", "we arrived"],
  ["elle est restée", "she stayed"],
  ["L'année dernière...", "Last year..."],
  ["Pendant les vacances...", "During the holidays..."]
])}
<div class="callout ex"><b class="t">A holiday account</b><i>L'été dernier, je suis allé(e) en Espagne avec ma famille. Nous sommes restés dans un camping. J'ai nagé dans la mer et j'ai mangé de la paella. C'était génial !</i></div>
<details class="check"><summary>Why does "elle est allée" have an extra "e" at the end compared with "il est allé"?</summary><div>Allée (être verb): the past participle agrees with the feminine subject "elle", adding -e like an adjective.</div></details>`},

    { h: "Describing the weather", body: C`
${T([
  ["Quel temps fait-il ?", "What's the weather like?"],
  ["Il fait beau.", "The weather is nice."],
  ["Il fait mauvais.", "The weather is bad."],
  ["Il fait chaud / froid.", "It's hot / cold."],
  ["Il fait du soleil.", "It's sunny."],
  ["Il fait du vent.", "It's windy."],
  ["Il pleut.", "It's raining."],
  ["Il neige.", "It's snowing."],
  ["Il y a des nuages.", "It's cloudy."],
  ["Il y a de l'orage.", "There's a storm."],
  ["Hier, il a plu.", "Yesterday, it rained. (past)"],
  ["Demain, il va faire beau.", "Tomorrow, it's going to be nice. (future)"]
])}
<div class="callout key"><b class="t">Weather uses "il"</b>Almost all weather expressions use the impersonal <i>il</i> ("it") — <i>il fait, il pleut, il neige, il y a</i> — just like English "it is raining". These phrases don't change for different subjects.</div>`}
  ],
  worked: [
    { q: C`Translate: "This summer, I am going to go to Italy with my friends. We are going to visit Rome."`,
      steps: [C`"This summer" = Cet été.`, C`"I am going to go" uses aller + infinitive: <i>je vais aller</i>.`, C`"to Italy" (feminine) = en Italie.`, C`Full: <i>Cet été, je vais aller en Italie avec mes amis. Nous allons visiter Rome.</i>`]},
    { q: C`Translate into the perfect tense: "Last year, she went to Canada and she stayed with her cousin."`,
      steps: [C`"went" uses être: <i>elle est allée</i> (agrees, feminine).`, C`"to Canada" (masculine) = au Canada.`, C`"she stayed" also uses être: <i>elle est restée</i>.`, C`Full: <i>L'année dernière, elle est allée au Canada et elle est restée chez son cousin.</i>`]},
    { q: C`Describe today's weather and tomorrow's forecast in French.`,
      steps: [C`Today (present): <i>Aujourd'hui, il fait beau et il y a du soleil.</i>`, C`Tomorrow (near future): <i>Demain, il va pleuvoir.</i>`]}
  ],
  formulas: [["to a country (f)", "en + country"], ["to a country (m)", "au + country"], ["near future", "aller + infinitive"], ["perfect tense", "avoir/être + past participle"], ["être verbs agree", "add -e/-s/-es to the participle"]],
  cards: [
    ["en France", "to/in France"],
    ["au Canada", "to/in Canada"],
    ["aux États-Unis", "to/in the USA"],
    ["je vais", "I go / I am going"],
    ["en train", "by train"],
    ["à pied", "on foot"],
    ["je vais visiter", "I am going to visit"],
    ["j'ai mangé", "I ate"],
    ["je suis allé(e)", "I went"],
    ["elle est restée", "she stayed"],
    ["l'année dernière", "last year"],
    ["pendant les vacances", "during the holidays"],
    ["Quel temps fait-il ?", "What's the weather like?"],
    ["il fait beau", "it's nice weather"],
    ["il pleut", "it's raining"],
    ["il neige", "it's snowing"],
    ["il fait chaud", "it's hot"],
    ["il y a des nuages", "it's cloudy"]
  ],
  quiz: [
    { type: "mcq", marks: 1, q: C`"I am going to Spain" is`, opts: ["Je vais au Espagne", "Je vais en Espagne", "Je vais à Espagne", "Je vais la Espagne"], ans: 1, why: C`Feminine country → en.` },
    { type: "mcq", marks: 1, q: C`"by bike" is`, opts: ["en vélo", "au vélo", "à vélo", "de vélo"], ans: 2, why: C`Exposed transport → à.` },
    { type: "mcq", marks: 1, q: C`"Je vais manger" means`, opts: ["I ate", "I eat", "I am going to eat", "I was eating"], ans: 2, why: C`Aller + infinitive.` },
    { type: "mcq", marks: 1, q: C`Which verb uses être in the perfect tense?`, opts: ["manger", "regarder", "aller", "jouer"], ans: 2, why: C`Aller is a "house of être" verb.` },
    { type: "mcq", marks: 1, q: C`"Il pleut" means`, opts: ["It's sunny", "It's raining", "It's windy", "It's snowing"], ans: 1, why: C`Pleuvoir = to rain.` },
    { type: "struct", marks: 2, q: C`Translate: "We are going to visit the museum tomorrow."`, ms: C`<b>B1</b> Nous allons visiter le musée<br><b>B1</b> demain` },
    { type: "struct", marks: 3, q: C`Translate: "Last year I went to Germany and I ate a lot of cake."`, ms: C`<b>B1</b> L'année dernière je suis allé(e) en Allemagne<br><b>B1</b> et j'ai mangé beaucoup de gâteau<br><b>B1</b> correct auxiliary for each verb (être/avoir)` },
    { type: "struct", marks: 2, q: C`Correct the agreement: "Elles sont allé au parc."`, ms: C`<b>B2</b> Elles sont allées au parc (agrees with feminine plural subject)` },
    { type: "struct", marks: 2, q: C`Describe the weather: "It is cold and it's snowing."`, ms: C`<b>B1</b> Il fait froid<br><b>B1</b> et il neige` }
  ],
  exam: [
    { d: 1, type: "struct", marks: 1, q: C`Translate: "I am going to the cinema."`, ms: C`<b>B1</b> Je vais au cinéma.` },
    { d: 1, type: "mcq", marks: 1, q: C`"il fait chaud" means`, opts: ["it's cold", "it's hot", "it's windy", "it's raining"], ans: 1, why: C`Chaud = hot.` },
    { d: 1, type: "struct", marks: 2, q: C`Translate: "by train" and "by plane".`, ms: C`<b>B1</b> en train<br><b>B1</b> en avion` },
    { d: 2, type: "struct", marks: 3, q: C`Translate: "Next year, we are going to go to the United States and we are going to visit New York."`, ms: C`<b>B1</b> L'année prochaine, nous allons aller aux États-Unis<br><b>B1</b> et nous allons visiter New York<br><b>B1</b> correct aller + infinitive structure throughout` },
    { d: 2, type: "struct", marks: 3, q: C`Translate using the perfect tense: "He visited Paris and he saw the Eiffel Tower."`, ms: C`<b>B1</b> Il a visité Paris<br><b>B1</b> et il a vu la tour Eiffel<br><b>B1</b> correct avoir auxiliary (visiter and voir both use avoir)` },
    { d: 2, type: "mcq", marks: 1, q: C`Which is correct for "they (f) arrived"?`, opts: ["ils ont arrivé", "elles sont arrivées", "elles ont arrivé", "ils sont arrivé"], ans: 1, why: C`Arriver uses être; feminine plural agreement.` },
    { d: 3, type: "struct", marks: 5, q: C`Write a paragraph (4–5 sentences) about a past holiday: where you went, how you travelled, one thing you did, and what the weather was like, using the perfect tense correctly.`, ms: C`<b>B1</b> correct être verb for "went" with agreement<br><b>B1</b> correct transport phrase<br><b>B1</b> correct avoir verb for an activity (e.g. j'ai mangé/visité)<br><b>B1</b> weather description (present or past)<br><b>B1</b> overall grammatical accuracy and logical sequencing` },
    { d: 3, type: "struct", marks: 3, q: C`Translate: "Tomorrow it is going to rain, so we are going to stay at the hotel."`, ms: C`<b>B1</b> Demain il va pleuvoir<br><b>B1</b> donc nous allons rester à l'hôtel<br><b>B1</b> correct use of aller + infinitive for both clauses` }
  ]
});
}
