window.TOPICS = window.TOPICS || [];
{
const C = String.raw;
const T = (rows) => `<table class="t"><tr><th>French</th><th>English</th></tr>${rows.map(([f, e]) => `<tr><td>${f}</td><td>${e}</td></tr>`).join("")}</table>`;

/* ============================================================
   GREETINGS, NUMBERS & INTRODUCTIONS
   ============================================================ */
TOPICS.push({
  id: "greetings", subject: "french", unit: 1, title: "Greetings, numbers & introductions",
  blurb: "Saying hello and goodbye, introducing yourself, asking and answering basic questions, numbers 0–100, days, months and telling the time.",
  level: "Beginner",
  syllabus: [
    ["1.1", "Greet someone and say goodbye, formally and informally", 0],
    ["1.2", "Introduce yourself: name, age, nationality, where you live", 1],
    ["1.3", "Ask and answer simple questions using question words", 2],
    ["1.4", "Count from 0 to 100 and use numbers in context", 3],
    ["1.5", "Say the days of the week, months, and tell the time", 4]
  ],
  sections: [
    { h: "Saying hello and goodbye", body: C`
<p class="lead">French has a <b>formal</b> and an <b>informal</b> way of speaking to people. Use <i>vous</i> (formal "you") with strangers, teachers, and adults you don't know well; use <i>tu</i> (informal "you") with friends, family and other young people. This choice is called <b>register</b>, and it affects greetings too.</p>
${T([
  ["Bonjour", "Hello / good morning / good afternoon"],
  ["Bonsoir", "Good evening"],
  ["Salut", "Hi / Bye (informal only)"],
  ["Au revoir", "Goodbye"],
  ["À bientôt", "See you soon"],
  ["À demain", "See you tomorrow"],
  ["Bonne nuit", "Good night (going to bed)"],
  ["Comment allez-vous ?", "How are you? (formal)"],
  ["Comment ça va ? / Ça va ?", "How are you? (informal)"],
  ["Ça va bien, merci", "I'm fine, thanks"],
  ["Comme ci, comme ça", "So-so"],
  ["S'il vous plaît / S'il te plaît", "Please (formal / informal)"],
  ["Merci (beaucoup)", "Thank you (very much)"],
  ["De rien", "You're welcome"],
  ["Excusez-moi / Excuse-moi", "Excuse me (formal / informal)"],
  ["Pardon", "Sorry / excuse me"]
])}
<div class="callout key"><b class="t">Tu or vous?</b>Use <b>tu</b>: friends, family, classmates, pets. Use <b>vous</b>: teachers, shopkeepers, strangers, more than one person (always). When in doubt in an exam, use <i>vous</i> — it is never wrong to be polite.</div>`},

    { h: "Introducing yourself", body: C`
<p>The verb <b>s'appeler</b> ("to be called") is the standard way to give your name.</p>
${T([
  ["Je m'appelle Sophie.", "My name is Sophie."],
  ["Comment tu t'appelles ?", "What's your name? (informal)"],
  ["Comment vous appelez-vous ?", "What's your name? (formal)"],
  ["J'ai quinze ans.", "I am fifteen years old."],
  ["Quel âge as-tu ?", "How old are you?"],
  ["Je suis anglais / anglaise.", "I am English (male / female)."],
  ["Je suis français / française.", "I am French (male / female)."],
  ["J'habite à Londres.", "I live in London."],
  ["J'habite en France.", "I live in France."],
  ["Où habites-tu ?", "Where do you live?"],
  ["Je viens de... ", "I come from..."],
  ["Voici mon ami(e).", "This is my friend."],
  ["Je te présente...", "Let me introduce you to..."]
])}
<div class="callout warn"><b class="t">Adjective agreement</b>Nationalities and many adjectives change spelling for a feminine subject, usually by adding <b>-e</b>: <i>anglais → anglaise</i>, <i>français → française</i>, <i>allemand → allemande</i>. If the word already ends in -e (like <i>suisse</i>), it stays the same.</div>
<p><b>Numbers with "avoir":</b> age uses <i>avoir</i> ("to have"), not "to be" — <i>j'ai 15 ans</i> is literally "I have 15 years". Never say "je suis 15 ans".</p>`},

    { h: "Question words", body: C`
${T([
  ["Qui ?", "Who?"],
  ["Que / Qu'est-ce que... ?", "What?"],
  ["Où ?", "Where?"],
  ["Quand ?", "When?"],
  ["Comment ?", "How?"],
  ["Pourquoi ?", "Why?"],
  ["Parce que...", "Because..."],
  ["Combien (de) ?", "How much / how many?"],
  ["Quel / Quelle... ?", "Which / what...?"],
  ["Est-ce que...?", "(turns a statement into a yes/no question)"]
])}
<div class="callout ex"><b class="t">Three ways to ask a question</b>1. Rising intonation: <i>Tu aimes le chocolat ?</i> (just raise your voice at the end). 2. <i>Est-ce que</i> + statement: <i>Est-ce que tu aimes le chocolat ?</i> 3. Inversion (formal/written): <i>Aimes-tu le chocolat ?</i> All three mean "Do you like chocolate?"</div>
<p><b>Quel/Quelle</b> agrees with the noun it describes: <i>quel âge</i> (masculine), <i>quelle heure</i> (feminine), <i>quels sports</i> (masculine plural), <i>quelles matières</i> (feminine plural).</p>`},

    { h: "Numbers 0–100", body: C`
<table class="t"><tr><th>0–4</th><th>5–9</th><th>10–14</th><th>15–19</th></tr>
<tr><td>0 zéro<br>1 un/une<br>2 deux<br>3 trois<br>4 quatre</td><td>5 cinq<br>6 six<br>7 sept<br>8 huit<br>9 neuf</td><td>10 dix<br>11 onze<br>12 douze<br>13 treize<br>14 quatorze</td><td>15 quinze<br>16 seize<br>17 dix-sept<br>18 dix-huit<br>19 dix-neuf</td></tr></table>
<table class="t"><tr><th>French</th><th>Value</th></tr>
<tr><td>vingt</td><td>20</td></tr><tr><td>vingt et un</td><td>21 (note: "et" before un)</td></tr><tr><td>vingt-deux</td><td>22</td></tr>
<tr><td>trente</td><td>30</td></tr><tr><td>quarante</td><td>40</td></tr><tr><td>cinquante</td><td>50</td></tr>
<tr><td>soixante</td><td>60</td></tr><tr><td>soixante-dix</td><td>70 (literally "sixty-ten")</td></tr>
<tr><td>quatre-vingts</td><td>80 (literally "four-twenties")</td></tr><tr><td>quatre-vingt-dix</td><td>90 ("four-twenty-ten")</td></tr>
<tr><td>cent</td><td>100</td></tr></table>
<div class="callout warn"><b class="t">The tricky ones</b>70, 80 and 90 don't follow the simple pattern: <b>71</b> = soixante et onze (61+10), <b>75</b> = soixante-quinze (60+15), <b>81</b> = quatre-vingt-un (no "et"), <b>95</b> = quatre-vingt-quinze. This trips up almost everyone at first — practise counting aloud from 60 to 100.</div>
<details class="check"><summary>Write 87 in French.</summary><div>quatre-vingt-sept (4×20 + 7).</div></details>`},

    { h: "Days, months and time", body: C`
${T([
  ["lundi, mardi, mercredi, jeudi, vendredi, samedi, dimanche", "Mon–Sun (no capital letters in French!)"],
  ["janvier, février, mars, avril, mai, juin", "Jan–Jun"],
  ["juillet, août, septembre, octobre, novembre, décembre", "Jul–Dec"],
  ["aujourd'hui / demain / hier", "today / tomorrow / yesterday"],
  ["le matin / l'après-midi / le soir", "in the morning / afternoon / evening"],
  ["Quelle heure est-il ?", "What time is it?"],
  ["Il est trois heures.", "It is 3 o'clock."],
  ["Il est trois heures et quart.", "It is quarter past three."],
  ["Il est trois heures et demie.", "It is half past three."],
  ["Il est quatre heures moins le quart.", "It is quarter to four."],
  ["Il est midi / minuit.", "It is midday / midnight."],
  ["à huit heures", "at eight o'clock"]
])}
<div class="callout key"><b class="t">No capitals</b>Unlike English, days and months do <b>not</b> take a capital letter in French: <i>lundi</i>, not <i>Lundi</i>; <i>janvier</i>, not <i>Janvier</i>.</div>`}
  ],
  worked: [
    { q: C`Translate into French: "Hello, my name is Léa. I am fourteen years old and I live in Paris."`,
      steps: [C`Greeting: <i>Bonjour</i>.`, C`Name: <i>je m'appelle Léa</i>.`, C`Age uses avoir: <i>j'ai quatorze ans</i>.`, C`Living uses habiter: <i>j'habite à Paris</i>.`, C`Full answer: <i>Bonjour, je m'appelle Léa. J'ai quatorze ans et j'habite à Paris.</i>`]},
    { q: C`Write these numbers in French: 16, 21, 72, 91.`,
      steps: [C`16 = seize.`, C`21 = vingt et un (don't forget "et").`, C`72 = soixante-douze (60 + 12).`, C`91 = quatre-vingt-onze (80 + 11).`]},
    { q: C`Ask a classmate, formally, what their name is and how old they are.`,
      steps: [C`Name, formal: <i>Comment vous appelez-vous ?</i>`, C`Age: <i>Quel âge avez-vous ?</i> (formal form of avoir).`]}
  ],
  formulas: [["Age", "j'ai + number + ans"], ["Name", "je m'appelle..."], ["Where I live", "j'habite à/en..."], ["Nationality agreement", "add -e for feminine"], ["70 / 80 / 90", "soixante-dix / quatre-vingts / quatre-vingt-dix"]],
  cards: [
    ["Bonjour", "Hello / Good morning"],
    ["Au revoir", "Goodbye"],
    ["Comment ça va ?", "How are you? (informal)"],
    ["Je m'appelle...", "My name is..."],
    ["J'ai ... ans", "I am ... years old"],
    ["J'habite à...", "I live in... (a town)"],
    ["Quel âge as-tu ?", "How old are you?"],
    ["Où habites-tu ?", "Where do you live?"],
    ["Merci beaucoup", "Thank you very much"],
    ["S'il te plaît", "Please (informal)"],
    ["vingt", "twenty"],
    ["trente", "thirty"],
    ["soixante-dix", "seventy"],
    ["quatre-vingts", "eighty"],
    ["quatre-vingt-dix", "ninety"],
    ["lundi", "Monday"],
    ["dimanche", "Sunday"],
    ["Quelle heure est-il ?", "What time is it?"],
    ["Il est midi", "It is midday"],
    ["aujourd'hui", "today"],
    ["demain", "tomorrow"],
    ["hier", "yesterday"]
  ],
  quiz: [
    { type: "mcq", marks: 1, q: C`"Good evening" in French is`, opts: ["Bonjour", "Bonsoir", "Bonne nuit", "Salut"], ans: 1, why: C`Bonsoir is used from the evening onwards.` },
    { type: "mcq", marks: 1, q: C`Which is the informal word for "you"?`, opts: ["vous", "tu", "toi", "te"], ans: 1, why: C`Tu is informal singular.` },
    { type: "mcq", marks: 1, q: C`"J'ai quinze ans" means`, opts: ["I have fifteen", "I am fifteen years old", "I was fifteen", "I will be fifteen"], ans: 1, why: C`Avoir + ans = age.` },
    { type: "mcq", marks: 1, q: C`How do you write 80 in French?`, opts: ["huit-vingt", "quatre-vingts", "octante", "quatre-dix"], ans: 1, why: C`Literally "four twenties".` },
    { type: "mcq", marks: 1, q: C`"Quelle heure est-il ?" means`, opts: ["What day is it?", "What time is it?", "How old are you?", "Where is it?"], ans: 1, why: C`Asking the time.` },
    { type: "struct", marks: 2, q: C`Translate: "I am English and I live in London."`, ms: C`<b>B1</b> Je suis anglais(e)<br><b>B1</b> et j'habite à Londres` },
    { type: "struct", marks: 2, q: C`Write in French: 45 and 99.`, ms: C`<b>B1</b> quarante-cinq<br><b>B1</b> quatre-vingt-dix-neuf` },
    { type: "struct", marks: 3, q: C`Translate: "Excuse me, what is your name and how old are you?" (formal)`, ms: C`<b>B1</b> Excusez-moi<br><b>B1</b> comment vous appelez-vous ?<br><b>B1</b> quel âge avez-vous ?` },
    { type: "struct", marks: 2, q: C`Write the time "half past seven" and "quarter to nine" in French.`, ms: C`<b>B1</b> sept heures et demie<br><b>B1</b> neuf heures moins le quart` }
  ],
  exam: [
    { d: 1, type: "mcq", marks: 1, q: C`"Merci beaucoup" means`, opts: ["You're welcome", "Please", "Thank you very much", "Sorry"], ans: 2, why: C`Merci = thanks.` },
    { d: 1, type: "struct", marks: 1, q: C`Translate: "Goodbye, see you tomorrow."`, ms: C`<b>B1</b> Au revoir, à demain.` },
    { d: 1, type: "struct", marks: 2, q: C`Write the French for 12, 17.`, ms: C`<b>B1</b> douze<br><b>B1</b> dix-sept` },
    { d: 2, type: "struct", marks: 3, q: C`Translate: "My name is Tom. I am sixteen years old and I live in Manchester."`, ms: C`<b>B1</b> Je m'appelle Tom<br><b>B1</b> j'ai seize ans<br><b>B1</b> j'habite à Manchester` },
    { d: 2, type: "struct", marks: 2, q: C`Write 68 and 76 in French.`, ms: C`<b>B1</b> soixante-huit<br><b>B1</b> soixante-seize` },
    { d: 2, type: "mcq", marks: 1, q: C`Which question is formal?`, opts: ["Ça va ?", "Tu t'appelles comment ?", "Comment allez-vous ?", "Tu as quel âge ?"], ans: 2, why: C`Uses vous.` },
    { d: 3, type: "struct", marks: 4, q: C`Write a short formal introduction (3–4 sentences) giving your name, age, nationality and where you live, using "vous"-appropriate structures where relevant.`, ms: C`<b>B1</b> correct greeting<br><b>B1</b> je m'appelle + name<br><b>B1</b> j'ai + age + ans<br><b>B1</b> je suis + nationality (agreement) and j'habite à + town` },
    { d: 3, type: "struct", marks: 3, q: C`Translate into French: "It is quarter past four in the afternoon."`, ms: C`<b>B1</b> Il est quatre heures et quart<br><b>B1</b> de l'après-midi<br><b>B1</b> correct word order` }
  ]
});
}
