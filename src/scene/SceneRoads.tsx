import {
  TOWER_HALF_SPACING,
  TOWER7_SIDEWAYS_OFFSET_Z,
  TOWER_SPAN,
  VISUAL_SCALE,
} from '../buildingConstants'

/** Matches `podiumPad` in `Tower.tsx` — podium slab extends past shaft footprint. */
const PODIUM_PAD = 0.9 * VISUAL_SCALE
const podiumHalf = (TOWER_SPAN + PODIUM_PAD) / 2

const ASPHALT = '#3a3d42'
const MARKING = '#e8e8e6'

/** Keep roads clearly above the site pad to avoid shimmer at shallow camera angles. */
const ROAD_Y = 0.01

/** Extra gap beyond `curb` (world units). */
const EXTRA_ROAD_SETBACK = 2.0

function DashesAlongZ({ x, z0, z1, dash, gap }: { x: number; z0: number; z1: number; dash: number; gap: number }) {
  const items: { key: string; z: number }[] = []
  let z = z0 + dash / 2
  let i = 0
  while (z < z1 - dash * 0.2) {
    items.push({ key: `d${i}`, z })
    z += dash + gap
    i++
  }
  const w = TOWER_SPAN * 0.045
  return (
    <>
      {items.map(({ key, z }) => (
        <mesh key={key} rotation={[-Math.PI / 2, 0, 0]} position={[x, ROAD_Y + 0.002, z]}>
          <planeGeometry args={[w, dash * 0.88]} />
          <meshBasicMaterial color={MARKING} toneMapped={false} depthWrite={false} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-2} />
        </mesh>
      ))}
    </>
  )
}

function DashesAlongX({ z, x0, x1, dash, gap }: { z: number; x0: number; x1: number; dash: number; gap: number }) {
  const items: { key: string; x: number }[] = []
  let x = x0 + dash / 2
  let i = 0
  while (x < x1 - dash * 0.2) {
    items.push({ key: `d${i}`, x })
    x += dash + gap
    i++
  }
  const w = TOWER_SPAN * 0.045
  return (
    <>
      {items.map(({ key, x }) => (
        <mesh key={key} rotation={[-Math.PI / 2, 0, 0]} position={[x, ROAD_Y + 0.002, z]}>
          <planeGeometry args={[dash * 0.88, w]} />
          <meshBasicMaterial color={MARKING} toneMapped={false} depthWrite={false} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-2} />
        </mesh>
      ))}
    </>
  )
}

/**
 * Two-lane strip west of Tower 6 (−X), and a road toward **North** (−Z).
 * Compass: North −Z, West −X (`CompassMap.tsx`).
 */
export function SceneRoads() {
  const laneW = TOWER_SPAN * 0.11
  const roadW = laneW * 2
  const curb = TOWER_SPAN * 0.045

  const tower6CenterX = -TOWER_HALF_SPACING
  const tower6WestFace = tower6CenterX - podiumHalf
  const westRoadCenterX = tower6WestFace - curb - EXTRA_ROAD_SETBACK - roadW / 2

  const westRoadLen = TOWER_SPAN * 4.2
  const halfLen = westRoadLen / 2
  const dash = TOWER_SPAN * 0.14
  const gap = TOWER_SPAN * 0.1

  const tower7North = TOWER7_SIDEWAYS_OFFSET_Z - podiumHalf
  const tower6North = -podiumHalf
  const northExtentZ = Math.min(tower6North, tower7North)
  const northRoadCenterZ = northExtentZ - curb - EXTRA_ROAD_SETBACK - roadW / 2

  const northRoadLen = 2 * TOWER_HALF_SPACING + 2 * podiumHalf + TOWER_SPAN * 0.85
  const halfNorthLen = northRoadLen / 2

  return (
    <group>
      {/* West of Tower 6: two lanes along Z */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[westRoadCenterX, ROAD_Y, 0]}>
        <planeGeometry args={[roadW, westRoadLen]} />
        <meshBasicMaterial color={ASPHALT} toneMapped={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-1} />
      </mesh>
      <DashesAlongZ x={westRoadCenterX} z0={-halfLen} z1={halfLen} dash={dash} gap={gap} />

      {/* North: road along X */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, ROAD_Y, northRoadCenterZ]}>
        <planeGeometry args={[northRoadLen, roadW]} />
        <meshBasicMaterial color={ASPHALT} toneMapped={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-1} />
      </mesh>
      <DashesAlongX z={northRoadCenterZ} x0={-halfNorthLen} x1={halfNorthLen} dash={dash} gap={gap} />
    </group>
  )
}
