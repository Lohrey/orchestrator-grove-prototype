export const CAMPAIGN_MAP_SIZE = Object.freeze({ width: 5600, height: 3800 });

export const CAMPAIGN_START = Object.freeze({
  x: 1080,
  y: CAMPAIGN_MAP_SIZE.height - 860
});

export const CAMPAIGN_MAP_FEATURES = Object.freeze([
  { id: 'campaign_lake_road', type: 'road', label: 'border road', points: [[-120, CAMPAIGN_MAP_SIZE.height - 910], [780, CAMPAIGN_MAP_SIZE.height - 910], [1180, CAMPAIGN_MAP_SIZE.height - 820], [CAMPAIGN_MAP_SIZE.width + 120, CAMPAIGN_MAP_SIZE.height - 820]], width: 96 },
  { id: 'campaign_lake_parking', type: 'parking_lot', label: 'lake parking lot', x: 1170, y: CAMPAIGN_MAP_SIZE.height - 650, w: 440, h: 250, rotation: -0.06 },
  { id: 'campaign_glow_lake', type: 'lake', label: 'glowing lake', x: 650, y: CAMPAIGN_MAP_SIZE.height - 530, rx: 560, ry: 360, rotation: -0.14, glow: 'green', glowRadius: 460, glowAlpha: 0.76 },
  { id: 'campaign_camper', type: 'camper_van', label: 'trusty camper van', x: 1160, y: CAMPAIGN_MAP_SIZE.height - 646, w: 126, h: 62, rotation: -0.06 }
]);

export const CAMPAIGN_INTRO_SCENES = Object.freeze([
  {
    kicker: 'City noise',
    title: 'Paul had stopped seeing the sun.',
    text: 'He loved AI early, when it still felt like a secret door to the future. But the big city was all sirens, calendars, office lights, and daylight spent behind glass.'
  },
  {
    kicker: 'A late-night spark',
    title: 'Then the gadget videos found him.',
    text: 'One evening, after too many tabs and too much noise, a YouTube rabbit hole showed him a smaller kind of freedom: simple tools, portable power, and a life that could move.'
  },
  {
    kicker: 'The escape kit',
    title: 'He bought only what could help him build.',
    text: 'A plain white camper van. A hammock. An ultrabook. Solar panels, a power station, a portable 3D printer and assembler, plus boxes of DIY robotics parts.'
  },
  {
    kicker: 'No return commute',
    title: 'Paul quit the office and closed the apartment door.',
    text: 'No dramatic speech. Just a final email, a cancelled lease, and the quiet click of a key left behind. The city kept rushing. Paul drove away from it.'
  },
  {
    kicker: 'The old lake',
    title: 'He went back to where nature had once felt endless.',
    text: 'Out in the countryside waited the lake his father had taken him to as a child. This time Paul arrived with a van full of tools, ready to grow a gentler world with little robotic helpers.'
  }
]);

export const CAMPAIGN_ARRIVAL_SCENES = Object.freeze([
  {
    id: 'campaign_camper_arrival',
    label: 'Camper van arrival',
    durationMs: 4600,
    parkedFeatureId: 'campaign_camper',
    cameraFollow: Object.freeze({
      mode: 'van',
      smoothing: 0.14,
      offsetX: 0,
      offsetY: 0
    }),
    path: Object.freeze([
      { x: -170, y: CAMPAIGN_MAP_SIZE.height - 910 },
      { x: 760, y: CAMPAIGN_MAP_SIZE.height - 910 },
      { x: 1140, y: CAMPAIGN_MAP_SIZE.height - 845 },
      { x: 1160, y: CAMPAIGN_MAP_SIZE.height - 646 }
    ])
  }
]);

export const CAMPAIGN_POST_ARRIVAL_SCENES = Object.freeze([
  {
    id: 'campaign_first_morning',
    kicker: 'First morning',
    title: 'The van was parked. The road was behind him.',
    text: 'Paul unpacked under the pale lake light and looked at the tools waiting in the camper. This was the first quiet morning of a much longer build.'
  }
]);

export function getCampaignArrivalScene(sceneId = CAMPAIGN_ARRIVAL_SCENES[0]?.id || '') {
  return CAMPAIGN_ARRIVAL_SCENES.find(scene => scene.id === sceneId) || CAMPAIGN_ARRIVAL_SCENES[0] || null;
}
