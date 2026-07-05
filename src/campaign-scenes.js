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

/**
 * Campaign dialogue entries for the speech bubble system.
 * Each entry: { id, text, speaker?, trigger? }
 *   - id      unique identifier (used by triggerDialogue('arrival_1'))
 *   - text    the displayed line (supports long text — wraps automatically)
 *   - speaker defaults to 'player'
 *   - trigger a hint for which game event fires this dialogue (documentary)
 *
 * Add new entries here and trigger them from game events via game.triggerDialogue(id).
 */
export const CAMPAIGN_DIALOGUES = Object.freeze([
  {
    id: 'arrival_1',
    pages: [
      'Finally arrived... what a nice place.',
      'The lake, the trees, the quiet. This is going to be home now.',
      'The van is packed tight — let me unpack it and see what we brought. Right-click the van to open it up!'
    ],
    speaker: 'player',
    trigger: 'arrival_complete'
  },
  {
    id: 'quest1_van_prompt',
    text: 'The van is packed tight. Right-click the van to unpack it!',
    speaker: 'player',
    trigger: 'quest_1_start'
  },
  {
    id: 'quest1_axe_dropped',
    text: 'An axe! That will be useful. Let me grab it and try chopping one of those trees.',
    speaker: 'player',
    trigger: 'quest_1_axe_dropped'
  },
  {
    id: 'quest2_start',
    text: 'Pick up the axe, then find a tree to chop. Right-click the tree while holding the axe.',
    speaker: 'player',
    trigger: 'quest_2_start'
  },
  {
    id: 'quest2_tree_chopped',
    text: 'Timber! The axe did the trick. Now let me set it down — press Q to drop it.',
    speaker: 'player',
    trigger: 'quest_2_tree_chopped'
  },
  {
    id: 'quest2_complete',
    text: 'Good, hands free again. Back to the van — I think there is more inside.',
    speaker: 'player',
    trigger: 'quest_2_complete'
  },
  {
    id: 'quest3_bot_dropped',
    pages: [
      'A helper bot! These little guys can do the boring work for us... if we teach them.',
      'They learn by watching. Do the task yourself once, and they will repeat it forever.',
      'But first — let me unpack the van again and see what else is in there.'
    ],
    speaker: 'player',
    trigger: 'quest_3_bot_dropped'
  },
  {
    id: 'quest4_teach_prompt',
    pages: [
      'Right-click the bot to open its menu.',
      'Teach it to pick up the axe and chop a tree — show it by doing!',
      'Once it has a program assigned, it will work on its own.'
    ],
    speaker: 'player',
    trigger: 'quest_4_start'
  },
  {
    id: 'quest4_bot_taught',
    text: 'It is learning! Once it chops a tree on its own, the real automation begins.',
    speaker: 'player',
    trigger: 'quest_4_bot_taught'
  },
  {
    id: 'quest5_storage_dropped',
    text: 'A storage building, in pieces. Pick up the kit and find a good spot to place it.',
    speaker: 'player',
    trigger: 'quest_5_storage_dropped'
  },
  {
    id: 'quest5_storage_placed',
    text: 'Perfect. Now we have somewhere to store things. Time to fill it with wood.',
    speaker: 'player',
    trigger: 'quest_5_storage_placed'
  },
  {
    id: 'quest6_start',
    text: 'Chop trees and bring the logs to the storage building. We need at least 10.',
    speaker: 'player',
    trigger: 'quest_6_start'
  },
  {
    id: 'quest6_complete',
    text: 'That is a full stockpile! The camp is taking shape.',
    speaker: 'player',
    trigger: 'quest_6_complete'
  },
  {
    id: 'quest7_shovel_dropped',
    text: 'A shovel. The ground here looks soft enough to dig.',
    speaker: 'player',
    trigger: 'quest_7_shovel_dropped'
  },
  {
    id: 'quest8_start',
    text: 'Pick up the shovel and dig 5 holes. Then drop the shovel.',
    speaker: 'player',
    trigger: 'quest_8_start'
  },
  {
    id: 'quest8_complete',
    text: 'Five holes, ready for planting. The forest will provide seeds.',
    speaker: 'player',
    trigger: 'quest_8_complete'
  },
  {
    id: 'quest9_start',
    text: 'Chop more trees to get seeds, then plant them in the holes. A new grove begins.',
    speaker: 'player',
    trigger: 'quest_9_start'
  },
  {
    id: 'quest9_complete',
    pages: [
      'And there it is — our first grove.',
      'Seeds in the ground, logs in the shed, a bot chopping wood on its own.',
      'The camp is self-sustaining now. Well done.'
    ],
    speaker: 'player',
    trigger: 'quest_9_complete'
  }
]);

export function getCampaignArrivalScene(sceneId = CAMPAIGN_ARRIVAL_SCENES[0]?.id || '') {
  return CAMPAIGN_ARRIVAL_SCENES.find(scene => scene.id === sceneId) || CAMPAIGN_ARRIVAL_SCENES[0] || null;
}
