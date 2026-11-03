window.TOPICS = window.TOPICS || [];
{
const C = String.raw;
const T = (rows) => `<table class="t"><tr><th>French</th><th>English</th></tr>${rows.map(([f, e]) => `<tr><td>${f}</td><td>${e}</td></tr>`).join("")}</table>`;

/* ============================================================
   FAMILY, HOME & DESCRIPTIONS
   ============================================================ */
TOPICS.push({
  id: "family", subject: "french", unit: 2, title: "Family, home & descriptions",
  blurb: "Family members, possessive adjectives, describing people's appearance and character, your house and rooms, and adjective agreement and position.",
  level: "Beginner",
  syllabus: [
    ["2.1", "Name family members and talk about family relationships", 0],
    ["2.2", "Use possessive adjectives (mon/ma/mes, ton/ta/tes, etc.)", 1],
    ["2.3", "Describe people's appearance and personality", 2],
    ["2.4", "Describe your house, rooms and where you live", 3],
    ["2.5", "Apply the rules of adjective agreement and position", 4]
  ],
  sections: [
    { h: "Family members", body: C`
${T([
  ["la famille", "the family"],
  ["le père / la mère", "father / mother"],
  ["les parents", "parents"],
  ["le frère / la sœur", "brother / sister"],
  ["le fils / la fille", "son / daughter"],
  ["le grand-père / la grand-mère", "grandfather / grandmother"],
  ["les grands-parents", "grandparents"],
  ["l'oncle / la tante", "uncle / aunt"],
  ["le cousin / la cousine", "cousin (male / female)"],
  ["le mari / la femme", "husband / wife"],
  ["le beau-père / la belle-mère", "stepfather or father-in-law / stepmother or mother-in-law"],
  ["le demi-frère / la demi-sœur", "half-brother / half-sister"],
  ["un animal domestique", "a pet"],
  ["le chien / le chat", "dog / cat"]
])}
<div class="callout ex"><b class="t">Example</b><i>Dans ma famille, il y a cinq personnes : mon père, ma mère, mon frère, ma sœur et moi.</i> ("In my family there are five people: my father, my mother, my brother, my sister and me.")</div>`},

    { h: "Possessive adjectives", body: C`
<p class="lead">"My", "your", "his/her" change their French form to match the <b>gender and number of the thing owned</b>, not the owner.</p>
<table class="t"><tr><th></th><th>masculine</th><th>feminine</th><th>plural</th></tr>
<tr><td>my</td><td>mon</td><td>ma</td><td>mes</td></tr>
<tr><td>your (tu)</td><td>ton</td><td>ta</td><td>tes</td></tr>
<tr><td>his/her/its</td><td>son</td><td>sa</td><td>ses</td></tr>
<tr><td>our</td><td colspan="2">notre</td><td>nos</td></tr>
<tr><td>your (vous)</td><td colspan="2">votre</td><td>vos</td></tr>
<tr><td>their</td><td colspan="2">leur</td><td>leurs</td></tr></table>
<div class="callout warn"><b class="t">The exception rule</b>Before a <b>feminine</b> word starting with a <b>vowel or silent h</b>, use <i>mon/ton/son</i> instead of <i>ma/ta/sa</i> — purely for pronunciation. <i>mon amie</i> (not "ma amie"), <i>son école</i>.</div>
<div class="callout warn"><b class="t">"His" or "her"?</b><i>son père</i> can mean "his father" <b>or</b> "her father" — French possessives agree with the <b>object owned</b>, not the owner's gender. Context tells you which.</div>
<details class="check"><summary>How do you say "her sisters"?</summary><div>ses sœurs (sœurs is plural, so "ses" regardless of whether the owner is male or female).</div></details>`},

    { h: "Describing people: appearance", body: C`
${T([
  ["Il/Elle est grand(e).", "He/She is tall."],
  ["Il/Elle est petit(e).", "He/She is short."],
  ["Il/Elle est mince.", "He/She is slim."],
  ["Il/Elle a les cheveux... ", "He/She has ... hair"],
  ["...blonds / bruns / noirs / roux", "...blond / brown / black / red"],
  ["...longs / courts / frisés", "...long / short / curly"],
  ["Il/Elle a les yeux bleus/verts/marron.", "He/She has blue/green/brown eyes."],
  ["Il porte des lunettes.", "He wears glasses."],
  ["Il/Elle a ... ans.", "He/She is ... years old."]
])}
<div class="callout warn"><b class="t">Marron is invariable</b><i>les yeux marron</i> never changes its ending — unlike most colours, "marron" (chestnut brown) doesn't agree with gender or number.</div>`},

    { h: "Describing personality", body: C`
${T([
  ["sympa / sympathique", "nice, friendly"],
  ["gentil / gentille", "kind"],
  ["drôle / amusant(e)", "funny"],
  ["intelligent(e)", "intelligent"],
  ["timide", "shy"],
  ["bavard(e)", "talkative"],
  ["paresseux / paresseuse", "lazy"],
  ["travailleur / travailleuse", "hardworking"],
  ["égoïste", "selfish"],
  ["généreux / généreuse", "generous"],
  ["Il/Elle s'entend bien avec...", "He/She gets on well with..."],
  ["Je m'entends bien avec mon frère.", "I get on well with my brother."]
])}`},

    { h: "Adjective agreement and position", body: C`
<p class="lead">Most French adjectives add <b>-e</b> for feminine and <b>-s</b> for plural, and usually come <b>after</b> the noun.</p>
<table class="t"><tr><th>Masc. sing.</th><th>Fem. sing.</th><th>Masc. pl.</th><th>Fem. pl.</th></tr>
<tr><td>grand</td><td>grande</td><td>grands</td><td>grandes</td></tr>
<tr><td>petit</td><td>petite</td><td>petits</td><td>petites</td></tr>
<tr><td>intelligent</td><td>intelligente</td><td>intelligents</td><td>intelligentes</td></tr>
<tr><td>heureux</td><td>heureuse</td><td>heureux</td><td>heureuses</td></tr>
<tr><td>sportif</td><td>sportive</td><td>sportifs</td><td>sportives</td></tr>
<tr><td>beau</td><td>belle</td><td>beaux</td><td>belles</td></tr></table>
<div class="callout key"><b class="t">BAGS — adjectives that go BEFORE the noun</b><b>B</b>eauty (beau, joli), <b>A</b>ge (jeune, vieux, nouveau), <b>G</b>oodness (bon, mauvais), <b>S</b>ize (grand, petit, gros). Example: <i>une jolie maison</i>, <i>un grand jardin</i> — most other adjectives (colours, nationalities) come after: <i>une maison blanche</i>.</div>
<details class="check"><summary>Make "intéressant" agree with "des histoires" (feminine plural).</summary><div>des histoires intéressantes.</div></details>`},

    { h: "Home and rooms", body: C`
${T([
  ["la maison / l'appartement", "house / flat"],
  ["le jardin", "the garden"],
  ["la cuisine", "kitchen"],
  ["le salon / la salle de séjour", "living room"],
  ["la salle à manger", "dining room"],
  ["la chambre", "bedroom"],
  ["la salle de bains", "bathroom"],
  ["les toilettes / les WC", "toilet"],
  ["le garage", "garage"],
  ["l'escalier", "the stairs"],
  ["au rez-de-chaussée", "on the ground floor"],
  ["au premier étage", "on the first floor"],
  ["Il y a... / Il n'y a pas de...", "There is/are... / There isn't/aren't any..."],
  ["grand(e) / petit(e) / confortable", "big / small / comfortable"]
])}
<div class="callout ex"><b class="t">Example</b><i>J'habite dans une grande maison avec un jardin. Au rez-de-chaussée, il y a la cuisine et le salon.</i></div>`}
  ],
  worked: [
    { q: C`Translate: "I have a younger brother and an older sister. My brother is funny but my sister is shy."`,
      steps: [C`"younger brother" = <i>un frère cadet / plus jeune</i>; "older sister" = <i>une sœur aînée / plus âgée</i>.`, C`<i>J'ai un frère plus jeune et une sœur plus âgée.</i>`, C`Personality with "but" (mais): <i>Mon frère est drôle mais ma sœur est timide.</i>`]},
    { q: C`Fill the gap with the correct possessive adjective: "___ (her) parents and ___ (his) school" (both using the correct French form).`,
      steps: [C`"her parents": parents is plural, so use <i>ses parents</i> regardless of the owner's gender.`, C`"his school": école is feminine singular starting with a vowel, so use <i>son école</i> (not "sa école").`]},
    { q: C`Put the adjective "blanc" in the correct form to agree with "une maison" and with "des chats".`,
      steps: [C`une maison blanche (feminine singular: -c → -che).`, C`des chats blancs (masculine plural: add -s).`]}
  ],
  formulas: [["my (m/f/pl)", "mon / ma / mes"], ["his/her (m/f/pl)", "son / sa / ses"], ["Before a vowel", "mon/ton/son even if feminine"], ["BAGS adjectives", "go before the noun"], ["Regular agreement", "+e feminine, +s plural"]],
  cards: [
    ["le frère", "brother"],
    ["la sœur", "sister"],
    ["les grands-parents", "grandparents"],
    ["mon / ma / mes", "my (m/f/pl)"],
    ["son / sa / ses", "his/her (m/f/pl)"],
    ["Il a les cheveux bruns.", "He has brown hair."],
    ["Il/Elle a les yeux bleus.", "He/She has blue eyes."],
    ["sympa", "nice/friendly"],
    ["paresseux / paresseuse", "lazy"],
    ["Je m'entends bien avec...", "I get on well with..."],
    ["la chambre", "bedroom"],
    ["le salon", "living room"],
    ["au rez-de-chaussée", "on the ground floor"],
    ["Il y a...", "There is/are..."],
    ["grand(e)", "big/tall"],
    ["petit(e)", "small/short"],
    ["beau / belle", "beautiful/handsome"],
    ["vieux / vieille", "old"]
  ],
  quiz: [
    { type: "mcq", marks: 1, q: C`"My sister" in French is`, opts: ["mon sœur", "ma sœur", "mes sœur", "son sœur"], ans: 1, why: C`Sœur is feminine singular.` },
    { type: "mcq", marks: 1, q: C`Which adjective usually goes BEFORE the noun?`, opts: ["intelligent", "rouge", "petit", "sportif"], ans: 2, why: C`Size (BAGS).` },
    { type: "mcq", marks: 1, q: C`The feminine of "heureux" is`, opts: ["heureuxe", "heureuse", "heureux", "heureuce"], ans: 1, why: C`-eux → -euse.` },
    { type: "mcq", marks: 1, q: C`"les yeux marron" means`, opts: ["blue eyes", "green eyes", "brown eyes", "red eyes"], ans: 2, why: C`Marron = chestnut/brown.` },
    { type: "struct", marks: 2, q: C`Translate: "my grandmother and his cousin"`, ms: C`<b>B1</b> ma grand-mère<br><b>B1</b> son cousin / sa cousine` },
    { type: "struct", marks: 3, q: C`Describe a friend in French: tall, with short black hair and a funny personality.`, ms: C`<b>B1</b> Il/Elle est grand(e)<br><b>B1</b> il/elle a les cheveux courts et noirs<br><b>B1</b> il/elle est drôle` },
    { type: "struct", marks: 2, q: C`Make "vieux" agree with "une maison" (feminine singular).`, ms: C`<b>B2</b> vieille (irregular feminine form)` },
    { type: "struct", marks: 3, q: C`Translate: "In my house there is a big kitchen and three bedrooms."`, ms: C`<b>B1</b> Dans ma maison il y a une grande cuisine<br><b>B1</b> et trois chambres<br><b>B1</b> correct adjective agreement/position (grande before cuisine)` }
  ],
  exam: [
    { d: 1, type: "struct", marks: 1, q: C`Translate: "my brother"`, ms: C`<b>B1</b> mon frère` },
    { d: 1, type: "mcq", marks: 1, q: C`"les grands-parents" means`, opts: ["the big parents", "the grandparents", "the parents' house", "the stepparents"], ans: 1, why: C`Grandparents.` },
    { d: 1, type: "struct", marks: 2, q: C`Translate: "He has blue eyes and blond hair."`, ms: C`<b>B1</b> Il a les yeux bleus<br><b>B1</b> et les cheveux blonds` },
    { d: 2, type: "struct", marks: 3, q: C`Translate: "My parents' house is big with a small garden."`, ms: C`<b>B1</b> La maison de mes parents est grande<br><b>B1</b> avec un petit jardin<br><b>B1</b> correct adjective position (petit before jardin)` },
    { d: 2, type: "struct", marks: 2, q: C`Give the correct possessive adjective: "___ (their) house and ___ (our) garden".`, ms: C`<b>B1</b> leur maison<br><b>B1</b> notre jardin` },
    { d: 2, type: "mcq", marks: 1, q: C`Which sentence is correctly formed?`, opts: ["une jardin petit", "un petit jardin", "un jardin petit", "une petit jardin"], ans: 1, why: C`Petit (BAGS) goes before a masculine noun.` },
    { d: 3, type: "struct", marks: 4, q: C`Write 3–4 sentences in French describing your family: who is in it, one physical description and one personality description, using correct possessive adjectives and adjective agreement.`, ms: C`<b>B1</b> correct family vocabulary and possessive adjectives<br><b>B1</b> appearance description with correct agreement<br><b>B1</b> personality description with correct agreement<br><b>B1</b> overall grammatical accuracy and natural sentence structure` },
    { d: 3, type: "struct", marks: 3, q: C`Translate: "Her brother is tall and hardworking, but her sister is short and lazy."`, ms: C`<b>B1</b> Son frère est grand et travailleur<br><b>B1</b> mais sa sœur est petite et paresseuse<br><b>B1</b> correct agreement throughout (grand/petite, travailleur/paresseuse)` }
  ]
});
}
