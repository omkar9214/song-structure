/* Inline SVG icon set (Lucide-style, 24×24 outline). No network, no emoji —
   emoji render differently on every platform and carry no accessible name. */
const ICONS = {
  plus:      'M5 12h14M12 5v14',
  minus:     'M5 12h14',
  copy:      'M9 9h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z|M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  clip:      'M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48',
  trash:     'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
  paint:     'M12 2.7l5.66 5.65a8 8 0 1 1-11.31 0z',
  up:        'M12 19V5M5 12l7-7 7 7',
  down:      'M12 5v14M19 12l-7 7-7-7',
  pin:       'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z|M12 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  repeat:    'M17 2l4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3',
  caretDown: 'M6 9l6 6 6-6',
  caretRight:'M9 18l6-6-6-6',
  columns:   'M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z|M12 4v16',
  square:    'M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
  image:     'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z|M9 10a1.6 1.6 0 1 0 0-3.2A1.6 1.6 0 0 0 9 10z|M21 15l-5-5L5 21',
  audio:     'M11 5L6 9H2v6h4l5 4V5z|M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13',
  video:     'M23 7l-7 5 7 5V7z|M3 5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
  file:      'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6',
  x:         'M18 6L6 18M6 6l12 12',
  list:      'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  filePlus:  'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|M12 18v-6M9 15h6',
  import:    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  export:    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  print:     'M6 9V3h12v6|M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2|M6 14h12v8H6z',
  grip:      'M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01',
  music:     'M9 18V5l12-2v13|M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  user:      'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2|M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  cloud:     'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z',
  wave:      'M3 11v2M7 7v10M11 4v16M15 8v8M19 10v4|M21 12h.01',
  sun:       'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z|M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon:      'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  auto:      'M12 3a9 9 0 0 0 0 18z|M12 21a9 9 0 0 0 0-18',
  caretLeft: 'M15 18l-6-6 6-6',
  pause:     'M7 4h3v16H7zM14 4h3v16h-3z',
  folder:    'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  play:      'M7 4l13 8-13 8V4z',
  more:      'M6 12h.01M12 12h.01M18 12h.01',
  setlist:   'M4 5h10M4 10h10M4 15h7|M18 4v11|M16 6l2-2 2 2|M20 17.5a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
  eye:       'M1.5 12S5 5.5 12 5.5 22.5 12 22.5 12 19 18.5 12 18.5 1.5 12 1.5 12z|M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  save:      'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z|M17 21v-8H7v8|M7 3v5h8',
  check:     'M20 6L9 17l-5-5',
  scissors:  'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12'
};

function icon(name, size = 15) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.9');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');           /* decorative: the button carries the name */
  svg.setAttribute('focusable', 'false');
  (ICONS[name] || ICONS.file).split('|').forEach(d => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
  });
  return svg;
}
