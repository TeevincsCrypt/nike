/* Level layout (world units = logical pixels, ground line at y = GROUND).
   Waves lock the camera until every enemy is down. Edit freely:
     waves[].x      — trigger position          waves[].arena — [left, right] lock bounds
     waves[].spawn  — [type, side ('L'|'R'), delay seconds]
   Enemy types: jeeter, rugger, mev, bundler. */
window.AALIYAH_LEVEL = {
  GROUND: 300,
  START_X: 120,
  END_X: 5720,
  zones: [
    { id: 'trenches', x0: 0, x1: 2240, bg: 'trenches', ground: 'groundTrenches', tint: '#ff6a2a' },
    { id: 'bunker', x0: 2240, x1: 4320, bg: 'bunker', ground: 'groundBunker', tint: '#ff2a2a' },
    { id: 'pool', x0: 4320, x1: 5120, bg: 'pool', ground: 'groundPool', tint: '#9b5cff' },
    { id: 'hq', x0: 5120, x1: 5760, bg: 'hq', ground: 'groundHq', tint: '#19e68c' }
  ],
  pits: [[800, 880], [1560, 1640], [2950, 3040]],
  platforms: [
    { x: 300, w: 96, h: 48, kind: 'bags' }, { x: 1040, w: 64, h: 48, kind: 'crate' }, { x: 1130, w: 112, h: 48, kind: 'bags' },
    { x: 1880, w: 80, h: 48, kind: 'bags' },
    { x: 2500, w: 160, y: 210, kind: 'catwalk' }, { x: 3300, w: 180, y: 200, kind: 'catwalk' }, { x: 3880, w: 160, y: 210, kind: 'catwalk' },
    { x: 3560, w: 64, h: 64, kind: 'crate' }
  ],
  props: [
    { type: 'barrel', x: 220 }, { type: 'barrel', x: 640 }, { type: 'barrel', x: 980 }, { type: 'barrel', x: 1420 },
    { type: 'barrel', x: 1760 }, { type: 'barrel', x: 2120 }, { type: 'barrel', x: 4400 }, { type: 'barrel', x: 5060 }
  ],
  pickups: [
    { x: 340, y: 230, amt: 1 }, { x: 840, y: 210, amt: 1 }, { x: 1180, y: 230, amt: 1.5 }, { x: 1600, y: 210, amt: 1 },
    { x: 2580, y: 180, amt: 2 }, { x: 2995, y: 210, amt: 1 }, { x: 3390, y: 170, amt: 2 }, { x: 3960, y: 180, amt: 2 }
  ],
  hazards: [
    { type: 'zap', x0: 3120, x1: 3240, on: 1.1, off: 1.6, phase: 0 },
    { type: 'zap', x0: 3680, x1: 3800, on: 1.1, off: 1.6, phase: 0.8 }
  ],
  waves: [
    { x: 480, arena: [200, 770], spawn: [['jeeter', 'R', 0], ['jeeter', 'L', 1.2], ['jeeter', 'R', 2.6]] },
    { x: 1200, arena: [910, 1530], spawn: [['jeeter', 'R', 0], ['rugger', 'R', 1.5], ['jeeter', 'L', 3], ['jeeter', 'R', 5]] },
    { x: 1960, arena: [1670, 2240], spawn: [['rugger', 'R', 0], ['jeeter', 'L', 0.8], ['rugger', 'L', 3], ['jeeter', 'R', 4]] },
    { x: 2620, arena: [2280, 2920], hint: 'bunker', spawn: [['mev', 'R', 0], ['jeeter', 'L', 1], ['mev', 'L', 2.5]] },
    { x: 3420, arena: [3070, 3660], hint: 'bundler', spawn: [['bundler', 'R', 0], ['mev', 'L', 1.5], ['jeeter', 'R', 3]] },
    { x: 4040, arena: [3820, 4320], spawn: [['bundler', 'L', 0], ['rugger', 'R', 0.6], ['mev', 'R', 2], ['jeeter', 'L', 3.5]] }
  ],
  boss: { trigger: 4520, arena: [4340, 5100], spawnX: 4920 },
  teevincs: { x: 5520 }
};
