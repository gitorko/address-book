/** Logical ids used in UI and `flats.config.json` (left / right as seen from default camera). */
export const TOWER_ID_LEFT = 6
export const TOWER_ID_RIGHT = 7

/**
 * Fraction of each floor slab used by the window band vertically.
 * Lower = more spacer between floors (windows read less cramped).
 */
export const WINDOW_BAND_FRAC = 0.5

/**
 * Floors per tower — top floor (F30) is a taller double-height garden deck (see `getFloorHeight`).
 */
export const FLOOR_COUNT = 30

/** Instancing slots per floor (unchanged mesh layout): South (+Z) pair, −Z, +X, −X. */
export const HOUSES_PER_FLOOR = 8

/** Logical house numbers in config / flat codes (`parseFlatNo` last digit): **1–9** (5 & 6 share one façade slot). */
export const LOGICAL_HOUSE_MAX = 9

/** Façade index for the duplex opening (logical houses **5** and **6** share this mesh). */
export const DUPLEX_SHARED_FACADE_INDEX = 3

/**
 * Clockwise perimeter after renumbering: old **7→8**, **8→9**; former **6** (east) → **7**.
 * **hi 3** → logical **5** (duplex with **6**); houses **6** also maps to hi **3** via `facadeHouseIndexFromLogicalHouse`.
 *
 * hi:  0   1   2   3         4   5   6   7
 * H:   1   9   4   5(dup6) 7   8   3   2
 */
const FACADE_INDEX_TO_LOGICAL_HOUSE = [1, 9, 4, 5, 7, 8, 3, 2] as const

/** Façade slot `hi` (0–7) → logical house for picks / labels (duplex reports **5**). */
export function logicalHouseFromFacadeHouseIndex(hi: number): number {
  return FACADE_INDEX_TO_LOGICAL_HOUSE[hi] ?? hi + 1
}

/** Logical house **1–9** → façade slot **0–7** (`5` and `6` → **3**). */
export function facadeHouseIndexFromLogicalHouse(house1: number): number {
  if (house1 === 5 || house1 === 6) return DUPLEX_SHARED_FACADE_INDEX
  const map: Record<number, number> = {
    1: 0,
    2: 7,
    3: 6,
    4: 2,
    7: 4,
    8: 5,
    9: 1,
  }
  return map[house1] ?? Math.max(0, Math.min(HOUSES_PER_FLOOR - 1, house1 - 1))
}

/** Uniform scale for the whole model — larger buildings / footprint / spacing. */
export const VISUAL_SCALE = 4.35

const BASE = {
  podium: 0.55,
  /** Taller slabs: more slab between window bands without adding floors (unscaled module). */
  floorH: 0.48,
  /** Square footprint — same extent on X and Z (unscaled module). */
  span: 4.2,
} as const

/** Same as `BASE.span` — for depth inset ratios next to `TOWER_SPAN`. */
export const FOOTPRINT_BASE = BASE.span

export const PODIUM_HEIGHT = BASE.podium * VISUAL_SCALE

/** Typical residential slab-to-slab height (floors 1 … FLOOR_COUNT − 1). */
export const FLOOR_HEIGHT = BASE.floorH * VISUAL_SCALE

/** Tower footprint is square: same width and depth. */
export const TOWER_SPAN = BASE.span * VISUAL_SCALE

/**
 * Top floor — double-height garden deck.
 */
export const TOP_FLOOR_HEIGHT_SCALE = 2.35

export const TOP_FLOOR_HEIGHT = FLOOR_HEIGHT * TOP_FLOOR_HEIGHT_SCALE

/** Y-height of slab `floor` (1-based): standard floors, last floor is the garden deck. */
export function getFloorHeight(floor1: number): number {
  if (floor1 === FLOOR_COUNT) return TOP_FLOOR_HEIGHT
  return FLOOR_HEIGHT
}

/** World Y at the bottom of floor `floor1` (top of podium = start of floor 1). */
export function floorBaseY(floor1: number): number {
  let y = PODIUM_HEIGHT
  for (let f = 1; f < floor1; f++) {
    y += getFloorHeight(f)
  }
  return y
}

/** World Y at the center of floor `floor1` (for placing façade cells). */
export function floorCenterY(floor1: number): number {
  return floorBaseY(floor1) + getFloorHeight(floor1) / 2
}

/** Sum of all floor stacks (excludes podium and crown adornment). */
export function getBodyHeight(): number {
  let h = 0
  for (let f = 1; f <= FLOOR_COUNT; f++) {
    h += getFloorHeight(f)
  }
  return h
}

/** Cached shaft height — main box uses this. */
export const BODY_HEIGHT = getBodyHeight()

/** Half-distance between tower centers on the X axis. */
export const TOWER_HALF_SPACING = 5.35 * VISUAL_SCALE

/**
 * Sideways shift of tower 7’s center vs tower 6: along **Z**, perpendicular to the tower row (**X**).
 * Compass (`CompassMap.tsx`): North **−Z**, South **+Z**, East **+X** (Tower 7), West **−X** (Tower 6).
 * Does not change spacing along **X** between centers (`2 * TOWER_HALF_SPACING`).
 * Uses a fraction of footprint so tower 7 clears tower 6 in depth from the default view (tiny inch-based
 * shifts were negligible vs `TOWER_SPAN`). Negate for the opposite sideways direction.
 */
export const TOWER7_SIDEWAYS_OFFSET_Z = -(TOWER_SPAN * 0.32)

/**
 * Orbit `target` shift on X (positive = toward tower 7 / right from default view).
 */
export const SCENE_TARGET_OFFSET_X = TOWER_HALF_SPACING * 0.22

/** Instanced façade cells per tower (all four faces). */
export const FACADE_INSTANCE_COUNT = FLOOR_COUNT * HOUSES_PER_FLOOR

/** Map instanced façade `instanceId` → 1-based floor / logical house (matches `flats.config.json`). */
export function facadeIndexToFloorHouse(instanceId: number): { floor: number; house: number } {
  const hi = instanceId % HOUSES_PER_FLOOR
  return {
    floor: Math.floor(instanceId / HOUSES_PER_FLOOR) + 1,
    house: logicalHouseFromFacadeHouseIndex(hi),
  }
}

/** One horizontal ring per floor junction (between stacked floors). */
export const FLOOR_RULE_LINE_COUNT = FLOOR_COUNT - 1
