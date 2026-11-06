# A* Lab

An animated study site for Cambridge IGCSE Maths (0580), Physics (0625) and Chemistry (0620).

Each topic has:
- **Deep lessons** that explain *why*, not just *what*, with common mistakes and exam tips
- **Animated figures** inside the lessons (completing the square, similar triangles, terminal velocity, refraction, ionic bonding, energy distributions…)
- **An interactive lab** with sliders and live simulations
- **Step-by-step worked examples**
- **Exam-style practice** with instant marking and real mark schemes
- **Flashcards** that remember what you know

## Run it

No build step. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Adding a topic

Add an entry to `data/maths.js`, `data/physics.js` or `data/chemistry.js` following the existing shape
(`sections`, `worked`, `formulas`, `cards`, `quiz`, optional `demo`). Drop `<div class="viz" data-viz="name"></div>`
into any section to embed an animated figure from `js/viz.js`; interactive labs live in `js/demos.js`.

KaTeX is vendored in `vendor/katex` (MIT) so maths renders offline.

## Also in this repo

[`lowstakes/`](lowstakes/) is **Low Stakes**, a separate play-money card room: hold'em, blackjack and roulette with friends in the browser. See its [README](lowstakes/README.md).
