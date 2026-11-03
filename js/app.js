(() => {
  const SUBJECTS = {
    maths: { name: "Mathematics", code: "0580", color: "var(--maths)", sub: "Algebra, geometry and graphs: the language the other two subjects are written in.",
      units: [[1, "Number"], [2, "Algebra and graphs"], [3, "Coordinate geometry"], [4, "Geometry"], [5, "Mensuration"], [6, "Trigonometry"], [7, "Transformations and vectors"], [8, "Probability"], [9, "Statistics"]] },
    physics: { name: "Physics", code: "0625", color: "var(--physics)", sub: "Forces, energy and waves: how the universe moves.",
      units: [[1, "Motion, forces and energy"], [2, "Thermal physics"], [3, "Waves"], [4, "Electricity and magnetism"], [5, "Nuclear physics"], [6, "Space physics"]] },
    chemistry: { name: "Chemistry", code: "0620", color: "var(--chem)", sub: "Atoms, bonds and reactions: what everything is made of.",
      units: [[1, "States of matter"], [2, "Atoms, elements and compounds"], [3, "Stoichiometry"], [4, "Electrochemistry"], [5, "Chemical energetics"], [6, "Chemical reactions"], [7, "Acids, bases and salts"], [8, "The Periodic Table"], [9, "Metals"], [10, "Chemistry of the environment"], [11, "Organic chemistry"], [12, "Experimental techniques and chemical analysis"]] },
    french: { name: "French", code: "0520", color: "var(--french)", sub: "Vocabulary, grammar and everyday conversation: a language you can actually use.",
      units: [[1, "Greetings, numbers & introductions"], [2, "Family, home & descriptions"], [3, "Daily life, school & hobbies"], [4, "Food, shopping & town"], [5, "Travel, holidays & weather"], [6, "Grammar essentials: verbs & tenses"]] }
  };
  // keep topics in syllabus order: subject, then unit, then load order
  { const ord = Object.keys(SUBJECTS); TOPICS.forEach((t, i) => t._i = i); TOPICS.sort((a, b) => ord.indexOf(a.subject) - ord.indexOf(b.subject) || (a.unit || 99) - (b.unit || 99) || a._i - b._i); }
  const app = document.getElementById("app");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let cleanup = [];

  // ---------- storage (best-effort) ----------
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem("astar:" + k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("astar:" + k, JSON.stringify(v)); } catch {} }
  };
  const progress = () => store.get("progress", {}); // {topicId: {read:true, best:0..1}}
  const saveProgress = (id, patch) => { const p = progress(); p[id] = { ...p[id], ...patch }; store.set("progress", p); };

  // ---------- helpers ----------
  const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  // "\$" outside maths is a currency sign: wrap it so auto-render leaves it alone (inside $…$ it stays as KaTeX's \$)
  const currency = (node) => {
    const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT), hits = [];
    while (w.nextNode()) if (w.currentNode.nodeValue.includes("\\$") && !w.currentNode.parentElement.closest(".katex,.nomath,textarea,script,svg")) hits.push(w.currentNode);
    hits.forEach(n => { const v = n.nodeValue, frag = document.createDocumentFragment(); let inMath = false, buf = "";
      for (let i = 0; i < v.length; i++) {
        if (v[i] === "\\" && v[i + 1] === "$") { if (inMath) buf += "\\$"; else { frag.append(buf); buf = ""; const sp = document.createElement("span"); sp.className = "nomath"; sp.textContent = "$"; frag.append(sp); } i++; continue; }
        if (v[i] === "$") inMath = !inMath; buf += v[i];
      }
      frag.append(buf); n.replaceWith(frag); });
  };
  const math = (node) => window.renderMathInElement && (currency(node), renderMathInElement(node, {
    delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], ignoredClasses: ["nomath"], throwOnError: false
  }));
  const topic = (id) => TOPICS.find(t => t.id === id);
  const subjColor = (s) => SUBJECTS[s].color;
  function reveal(root) {
    const items = root.querySelectorAll(".reveal");
    if (reduced || !("IntersectionObserver" in window)) { items.forEach(i => i.classList.add("in")); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
    items.forEach((i, n) => { i.style.transitionDelay = Math.min(n % 6, 5) * 60 + "ms"; io.observe(i); });
    cleanup.push(() => io.disconnect());
  }
  function ring(pct, color) {
    const r = 16, c = 2 * Math.PI * r;
    return `<svg class="ring" viewBox="0 0 40 40" aria-label="${Math.round(pct * 100)}% complete"><circle cx="20" cy="20" r="${r}" stroke="var(--line)"/><circle cx="20" cy="20" r="${r}" stroke="${color}" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-off="${c * (1 - pct)}" transform="rotate(-90 20 20)"/></svg>`;
  }
  function animateRings(root) { requestAnimationFrame(() => root.querySelectorAll(".ring circle[data-off]").forEach(c => c.style.strokeDashoffset = c.dataset.off)); }
  function tilt(root) {
    if (reduced || matchMedia("(hover: none)").matches) return;
    root.querySelectorAll(".tilt").forEach(card => {
      card.addEventListener("pointermove", e => {
        const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        card.style.transform = `perspective(800px) rotateX(${(0.5 - y) * 6}deg) rotateY(${(x - 0.5) * 8}deg) translateY(-3px)`;
        card.style.setProperty("--mx", x * 100 + "%"); card.style.setProperty("--my", y * 100 + "%");
      });
      card.addEventListener("pointerleave", () => card.style.transform = "");
    });
  }
  function confetti(x, y, color) {
    if (reduced) return;
    const cv = document.createElement("canvas"); cv.className = "confetti"; document.body.appendChild(cv);
    const dpr = Math.min(devicePixelRatio || 1, 2); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
    const cols = [color, getComputedStyle(document.documentElement).getPropertyValue("--maths"), getComputedStyle(document.documentElement).getPropertyValue("--physics"), getComputedStyle(document.documentElement).getPropertyValue("--chem"), getComputedStyle(document.documentElement).getPropertyValue("--french")];
    const bits = Array.from({ length: 70 }, () => ({ x, y, vx: (Math.random() - .5) * 9, vy: -Math.random() * 9 - 3, r: Math.random() * 6, s: 4 + Math.random() * 5, c: cols[Math.floor(Math.random() * cols.length)] }));
    let f = 0;
    (function step() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      bits.forEach(b => { b.vy += .32; b.x += b.vx; b.y += b.vy; b.r += .15; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c; ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); ctx.restore(); });
      if (++f < 90) requestAnimationFrame(step); else cv.remove();
    })();
  }

  // ---------- animated hero background ----------
  function heroCanvas(host) {
    const cv = document.createElement("canvas"); cv.className = "hero-canvas"; host.prepend(cv);
    const ctx = cv.getContext("2d");
    const glyphs = ["F = ma", "v = fλ", "x = −b ± √Δ / 2a", "n = m / Mr", "V = IR", "sin θ", "E = mc²", "p = mv", "a² + b² = c²", "6.02×10²³", "y = mx + c", "ΔH", "λ", "π", "∫", "Σ", "bonjour", "je suis", "il/elle", "passé composé"];
    let W, H, items, mouse = { x: .5, y: .5 }, id;
    const fit = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2); W = host.clientWidth; H = host.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      items = glyphs.map((g, i) => ({ g, x: Math.random() * W, y: Math.random() * H, z: .3 + Math.random() * .7, sp: 6 + Math.random() * 10, ph: Math.random() * 7 }));
    };
    fit(); addEventListener("resize", fit);
    const mm = e => { mouse.x = e.clientX / innerWidth; mouse.y = e.clientY / innerHeight; }; addEventListener("pointermove", mm);
    const cs = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    const draw = (ms) => {
      const t = ms / 1000; ctx.clearRect(0, 0, W, H);
      const ink = cs("--muted"), cols = [cs("--maths"), cs("--physics"), cs("--chem"), cs("--french")];
      // drifting formulas with parallax
      items.forEach((it, i) => {
        const y = ((it.y - t * it.sp * it.z) % (H + 40) + H + 40) % (H + 40) - 20;
        const x = it.x + Math.sin(t * .4 + it.ph) * 12 + (mouse.x - .5) * 40 * it.z;
        ctx.globalAlpha = (W > 760 ? 1 : .55) * (.10 + it.z * .16); ctx.fillStyle = i % 4 === 0 ? cols[i % 3] : ink;
        ctx.font = `${it.z > .7 ? "italic " : ""}${12 + it.z * 14}px Fraunces, Georgia, serif`; ctx.fillText(it.g, x, y);
      });
      ctx.globalAlpha = 1;
      // orbiting atom on the right
      const wide = W > 760, cx = (wide ? W * .78 : W * .5) + (mouse.x - .5) * 18, cy = (wide ? H * .5 : 92) + (mouse.y - .5) * 18, R = wide ? Math.min(W, H) * .3 : Math.min(W * .36, 120);
      for (let k = 0; k < 3; k++) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(k * Math.PI / 3 + t * .05);
        ctx.strokeStyle = cols[k]; ctx.globalAlpha = .35; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(0, 0, R, R * .36, 0, 0, 7); ctx.stroke();
        const a = t * (0.9 + k * .25) + k * 2; ctx.globalAlpha = 1;
        ctx.shadowColor = cols[k]; ctx.shadowBlur = 18; ctx.fillStyle = cols[k];
        ctx.beginPath(); ctx.arc(R * Math.cos(a), R * .36 * Math.sin(a), 6, 0, 7); ctx.fill(); ctx.restore();
      }
      const pulse = 1 + Math.sin(t * 2) * .06;
      ctx.shadowColor = cs("--ink"); ctx.shadowBlur = 24; ctx.fillStyle = cs("--ink");
      ctx.beginPath(); ctx.arc(cx, cy, 11 * pulse, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      // sine wave baseline
      ctx.strokeStyle = cols[0]; ctx.globalAlpha = .25; ctx.lineWidth = 2; ctx.beginPath();
      for (let x = 0; x <= W; x += 4) { const y = H - 30 + Math.sin(x / 60 - t * 1.4) * 10 * Math.sin(x / W * Math.PI); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke(); ctx.globalAlpha = 1;
      if (!reduced) id = requestAnimationFrame(draw);
    };
    id = requestAnimationFrame(draw);
    cleanup.push(() => { cancelAnimationFrame(id); removeEventListener("resize", fit); removeEventListener("pointermove", mm); });
  }

  // ---------- views ----------
  function home() {
    const p = progress(), total = TOPICS.length;
    const done = TOPICS.filter(t => p[t.id]?.read).length;
    const avg = TOPICS.filter(t => p[t.id]?.best != null);
    const mastery = avg.length ? Math.round(avg.reduce((s, t) => s + p[t.id].best, 0) / avg.length * 100) : 0;
    const v = el(`<div>
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow"><span></span>Cambridge IGCSE · Extended</p>
          <h1>Understand it once.<br><em>Ace it</em> forever.</h1>
          <p class="lede">Deep lessons that explain <i>why</i>, live simulations you can play with, real exam-style questions with mark schemes, and spaced flashcards. Maths, Physics and Chemistry, from first principles to A*.</p>
          <div class="hero-cta"><a class="btn big" href="#start">Choose a topic →</a><a class="btn ghost big" href="#/cards">Revise flashcards</a></div>
          <div class="stats">
            <div class="stat"><b data-count="${total}">0</b><span>topics</span></div>
            <div class="stat"><b data-count="${done}">0</b><span>studied</span></div>
            <div class="stat"><b data-count="${mastery}" data-suffix="%">0</b><span>quiz mastery</span></div>
          </div>
        </div>
      </section>
      <div id="start"></div>
      <div class="filters" role="group" aria-label="Filter by subject">
        <button class="chip" aria-pressed="true" data-f="all">All subjects</button>
        ${Object.entries(SUBJECTS).map(([k, s]) => `<button class="chip" aria-pressed="false" data-f="${k}" style="--c:${s.color}"><i class="sw"></i>${s.name}</button>`).join("")}
      </div>
      ${Object.entries(SUBJECTS).map(([k, s]) => `
      <section class="subject" data-subject="${k}" style="--c:${s.color}">
        <div class="subject-head reveal"><span class="code">${s.code}</span><h2>${s.name}</h2><p class="sub">${s.sub}</p></div>
        ${s.units.filter(([n]) => TOPICS.some(t => t.subject === k && t.unit === n)).map(([n, uname]) => `<h3 class="unit-h"><b>Unit ${n}</b>${uname}</h3>
        <div class="grid">
          ${TOPICS.filter(t => t.subject === k && t.unit === n).map((t) => { const i = TOPICS.filter(x => x.subject === k).indexOf(t);
            const tp = p[t.id] || {}, pct = (tp.read ? .5 : 0) + (tp.best != null ? tp.best * .5 : 0);
            return `<a class="card tilt reveal" href="#/topic/${t.id}" style="--c:${s.color}">
              <div class="card-top"><span class="num">${String(i + 1).padStart(2, "0")}</span>${ring(pct, s.color)}</div>
              <h3>${t.title}</h3><p>${t.blurb}</p>
              <div class="tags"><span class="tag">${t.level}</span><span class="tag">${t.quiz.length} questions</span><span class="tag">${t.cards.length} cards</span>${tp.best != null ? `<span class="tag done">Best ${Math.round(tp.best * 100)}%</span>` : ""}</div>
              <span class="go" aria-hidden="true">→</span></a>`;
          }).join("")}
        </div>`).join("")}
      </section>`).join("")}
    </div>`);
    swap(v);
    heroCanvas(v.querySelector(".hero"));
    v.querySelector(".hero-cta a").onclick = (e) => { e.preventDefault(); v.querySelector("#start").scrollIntoView({ behavior: reduced ? "auto" : "smooth" }); };
    v.querySelectorAll("[data-count]").forEach(b => countUp(b, +b.dataset.count, b.dataset.suffix || ""));
    v.querySelector(".filters").onclick = (e) => {
      const b = e.target.closest("[data-f]"); if (!b) return;
      v.querySelectorAll(".filters .chip").forEach(c => c.setAttribute("aria-pressed", c === b));
      v.querySelectorAll(".subject").forEach(s => s.hidden = b.dataset.f !== "all" && s.dataset.subject !== b.dataset.f);
    };
    reveal(v); tilt(v); animateRings(v);
  }
  function countUp(node, to, suffix) {
    if (reduced || !to) { node.textContent = to + suffix; return; }
    const t0 = performance.now(), d = 900;
    const f = (t) => { const k = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - k, 3); node.textContent = Math.round(to * e) + suffix; if (k < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }

  function lesson(id) {
    const t = topic(id); if (!t) return home();
    const s = SUBJECTS[t.subject], color = s.color;
    const idx = TOPICS.filter(x => x.subject === t.subject), pos = idx.indexOf(t), next = idx[pos + 1];
    const toc = [...(t.syllabus ? [["syllabus", "Syllabus checklist"]] : []), ...t.sections.map((x, i) => [`s${i}`, x.h]), ...(t.demo ? [["demo", "Interactive lab"]] : []), ["worked", "Worked examples"], ["formulas", "Key formulae"], ["practice", "Exam practice"], ["cards", "Flashcards"]];
    const v = el(`<div style="--c:${color}">
      <div class="lesson-hero">
        <div class="crumbs"><a href="#/">Topics</a> <span>/</span> <a href="#/" data-subj="${t.subject}">${s.name}</a></div>
        <div class="lesson-head">
          <span class="code">${s.code} · ${t.level}</span>
          <h1>${t.title}</h1><p>${t.blurb}</p>
        </div>
        <div class="readbar" aria-hidden="true"><div></div></div>
      </div>
      <div class="layout">
        <nav class="toc" aria-label="On this page">${toc.map(([h, l], i) => `<a href="#${h}" data-sec="${h}"><span>${String(i + 1).padStart(2, "0")}</span>${l.replace(/\$[^$]*\$/g, "")}</a>`).join("")}</nav>
        <article>
          ${t.syllabus ? `<section id="syllabus" class="reveal"><span class="kicker">What you need to know</span><h2>Syllabus checklist</h2>
            <p class="muted">Every point below is explained in this lesson. Tick each one only when you could explain it to someone else without notes.</p>
            <div class="syl-head"><div class="progress"><div></div></div><b class="syl-count"></b></div>
            <ul class="syl">${t.syllabus.map(([code, text, sec], i) => `<li><label><input type="checkbox" data-i="${i}"><span class="syl-code">${code}</span><span class="syl-text">${text}</span></label><a href="#s${sec}" data-jump="s${sec}">Part ${sec + 1} →</a></li>`).join("")}</ul>
            <p class="syl-note">Paraphrased from the Cambridge IGCSE ${s.code} syllabus. "S" or "E" marks Supplement / Extended content. Check the official syllabus for your exam year.</p></section>` : ""}
          ${t.sections.map((x, i) => `<section id="s${i}" class="reveal"><span class="kicker">Part ${i + 1}</span><h2>${x.h}</h2>${x.body}</section>`).join("")}
          ${t.demo ? `<section id="demo" class="reveal"><span class="kicker">Play with it</span><h2>Interactive lab</h2><p class="muted">Drag the sliders. Everything updates live, and the numbers below the canvas show the working.</p><div class="demo" id="demo-root"></div></section>` : ""}
          <section id="worked" class="reveal"><span class="kicker">See it done</span><h2>Worked examples</h2>
            ${t.worked.map((w, i) => `<div class="worked"><p class="q"><span class="qn">Example ${i + 1}</span>${w.q}</p>
              <ol class="steps">${w.steps.map((st, j) => `<li class="step" ${j ? "hidden" : ""}><span class="n">${j + 1}</span><div>${st}</div></li>`).join("")}</ol>
              ${w.steps.length > 1 ? `<button class="btn ghost small" data-next>Show next step</button>` : ""}</div>`).join("")}
          </section>
          <section id="formulas" class="reveal"><span class="kicker">Memorise</span><h2>Key formulae</h2>
            <div class="formulas">${t.formulas.map(([n, f]) => `<div class="formula"><small>${n}</small>${f}</div>`).join("")}</div></section>
          <section id="practice" class="reveal"><span class="kicker">Test yourself</span><h2>Exam practice</h2>
            <p class="muted">Multiple-choice is marked instantly. For written questions, answer first, then reveal the mark scheme and award yourself the marks you earned, just as an examiner would.</p>
            <div id="quiz"></div></section>
          <section id="cards" class="reveal"><span class="kicker">Lock it in</span><h2>Flashcards</h2><div id="fc"></div></section>
          ${next ? `<a class="next-topic" href="#/topic/${next.id}"><small>Next in ${s.name}</small><b>${next.title} →</b></a>` : `<a class="next-topic" href="#/"><small>Finished ${s.name}</small><b>Back to all topics →</b></a>`}
        </article>
      </div>
    </div>`);
    swap(v);
    v.querySelectorAll("[data-next]").forEach(b => b.onclick = () => {
      const hid = b.parentElement.querySelector(".step[hidden]"); if (hid) { hid.hidden = false; hid.classList.add("pop"); }
      if (!b.parentElement.querySelector(".step[hidden]")) b.remove();
    });
    if (t.demo && DEMOS[t.demo]) cleanup.push(DEMOS[t.demo](v.querySelector("#demo-root"), getComputedStyle(document.documentElement).getPropertyValue("--" + (SUBJECTS[t.subject] ? t.subject === "chemistry" ? "chem" : t.subject : "chem")).trim()));
    v.querySelectorAll(".viz[data-viz]").forEach(h => VIZ[h.dataset.viz] && cleanup.push(VIZ[h.dataset.viz](h)));
    quiz(v.querySelector("#quiz"), { qs: t.quiz, id: t.id, title: t.title });
    if (t.syllabus) {
      const ticks = store.get("syl", {}), boxes = [...v.querySelectorAll(".syl input")];
      const upd = () => { const n = boxes.filter(b => b.checked).length; v.querySelector(".syl-count").textContent = `${n} / ${boxes.length} mastered`; v.querySelector(".syl-head .progress div").style.width = (n / boxes.length * 100) + "%"; };
      boxes.forEach(b => { b.checked = !!ticks[t.id + ":" + b.dataset.i]; b.onchange = () => { const k = store.get("syl", {}); k[t.id + ":" + b.dataset.i] = b.checked; store.set("syl", k); upd(); }; });
      v.querySelectorAll("[data-jump]").forEach(a => a.onclick = (e) => { e.preventDefault(); document.getElementById(a.dataset.jump).scrollIntoView({ behavior: reduced ? "auto" : "smooth" }); });
      upd();
    }
    flashcards(v.querySelector("#fc"), t.cards.map(c => ({ c, t })));
    math(v); reveal(v);
    // TOC + reading progress + mark as read
    const links = [...v.querySelectorAll(".toc a")], bar = v.querySelector(".readbar div");
    v.querySelectorAll(".toc a").forEach(a => a.onclick = (e) => { e.preventDefault(); document.getElementById(a.dataset.sec).scrollIntoView({ behavior: reduced ? "auto" : "smooth" }); });
    const onScroll = () => {
      const art = v.querySelector("article"), r = art.getBoundingClientRect(), k = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
      bar.style.transform = `scaleX(${k})`;
      if (k > .85 && !progress()[t.id]?.read) saveProgress(t.id, { read: true });
      let cur = links[0]; for (const a of links) { const s = document.getElementById(a.dataset.sec); if (s && s.getBoundingClientRect().top < 140) cur = a; }
      links.forEach(a => a.classList.toggle("on", a === cur));
    };
    addEventListener("scroll", onScroll, { passive: true }); onScroll();
    cleanup.push(() => removeEventListener("scroll", onScroll));
  }

  // ---------- question sets ----------
  // opts: { qs, id (progress key or null), diff (show difficulty filter), tag (show source topic), timer (seconds), title }
  const DIFF = { 1: "Easy", 2: "Medium", 3: "Hard" };
  const diffOf = (q) => q.d || (q.marks <= 1 ? 1 : q.marks <= 3 ? 2 : 3);
  function quiz(root, o, st = { type: "all", diff: "all" }) {
    const pool = o.qs, match = (q, s) => (s.type === "all" || q.type === s.type) && (s.diff === "all" || diffOf(q) === +s.diff);
    const qs = pool.filter(q => match(q, st));
    let score = 0, answered = 0; const max = qs.reduce((s, q) => s + q.marks, 0);
    const again = (s) => { root.innerHTML = ""; quiz(root, o, s); math(root); };
    const chips = (key, items) => items.map(([k, l]) => `<button class="chip" aria-pressed="${st[key] === k}" data-${key}="${k}">${l} <span class="n">${pool.filter(q => match(q, { ...st, [key]: k })).length}</span></button>`).join("");
    if (!o.paper) {
      const tabs = el(`<div class="quiz-filters"><div class="filters" role="group" aria-label="Question type">${chips("type", [["all", "All"], ["mcq", "Multiple choice"], ["struct", "Written"]])}</div>
        ${o.diff ? `<div class="filters" role="group" aria-label="Difficulty">${chips("diff", [["all", "Any difficulty"], ["1", "Easy"], ["2", "Medium"], ["3", "Hard"]])}</div>` : ""}</div>`);
      tabs.onclick = (e) => { const b = e.target.closest("[data-type],[data-diff]"); if (!b) return; const k = b.dataset.type ? "type" : "diff", v = b.dataset[k]; if (st[k] === v) return; again({ ...st, [k]: v }); };
      root.appendChild(tabs);
    }
    const head = el(`<div class="scorebar"><div class="progress"><div style="width:0"></div></div><b class="score">0 / ${max}</b>${o.timer ? `<b class="timer" aria-live="off"></b>` : ""}</div>`);
    root.appendChild(head);
    if (o.timer) {
      const end = Date.now() + o.timer * 1000, tEl = head.querySelector(".timer");
      const tick = () => { const s = Math.max(0, Math.round((end - Date.now()) / 1000)); tEl.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; tEl.classList.toggle("late", s < 60); if (s === 0) clearInterval(iv); };
      const iv = setInterval(tick, 1000); tick(); cleanup.push(() => clearInterval(iv));
    }
    if (!qs.length) root.appendChild(el(`<p class="muted">No questions match these filters yet.</p>`));
    const update = () => {
      head.querySelector(".progress div").style.width = (max ? score / max * 100 : 0) + "%";
      head.querySelector(".score").textContent = `${score} / ${max}`;
      if (answered === qs.length && qs.length) {
        if (o.id && st.type === "all" && st.diff === "all") saveProgress(o.id, { best: Math.max(progress()[o.id]?.best ?? 0, score / max) });
        const pct = score / max, msg = pct >= .9 ? "A* territory. Try teaching it to someone to make it permanent." : pct >= .7 ? "Solid. Re-read the parts you dropped marks on, then retry." : "Go back through the lesson sections and worked examples, then have another go. That loop is how the grade moves.";
        const done = el(`<div class="result"><b>${Math.round(pct * 100)}%</b><span>${msg}</span><button class="btn small">Retry</button></div>`);
        done.querySelector("button").onclick = () => o.retry ? o.retry() : again(st);
        root.appendChild(done);
        if (pct >= .9) { const r = done.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top, getComputedStyle(root).getPropertyValue("--c")); }
      }
    };
    qs.forEach((q, qi) => {
      const dq = diffOf(q), src = q._t;
      const card = el(`<div class="qcard"><div class="qmeta">${o.diff ? `<span class="diff d${dq}">${DIFF[dq]}</span>` : ""}${o.tag && src ? `<a class="qsrc" href="#/topic/${src.id}">${src.title}</a>` : ""}<span class="marks">[${q.marks} mark${q.marks > 1 ? "s" : ""}]</span></div><p class="qtext"><b>Q${qi + 1}.</b> ${q.q}</p></div>`);
      if (q.type === "mcq") {
        const opts = el(`<div class="opts">${q.opts.map((op, i) => `<button class="opt"><span class="letter">${"ABCD"[i]}</span><span>${op}</span></button>`).join("")}</div>`);
        card.appendChild(opts);
        opts.querySelectorAll(".opt").forEach((b, i) => b.onclick = (e) => {
          opts.querySelectorAll(".opt").forEach((x, j) => { x.disabled = true; if (j === q.ans) x.classList.add("right"); });
          if (i === q.ans) { score += q.marks; confetti(e.clientX, e.clientY, getComputedStyle(root).getPropertyValue("--c")); } else { b.classList.add("wrong"); card.classList.add("shake"); }
          const ex = el(`<div class="expl"><b>${i === q.ans ? "Correct." : "Not quite."}</b> ${q.why}</div>`); card.appendChild(ex); math(ex);
          answered++; update();
        });
      } else {
        const box = el(`<div><textarea placeholder="Write your full answer here, showing working, before checking…" aria-label="Your answer"></textarea><button class="btn small">Reveal mark scheme</button></div>`);
        card.appendChild(box);
        const revealBtn = box.querySelector("button");
        revealBtn.onclick = () => {
          revealBtn.remove();
          const ms = el(`<div class="ms"><b class="t">Mark scheme</b><div>${q.ms}</div><div class="self"><span>Marks you earned:</span>${Array.from({ length: q.marks + 1 }, (_, i) => `<button class="chip" data-m="${i}">${i}</button>`).join("")}</div></div>`);
          box.appendChild(ms); math(ms);
          ms.querySelectorAll("[data-m]").forEach(b => b.onclick = () => {
            ms.querySelectorAll("[data-m]").forEach(x => { x.disabled = true; x.setAttribute("aria-pressed", x === b); });
            score += +b.dataset.m; answered++; update();
          });
        };
        AI.attachMarker(card, q, (src || o).title, box.querySelector("textarea"), (aw) => {
          if (revealBtn.isConnected) revealBtn.click();
          const chip = box.querySelector(`.ms [data-m="${aw}"]`); if (chip && !chip.disabled) chip.click();
        }, math);
      }
      root.appendChild(card);
    });
  }

  // ---------- exam questions by unit ----------
  const unitTopics = (subj, u) => TOPICS.filter(t => t.subject === subj && t.unit === u);
  const unitQs = (subj, u) => unitTopics(subj, u).flatMap(t => [...(t.exam || []), ...t.quiz].map(q => ({ ...q, _t: t })))
    .sort((a, b) => diffOf(a) - diffOf(b));
  function examHome(subj) {
    subj = SUBJECTS[subj] ? subj : "physics";
    const s = SUBJECTS[subj], p = progress();
    const v = el(`<div style="--c:${s.color}"><div class="page-head"><span class="code">Exam practice</span><h1>Exam questions</h1>
      <p>Every question for a whole syllabus unit in one place, from easy one-markers to hard multi-step problems. Filter by difficulty, get AI marking on written answers, or sit a timed practice paper.</p></div>
      <div class="filters" role="group" aria-label="Subject">${Object.entries(SUBJECTS).map(([k, x]) => `<button class="chip" aria-pressed="${k === subj}" data-s="${k}" style="--c:${x.color}"><i class="sw"></i>${x.name}</button>`).join("")}</div>
      <div class="units">${s.units.map(([n, name]) => {
        const qs = unitQs(subj, n), ts = unitTopics(subj, n), c = [1, 2, 3].map(d => qs.filter(q => diffOf(q) === d).length), best = p["exam:" + subj + n]?.best;
        return qs.length ? `<a class="unit-card reveal" href="#/exam/${subj}/${n}"><span class="code">Unit ${n}</span><h3>${name}</h3>
          <p class="muted">${ts.map(t => t.title).join(" · ")}</p>
          <div class="dbar" aria-label="${c[0]} easy, ${c[1]} medium, ${c[2]} hard">${c.map((k, i) => `<i class="d${i + 1}" style="flex:${k}"></i>`).join("")}</div>
          <div class="tags"><span class="tag">${qs.length} questions</span><span class="tag">${c[0]} easy · ${c[1]} medium · ${c[2]} hard</span>${best != null ? `<span class="tag done">Best paper ${Math.round(best * 100)}%</span>` : ""}</div><span class="go" aria-hidden="true">→</span></a>`
          : `<div class="unit-card soon"><span class="code">Unit ${n}</span><h3>${name}</h3><p class="muted">Coming soon</p></div>`;
      }).join("")}</div></div>`);
    swap(v);
    v.querySelector(".filters").onclick = (e) => { const b = e.target.closest("[data-s]"); if (b) location.hash = "#/exam/" + b.dataset.s; };
    reveal(v); tilt(v);
  }
  function examUnit(subj, n) {
    const s = SUBJECTS[subj], u = s && s.units.find(x => x[0] === +n); if (!u) return examHome(subj);
    const qs = unitQs(subj, u[0]);
    const v = el(`<div style="--c:${s.color}">
      <div class="page-head"><div class="crumbs"><a href="#/exam/${subj}">Exam questions</a> <span>/</span> ${s.name}</div><span class="code">${s.code} · Unit ${u[0]}</span><h1>${u[1]}</h1>
        <p>${qs.length} questions from ${unitTopics(subj, u[0]).map(t => `<a href="#/topic/${t.id}">${t.title}</a>`).join(", ")}. Easy first, hard last.</p></div>
      <div class="paper-cta"><div><b>Timed practice paper</b><span>A random mix of about 40 marks, easy to hard, with 1 minute per mark, like the real exam.</span></div><button class="btn" data-paper>Start a paper</button></div>
      <div id="xq"></div></div>`);
    swap(v);
    const root = v.querySelector("#xq");
    const bank = () => { root.innerHTML = ""; quiz(root, { qs, diff: true, tag: true }); math(root); };
    const paper = () => {
      const pick = [], by = [1, 2, 3].map(d => qs.filter(q => diffOf(q) === d).sort(() => Math.random() - .5));
      let marks = 0, k = 0; const want = [14, 16, 12];
      by.forEach((list, d) => { let m = 0; for (const q of list) { if (m >= want[d]) break; pick.push(q); m += q.marks; } marks += m; });
      pick.sort((a, b) => diffOf(a) - diffOf(b));
      root.innerHTML = ""; const bar = el(`<div class="paper-head"><b>Practice paper · ${pick.reduce((t, q) => t + q.marks, 0)} marks</b><button class="btn ghost small">Back to all questions</button></div>`);
      bar.querySelector("button").onclick = bank; root.appendChild(bar);
      quiz(root, { qs: pick, diff: true, tag: true, paper: true, id: "exam:" + subj + u[0], timer: pick.reduce((t, q) => t + q.marks, 0) * 60, retry: paper }); math(root);
      root.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    };
    v.querySelector("[data-paper]").onclick = paper;
    bank();
  }

  function flashcards(root, deck) {
    if (!deck.length) { root.innerHTML = "<p class='muted'>No cards for this selection.</p>"; return; }
    const known = store.get("known", {});
    let order = deck.map((_, i) => i), i = 0;
    const key = (d) => d.t.id + ":" + d.c[0];
    const v = el(`<div class="fc-wrap">
      <div class="fc-meta"><span class="count"></span><span class="known"></span></div>
      <div class="fc" tabindex="0" role="button" aria-label="Flip card"><div class="fc-in"><div class="fc-face front"></div><div class="fc-face back"></div></div></div>
      <div class="fc-actions"><button class="btn ghost" data-a="prev">←</button><button class="btn ghost" data-a="again">Still learning</button><button class="btn" data-a="got">Got it ✓</button><button class="btn ghost" data-a="next">→</button><button class="btn ghost" data-a="shuffle">Shuffle</button></div>
      <p class="hint">Click or press Space to flip · ← → to move</p></div>`);
    root.innerHTML = ""; root.appendChild(v);
    const fc = v.querySelector(".fc");
    const render = (dir = 0) => {
      const d = deck[order[i]];
      fc.classList.remove("flip");
      fc.classList.remove("in-l", "in-r"); void fc.offsetWidth; if (dir) fc.classList.add(dir > 0 ? "in-r" : "in-l");
      v.querySelector(".front").innerHTML = `<div><small style="color:${subjColor(d.t.subject)}">${d.t.title}</small>${d.c[0]}</div>`;
      v.querySelector(".back").innerHTML = `<div>${d.c[1]}</div>`;
      v.querySelector(".count").textContent = `Card ${i + 1} of ${deck.length}`;
      const k = deck.filter(x => known[key(x)]).length;
      v.querySelector(".known").innerHTML = `${k} known <span class="mini"><i style="width:${k / deck.length * 100}%"></i></span>`;
      fc.style.setProperty("--c", subjColor(d.t.subject));
      math(fc);
    };
    const go = (d) => { i = (i + d + order.length) % order.length; render(d); };
    fc.onclick = () => fc.classList.toggle("flip");
    v.querySelector(".fc-actions").onclick = (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a; if (!a) return;
      if (a === "prev") go(-1); if (a === "next") go(1);
      if (a === "got" || a === "again") { known[key(deck[order[i]])] = a === "got"; store.set("known", known); go(1); }
      if (a === "shuffle") { order.sort(() => Math.random() - .5); i = 0; render(1); }
    };
    const kb = (e) => {
      if (!document.body.contains(fc) || e.target.matches("input,textarea,select")) return;
      const r = fc.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
      if (e.key === " ") { e.preventDefault(); fc.classList.toggle("flip"); }
      if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1);
    };
    addEventListener("keydown", kb); cleanup.push(() => removeEventListener("keydown", kb));
    render();
  }

  function cardsPage() {
    const v = el(`<div><div class="page-head"><span class="code">Active recall</span><h1>Flashcards</h1><p>Say the answer out loud before flipping. Mark it honestly. Cards you still need to learn come back when you shuffle.</p></div>
      <div class="filters" role="group" aria-label="Filter">
        <button class="chip" aria-pressed="true" data-f="all">All</button>
        ${Object.entries(SUBJECTS).map(([k, s]) => `<button class="chip" aria-pressed="false" data-f="${k}" style="--c:${s.color}"><i class="sw"></i>${s.name}</button>`).join("")}
        <button class="chip" aria-pressed="false" data-f="weak">Still learning only</button>
      </div><div id="deck"></div></div>`);
    swap(v);
    const all = TOPICS.flatMap(t => t.cards.map(c => ({ c, t })));
    const build = (f) => {
      const known = store.get("known", {});
      const deck = f === "all" ? all : f === "weak" ? all.filter(d => !known[d.t.id + ":" + d.c[0]]) : all.filter(d => d.t.subject === f);
      flashcards(v.querySelector("#deck"), deck);
    };
    v.querySelector(".filters").onclick = (e) => { const b = e.target.closest("[data-f]"); if (!b) return; v.querySelectorAll(".filters .chip").forEach(c => c.setAttribute("aria-pressed", c === b)); build(b.dataset.f); };
    build("all");
  }

  function formulasPage() {
    const v = el(`<div><div class="page-head"><span class="code">One page</span><h1>Formula sheet</h1><p>Every formula from every topic. Print it (Ctrl/Cmd + P) and stick it above your desk.</p></div>
      ${Object.entries(SUBJECTS).map(([k, s]) => `<section class="sheet-sec reveal" style="--c:${s.color}"><h2><i class="sw"></i>${s.name}</h2>
        ${TOPICS.filter(t => t.subject === k).map(t => `<h3><a href="#/topic/${t.id}">${t.title}</a></h3><div class="formulas">${t.formulas.map(([n, f]) => `<div class="formula"><small>${n}</small>${f}</div>`).join("")}</div>`).join("")}
      </section>`).join("")}</div>`);
    swap(v); math(v); reveal(v);
  }

  // ---------- router + transitions ----------
  function swap(node) {
    app.innerHTML = ""; app.appendChild(node);
    if (!reduced) { app.classList.remove("enter"); void app.offsetWidth; app.classList.add("enter"); }
  }
  function route() {
    cleanup.forEach(f => { try { f(); } catch {} }); cleanup = [];
    const h = location.hash || "#/";
    if (!h.startsWith("#/")) return; // in-page anchors
    const [, page, id] = h.slice(1).split("/");
    document.querySelectorAll("#tabs [data-go]").forEach(b => b.setAttribute("aria-current", b.dataset.go === (page ? "#/" + page : "#/") ? "page" : "false"));
    if (page === "topic") lesson(id); else if (page === "cards") cardsPage(); else if (page === "formulas") formulasPage(); else if (page === "ask") AI.page(app, { el, math, swap }); else if (page === "exam") (id && h.split("/")[3] ? examUnit(id, h.split("/")[3]) : examHome(id)); else home();
    window.scrollTo({ top: 0 });
  }
  document.getElementById("tabs").onclick = (e) => { const b = e.target.closest("[data-go]"); if (b) location.hash = b.dataset.go; };

  // theme
  const themeBtn = document.getElementById("theme");
  const savedTheme = store.get("theme", null); if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  themeBtn.onclick = () => {
    const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = dark ? "light" : "dark"; store.set("theme", dark ? "light" : "dark");
    route();
  };

  addEventListener("hashchange", route);
  // wait for KaTeX (deferred) before first render; it's loaded before this file.
  route();
})();
