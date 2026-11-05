/* ============================================================
   VIEWS — edit this list to change the story.

   Coordinates are in pixels of shirt_print_restored.png (1665 × 1638).
     x, y  : the point of the print at the centre of the screen
     span  : how many print pixels fit across the SHORTER side of the
             screen (smaller = more zoomed in)
     full  : true → show the whole print

   overlays: things placed on the print, also in print pixels
     text    : { type:'text', text, x, y, size, indents? }
     svg     : { type:'svg', src, x, y, width }
     hotspot : { type:'hotspot', x, y, w, h }   ← invisible button
   Clicking any overlay goes to the next view. `action` runs on click.

   Press E in the browser for calibration mode (drag / scroll to frame,
   C copies the current view as JSON, ← → steps through views).
   ============================================================ */
const VIEWS = [
  {
    // View one — extreme close-up on the left figure's jaw/neck line.
    name: 'come on baby',
    x: 491, y: 676, span: 153,
    overlays: [
      {
        type: 'text',
        text: ['come', 'on', 'baby'],
        indents: [0, 0.33, 0.68],   // in em, staggers the lines like the reference
        x: 404, y: 637, size: 22,
      },
    ],
  },
  {
    // View two — pulls back a little; the hand-drawn "light my fire".
    // NOTE: position is a first guess — calibrate with E.
    name: 'light my fire',
    x: 640, y: 545, span: 330,
    overlays: [
      {
        type: 'svg', src: 'assets/drawing.svg',
        x: 585, y: 560, width: 110,
        action: 'playAudio',
      },
    ],
  },
  {
    // View three — placeholder: further out, with an invisible button
    // over the middle figure's face.
    name: 'placeholder',
    x: 820, y: 620, span: 760,
    overlays: [
      { type: 'hotspot', x: 760, y: 290, w: 110, h: 110 },
    ],
  },
  {
    // Final — the whole print.
    name: 'reveal',
    full: true,
    overlays: [],
  },
];

/* ============================================================ */

const IMG_W = 1665, IMG_H = 1638;

const world = document.getElementById('world');
const layer = document.getElementById('overlays');
const audio = document.getElementById('track');
const hud = document.getElementById('hud');

let current = 0;
let cam = { x: IMG_W / 2, y: IMG_H / 2, s: 1 };

/* ---------- music ----------
   Prefers the local file in <audio id="track">. If that file can't be
   decoded (the current one is a saved web page, not audio), it falls back
   to the YouTube player for YOUTUBE_ID. */
const YOUTUBE_ID = 'cq8k-ZbsXDI';   // The Doors – Light My Fire

let localAudioOk = null;            // null = unknown yet
audio.addEventListener('canplay', () => { localAudioOk = true; });
// With <source> children, failures fire on the sources; the last one
// failing means every source failed.
audio.querySelector('source:last-of-type')
  ?.addEventListener('error', () => { localAudioOk = false; });

let yt = null, ytReady = false;
window.onYouTubeIframeAPIReady = () => {
  yt = new YT.Player('yt-player', {
    width: 200, height: 113, videoId: YOUTUBE_ID,
    playerVars: { controls: 0, playsinline: 1, rel: 0 },
    events: { onReady: () => { ytReady = true; } },
  });
};
const ytScript = document.createElement('script');
ytScript.src = 'https://www.youtube.com/iframe_api';
document.head.appendChild(ytScript);

const ACTIONS = {
  playAudio() {
    if (localAudioOk !== false) {
      audio.currentTime = 0;
      audio.play().catch(err => { console.warn('local audio failed:', err); playYouTube(); });
    } else {
      playYouTube();
    }
  },
};

function playYouTube() {
  if (!ytReady) return console.warn('YouTube player not ready yet');
  document.getElementById('yt-wrap').classList.add('playing');
  yt.seekTo(0);
  yt.playVideo();
}

/* ---------- camera ---------- */

function camFor(view) {
  const vw = innerWidth, vh = innerHeight;
  if (view.full) {
    const s = Math.min(vw / IMG_W, vh / IMG_H) * 0.92;
    return { x: IMG_W / 2, y: IMG_H / 2, s };
  }
  return { x: view.x, y: view.y, s: Math.min(vw, vh) / view.span };
}

function applyCam(animate = true) {
  world.classList.toggle('no-anim', !animate);
  const tx = innerWidth / 2 - cam.x * cam.s;
  const ty = innerHeight / 2 - cam.y * cam.s;
  world.style.transform = `translate(${tx}px, ${ty}px) scale(${cam.s})`;
  if (!animate) void world.offsetWidth; // flush so the next change animates
  updateHud();
}

/* ---------- overlays ---------- */

const svgCache = {};
async function loadSvg(src) {
  if (!svgCache[src]) {
    svgCache[src] = fetch(src).then(r => r.text()).then(txt => {
      const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
      return [...doc.querySelectorAll('path')].map(p => p.getAttribute('d'));
    });
  }
  return svgCache[src];
}

async function buildOverlay(spec, viewIndex) {
  const el = document.createElement('div');
  el.className = `overlay ${spec.type}`;
  el.dataset.view = viewIndex;
  el.style.left = spec.x + 'px';
  el.style.top = spec.y + 'px';

  if (spec.type === 'text') {
    el.style.fontSize = spec.size + 'px';
    const lines = [].concat(spec.text);
    lines.forEach((line, i) => {
      const d = document.createElement('div');
      d.textContent = line;
      d.style.marginLeft = ((spec.indents || [])[i] || 0) + 'em';
      el.appendChild(d);
    });
  }

  if (spec.type === 'hotspot') {
    el.style.width = spec.w + 'px';
    el.style.height = spec.h + 'px';
  }

  if (spec.type === 'svg') {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    for (const d of await loadSvg(spec.src)) {
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', d);
      svg.appendChild(p);
    }
    el.appendChild(svg);
    layer.appendChild(el);
    // Crop the A4 Inkscape page down to just the drawing.
    const b = svg.getBBox();
    svg.setAttribute('viewBox', `${b.x} ${b.y} ${b.width} ${b.height}`);
    el.style.width = spec.width + 'px';
    el.style.height = (spec.width * b.height / b.width) + 'px';
  }

  el.addEventListener('click', e => {
    if (document.body.classList.contains('edit')) return;
    e.stopPropagation();
    if (spec.action) ACTIONS[spec.action]?.();
    goTo(viewIndex + 1);
  });

  layer.appendChild(el);
}

function showOverlays(index) {
  for (const el of layer.children) {
    const on = Number(el.dataset.view) === index;
    el.classList.toggle('leaving', !on && el.classList.contains('visible'));
    el.classList.toggle('visible', on);
  }
}

/* ---------- navigation ---------- */

function goTo(index, animate = true) {
  if (index < 0 || index >= VIEWS.length) return;
  current = index;
  cam = camFor(VIEWS[index]);
  applyCam(animate);
  showOverlays(index);
}

addEventListener('resize', () => {
  if (!document.body.classList.contains('edit')) {
    cam = camFor(VIEWS[current]);
    applyCam(false);
  }
});

/* ---------- calibration mode ---------- */

let lastClick = null;

function updateHud() {
  if (hud.hidden) return;
  const span = Math.round(Math.min(innerWidth, innerHeight) / cam.s);
  hud.textContent =
    `CALIBRATION  view ${current + 1}/${VIEWS.length} "${VIEWS[current].name}"\n` +
    `camera  x: ${Math.round(cam.x)}, y: ${Math.round(cam.y)}, span: ${span}\n` +
    (lastClick ? `last click (print px)  x: ${lastClick.x}, y: ${lastClick.y}\n` : '') +
    `drag = pan · scroll = zoom · ←/→ = view · C = copy view · E = exit`;
}

function screenToImage(sx, sy) {
  return {
    x: Math.round(cam.x + (sx - innerWidth / 2) / cam.s),
    y: Math.round(cam.y + (sy - innerHeight / 2) / cam.s),
  };
}

let drag = null;
addEventListener('pointerdown', e => {
  if (!document.body.classList.contains('edit')) return;
  drag = { sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y, moved: false };
});
addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
  if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
  cam.x = drag.cx - dx / cam.s;
  cam.y = drag.cy - dy / cam.s;
  applyCam(false);
});
addEventListener('pointerup', e => {
  if (drag && !drag.moved) {
    lastClick = screenToImage(e.clientX, e.clientY);
    console.log('print px', lastClick);
    updateHud();
  }
  drag = null;
});
addEventListener('wheel', e => {
  if (!document.body.classList.contains('edit')) return;
  e.preventDefault();
  const before = screenToImage(e.clientX, e.clientY);
  cam.s *= Math.exp(-e.deltaY * 0.0015);
  const after = screenToImage(e.clientX, e.clientY);
  cam.x += before.x - after.x;
  cam.y += before.y - after.y;
  applyCam(false);
}, { passive: false });

addEventListener('keydown', e => {
  const editing = document.body.classList.contains('edit');
  if (e.key === 'e' || e.key === 'E') {
    document.body.classList.toggle('edit');
    hud.hidden = !document.body.classList.contains('edit');
    if (hud.hidden) goTo(current, false);
    updateHud();
  } else if (e.key === 'ArrowRight') {
    goTo(current + 1, !editing);
  } else if (e.key === 'ArrowLeft') {
    goTo(current - 1, !editing);
  } else if (editing && (e.key === 'c' || e.key === 'C')) {
    const span = Math.round(Math.min(innerWidth, innerHeight) / cam.s);
    const txt = `x: ${Math.round(cam.x)}, y: ${Math.round(cam.y)}, span: ${span},`;
    navigator.clipboard?.writeText(txt);
    console.log(txt);
    hud.textContent += `\ncopied → ${txt}`;
  }
});

/* ---------- start ---------- */

(async () => {
  for (const [i, view] of VIEWS.entries()) {
    for (const spec of view.overlays) await buildOverlay(spec, i);
  }
  const start = parseInt(location.hash.slice(1), 10) - 1;
  goTo(Number.isInteger(start) ? start : 0, false);
})();
