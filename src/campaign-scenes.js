export const CAMPAIGN_MAP_SIZE = Object.freeze({ width: 12000, height: 9000 });

export const CAMPAIGN_START = Object.freeze({
  x: 1080,
  y: CAMPAIGN_MAP_SIZE.height - 860
});

/**
 * Canyon terrain feature — a semicircular band (ring segment) centered on the
 * spawn area, cutting off the lands beyond the playable region. The impassable
 * band runs from inner radius to outer radius around an arc that faces away
 * from the spawn corner (bottom-left). A small gap is left for the bridge quest.
 *
 * `generateCanyonPolygon` produces a closed polygon approximation (~60 inner +
 * ~60 outer points) suitable for the collision system and canvas rendering.
 *
 * Angles are measured from east (+x), increasing clockwise in screen space
 * (because +y points "down"). Spawn is at bottom-left (θ ∈ (π, 3π/2)); the
 * canyon arc sweeps from north (top edge, θ = -π/2) through east (right edge)
 * and south (bottom-right area) to west (left edge, θ = π) — i.e. the half
 * of the circle NOT containing the spawn corner.
 */
export const CANYON_CONFIG = Object.freeze({
  center: Object.freeze({ x: CAMPAIGN_START.x, y: CAMPAIGN_START.y }),
  innerRadius: 4400,
  outerRadius: 4600,
  startAngle: -Math.PI / 2, // north (top edge of map)
  endAngle: Math.PI,        // west (left edge of map)
  segments: 60,
  // Bridge gap — a small angular window where the impassable zone is split
  // into two polygons. The bridge structure sits in the gap.
  bridgeAngle: -Math.PI / 4, // 45° up-right from center (toward far corner)
  bridgeHalfWidth: 0.045    // radians (~2.6°) — narrow gap
});

/**
 * Build canyon polygon(s) from config. Returns an array of polygons (each a
 * list of `{x, y}` points). With the bridge gap enabled (default), returns
 * two polygons split around the gap. Pass `withBridgeGap: false` for a single
 * solid band polygon.
 */
export function generateCanyonPolygon(config = CANYON_CONFIG, options = {}) {
  const { center, innerRadius, outerRadius, segments, bridgeAngle, bridgeHalfWidth } = config;
  const withBridgeGap = options.withBridgeGap !== false;
  const startAngle = config.startAngle;
  const endAngle = config.endAngle;
  const span = endAngle - startAngle;
  const buildArc = (r, fromAngle, toAngle, segs, reverse) => {
    const pts = [];
    const count = Math.max(1, segs);
    const step = (toAngle - fromAngle) / count;
    for (let i = 0; i <= count; i++) {
      const t = reverse ? count - i : i;
      const a = fromAngle + t * step;
      pts.push({ x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r });
    }
    return pts;
  };
  if (!withBridgeGap) {
    const inner = buildArc(innerRadius, startAngle, endAngle, segments, false);
    const outer = buildArc(outerRadius, startAngle, endAngle, segments, true);
    return [inner.concat(outer)];
  }
  // Split into two polygons around the bridge gap.
  const aEnd = bridgeAngle - bridgeHalfWidth;
  const bStart = bridgeAngle + bridgeHalfWidth;
  const segsA = Math.max(8, Math.round(segments * (aEnd - startAngle) / span));
  const segsB = Math.max(8, Math.round(segments * (endAngle - bStart) / span));
  const polyA = buildArc(innerRadius, startAngle, aEnd, segsA, false)
    .concat(buildArc(outerRadius, startAngle, aEnd, segsA, true));
  const polyB = buildArc(innerRadius, bStart, endAngle, segsB, false)
    .concat(buildArc(outerRadius, bStart, endAngle, segsB, true));
  return [polyA, polyB];
}

/**
 * World position of the bridge across the canyon gap. Sits at the midpoint
 * radius between inner and outer, at the bridge angle.
 */
export const CANYON_BRIDGE_POSITION = Object.freeze({
  x: CANYON_CONFIG.center.x + Math.cos(CANYON_CONFIG.bridgeAngle) * ((CANYON_CONFIG.innerRadius + CANYON_CONFIG.outerRadius) / 2),
  y: CANYON_CONFIG.center.y + Math.sin(CANYON_CONFIG.bridgeAngle) * ((CANYON_CONFIG.innerRadius + CANYON_CONFIG.outerRadius) / 2),
  angle: CANYON_CONFIG.bridgeAngle
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
  },
  // ═════════════════════════════════════════════════════════
  // Chapter II — Industry (Q10–Q15)
  // ═════════════════════════════════════════════════════════
  {
    id: 'quest10_start',
    text: 'Raw logs are bulky. A sawbench turns them into planks — the real building blocks. Right-click the van to unpack the sawbench kit.',
    speaker: 'player',
    trigger: 'quest_10_start'
  },
  {
    id: 'quest10_van_drop',
    text: 'A sawbench kit! Pick it up and place it somewhere flat. Then carry a log to it and let it process.',
    speaker: 'player',
    trigger: 'quest_10_van_drop'
  },
  {
    id: 'quest10_complete',
    text: 'Planks! Now we are building. These are the bones of everything from here on.',
    speaker: 'player',
    trigger: 'quest_10_complete'
  },
  {
    id: 'quest11_start',
    text: 'Planks can go further — feed them back into the sawbench to split into poles. Thinner, lighter, perfect for tool handles.',
    speaker: 'player',
    trigger: 'quest_11_start'
  },
  {
    id: 'quest11_complete',
    text: 'Poles. The ingredient chain grows: log → plank → pole. Each step adds refinement.',
    speaker: 'player',
    trigger: 'quest_11_complete'
  },
  {
    id: 'quest12_start',
    text: 'The van has a workbench kit. With planks, poles, and sticks, we can craft proper tools — not just that crude axe.',
    speaker: 'player',
    trigger: 'quest_12_start'
  },
  {
    id: 'quest12_van_drop',
    text: 'A workbench kit. Pick it up and place it near the sawbench.',
    speaker: 'player',
    trigger: 'quest_12_van_drop'
  },
  {
    id: 'quest12_complete',
    text: 'A proper workbench. Now we can craft tools — pickaxes, shovels, hammers. Each one speeds up a different job.',
    speaker: 'player',
    trigger: 'quest_12_complete'
  },
  {
    id: 'quest13_start',
    text: 'A pickaxe! Deposit sticks and stone into the workbench to craft one. Mining stone without it takes forever.',
    speaker: 'player',
    trigger: 'quest_13_start'
  },
  {
    id: 'quest13_complete',
    text: 'A crude pickaxe. Those rock deposits have been sitting there since we arrived — time to crack them open.',
    speaker: 'player',
    trigger: 'quest_13_complete'
  },
  {
    id: 'quest14_start',
    text: 'Equip the pickaxe and right-click a stone deposit. Let\'s see what is inside.',
    speaker: 'player',
    trigger: 'quest_14_start'
  },
  {
    id: 'quest14_complete',
    text: 'Stone! Now we have all three raw resources: wood, stone, and seeds. The full material base.',
    speaker: 'player',
    trigger: 'quest_14_complete'
  },
  {
    id: 'quest15_start',
    text: 'You are hauling logs by hand again. Teach a bot to do it — pick up a log, carry it to the sawbench, deposit. Record that loop and assign it.',
    speaker: 'player',
    trigger: 'quest_15_start'
  },
  {
    id: 'quest15_complete',
    text: 'Automated plank production. The first real supply chain. This is the template for everything ahead.',
    speaker: 'player',
    trigger: 'quest_15_complete'
  },
  // ═════════════════════════════════════════════════════════
  // Chapter III — Automation at Scale (Q16–Q19)
  // ═════════════════════════════════════════════════════════
  {
    id: 'quest16_start',
    text: 'Your bots only know basic tasks. Knowledge packs teach them new skills. Give one the Woodworking pack — it will learn to run the sawbench on its own.',
    speaker: 'player',
    trigger: 'quest_16_start'
  },
  {
    id: 'quest16_complete',
    text: 'A woodworking specialist. This bot can now process planks and poles autonomously. Specialization is the key to scale.',
    speaker: 'player',
    trigger: 'quest_16_complete'
  },
  {
    id: 'quest17_start',
    text: 'Two bots, two jobs: one chops, one mills. Watch the planks pile up without lifting a finger. This is what the camp should feel like.',
    speaker: 'player',
    trigger: 'quest_17_start'
  },
  {
    id: 'quest17_complete',
    text: 'Compound automation. Each bot multiplies the others. The supply chain runs itself now.',
    speaker: 'player',
    trigger: 'quest_17_complete'
  },
  {
    id: 'quest18_start',
    text: 'Too many bots to manage one by one? Make one a Manager. Promote a bot and delegate tasks to it.',
    speaker: 'player',
    trigger: 'quest_18_start'
  },
  {
    id: 'quest18_manager_prompt',
    text: 'Good — you have a manager. Now delegate: tell it to assign work to the other bots.',
    speaker: 'player',
    trigger: 'quest_18_manager_prompt'
  },
  {
    id: 'quest18_complete',
    text: 'Hands-off coordination. The manager handles the details. You design the system, not the steps.',
    speaker: 'player',
    trigger: 'quest_18_complete'
  },
  {
    id: 'quest19_start',
    text: 'The van has one more thing — a bot factory. Feed it logs, planks, poles, and a seed, and it will assemble a brand new worker.',
    speaker: 'player',
    trigger: 'quest_19_start'
  },
  {
    id: 'quest19_van_drop',
    text: 'A factory kit. Place it, supply it with materials, and it will build bots for you.',
    speaker: 'player',
    trigger: 'quest_19_van_drop'
  },
  {
    id: 'quest19_complete',
    text: 'A self-replicating workforce. Bots gather materials → factory builds more bots → more bots gather more. This is exponential growth.',
    speaker: 'player',
    trigger: 'quest_19_complete'
  },
  // ═════════════════════════════════════════════════════════
  // Chapter IV — Arms & Defense (Q20–Q25)
  // ═════════════════════════════════════════════════════════
  {
    id: 'quest20_start',
    pages: [
      'Something is out there. I have heard it at night.',
      'We need to be ready. The van has a smithery — set it up.'
    ],
    speaker: 'player',
    trigger: 'quest_20_start'
  },
  {
    id: 'quest20_van_drop',
    text: 'A smithery kit. Place it near the workbench. Stone is the key ingredient for weapons.',
    speaker: 'player',
    trigger: 'quest_20_van_drop'
  },
  {
    id: 'quest20_complete',
    text: 'The smithery is ready. Planks and stone go in — swords and shields come out.',
    speaker: 'player',
    trigger: 'quest_20_complete'
  },
  {
    id: 'quest21_start',
    text: 'Deposit planks and stone into the smithery. Craft a sword to strike, a shield to block. Equip both — you will attack automatically when enemies get close.',
    speaker: 'player',
    trigger: 'quest_21_start'
  },
  {
    id: 'quest21_complete',
    text: 'Armed and ready. The auto-attack will trigger when threats are in range. But defense is more than a sword...',
    speaker: 'player',
    trigger: 'quest_21_complete'
  },
  {
    id: 'quest22_start',
    text: 'They come at night. Stay near the fire, keep your sword ready. Just survive until dawn.',
    speaker: 'player',
    trigger: 'quest_22_start'
  },
  {
    id: 'quest22_survived',
    pages: [
      'Dawn. They are gone. But they will be back.',
      'We need walls. We need towers. We need to be ready for next time.'
    ],
    speaker: 'player',
    trigger: 'quest_22_survived'
  },
  {
    id: 'quest23_start',
    text: 'A defense tower fires arrows on its own — no bot needed. Place one where the monsters came from last night.',
    speaker: 'player',
    trigger: 'quest_23_start'
  },
  {
    id: 'quest23_complete',
    text: 'The tower watches. Passive defense — always on, always vigilant. The first layer of our perimeter.',
    speaker: 'player',
    trigger: 'quest_23_complete'
  },
  {
    id: 'quest24_start',
    text: 'Bots can fight too. Give one the Combat pack and a sword. Toggle it to aggressive — it will break from work to fight, then pick up where it left off.',
    speaker: 'player',
    trigger: 'quest_24_start'
  },
  {
    id: 'quest24_complete',
    text: 'A combat bot. It works when it is safe, fights when it is not. The camp is starting to defend itself.',
    speaker: 'player',
    trigger: 'quest_24_complete'
  },
  {
    id: 'quest25_start',
    text: 'Swords are close-range. For distance, we need bows. Build a bowmaker and an arrowmaker. Craft a bow and arrow pack — equip the pack to load 10 arrows.',
    speaker: 'player',
    trigger: 'quest_25_start'
  },
  {
    id: 'quest25_complete',
    text: 'Ranged combat ready. Melee for close, bow for distance, ammunition as a consumable. The full weapons tree.',
    speaker: 'player',
    trigger: 'quest_25_complete'
  },
  // ═════════════════════════════════════════════════════════
  // Chapter V — The Garrison (Q26–Q29)
  // ═════════════════════════════════════════════════════════
  {
    id: 'quest26_start',
    text: 'Towers are static. A patrol bot moves. Teach one to walk a route around the camp and attack anything hostile it finds.',
    speaker: 'player',
    trigger: 'quest_26_start'
  },
  {
    id: 'quest26_complete',
    text: 'Mobile defense. The patrol sweeps the perimeter and engages threats on the move.',
    speaker: 'player',
    trigger: 'quest_26_complete'
  },
  {
    id: 'quest27_start',
    text: 'A patrol sweeps. A guard holds. Assign a bot to guard a chokepoint — it will stay put and intercept anything in its zone.',
    speaker: 'player',
    trigger: 'quest_27_start'
  },
  {
    id: 'quest27_complete',
    text: 'Three defense layers now: towers for passive fire, guards for chokepoints, patrols for the perimeter.',
    speaker: 'player',
    trigger: 'quest_27_complete'
  },
  {
    id: 'quest28_start',
    text: 'The factory is the key. Build more bots. Some work, some fight. A manager can coordinate them all. Scale up — the camp needs to run itself while you command the defense.',
    speaker: 'player',
    trigger: 'quest_28_start'
  },
  {
    id: 'quest28_complete',
    text: 'A self-defending, self-sustaining camp with a military wing. Production feeds the war effort; the war effort protects production.',
    speaker: 'player',
    trigger: 'quest_28_complete'
  },
  {
    id: 'quest29_start',
    pages: [
      'This is the big one.',
      'They are coming in waves tonight — more than before.',
      'Hold the line. Every tower, every guard, every patrol. This is what we built for.'
    ],
    speaker: 'player',
    trigger: 'quest_29_start'
  },
  {
    id: 'quest29_finale',
    pages: [
      'Dawn. And the camp stands.',
      'Towers intact, bots still working, not a single structure lost.',
      'You have built something real here. A home that feeds itself, defends itself, grows itself.',
      'The grove is yours now.'
    ],
    speaker: 'player',
    trigger: 'quest_29_finale'
  },
  // ═════════════════════════════════════════════════════════
  // Epilogue — The Bridge (Q30)
  // ═════════════════════════════════════════════════════════
  {
    id: 'quest30_start',
    pages: [
      'The canyon cuts off the lands beyond.',
      'A bridge must be built. Gather logs, planks, poles, and stones — then assign your bots to build.'
    ],
    speaker: 'player',
    trigger: 'quest_30_start'
  },
  {
    id: 'quest30_complete',
    pages: [
      'The bridge stands.',
      'New lands lie open beyond the chasm.'
    ],
    speaker: 'player',
    trigger: 'quest_30_complete'
  }
]);

export function getCampaignArrivalScene(sceneId = CAMPAIGN_ARRIVAL_SCENES[0]?.id || '') {
  return CAMPAIGN_ARRIVAL_SCENES.find(scene => scene.id === sceneId) || CAMPAIGN_ARRIVAL_SCENES[0] || null;
}
