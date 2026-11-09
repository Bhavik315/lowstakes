import type { SceneSpec } from "./types";

// The whole video: narration (lines) and the visuals that are cued from it.
// Cambridge IGCSE Business Studies (0450), Unit 1: Understanding business activity.
// Edit text here, then run `npm run voice` to regenerate the voiceover and timings.

export const SCENES: SceneSpec[] = [
  // ───────────────────────────── INTRO ─────────────────────────────
  {
    id: "hook",
    kind: "montage",
    chapter: 0,
    lines: [
      { text: "Think about the last twenty-four hours of your life." },
      {
        id: "things",
        text: "The breakfast you ate. The clothes you're wearing. The phone in your hand. The bus that took you to school.",
      },
      { id: "business", text: "Every single one of those things reached you because of a business." },
      { text: "Someone grew it, someone made it, someone moved it, and someone sold it to you." },
      {
        id: "question",
        text: "But why do businesses exist at all? How do they grow? Who do they serve? And what are they really trying to achieve?",
      },
    ],
    items: [
      { icon: "Coffee", label: "Breakfast", at: "things" },
      { icon: "Shirt", label: "Clothes", at: "things" },
      { icon: "Smartphone", label: "Phone", at: "things" },
      { icon: "Bus", label: "Bus", at: "things" },
      { icon: "Croissant", label: "Bakery", at: "business" },
      { icon: "Laptop", label: "Laptop", at: "business" },
      { icon: "Landmark", label: "Bank", at: "business" },
      { icon: "ShoppingCart", label: "Shop", at: "business" },
    ],
    center: { label: "Business", at: "business" },
    question: { text: "Why do businesses exist?", at: "question" },
  },
  {
    id: "title",
    kind: "title",
    chapter: 0,
    kicker: "Cambridge IGCSE Business Studies · Unit 1",
    title: "Understanding Business Activity",
    subtitle: "The complete guide, explained from scratch",
    lines: [
      {
        text: "Welcome to this complete guide to Unit 1 of Cambridge IGCSE Business Studies: Understanding Business Activity.",
        say: "Welcome to this complete guide to Unit One of Cambridge I G C S E Business Studies: Understanding Business Activity.",
      },
      {
        text: "By the end of this video, you'll understand the ideas that the rest of the course is built on, explained from scratch, with real examples and exam tips along the way.",
      },
    ],
  },
  {
    id: "roadmap",
    kind: "roadmap",
    chapter: 0,
    heading: "Your journey through Unit 1",
    lines: [
      { text: "Here's our journey. It's split into five chapters." },
      { id: "c1", text: "First, business activity: why businesses exist, and how they add value." },
      { id: "c2", text: "Second, how we classify businesses into different sectors." },
      { id: "c3", text: "Third, enterprise, and how businesses grow, stay small, or fail." },
      {
        id: "c4",
        text: "Fourth, the different types of business organisation, from a one-person shop to a global company.",
      },
      { id: "c5", text: "And fifth, business objectives, and the stakeholders who care about them." },
    ],
    items: [
      { num: "1.1", title: "Business activity", sub: "Needs, wants, scarcity & added value", at: "c1" },
      { num: "1.2", title: "Classification of businesses", sub: "Sectors & the mixed economy", at: "c2" },
      { num: "1.3", title: "Enterprise, growth & size", sub: "Entrepreneurs, growth & failure", at: "c3" },
      { num: "1.4", title: "Types of business organisation", sub: "Sole traders to plcs", at: "c4" },
      { num: "1.5", title: "Objectives & stakeholders", sub: "Aims, interests & conflicts", at: "c5" },
    ],
  },

  // ─────────────────────── CHAPTER 1 · BUSINESS ACTIVITY ───────────────────────
  {
    id: "ch1",
    kind: "chapter",
    chapter: 1,
    num: 1,
    code: "1.1",
    title: "Business Activity",
    subtitle: "Why do businesses exist?",
    lines: [
      {
        text: "Chapter one. Business activity. Let's start with the most basic question of all: why do businesses exist?",
      },
    ],
  },
  {
    id: "needs-wants",
    kind: "split",
    chapter: 1,
    heading: "Needs and wants",
    lines: [
      { text: "It all begins with people, and the things they need, and want." },
      { id: "needs", text: "Needs are the things we must have to survive: food, water, shelter, and clothing." },
      {
        id: "wants",
        text: "Wants are things we would like to have, but can live without, such as a smartphone, a car, or a holiday abroad.",
      },
      {
        id: "unlimited",
        text: "Here's the important part. Our needs are limited, but our wants are unlimited. As soon as we get one thing, we start wanting the next.",
      },
    ],
    left: {
      title: "Needs",
      sub: "Essential for survival",
      icon: "HeartPulse",
      tone: "accent",
      at: "needs",
      items: [
        { icon: "Utensils", label: "Food" },
        { icon: "Droplet", label: "Water" },
        { icon: "House", label: "Shelter" },
        { icon: "Shirt", label: "Clothing" },
      ],
    },
    right: {
      title: "Wants",
      sub: "Nice to have, not essential",
      icon: "Sparkles",
      tone: "neutral",
      at: "wants",
      items: [
        { icon: "Smartphone", label: "Smartphone" },
        { icon: "Car", label: "Car" },
        { icon: "Plane", label: "Holidays" },
        { icon: "Gamepad2", label: "Games" },
      ],
    },
    banner: { text: "Needs are limited  ·  Wants are unlimited", at: "unlimited" },
  },
  {
    id: "factors",
    kind: "grid",
    chapter: 1,
    heading: "The factors of production",
    lines: [
      {
        id: "intro",
        text: "To satisfy needs and wants, we produce goods and services. And to produce anything at all, we need resources, called the factors of production. There are four of them.",
      },
      { id: "land", text: "Land: all natural resources, like soil, water, minerals, oil and forests." },
      { id: "labour", text: "Labour: people, and the physical and mental effort they put into their work." },
      {
        id: "capital",
        text: "Capital: man-made goods used to produce other goods, such as machines, tools, vehicles and buildings.",
      },
      {
        id: "enterprise",
        text: "And enterprise: the skill and risk-taking of the entrepreneur, who brings the other three factors together to start a business.",
      },
    ],
    sub: { text: "The resources needed to produce goods and services", at: "intro" },
    columns: 4,
    items: [
      { icon: "Mountain", label: "Land", sub: "Natural resources", at: "land" },
      { icon: "Users", label: "Labour", sub: "People & their effort", at: "labour" },
      { icon: "Cog", label: "Capital", sub: "Machines, tools, buildings", at: "capital" },
      { icon: "Lightbulb", label: "Enterprise", sub: "Risk-taking & organising", at: "enterprise" },
    ],
  },
  {
    id: "scarcity",
    kind: "equation",
    chapter: 1,
    heading: "The basic economic problem",
    lines: [
      { text: "Now, put those two ideas together." },
      { id: "wants", text: "Wants are unlimited." },
      { id: "resources", text: "But the resources to satisfy them are limited." },
      {
        id: "scarcity",
        text: "The result is scarcity: there are not enough goods and services to satisfy everyone's wants. This is called the basic economic problem.",
      },
      {
        id: "choice",
        text: "And because of scarcity, people, businesses, and governments all have to make choices.",
      },
    ],
    parts: [
      { text: "Unlimited wants", at: "wants", role: "term" },
      { text: "+", at: "resources", role: "op" },
      { text: "Limited resources", at: "resources", role: "term" },
      { text: "=", at: "scarcity", role: "op" },
      { text: "Scarcity", at: "scarcity", role: "result" },
    ],
    footer: { text: "Scarcity forces us to make choices", at: "choice" },
  },
  {
    id: "opportunity-cost",
    kind: "definition",
    chapter: 1,
    eyebrow: "Key term",
    term: "Opportunity cost",
    def: "The next best alternative given up when a choice is made.",
    at: "def",
    icon: "Scale",
    lines: [
      {
        id: "def",
        text: "And every choice has a cost. Opportunity cost is the next best alternative given up when a choice is made.",
      },
      {
        id: "ex1",
        text: "Imagine you have $50. You could buy a concert ticket, or a new pair of trainers. If you choose the concert, the opportunity cost is the trainers you gave up.",
        say: "Imagine you have fifty dollars. You could buy a concert ticket, or a new pair of trainers. If you choose the concert, the opportunity cost is the trainers you gave up.",
      },
      {
        id: "ex2",
        text: "Businesses face this too. If a business spends its money on a new machine, the opportunity cost might be the advertising campaign it can no longer afford.",
      },
      { id: "ex3", text: "And a government that builds a new hospital may have to give up building a new school." },
    ],
    forks: [
      { from: "You, with $50", icon: "Wallet", chosen: "Concert ticket", lost: "Trainers", at: "ex1" },
      { from: "A business", icon: "Briefcase", chosen: "New machine", lost: "Advertising", at: "ex2" },
      { from: "A government", icon: "Landmark", chosen: "Hospital", lost: "School", at: "ex3" },
    ],
  },
  {
    id: "specialisation",
    kind: "flow",
    chapter: 1,
    heading: "Specialisation & division of labour",
    lines: [
      {
        id: "spec",
        text: "To produce goods efficiently, businesses use specialisation. Specialisation is when people and businesses concentrate on what they are best at.",
      },
      {
        id: "dol",
        text: "Inside a business, this often takes the form of the division of labour: production is split into separate tasks, and each worker focuses on just one task.",
      },
      { id: "order", text: "Think of a sandwich shop at lunchtime. One person takes the orders," },
      { id: "make", text: "another makes the sandwiches," },
      { id: "pay", text: "and a third handles the payments." },
      {
        id: "together",
        text: "Working together like this, they can serve far more customers than if each person did everything.",
      },
    ],
    nodes: [
      { icon: "ClipboardList", label: "Take orders", sub: "Worker 1", at: "order", tag: "Task 1" },
      { icon: "Sandwich", label: "Make sandwiches", sub: "Worker 2", at: "make", tag: "Task 2" },
      { icon: "CreditCard", label: "Take payment", sub: "Worker 3", at: "pay", tag: "Task 3" },
    ],
    footer: { text: "Each worker specialises in one task → more output", at: "together" },
  },
  {
    id: "specialisation-eval",
    kind: "split",
    chapter: 1,
    heading: "Division of labour: pros & cons",
    lines: [
      { text: "So, is the division of labour a good thing? Let's weigh it up." },
      { id: "p1", text: "On the plus side, workers become skilled and fast at their task, so output rises." },
      { id: "p2", text: "Quality can improve, because each worker becomes an expert." },
      { id: "p3", text: "And training is quicker, because each worker only needs to learn one job." },
      { id: "c1", text: "But doing the same task all day can be boring and repetitive," },
      { id: "c2", text: "which can lower motivation." },
      {
        id: "c3",
        text: "And if one worker is absent, production can stop, because nobody else knows how to do that job.",
      },
    ],
    left: {
      title: "Advantages",
      icon: "ThumbsUp",
      tone: "good",
      at: "p1",
      items: [
        { icon: "Gauge", label: "Higher efficiency & output", at: "p1" },
        { icon: "BadgeCheck", label: "Better quality", at: "p2" },
        { icon: "Clock", label: "Less training needed", at: "p3" },
      ],
    },
    right: {
      title: "Disadvantages",
      icon: "ThumbsDown",
      tone: "bad",
      at: "c1",
      items: [
        { icon: "Repeat", label: "Boring, repetitive work", at: "c1" },
        { icon: "Frown", label: "Lower motivation", at: "c2" },
        { icon: "UserX", label: "One absence can stop production", at: "c3" },
      ],
    },
  },
  {
    id: "purpose",
    kind: "flow",
    chapter: 1,
    heading: "The purpose of business activity",
    lines: [
      { text: "So what is the purpose of business activity?" },
      { id: "combine", text: "A business combines the factors of production," },
      { id: "produce", text: "to produce goods and services," },
      { id: "satisfy", text: "that satisfy people's needs and wants." },
      {
        id: "more",
        text: "Along the way, businesses create jobs, pay wages, and earn income for their owners. That's why business activity is at the heart of every economy.",
      },
    ],
    nodes: [
      { icon: "Layers", label: "Factors of production", sub: "Land · Labour · Capital · Enterprise", at: "combine" },
      { icon: "Building2", label: "Business", sub: "Combines the resources", at: "combine" },
      { icon: "Package", label: "Goods & services", sub: "Products people value", at: "produce" },
      { icon: "Smile", label: "Needs & wants satisfied", sub: "Happy customers", at: "satisfy" },
    ],
    footer: { text: "Business activity also creates jobs, wages & income", at: "more" },
  },
  {
    id: "added-value",
    kind: "equation",
    chapter: 1,
    heading: "Adding value",
    lines: [
      { id: "intro", text: "One of the most important ideas in this whole unit is added value." },
      {
        id: "def",
        text: "Added value is the difference between the selling price of a product, and the cost of the bought-in materials and components used to make it.",
      },
      { id: "sp", text: "In other words, added value equals the selling price," },
      { id: "minus", text: "minus the cost of bought-in materials." },
    ],
    term: {
      title: "Added value",
      def: "The difference between the selling price and the cost of bought-in materials and components.",
      at: "def",
    },
    parts: [
      { text: "Added value", at: "sp", role: "result" },
      { text: "=", at: "sp", role: "op" },
      { text: "Selling price", at: "sp", role: "term" },
      { text: "−", at: "minus", role: "op" },
      { text: "Cost of bought-in materials", at: "minus", role: "term" },
    ],
  },
  {
    id: "added-value-example",
    kind: "addedvalue",
    chapter: 1,
    lines: [
      {
        id: "buy",
        text: "Let's see it in action. A bakery buys flour, butter, sugar and eggs. The ingredients for one cake cost $2.",
        say: "Let's see it in action. A bakery buys flour, butter, sugar and eggs. The ingredients for one cake cost two dollars.",
      },
      {
        id: "sell",
        text: "After the baker has mixed, baked and decorated it, the cake sells for $10.",
        say: "After the baker has mixed, baked and decorated it, the cake sells for ten dollars.",
      },
      {
        id: "result",
        text: "So the added value is $10 minus $2, which is $8.",
        say: "So the added value is ten dollars, minus two dollars, which is eight dollars.",
      },
      {
        id: "warning",
        text: "But be careful. Added value is not the same as profit. Out of that $8, the bakery still has to pay wages, rent and electricity. Only what's left after those costs is profit.",
        say: "But be careful. Added value is not the same as profit. Out of that eight dollars, the bakery still has to pay wages, rent and electricity. Only what's left after those costs is profit.",
      },
    ],
  },
  {
    id: "increase-value",
    kind: "grid",
    chapter: 1,
    heading: "How can a business add more value?",
    lines: [
      {
        id: "intro",
        text: "So how can a business increase its added value? There are two routes: persuade customers to pay a higher price, or reduce the cost of materials.",
      },
      { id: "brand", text: "It can build a strong brand image, so that customers are willing to pay more." },
      { id: "quality", text: "It can improve quality, or use premium packaging that makes the product feel special." },
      { id: "service", text: "It can offer excellent customer service, or extra convenience, like fast delivery." },
      {
        id: "usp",
        text: "It can give the product a unique selling point: something that makes it different from its competitors.",
      },
      {
        id: "cost",
        text: "Or it can find cheaper suppliers to cut the cost of materials, although it must be careful not to lower quality and damage its reputation.",
      },
    ],
    sub: { text: "Raise the price customers will pay — or cut material costs", at: "intro" },
    columns: 5,
    items: [
      { icon: "Crown", label: "Strong brand", sub: "Customers pay more", at: "brand" },
      { icon: "Gem", label: "Higher quality", sub: "Premium packaging", at: "quality" },
      { icon: "HeartHandshake", label: "Great service", sub: "Convenience & speed", at: "service" },
      { icon: "Sparkles", label: "Unique selling point", sub: "Stand out from rivals", at: "usp" },
      { icon: "HandCoins", label: "Cheaper suppliers", sub: "Lower material costs", at: "cost" },
    ],
  },
  {
    id: "coffee",
    kind: "statement",
    chapter: 1,
    heading: "Added value in real life",
    lines: [
      {
        id: "beans",
        text: "Think about a cup of coffee from a famous café chain. The coffee beans inside might cost just a few cents.",
      },
      {
        id: "cup",
        text: "Yet the cup sells for four dollars or more.",
      },
      {
        id: "why",
        text: "The brand, the comfortable seats, the free wi-fi and the convenience all add value that customers are happy to pay for.",
      },
    ],
    left: { big: "≈ 30¢", small: "Coffee beans in one cup", icon: "Bean", at: "beans" },
    right: { big: "$4+", small: "Price of the cup", icon: "Coffee", at: "cup" },
    chips: [
      { icon: "Crown", label: "Brand", at: "why" },
      { icon: "Armchair", label: "Comfort", at: "why" },
      { icon: "Wifi", label: "Free wi-fi", at: "why" },
      { icon: "Clock", label: "Convenience", at: "why" },
    ],
  },

  // ─────────────────────── CHAPTER 2 · CLASSIFICATION ───────────────────────
  {
    id: "ch2",
    kind: "chapter",
    chapter: 2,
    num: 2,
    code: "1.2",
    title: "Classifying Businesses",
    subtitle: "Sectors of the economy",
    lines: [
      {
        text: "Chapter two. Classifying businesses. There are millions of businesses in the world. So how do we organise them?",
      },
    ],
  },
  {
    id: "sectors",
    kind: "grid",
    chapter: 2,
    heading: "The three sectors of industry",
    lines: [
      { id: "intro", text: "Businesses are grouped into three sectors, according to what they do." },
      {
        id: "primary",
        text: "The primary sector extracts natural resources from the earth. Think of farming, fishing, mining, forestry, and drilling for oil.",
      },
      {
        id: "secondary",
        text: "The secondary sector turns those raw materials into finished products. This is manufacturing, processing, and construction: car factories, bakeries, oil refineries, and builders.",
      },
      {
        id: "tertiary",
        text: "And the tertiary sector provides services, to people and to other businesses. Banks, shops, hotels, transport, hospitals, and schools are all in the tertiary sector.",
      },
    ],
    sub: { text: "Classified by the type of activity a business does", at: "intro" },
    columns: 3,
    items: [
      { icon: "Tractor", label: "Primary", sub: "Extracts natural resources: farming, fishing, mining, forestry", at: "primary" },
      { icon: "Factory", label: "Secondary", sub: "Manufacturing, processing & construction", at: "secondary" },
      { icon: "Store", label: "Tertiary", sub: "Provides services: banks, shops, transport, hospitals", at: "tertiary" },
    ],
  },
  {
    id: "chain",
    kind: "flow",
    chapter: 2,
    heading: "The chain of production",
    lines: [
      { text: "These sectors are linked together in a chain of production. Let's follow a loaf of bread." },
      { id: "farm", text: "A farmer grows wheat. That's the primary sector." },
      {
        id: "bake",
        text: "A flour mill grinds the wheat, and a bakery turns the flour into bread. That's the secondary sector.",
      },
      { id: "shop", text: "Then a supermarket transports the bread and sells it to you. That's the tertiary sector." },
      { id: "you", text: "Value is added at every stage, and each business depends on the others." },
    ],
    nodes: [
      { icon: "Wheat", label: "Farmer grows wheat", tag: "Primary", at: "farm" },
      { icon: "Factory", label: "Bakery makes bread", tag: "Secondary", at: "bake" },
      { icon: "ShoppingCart", label: "Supermarket sells it", tag: "Tertiary", at: "shop" },
      { icon: "User", label: "You buy it", tag: "Consumer", at: "you" },
    ],
    footer: { text: "Value is added at every stage", at: "you" },
  },
  {
    id: "sector-bars",
    kind: "bars",
    chapter: 2,
    heading: "Sectors in different economies",
    sub: "Share of employment by sector (illustrative %)",
    lines: [
      {
        text: "The importance of each sector is different from country to country. We usually measure it by the share of workers employed, or the value of output, in each sector.",
      },
      {
        id: "developing",
        text: "In many developing economies, a large share of people work in the primary sector, especially in farming.",
      },
      {
        id: "emerging",
        text: "As countries industrialise, the secondary sector grows, as factories open and workers move to the cities.",
      },
      {
        id: "developed",
        text: "And in developed economies, such as the United Kingdom or the United States, the tertiary sector is by far the largest, employing around four out of every five workers.",
      },
      { id: "note", text: "These figures are illustrative, but it's the pattern that matters for your exam." },
    ],
    legend: ["Primary", "Secondary", "Tertiary"],
    rows: [
      { label: "Developing economy", values: [55, 15, 30], at: "developing" },
      { label: "Industrialising economy", values: [25, 35, 40], at: "emerging" },
      { label: "Developed economy", values: [2, 18, 80], at: "developed" },
    ],
    note: { text: "Learn the pattern, not the exact numbers", at: "note" },
  },
  {
    id: "sector-change",
    kind: "stages",
    chapter: 2,
    heading: "How economies change over time",
    lines: [
      { id: "s1", text: "As a country develops, the balance between the sectors shifts." },
      {
        id: "s2",
        text: "First comes industrialisation: workers move from the farms into factories, and the secondary sector grows.",
      },
      {
        id: "s3",
        text: "Later comes de-industrialisation: the secondary sector shrinks, and the tertiary sector takes over.",
      },
    ],
    stages: [
      { icon: "Wheat", label: "Primary dominates", sub: "Mostly farming & extraction", at: "s1" },
      { icon: "Factory", label: "Industrialisation", sub: "Secondary sector grows", at: "s2" },
      { icon: "Store", label: "De-industrialisation", sub: "Tertiary sector dominates", at: "s3" },
    ],
  },
  {
    id: "sector-reasons",
    kind: "grid",
    chapter: 2,
    heading: "Why does the tertiary sector grow?",
    lines: [
      { text: "So why does de-industrialisation happen in developed economies? There are four main reasons." },
      {
        id: "income",
        text: "As people get richer, they spend more of their income on services, like eating out, travel, entertainment, and healthcare.",
      },
      { id: "global", text: "Manufacturing often moves to other countries, where labour costs are lower." },
      { id: "deplete", text: "Natural resources can run out, so primary industries decline." },
      { id: "auto", text: "And automation means factories need fewer workers to produce the same output." },
    ],
    columns: 4,
    items: [
      { icon: "Wallet", label: "Rising incomes", sub: "More spent on services", at: "income" },
      { icon: "Globe", label: "Globalisation", sub: "Factories move to low-cost countries", at: "global" },
      { icon: "Pickaxe", label: "Resources run out", sub: "Primary industries decline", at: "deplete" },
      { icon: "Bot", label: "Automation", sub: "Fewer factory workers needed", at: "auto" },
    ],
  },
  {
    id: "mixed-economy",
    kind: "split",
    chapter: 2,
    heading: "Private sector vs public sector",
    lines: [
      { text: "Businesses can also be classified by who owns them." },
      {
        id: "private",
        text: "The private sector is made up of businesses owned by private individuals, such as sole traders, partnerships, and companies. Most of them aim to make a profit.",
      },
      {
        id: "public",
        text: "The public sector is made up of organisations owned and controlled by the government, such as state schools and hospitals, the police, and the armed forces. Their main aim is usually to provide a service to the public.",
      },
      {
        id: "mixed",
        text: "Most countries have a mixed economy, where the private sector and the public sector exist side by side.",
      },
      {
        id: "why",
        text: "Governments usually run essential services that everyone needs, or services that private businesses might not provide, because they wouldn't make a profit, like street lighting or national defence.",
      },
    ],
    left: {
      title: "Private sector",
      sub: "Owned by private individuals",
      icon: "Briefcase",
      tone: "accent",
      at: "private",
      items: [
        { icon: "User", label: "Sole traders & partnerships" },
        { icon: "Building2", label: "Companies" },
        { icon: "Coins", label: "Usually aims for profit" },
      ],
    },
    right: {
      title: "Public sector",
      sub: "Owned & controlled by government",
      icon: "Landmark",
      tone: "neutral",
      at: "public",
      items: [
        { icon: "GraduationCap", label: "State schools & hospitals" },
        { icon: "Siren", label: "Police & armed forces" },
        { icon: "HeartHandshake", label: "Aims to serve the public" },
      ],
    },
    banner: { text: "Mixed economy = private sector + public sector", at: "mixed" },
  },

  // ─────────────────── CHAPTER 3 · ENTERPRISE, GROWTH & SIZE ───────────────────
  {
    id: "ch3",
    kind: "chapter",
    chapter: 3,
    num: 3,
    code: "1.3",
    title: "Enterprise, Growth & Size",
    subtitle: "Starting, growing, and failing",
    lines: [
      {
        text: "Chapter three. Enterprise, business growth, and size. Every business, even the biggest in the world, started as an idea in someone's head.",
      },
    ],
  },
  {
    id: "entrepreneur",
    kind: "definition",
    chapter: 3,
    eyebrow: "Key term",
    term: "Entrepreneur",
    def: "A person who organises, operates and takes the risk for a new business venture.",
    at: "def",
    icon: "Rocket",
    lines: [
      {
        id: "def",
        text: "An entrepreneur is a person who organises, operates, and takes the risk for a new business venture.",
      },
      {
        id: "spot",
        text: "Entrepreneurs spot an opportunity, gather the resources, and put their own money and time on the line.",
      },
      {
        id: "reward",
        text: "If the business succeeds, they are rewarded with profit. If it fails, they may lose everything they invested.",
      },
    ],
    chips: [
      { icon: "Eye", label: "Spots an opportunity", at: "spot" },
      { icon: "Layers", label: "Gathers resources", at: "spot" },
      { icon: "TrendingUp", label: "Reward: profit", at: "reward" },
      { icon: "TriangleAlert", label: "Risk: losing it all", at: "reward" },
    ],
  },
  {
    id: "traits",
    kind: "grid",
    chapter: 3,
    heading: "Characteristics of successful entrepreneurs",
    lines: [
      { text: "So what makes a successful entrepreneur? Here are the key characteristics." },
      { id: "risk", text: "They are willing to take risks." },
      { id: "creative", text: "They are creative and innovative, always coming up with new ideas." },
      { id: "hard", text: "They are hard-working and determined, and they don't give up easily." },
      { id: "confident", text: "They are self-confident, and believe in their ideas." },
      { id: "comm", text: "They are good communicators, able to persuade customers, banks, and employees." },
      {
        id: "multi",
        text: "And they are independent and multi-skilled, able to handle lots of different jobs at once, especially in the early days.",
      },
    ],
    columns: 3,
    items: [
      { icon: "Rocket", label: "Risk-taker", at: "risk" },
      { icon: "Lightbulb", label: "Creative & innovative", at: "creative" },
      { icon: "Flame", label: "Hard-working & determined", at: "hard" },
      { icon: "BadgeCheck", label: "Self-confident", at: "confident" },
      { icon: "MessageCircle", label: "Good communicator", at: "comm" },
      { icon: "Puzzle", label: "Independent & multi-skilled", at: "multi" },
    ],
  },
  {
    id: "business-plan",
    kind: "grid",
    chapter: 3,
    heading: "What goes in a business plan?",
    lines: [
      {
        id: "def",
        text: "Before starting, most entrepreneurs write a business plan: a document containing the business objectives, and important details about its operations, finance, and owners.",
      },
      { id: "desc", text: "A typical business plan includes a description of the business, and its objectives." },
      { id: "product", text: "The product or service it will sell." },
      { id: "market", text: "The target market, and the competition." },
      { id: "ops", text: "How and where the product will be made, and the staff that are needed." },
      {
        id: "finance",
        text: "And financial forecasts, such as expected sales, costs, profit, and cash flow, plus where the finance will come from.",
      },
    ],
    sub: { text: "A document setting out objectives, operations, finance & owners", at: "def" },
    columns: 5,
    items: [
      { icon: "FileText", label: "The business", sub: "Description & objectives", at: "desc" },
      { icon: "Package", label: "Product", sub: "What it will sell", at: "product" },
      { icon: "Target", label: "Market", sub: "Customers & competitors", at: "market" },
      { icon: "Factory", label: "Operations", sub: "Location, production, staff", at: "ops" },
      { icon: "Calculator", label: "Finance", sub: "Sales, costs, profit, cash flow", at: "finance" },
    ],
  },
  {
    id: "plan-why",
    kind: "grid",
    chapter: 3,
    heading: "Why write a business plan?",
    lines: [
      { text: "Why bother writing one?" },
      {
        id: "think",
        text: "Writing a plan forces the entrepreneur to think carefully about every part of the business, which reduces the risk of failure.",
      },
      { id: "bank", text: "Banks and investors will usually want to see a business plan before they lend any money." },
      {
        id: "targets",
        text: "And it sets clear targets, so the owner can measure progress once the business is up and running.",
      },
    ],
    columns: 3,
    items: [
      { icon: "Brain", label: "Forces careful planning", sub: "Reduces the risk of failure", at: "think" },
      { icon: "Landmark", label: "Helps get finance", sub: "Banks & investors ask for it", at: "bank" },
      { icon: "Target", label: "Sets clear targets", sub: "Progress can be measured", at: "targets" },
    ],
  },
  {
    id: "gov-support",
    kind: "split",
    chapter: 3,
    heading: "Government support for start-ups",
    lines: [
      { id: "why", text: "Governments are very keen to help new businesses get started. Why?" },
      { id: "w1", text: "New businesses create jobs, and reduce unemployment." },
      { id: "w2", text: "They increase competition, which gives consumers more choice and lower prices." },
      {
        id: "w3",
        text: "And they bring new ideas, and some will grow into the large firms of the future, paying more tax and exporting goods.",
      },
      { id: "how", text: "So how do governments help?" },
      { id: "h1", text: "They offer grants, and low-interest loans." },
      { id: "h2", text: "They provide advice and training schemes for new entrepreneurs." },
      { id: "h3", text: "They provide cheap premises, sometimes in business incubator centres." },
      { id: "h4", text: "And they may reduce taxes for new businesses." },
    ],
    left: {
      title: "Why help?",
      icon: "CircleHelp",
      tone: "accent",
      at: "why",
      items: [
        { icon: "Briefcase", label: "More jobs", at: "w1" },
        { icon: "Scale", label: "More competition & choice", at: "w2" },
        { icon: "TrendingUp", label: "Innovation & growth", at: "w3" },
      ],
    },
    right: {
      title: "How?",
      icon: "Wrench",
      tone: "neutral",
      at: "how",
      items: [
        { icon: "Banknote", label: "Grants & cheap loans", at: "h1" },
        { icon: "GraduationCap", label: "Advice & training", at: "h2" },
        { icon: "Building", label: "Cheap premises", at: "h3" },
        { icon: "Percent", label: "Lower taxes", at: "h4" },
      ],
    },
  },
  {
    id: "measure-size",
    kind: "grid",
    chapter: 3,
    heading: "Measuring the size of a business",
    lines: [
      {
        id: "intro",
        text: "As businesses grow, how do we measure how big they are? There are three main methods, and each one has a limitation.",
      },
      {
        id: "employees",
        text: "First, the number of employees. It's simple, but it can be misleading: a highly automated business can produce a huge amount, with very few workers.",
      },
      {
        id: "output",
        text: "Second, the value of output, or sales. But this depends on what's being sold: a firm selling a few very expensive products could look bigger than one selling lots of cheap ones.",
      },
      {
        id: "capital",
        text: "Third, capital employed: the total value of money invested in the business. But a business that uses lots of workers, rather than machines, may look small, even if it employs thousands.",
      },
      { id: "both", text: "That's why it's best to compare businesses using more than one method." },
    ],
    sub: { text: "Each method has a limitation, so use more than one", at: "both" },
    columns: 3,
    items: [
      { icon: "Users", label: "Number of employees", sub: "But automated firms need few workers", at: "employees" },
      { icon: "Banknote", label: "Value of output", sub: "But depends on the price of products", at: "output" },
      { icon: "Factory", label: "Capital employed", sub: "But labour-intensive firms look small", at: "capital" },
    ],
  },
  {
    id: "profit-trap",
    kind: "tip",
    chapter: 3,
    eyebrow: "Exam trap",
    big: "Profit ≠ size",
    text: "Profit shows how well a business is doing — not how big it is.",
    at: "rule",
    lines: [
      { text: "Here's a classic exam trap." },
      {
        id: "rule",
        text: "Profit is not a measure of business size. A small business can be very profitable, and a huge business can make a loss. Profit tells you how well a business is doing, not how big it is.",
      },
    ],
  },
  {
    id: "why-grow",
    kind: "grid",
    chapter: 3,
    heading: "Why do businesses want to grow?",
    lines: [
      { text: "Why do owners want their businesses to grow?" },
      { id: "profit", text: "Bigger businesses can earn higher profits." },
      {
        id: "eos",
        text: "They can benefit from economies of scale, which means lower average costs, for example, by buying materials in bulk at a discount.",
      },
      { id: "share", text: "They gain a larger market share, and more power over their suppliers." },
      { id: "security", text: "And they are more secure: larger businesses are less likely to fail, or to be taken over." },
    ],
    columns: 4,
    items: [
      { icon: "TrendingUp", label: "Higher profits", at: "profit" },
      { icon: "Coins", label: "Economies of scale", sub: "Lower average costs", at: "eos" },
      { icon: "ChartPie", label: "Bigger market share", at: "share" },
      { icon: "ShieldCheck", label: "More security", sub: "Less risk of failure", at: "security" },
    ],
  },
  {
    id: "growth-ways",
    kind: "split",
    chapter: 3,
    heading: "Two ways to grow",
    lines: [
      { text: "There are two ways for a business to grow." },
      {
        id: "internal",
        text: "Internal growth, also called organic growth, is when a business expands its own operations. It might open new branches, launch new products, or start selling in new countries.",
      },
      { id: "ieval", text: "Internal growth is usually slow, but it's less risky, and the owners keep control." },
      { id: "external", text: "External growth is much faster. It happens through mergers and takeovers." },
      { id: "merger", text: "A merger is when two businesses agree to join together, to form one new business." },
      {
        id: "takeover",
        text: "A takeover, or acquisition, is when one business buys enough shares to take control of another.",
      },
    ],
    left: {
      title: "Internal growth",
      sub: "Also called organic growth",
      icon: "Sprout",
      tone: "accent",
      at: "internal",
      items: [
        { icon: "Store", label: "New branches or outlets" },
        { icon: "Package", label: "New products" },
        { icon: "Globe", label: "New markets & countries" },
        { icon: "Clock", label: "Slower, but lower risk", at: "ieval" },
      ],
    },
    right: {
      title: "External growth",
      sub: "Faster: joining with other firms",
      icon: "GitMerge",
      tone: "neutral",
      at: "external",
      items: [
        { icon: "Handshake", label: "Merger: two firms agree to join", at: "merger" },
        { icon: "Crown", label: "Takeover: one firm buys control", at: "takeover" },
      ],
    },
  },
  {
    id: "mergers",
    kind: "mergers",
    chapter: 3,
    heading: "Types of merger & takeover",
    lines: [
      {
        id: "intro",
        text: "There are three main types of merger, or takeover. To understand them, imagine a chocolate company, and its chain of production.",
      },
      {
        id: "horizontal",
        text: "A horizontal merger is between two businesses in the same industry, at the same stage of production. For example, our chocolate maker joins with another chocolate maker. This reduces competition, and increases market share.",
      },
      {
        id: "backward",
        text: "A vertical merger is between businesses at different stages of the same chain. If our chocolate maker buys a cocoa farm, that's backward vertical integration. It secures the supply of raw materials, and helps control their cost and quality.",
      },
      {
        id: "forward",
        text: "If it buys a chain of sweet shops, that's forward vertical integration. It guarantees an outlet for its products, and brings it closer to its customers.",
      },
      {
        id: "conglomerate",
        text: "Finally, a conglomerate merger is between businesses in completely different industries, like our chocolate maker buying a hotel chain. This is called diversification, and it spreads risk: if chocolate sales fall, the hotels may still do well.",
      },
    ],
  },
  {
    id: "growth-problems",
    kind: "quad",
    chapter: 3,
    heading: "Problems of growth — and solutions",
    lines: [
      { text: "But growth brings its own problems, and good managers find ways to overcome them." },
      {
        id: "control",
        text: "Large businesses are harder to control and coordinate. The solution is to split the business into smaller divisions, each with its own managers.",
      },
      {
        id: "comm",
        text: "Communication gets slower, and messages can get lost. Good IT systems, and a clear structure, can help.",
      },
      {
        id: "finance",
        text: "Expansion needs a lot of money. So careful financial planning, and choosing the right sources of finance, are essential.",
      },
      {
        id: "culture",
        text: "And after a merger, the two businesses may have very different cultures, and workers may worry about losing their jobs. Clear communication, and involving employees in decisions, can reduce these problems.",
      },
    ],
    boxes: [
      { title: "Hard to control", icon: "Network", tone: "neutral", items: ["Split into smaller divisions"], at: "control" },
      { title: "Poor communication", icon: "MessageCircle", tone: "neutral", items: ["Better IT & clear structure"], at: "comm" },
      { title: "Shortage of finance", icon: "Wallet", tone: "neutral", items: ["Plan finance carefully"], at: "finance" },
      { title: "Culture clash after a merger", icon: "Users", tone: "neutral", items: ["Communicate & involve staff"], at: "culture" },
    ],
  },
  {
    id: "stay-small",
    kind: "grid",
    chapter: 3,
    heading: "Why do some businesses stay small?",
    lines: [
      { text: "Not every business wants to grow. Many stay small, and that's perfectly fine." },
      {
        id: "type",
        text: "Some industries suit small firms, because customers want a personal service, like hairdressers, plumbers, or accountants.",
      },
      {
        id: "market",
        text: "Some businesses sell to a small market, such as a village shop, or a luxury product with only a few buyers.",
      },
      {
        id: "owner",
        text: "Many owners simply want to stay small. They prefer to keep control, avoid the stress of running a big business, and enjoy a good work-life balance.",
      },
      { id: "finance", text: "And some businesses just don't have the finance needed to grow." },
    ],
    columns: 4,
    items: [
      { icon: "Scissors", label: "Personal services", sub: "Hairdressers, plumbers", at: "type" },
      { icon: "MapPin", label: "Small market", sub: "Local or luxury niche", at: "market" },
      { icon: "Heart", label: "Owner's choice", sub: "Control & less stress", at: "owner" },
      { icon: "PiggyBank", label: "Lack of finance", sub: "Can't fund expansion", at: "finance" },
    ],
  },
  {
    id: "failure",
    kind: "grid",
    chapter: 3,
    heading: "Why do businesses fail?",
    lines: [
      { text: "Sadly, many businesses fail. What are the main causes?" },
      {
        id: "mgmt",
        text: "A lack of management skills: owners without experience may make poor decisions about pricing, stock, or staff.",
      },
      {
        id: "env",
        text: "Changes in the business environment: a new competitor arrives, consumer tastes change, new technology appears, or the economy falls into recession.",
      },
      {
        id: "cash",
        text: "And liquidity problems, which means running out of cash. A business can be selling well, and even making a profit, but if it can't pay its suppliers and workers on time, it may be forced to close.",
      },
      { id: "plan", text: "Other causes include poor planning, and expanding too quickly." },
    ],
    columns: 4,
    items: [
      { icon: "UserX", label: "Poor management", sub: "Lack of skills & experience", at: "mgmt" },
      { icon: "CloudLightning", label: "A changing environment", sub: "Rivals, tastes, recession", at: "env" },
      { icon: "Wallet", label: "Liquidity problems", sub: "Running out of cash", at: "cash" },
      { icon: "TriangleAlert", label: "Poor planning", sub: "Expanding too fast", at: "plan" },
    ],
  },
  {
    id: "new-risk",
    kind: "grid",
    chapter: 3,
    heading: "Why are new businesses at greater risk?",
    lines: [
      { text: "New businesses are at an especially high risk of failure. Why?" },
      { id: "exp", text: "Their owners often have little experience of running a business." },
      { id: "cust", text: "They have few customers, and nobody knows their brand yet." },
      { id: "cash", text: "They have limited finance, and no cash reserves to fall back on." },
      {
        id: "comp",
        text: "And they face tough competition from established firms, which already have loyal customers, and lower costs.",
      },
    ],
    columns: 4,
    items: [
      { icon: "GraduationCap", label: "Little experience", at: "exp" },
      { icon: "Users", label: "Few customers", sub: "Unknown brand", at: "cust" },
      { icon: "PiggyBank", label: "Limited finance", sub: "No cash reserves", at: "cash" },
      { icon: "Swords", label: "Strong competition", sub: "From established firms", at: "comp" },
    ],
  },

  // ─────────────────── CHAPTER 4 · TYPES OF BUSINESS ORGANISATION ───────────────────
  {
    id: "ch4",
    kind: "chapter",
    chapter: 4,
    num: 4,
    code: "1.4",
    title: "Types of Business Organisation",
    subtitle: "Who owns it, who controls it, who takes the risk?",
    lines: [
      {
        text: "Chapter four. Types of business organisation. When someone starts a business, one of the first decisions is which legal form it should take.",
      },
    ],
  },
  {
    id: "liability",
    kind: "split",
    chapter: 4,
    heading: "The key idea: liability",
    lines: [
      { text: "To understand the different types, you need one key idea first: liability." },
      {
        id: "unlimited",
        text: "Unlimited liability means the owners are personally responsible for all the debts of the business. If the business can't pay, the owners may have to sell their own possessions, like their car, or even their house.",
      },
      {
        id: "limited",
        text: "Limited liability means the owners can only lose the money they invested in the business. Their personal possessions are safe.",
      },
      {
        id: "incorporated",
        text: "Businesses with limited liability are called limited companies, or incorporated businesses. They have a separate legal identity from their owners, so the company itself can own property, sign contracts, sue, and be sued.",
      },
    ],
    left: {
      title: "Unlimited liability",
      sub: "Owners are personally responsible for all debts",
      icon: "LockOpen",
      tone: "bad",
      at: "unlimited",
      items: [
        { icon: "House", label: "House at risk" },
        { icon: "Car", label: "Car at risk" },
        { icon: "PiggyBank", label: "Savings at risk" },
      ],
    },
    right: {
      title: "Limited liability",
      sub: "Owners can only lose what they invested",
      icon: "Lock",
      tone: "good",
      at: "limited",
      items: [
        { icon: "ShieldCheck", label: "Personal possessions safe" },
        { icon: "Building2", label: "Separate legal identity", at: "incorporated" },
        { icon: "FileSignature", label: "Company can sue & be sued", at: "incorporated" },
      ],
    },
    banner: { text: "Limited liability = incorporated business", at: "incorporated" },
  },
  {
    id: "sole-trader",
    kind: "profile",
    chapter: 4,
    icon: "User",
    title: "Sole trader",
    tags: ["1 owner", "Unlimited liability", "Unincorporated"],
    def: "A business owned and controlled by one person, who may employ others.",
    atDef: "def",
    lines: [
      {
        id: "def",
        text: "Let's start with the simplest. A sole trader is a business owned and controlled by just one person, although it can still employ other workers. Many small shops, hairdressers, and plumbers are sole traders.",
      },
      {
        id: "pros",
        text: "Sole traders are easy and cheap to set up, with very few legal formalities. The owner keeps all of the profit, and has complete control, so decisions can be made quickly.",
      },
      {
        id: "cons",
        text: "But the owner has unlimited liability. Raising capital is difficult, the hours are long, and there's nobody to share the work with. And the business may end if the owner becomes ill or dies, which is called a lack of continuity.",
      },
    ],
    pros: { title: "Advantages", items: ["Easy & cheap to set up", "Keeps all the profit", "Full control, quick decisions"], at: "pros" },
    cons: {
      title: "Disadvantages",
      items: ["Unlimited liability", "Hard to raise capital", "Long hours, no one to share work", "Lack of continuity"],
      at: "cons",
    },
  },
  {
    id: "partnership",
    kind: "profile",
    chapter: 4,
    icon: "Users",
    title: "Partnership",
    tags: ["2 to 20 owners", "Unlimited liability", "Unincorporated"],
    def: "A business owned by two or more people, usually with a partnership agreement.",
    atDef: "def",
    lines: [
      {
        id: "def",
        text: "A partnership is a business owned by two or more people, usually up to twenty. Partners often sign a partnership agreement, which sets out how much capital each partner puts in, how profits are shared, and what happens if a partner leaves.",
      },
      {
        id: "pros",
        text: "Compared with a sole trader, there's more capital available, and partners can share the workload, their skills, and any losses.",
      },
      {
        id: "cons",
        text: "But in most partnerships, the partners still have unlimited liability. Partners can disagree, profits have to be shared, and if a partner leaves or dies, the partnership may have to end.",
      },
    ],
    pros: { title: "Advantages", items: ["More capital than a sole trader", "Shared workload & skills", "Losses are shared"], at: "pros" },
    cons: {
      title: "Disadvantages",
      items: ["Usually unlimited liability", "Partners may disagree", "Profits must be shared", "Lack of continuity"],
      at: "cons",
    },
  },
  {
    id: "shares",
    kind: "definition",
    chapter: 4,
    eyebrow: "Key terms",
    term: "Shares & shareholders",
    def: "A share is a part of the ownership of a company. Shareholders may receive a share of the profits, called a dividend.",
    at: "share",
    icon: "ChartPie",
    lines: [
      { id: "intro", text: "The next two types are limited companies, which are owned by shareholders." },
      {
        id: "share",
        text: "A share is a small part of the ownership of a company. If you own shares, you're a shareholder, and you may receive part of the profits, called a dividend.",
      },
      { id: "board", text: "Shareholders elect a board of directors, to run the company on their behalf." },
    ],
    chips: [
      { icon: "ChartPie", label: "Share = part ownership", at: "share" },
      { icon: "Coins", label: "Dividend = share of profit", at: "share" },
      { icon: "Users", label: "Shareholders elect directors", at: "board" },
    ],
  },
  {
    id: "ltd",
    kind: "profile",
    chapter: 4,
    icon: "Building",
    title: "Private limited company (Ltd)",
    tags: ["Shares sold privately", "Limited liability", "Incorporated"],
    def: "A company whose shares are sold privately, to people the owners choose.",
    atDef: "def",
    lines: [
      {
        id: "def",
        text: "A private limited company, shown by the letters Ltd after its name, sells shares privately, to people the owners choose, such as family and friends. Its shares cannot be sold to the general public.",
        say: "A private limited company, shown by the letters L, T, D, after its name, sells shares privately, to people the owners choose, such as family and friends. Its shares cannot be sold to the general public.",
      },
      {
        id: "pros",
        text: "Shareholders have limited liability. The company has a separate legal identity, and continuity, so it carries on even if a shareholder dies. It can raise more capital than a partnership, and the original owners keep control.",
      },
      {
        id: "cons",
        text: "But there are more legal formalities to set it up. The accounts must be published, so there's less privacy. And the amount of capital is still limited, because shares can't be sold to the public.",
      },
    ],
    pros: {
      title: "Advantages",
      items: ["Limited liability", "Separate legal identity & continuity", "More capital than a partnership", "Owners keep control"],
      at: "pros",
    },
    cons: {
      title: "Disadvantages",
      items: ["More legal formalities", "Accounts published: less privacy", "Can't sell shares to the public"],
      at: "cons",
    },
  },
  {
    id: "plc",
    kind: "profile",
    chapter: 4,
    icon: "Building2",
    title: "Public limited company (plc)",
    tags: ["Shares sold to the public", "Limited liability", "Incorporated"],
    def: "A company that can sell its shares to the general public, usually on a stock exchange.",
    atDef: "def",
    lines: [
      {
        id: "def",
        text: "A public limited company, or plc, can sell its shares to the general public, usually through a stock exchange. Most of the world's biggest companies are public limited companies.",
        say: "A public limited company, or P L C, can sell its shares to the general public, usually through a stock exchange. Most of the world's biggest companies are public limited companies.",
      },
      {
        id: "pros",
        text: "This means it can raise huge amounts of capital. Shareholders have limited liability, the company has continuity, and its size makes it easier to borrow money.",
      },
      {
        id: "cons",
        text: "But setting up and running a plc is expensive, with strict legal rules. Its accounts are public, so competitors can see them. Because anyone can buy its shares, it can face a takeover. And there's a separation of ownership and control: shareholders own the company, but directors control it, and they may want different things.",
        say: "But setting up and running a P L C is expensive, with strict legal rules. Its accounts are public, so competitors can see them. Because anyone can buy its shares, it can face a takeover. And there's a separation of ownership and control: shareholders own the company, but directors control it, and they may want different things.",
      },
    ],
    pros: {
      title: "Advantages",
      items: ["Can raise huge amounts of capital", "Limited liability", "Continuity", "Easier to borrow money"],
      at: "pros",
    },
    cons: {
      title: "Disadvantages",
      items: ["Expensive, strict legal rules", "Accounts are public", "Risk of takeover", "Ownership & control separated"],
      at: "cons",
    },
  },
  {
    id: "franchise",
    kind: "franchise",
    chapter: 4,
    heading: "Franchises",
    lines: [
      {
        id: "def",
        text: "A franchise is when a business, called the franchisor, sells the right to use its brand name, products, and way of doing business, to another business, called the franchisee.",
      },
      {
        id: "money",
        text: "The franchisee pays an initial fee, and then a royalty, which is a percentage of its sales, usually every year.",
      },
      {
        id: "support",
        text: "In return, the franchisor provides the brand, training, supplies, and national advertising. Many fast-food restaurants, hotels, and gyms work this way.",
      },
    ],
  },
  {
    id: "franchise-eval",
    kind: "quad",
    chapter: 4,
    heading: "Franchises: both sides",
    lines: [
      {
        id: "frp",
        text: "For the franchisor, it's a fast way to expand without needing much capital, and franchisees work hard, because they've invested their own money.",
      },
      {
        id: "frc",
        text: "The risk is that one badly run franchise could damage the reputation of the whole brand, and profits are shared with the franchisees.",
      },
      {
        id: "fep",
        text: "For the franchisee, the risk of failure is lower, because the brand is already well known, and they receive training and support.",
      },
      {
        id: "fec",
        text: "But they pay fees and royalties, must follow strict rules, and have little freedom to make their own decisions.",
      },
    ],
    boxes: [
      { title: "Franchisor: advantages", icon: "Crown", tone: "good", items: ["Fast expansion, little capital", "Motivated franchisees"], at: "frp" },
      { title: "Franchisor: disadvantages", icon: "Crown", tone: "bad", items: ["Reputation risk", "Profits shared"], at: "frc" },
      { title: "Franchisee: advantages", icon: "Store", tone: "good", items: ["Known brand: lower risk", "Training & support"], at: "fep" },
      { title: "Franchisee: disadvantages", icon: "Store", tone: "bad", items: ["Fees & royalties", "Strict rules, less freedom"], at: "fec" },
    ],
  },
  {
    id: "joint-venture",
    kind: "venn",
    chapter: 4,
    heading: "Joint ventures",
    a: "Business A",
    b: "Business B",
    middle: "Joint venture",
    atDef: "def",
    lines: [
      {
        id: "def",
        text: "A joint venture is when two or more businesses agree to work together on a particular project, creating a separate business unit, and sharing its costs, risks, and profits.",
      },
      {
        id: "ex",
        text: "For example, a foreign car maker might team up with a local company to enter a new country, using the local company's knowledge of that market.",
      },
      { id: "pros", text: "Joint ventures share costs and risks, and combine the expertise of both partners." },
      {
        id: "cons",
        text: "But the profits must be shared, and the partners may disagree, especially if they have different ways of working.",
      },
    ],
    example: { text: "e.g. a foreign car maker + a local company entering a new market", at: "ex" },
    pros: { items: ["Shared costs & risks", "Combined expertise"], at: "pros" },
    cons: { items: ["Shared profits", "Possible disagreements"], at: "cons" },
  },
  {
    id: "public-corp",
    kind: "profile",
    chapter: 4,
    icon: "Landmark",
    title: "Public corporation",
    tags: ["Owned by the government", "Public sector", "Run for the public"],
    def: "A business owned and controlled by the government, on behalf of the public.",
    atDef: "def",
    lines: [
      {
        id: "def",
        text: "Finally, back to the public sector. A public corporation is a business owned and controlled by the government, on behalf of the public. Examples can include national railways, postal services, state broadcasters, and water companies.",
      },
      {
        id: "pros",
        text: "Its main aim is usually to provide an essential service at an affordable price, and to protect jobs, rather than simply to make a profit.",
      },
      {
        id: "cons",
        text: "However, because the government will often cover its losses, there may be less incentive to be efficient, and it can become a burden on taxpayers.",
      },
    ],
    pros: { title: "Aims & benefits", items: ["Essential services provided", "Affordable prices", "Jobs protected"], at: "pros" },
    cons: { title: "Drawbacks", items: ["Less incentive to be efficient", "Losses paid by taxpayers"], at: "cons" },
  },
  {
    id: "org-table",
    kind: "table",
    chapter: 4,
    heading: "Comparing business organisations",
    lines: [
      { text: "Let's put the main types side by side." },
      { id: "r1", text: "Sole traders have one owner, unlimited liability, and limited capital." },
      { id: "r2", text: "Partnerships have more owners and more capital, but still unlimited liability." },
      {
        id: "r3",
        text: "Private limited companies give limited liability and continuity, with shares sold privately.",
      },
      {
        id: "r4",
        text: "And public limited companies can raise the most capital of all, by selling shares to the public.",
      },
      {
        id: "choose",
        text: "In an exam, the best type of organisation depends on how much capital is needed, how much risk the owners will accept, and how much control they want to keep.",
      },
    ],
    columns: ["Type", "Owners", "Liability", "Capital", "Continuity"],
    rows: [
      { cells: ["Sole trader", "1", "Unlimited", "Low", "No"], at: "r1" },
      { cells: ["Partnership", "2 – 20", "Unlimited", "Medium", "No"], at: "r2" },
      { cells: ["Private limited (Ltd)", "Shareholders", "Limited", "High", "Yes"], at: "r3" },
      { cells: ["Public limited (plc)", "Shareholders", "Limited", "Very high", "Yes"], at: "r4" },
    ],
    footer: { text: "Best choice depends on capital needed, risk & control", at: "choose" },
  },

  // ─────────────────── CHAPTER 5 · OBJECTIVES & STAKEHOLDERS ───────────────────
  {
    id: "ch5",
    kind: "chapter",
    chapter: 5,
    num: 5,
    code: "1.5",
    title: "Objectives & Stakeholders",
    subtitle: "What businesses aim for, and who cares",
    lines: [
      {
        text: "Chapter five. Business objectives and stakeholders. Every business needs to know where it's going, and who it answers to.",
      },
    ],
  },
  {
    id: "objectives-why",
    kind: "grid",
    chapter: 5,
    heading: "Why set business objectives?",
    lines: [
      { id: "def", text: "Business objectives are the aims, or targets, that a business works towards." },
      { id: "direction", text: "They give the business a clear direction and focus." },
      { id: "motivate", text: "They motivate employees, who know exactly what they're working towards." },
      { id: "measure", text: "They make it possible to measure success, by comparing actual performance with the target." },
      { id: "decide", text: "And they guide decision-making, helping managers choose between different options." },
    ],
    sub: { text: "Objectives = the aims or targets a business works towards", at: "def" },
    columns: 4,
    items: [
      { icon: "Compass", label: "Direction & focus", at: "direction" },
      { icon: "Flame", label: "Motivate employees", at: "motivate" },
      { icon: "Gauge", label: "Measure performance", at: "measure" },
      { icon: "Signpost", label: "Guide decisions", at: "decide" },
    ],
  },
  {
    id: "smart",
    kind: "acronym",
    chapter: 5,
    heading: "Good objectives are SMART",
    at: "letters",
    lines: [
      {
        id: "letters",
        text: "The best objectives are SMART: specific, measurable, achievable, realistic, and time-bound.",
      },
      {
        id: "ex",
        text: "For example: increase sales by 10% within the next 12 months. It's specific, measurable, realistic, and it has a deadline.",
        say: "For example: increase sales by ten percent within the next twelve months. It's specific, measurable, realistic, and it has a deadline.",
      },
    ],
    letters: [
      { letter: "S", word: "Specific" },
      { letter: "M", word: "Measurable" },
      { letter: "A", word: "Achievable" },
      { letter: "R", word: "Realistic" },
      { letter: "T", word: "Time-bound" },
    ],
    example: { text: "“Increase sales by 10% within the next 12 months”", at: "ex" },
  },
  {
    id: "objective-types",
    kind: "grid",
    chapter: 5,
    heading: "Common business objectives",
    lines: [
      { text: "So what objectives do businesses set? Here are the four big ones." },
      {
        id: "survival",
        text: "Survival: simply staying in business. This is the main objective for new businesses, and for any business during a recession, or when a powerful new competitor arrives.",
      },
      { id: "profit", text: "Profit: the reward for the owners, and a source of money to reinvest in the business." },
      {
        id: "growth",
        text: "Growth: increasing the size of the business, for example in sales, or the number of outlets, which can bring economies of scale, and more security.",
      },
      {
        id: "share",
        text: "And market share: the percentage of total market sales made by one business. A high market share gives a business status, and more power over suppliers and retailers.",
      },
      {
        id: "change",
        text: "Objectives also change over time. A brand new business may focus on survival, but once it's established, it may aim for growth, profit, or market share.",
      },
    ],
    columns: 4,
    items: [
      { icon: "LifeBuoy", label: "Survival", sub: "Staying in business", at: "survival" },
      { icon: "Coins", label: "Profit", sub: "Reward & reinvestment", at: "profit" },
      { icon: "TrendingUp", label: "Growth", sub: "A bigger business", at: "growth" },
      { icon: "ChartPie", label: "Market share", sub: "% of total market sales", at: "share" },
    ],
    banner: { text: "Objectives change over time: survival first, then growth & profit", at: "change" },
  },
  {
    id: "market-share",
    kind: "marketshare",
    chapter: 5,
    lines: [
      {
        id: "formula",
        text: "Market share is calculated as the firm's sales, divided by the total sales in the market, multiplied by 100.",
        say: "Market share is calculated as the firm's sales, divided by the total sales in the market, multiplied by one hundred.",
      },
      {
        id: "ex",
        text: "So if a business sells $2 million worth of trainers, in a market worth $10 million,",
        say: "So if a business sells two million dollars' worth of trainers, in a market worth ten million dollars,",
      },
      { id: "answer", text: "its market share is 20%.", say: "its market share is twenty percent." },
    ],
  },
  {
    id: "social-enterprise",
    kind: "definition",
    chapter: 5,
    eyebrow: "Key term",
    term: "Social enterprise",
    def: "A business with social or environmental objectives, which uses its profits to help people or the planet.",
    at: "def",
    icon: "HeartHandshake",
    lines: [
      {
        id: "def",
        text: "Some businesses have very different priorities. A social enterprise is a business whose main objectives are social, or environmental. It still tries to make a profit, but it uses that profit to help people, or the planet.",
      },
      {
        id: "ex",
        text: "For example, a café that trains and employs homeless people, or a company that sells bottled water, and uses its profits to build wells in communities without clean water.",
      },
      { id: "tbl", text: "Social enterprises often aim for a triple bottom line." },
      { id: "profit", text: "Economic: making a profit." },
      { id: "people", text: "Social: helping people and communities." },
      {
        id: "planet",
        text: "And environmental: protecting the planet. These are often called profit, people, and planet.",
      },
    ],
    chips: [
      { icon: "Coins", label: "Profit", sub: "Economic", at: "profit" },
      { icon: "Users", label: "People", sub: "Social", at: "people" },
      { icon: "Leaf", label: "Planet", sub: "Environmental", at: "planet" },
    ],
  },
  {
    id: "stakeholders",
    kind: "wheel",
    chapter: 5,
    heading: "Stakeholders",
    center: "The business",
    lines: [
      {
        id: "def",
        text: "Every business affects lots of different people. A stakeholder is any person or group with an interest in the activities and performance of a business.",
      },
      {
        id: "internal",
        text: "Internal stakeholders are inside the business: the owners or shareholders, the managers, and the employees.",
      },
      {
        id: "external",
        text: "External stakeholders are outside the business: customers, suppliers, lenders such as banks, the government, and the local community.",
      },
    ],
    def: { text: "Any person or group with an interest in a business", at: "def" },
    inner: {
      label: "Internal",
      at: "internal",
      items: [
        { icon: "Crown", label: "Owners" },
        { icon: "Briefcase", label: "Managers" },
        { icon: "HardHat", label: "Employees" },
      ],
    },
    outer: {
      label: "External",
      at: "external",
      items: [
        { icon: "ShoppingCart", label: "Customers" },
        { icon: "Truck", label: "Suppliers" },
        { icon: "Landmark", label: "Lenders" },
        { icon: "Scale", label: "Government" },
        { icon: "House", label: "Community" },
      ],
    },
  },
  {
    id: "stakeholder-aims",
    kind: "grid",
    chapter: 5,
    heading: "What does each stakeholder want?",
    lines: [
      { text: "Each stakeholder group wants something different from the business." },
      { id: "owners", text: "Owners and shareholders want high profits, dividends, and a rising share price." },
      { id: "managers", text: "Managers want good salaries, power and status, and job security." },
      {
        id: "employees",
        text: "Employees want fair pay, good working conditions, job security, and opportunities for training.",
      },
      { id: "customers", text: "Customers want good-quality products, at reasonable prices, with good service." },
      { id: "suppliers", text: "Suppliers want regular orders, and to be paid on time." },
      { id: "lenders", text: "Banks and other lenders want their loans repaid on time, with interest." },
      { id: "government", text: "The government wants the business to create jobs, pay its taxes, and obey the law." },
      {
        id: "community",
        text: "And the local community wants jobs for local people, with little pollution, and a safe environment.",
      },
    ],
    columns: 4,
    items: [
      { icon: "Crown", label: "Owners", sub: "Profit & dividends", at: "owners" },
      { icon: "Briefcase", label: "Managers", sub: "Salary, status, security", at: "managers" },
      { icon: "HardHat", label: "Employees", sub: "Fair pay & job security", at: "employees" },
      { icon: "ShoppingCart", label: "Customers", sub: "Quality at fair prices", at: "customers" },
      { icon: "Truck", label: "Suppliers", sub: "Regular orders, paid on time", at: "suppliers" },
      { icon: "Landmark", label: "Lenders", sub: "Repayment with interest", at: "lenders" },
      { icon: "Scale", label: "Government", sub: "Jobs, taxes, obey laws", at: "government" },
      { icon: "House", label: "Community", sub: "Jobs, low pollution", at: "community" },
    ],
  },
  {
    id: "conflict",
    kind: "conflict",
    chapter: 5,
    heading: "When stakeholder objectives conflict",
    lines: [
      { text: "Here's the problem: these objectives often conflict." },
      {
        id: "c1",
        text: "Shareholders want higher profits. One way to achieve that is to cut costs, perhaps by replacing workers with machines. That's good for shareholders, but bad for employees, who want job security.",
      },
      {
        id: "c2",
        text: "Or imagine a business that wants to build a new factory. The government is pleased about the new jobs, but local residents may be unhappy about the extra noise, traffic, and pollution.",
      },
      { id: "c3", text: "And customers want low prices, while owners want high profits." },
      {
        id: "resolve",
        text: "A business can't keep everyone happy all the time. It has to prioritise, and find a compromise.",
      },
    ],
    rows: [
      {
        a: { icon: "Crown", who: "Shareholders", wants: "Higher profits" },
        b: { icon: "HardHat", who: "Employees", wants: "Job security" },
        at: "c1",
      },
      {
        a: { icon: "Scale", who: "Government", wants: "New jobs" },
        b: { icon: "House", who: "Local residents", wants: "Less pollution" },
        at: "c2",
      },
      {
        a: { icon: "ShoppingCart", who: "Customers", wants: "Low prices" },
        b: { icon: "Coins", who: "Owners", wants: "High profits" },
        at: "c3",
      },
    ],
    footer: { text: "Businesses must prioritise and compromise", at: "resolve" },
  },
  {
    id: "sector-objectives",
    kind: "split",
    chapter: 5,
    heading: "Private vs public sector objectives",
    lines: [
      { text: "Finally, objectives depend on which sector an organisation is in." },
      { id: "private", text: "Private sector businesses usually aim for survival, profit, growth, and market share." },
      {
        id: "public",
        text: "Public sector organisations usually aim to provide a good service to the public, keep prices affordable so that everyone can use the service, protect jobs, and stay within the budget set by the government.",
      },
    ],
    left: {
      title: "Private sector",
      icon: "Briefcase",
      tone: "accent",
      at: "private",
      items: [
        { icon: "LifeBuoy", label: "Survival" },
        { icon: "Coins", label: "Profit" },
        { icon: "TrendingUp", label: "Growth" },
        { icon: "ChartPie", label: "Market share" },
      ],
    },
    right: {
      title: "Public sector",
      icon: "Landmark",
      tone: "neutral",
      at: "public",
      items: [
        { icon: "HeartHandshake", label: "Service to the public" },
        { icon: "Tag", label: "Affordable prices for all" },
        { icon: "Briefcase", label: "Protect jobs" },
        { icon: "Receipt", label: "Stay within budget" },
      ],
    },
  },

  // ───────────────────────────── SUMMARY ─────────────────────────────
  {
    id: "recap",
    kind: "recap",
    chapter: 6,
    heading: "Unit 1 in five sentences",
    lines: [
      { text: "Let's bring it all together." },
      {
        id: "r1",
        text: "Businesses exist to satisfy needs and wants, by combining scarce resources, and they succeed by adding value.",
      },
      {
        id: "r2",
        text: "They are classified into the primary, secondary, and tertiary sectors, and into the private and public sectors.",
      },
      {
        id: "r3",
        text: "Entrepreneurs start them. They grow internally or externally, and they can fail if they run out of cash, or fail to adapt.",
      },
      {
        id: "r4",
        text: "They take different legal forms, from sole traders to public limited companies, each with its own balance of risk, capital, and control.",
      },
      { id: "r5", text: "And they set objectives, while balancing the conflicting interests of their stakeholders." },
    ],
    items: [
      { num: "1.1", text: "Businesses satisfy needs & wants and add value", at: "r1" },
      { num: "1.2", text: "Primary, secondary & tertiary · private & public", at: "r2" },
      { num: "1.3", text: "Entrepreneurs start them; they grow — or fail", at: "r3" },
      { num: "1.4", text: "Sole trader → plc: a trade-off of risk, capital & control", at: "r4" },
      { num: "1.5", text: "Objectives & the stakeholders who care about them", at: "r5" },
    ],
  },
  {
    id: "exam-tips",
    kind: "grid",
    chapter: 6,
    heading: "Three exam tips",
    lines: [
      { text: "Before you go, here are three exam tips." },
      {
        id: "t1",
        text: "One: learn your definitions word for word. Terms like added value, opportunity cost, and limited liability are easy marks.",
      },
      {
        id: "t2",
        text: "Two: always apply your answer to the business in the question. Use its name, its products, and its situation, not just general points.",
      },
      {
        id: "t3",
        text: "And three: when a question asks you to evaluate, or discuss, look at both sides, and finish with a clear, justified conclusion.",
      },
    ],
    columns: 3,
    items: [
      { icon: "BookOpen", label: "Learn definitions", sub: "Precise wording = easy marks", at: "t1" },
      { icon: "Target", label: "Apply to the case", sub: "Use the business in the question", at: "t2" },
      { icon: "Scale", label: "Evaluate", sub: "Both sides + justified conclusion", at: "t3" },
    ],
  },
  {
    id: "end",
    kind: "end",
    chapter: 6,
    title: "Unit 1 complete",
    sub: "Understanding Business Activity",
    lines: [
      {
        text: "That's Unit 1: Understanding Business Activity. You now have the foundation for everything else in IGCSE Business. Good luck, and keep learning.",
        say: "That's Unit One: Understanding Business Activity. You now have the foundation for everything else in I G C S E Business. Good luck, and keep learning.",
      },
    ],
  },
];
