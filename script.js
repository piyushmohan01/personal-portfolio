// Portfolio interactions: arc carousel, uncropped collages, image viewer
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ratio(img) {
    return img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1.65;
  }
  function whenLoaded(imgs, cb) {
    let left = imgs.length;
    if (!left) return cb();
    imgs.forEach(function (img) {
      if (img.complete && img.naturalWidth) { if (--left === 0) cb(); }
      else {
        img.addEventListener('load', function () { if (--left === 0) cb(); }, { once: true });
        img.addEventListener('error', function () { if (--left === 0) cb(); }, { once: true });
      }
    });
  }

  /* ================= Arc carousel =================
     Seven positions on a half-ellipse. The straight side of the half-ellipse
     is the right edge of the page; the curve bulges left towards the text.
     Position 0 enters hidden at the top-right, 1–5 are visible (3 is the
     centre and largest), 6 leaves hidden at the bottom-right. */
  const arc = document.querySelector('.arc');
  if (arc) {
    const cards = Array.from(arc.querySelectorAll('.arc-card'));
    const n = cards.length;
    const angles = [-100, -70, -36, 0, 36, 70, 100];        // degrees from the leftmost point
    const scales = [0.5, 0.6, 0.78, 1, 0.78, 0.6, 0.5];
    const opac   = [0, 1, 1, 1, 1, 1, 0];
    const centre = 3;
    let step = 0;
    let timer = null;

    function slotFor(i) { return ((centre - i + step) % n + n) % n; }

    const narrowQuery = window.matchMedia('(max-width: 1100px)');

    function layout(skipAnimFor) {
      const narrow = narrowQuery.matches;
      const W = arc.clientWidth;
      let cardW, cardH, H;

      if (narrow) {
        // Horizontal strip: centre card largest, cards travel right to left
        cardW = Math.min(440, Math.max(200, W * 0.46));
        cardH = cardW / 1.65;
        H = Math.round(cardH + 32);
        arc.style.height = H + 'px';
      } else {
        arc.style.height = '';
        H = arc.clientHeight;
        cardW = Math.min(380, Math.max(260, W * 0.55));
        cardH = cardW / 1.65;
      }
      if (!W || !H) return;
      arc.style.setProperty('--card-w', cardW + 'px');
      const rx = Math.min(W - cardW / 2 - 32, 520);                // centre card's left edge stays clear of the text
      const ry = Math.max(120, H / 2 - (cardH * scales[1]) / 2 - 8);
      const cx = W, cy = H / 2;
      const spacing = cardW * 0.7;

      cards.forEach(function (card, i) {
        const s = slotFor(i) % angles.length;
        let x, y;
        if (narrow) {
          x = W / 2 + (centre - s) * spacing;                      // slot 0 enters on the right, slot 6 leaves on the left
          y = H / 2;
        } else {
          const t = angles[s] * Math.PI / 180;
          x = cx - rx * Math.cos(t);
          y = cy + ry * Math.sin(t);
        }
        const h = card.offsetHeight || cardH;
        if (skipAnimFor === card) card.classList.add('no-anim');
        card.style.transform =
          'translate(' + (x - cardW / 2) + 'px,' + (y - h / 2) + 'px) scale(' + scales[s] + ')';
        card.style.opacity = opac[s];
        card.style.zIndex = 10 - Math.abs(s - centre);
        card.tabIndex = opac[s] ? 0 : -1;
        card.setAttribute('aria-hidden', opac[s] ? 'false' : 'true');
      });
      if (skipAnimFor) {
        void skipAnimFor.offsetWidth;                                // apply the jump, then restore the transition
        skipAnimFor.classList.remove('no-anim');
      }
    }

    function advance() {
      step = (step + 1) % n;
      // The card that wraps from the bottom (hidden) back to the top (hidden) jumps without animating
      const wrapped = cards.find(function (c, i) { return slotFor(i) === 0; });
      layout(wrapped);
    }
    function start() { if (!reduceMotion && !timer) timer = setInterval(advance, 4000); }
    function stop() { clearInterval(timer); timer = null; }

    arc.addEventListener('mouseenter', stop);
    arc.addEventListener('mouseleave', start);
    arc.addEventListener('focusin', stop);
    arc.addEventListener('focusout', start);
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });

    whenLoaded(cards.map(function (c) { return c.querySelector('img'); }), function () { layout(); start(); });
    window.addEventListener('resize', function () { layout(); });
  }

  /* ================= Collages =================
     Layout A: hero on top, three below · B: hero left, three stacked right
     C: three stacked left, hero right   · D: three on top, hero below
     Sizes come from each image's own proportions, so nothing is cropped
     and every gap between edges equals --gap. */
  const collages = Array.from(document.querySelectorAll('.collage'));

  function gapOf(el) {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap')) || 16;
  }

  function place(tile, x, y, w, h) {
    tile.style.left = x + 'px'; tile.style.top = y + 'px';
    tile.style.width = w + 'px'; tile.style.height = h + 'px';
  }

  function layoutCollage(collage) {
    const tiles = Array.from(collage.querySelectorAll('.tile'));
    if (tiles.length < 4) return;
    const r = tiles.map(function (t) { return ratio(t.querySelector('img')); });
    const W = collage.clientWidth;
    const g = gapOf(collage);
    const hero = tiles[0], small = tiles.slice(1), rs = r.slice(1);
    const type = collage.dataset.layout || 'A';
    let H = 0;

    if (type === 'A' || type === 'D') {
      // Row of three at one shared height that exactly fills the width
      const sumR = rs.reduce(function (a, b) { return a + b; }, 0);
      const rowH = (W - 2 * g) / sumR;
      const heroH = W / r[0];
      const rowY = type === 'A' ? heroH + g : 0;
      const heroY = type === 'A' ? 0 : rowH + g;
      place(hero, 0, heroY, W, heroH);
      let x = 0;
      small.forEach(function (t, i) { const w = rowH * rs[i]; place(t, x, rowY, w, rowH); x += w + g; });
      H = heroH + g + rowH;
    } else {
      // Column of three beside the hero. The hero takes ~62% of the width and
      // is centred against the column, so the small images stay readable.
      const heroW = (W - g) * 0.62;
      const colW = W - g - heroW;
      const heroH = heroW / r[0];
      const colH = rs.reduce(function (a, b) { return a + colW / b; }, 0) + 2 * g;
      const total = Math.max(heroH, colH);
      const heroX = type === 'B' ? 0 : colW + g;
      const colX = type === 'B' ? heroW + g : 0;
      place(hero, heroX, (total - heroH) / 2, heroW, heroH);
      let y = (total - colH) / 2;
      small.forEach(function (t, i) { const h = colW / rs[i]; place(t, colX, y, colW, h); y += h + g; });
      H = total;
    }
    collage.style.height = Math.ceil(H) + 'px';
  }

  collages.forEach(function (collage) {
    const imgs = Array.from(collage.querySelectorAll('img'));
    imgs.forEach(function (img) { img.loading = 'eager'; }); // proportions are needed for layout
    layoutCollage(collage);
    whenLoaded(imgs, function () { layoutCollage(collage); });
  });
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(function (entries) { entries.forEach(function (e) { layoutCollage(e.target); }); });
    collages.forEach(function (c) { ro.observe(c); });
  } else {
    window.addEventListener('resize', function () { collages.forEach(layoutCollage); });
  }

  /* ================= Image viewer ================= */
  const box = document.getElementById('lightbox');
  const img = box.querySelector('.lb-img');
  const caption = box.querySelector('.lb-caption');
  const count = box.querySelector('.lb-count');
  let set = [];
  let index = 0;
  let lastFocus = null;

  function show(i) {
    index = (i + set.length) % set.length;   // wraps back to the first image after the last
    const tile = set[index];
    const thumb = tile.querySelector('img');
    img.src = tile.dataset.full || thumb.currentSrc || thumb.src;
    img.onerror = function () { img.onerror = null; img.src = thumb.currentSrc || thumb.src; };
    img.alt = thumb.alt;
    caption.textContent = thumb.alt;
    count.textContent = (index + 1) + ' / ' + set.length;
  }
  function open(collage, i) {
    set = Array.from(collage.querySelectorAll('.tile'));
    lastFocus = document.activeElement;
    box.hidden = false;
    document.body.classList.add('lb-open');
    show(i);
    box.querySelector('.lb-next').focus();
  }
  function close() {
    box.hidden = true;
    document.body.classList.remove('lb-open');
    img.src = '';
    if (lastFocus) lastFocus.focus();
  }

  collages.forEach(function (collage) {
    collage.querySelectorAll('.tile').forEach(function (tile, i) {
      tile.addEventListener('click', function () { open(collage, i); });
    });
  });
  box.querySelector('.lb-next').addEventListener('click', function () { show(index + 1); });
  box.querySelector('.lb-prev').addEventListener('click', function () { show(index - 1); });
  box.querySelector('.lb-close').addEventListener('click', close);
  img.addEventListener('click', function () { show(index + 1); });
  box.addEventListener('click', function (e) { if (e.target === box) close(); });
  document.addEventListener('keydown', function (e) {
    if (box.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') show(index + 1);
    else if (e.key === 'ArrowLeft') show(index - 1);
  });
})();