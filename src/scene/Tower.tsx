import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import {
  BODY_HEIGHT,
  DUPLEX_SHARED_FACADE_INDEX,
  FACADE_INSTANCE_COUNT,
  FLOOR_COUNT,
  FLOOR_HEIGHT,
  FLOOR_RULE_LINE_COUNT,
  FOOTPRINT_BASE,
  HOUSES_PER_FLOOR,
  PODIUM_HEIGHT,
  TOWER_ID_LEFT,
  TOWER_ID_RIGHT,
  TOWER_SPAN,
  VISUAL_SCALE,
  WINDOW_BAND_FRAC,
  facadeHouseIndexFromLogicalHouse,
  facadeIndexToFloorHouse,
  logicalHouseFromFacadeHouseIndex,
  floorBaseY,
  floorCenterY,
  getFloorHeight,
} from '../buildingConstants'
import type { FlatLookup } from '../flatLookup'
import { getWindowWireframeColor } from '../windowColors'

export type TowerBuildingId = typeof TOWER_ID_LEFT | typeof TOWER_ID_RIGHT

type TowerProps = {
  towerId: TowerBuildingId
  position: [number, number, number]
  flatLookup: FlatLookup
  selected: { tower: number; floor: number; house: number } | null
  onSelectHouse: (tower: number, floor: number, house: number) => void
}

const LINE_COLOR = '#9aa3ad'

/** Opaque shell so you cannot see façades on the opposite side through the volume. */
const SHELL_COLOR = '#d4d4d4'
const PODIUM_SHELL = '#c8c8c8'

/** Horizontal gap between adjacent façade cells on the same floor. */
const MARGIN_CELL = 0.1
const COL_HOVER = new THREE.Color('#d9a066')
/** “Lights on” — warm yellow when selected */
const COL_SELECT = new THREE.Color('#ffd54a')

const BAY_OFFSET = () => TOWER_SPAN / 4

function SolidBox({
  size,
  height,
  position,
  color,
}: {
  size: number
  height: number
  position: [number, number, number]
  color: string
}) {
  const geometry = useMemo(() => new THREE.BoxGeometry(size, height, size), [size, height])
  return (
    <mesh position={position} geometry={geometry}>
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}

function FloorRings({ half }: { half: number }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(FLOOR_RULE_LINE_COUNT * 4 * 6)
    let o = 0
    const h = half
    for (let k = 2; k <= FLOOR_COUNT; k++) {
      const y = floorBaseY(k)
      const segments: [number, number, number, number, number, number][] = [
        [-h, y, -h, h, y, -h],
        [h, y, -h, h, y, h],
        [h, y, h, -h, y, h],
        [-h, y, h, -h, y, -h],
      ]
      for (const seg of segments) {
        positions.set(seg, o)
        o += 6
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [half])

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={LINE_COLOR} toneMapped={false} />
    </lineSegments>
  )
}

/** Troika Text faces +local Z; each tuple places that plane flush on one façade (+X, −X, +Z, −Z). */
function floorLabelFaces(half: number, eps: number) {
  return [
    {
      id: 'nx',
      pos: (y: number): [number, number, number] => [-half - eps, y, 0],
      rot: [0, -Math.PI / 2, 0] as const,
    },
    {
      id: 'px',
      pos: (y: number): [number, number, number] => [half + eps, y, 0],
      rot: [0, Math.PI / 2, 0] as const,
    },
    {
      id: 'pz',
      pos: (y: number): [number, number, number] => [0, y, half + eps],
      rot: [0, 0, 0] as const,
    },
    {
      id: 'nz',
      pos: (y: number): [number, number, number] => [0, y, -half - eps],
      rot: [0, Math.PI, 0] as const,
    },
  ] as const
}

function FloorNumberLabels({ half }: { half: number }) {
  const labelSize = 0.44 * VISUAL_SCALE
  const eps = Math.max(0.012, 0.005 * TOWER_SPAN)
  const faces = useMemo(() => floorLabelFaces(half, eps), [half, eps])

  const labels = useMemo(() => {
    return Array.from({ length: FLOOR_COUNT }, (_, idx) => idx + 1)
  }, [])

  const textures = useMemo(() => {
    return labels.map((floor1) => {
      const size = 96
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')

      if (ctx) {
        ctx.clearRect(0, 0, size, size)
        ctx.fillStyle = '#f0f0ec'
        ctx.strokeStyle = '#383838'
        ctx.lineWidth = 3
        ctx.font = '700 34px Arial, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.strokeText(`F${floor1}`, size / 2, size / 2)
        ctx.fillText(`F${floor1}`, size / 2, size / 2)
      }

      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.needsUpdate = true
      return texture
    })
  }, [labels])

  return (
    <>
      {labels.flatMap((floor1, idx) =>
        faces.map((face) => (
          <sprite
            key={`${floor1}-${face.id}`}
            position={face.pos(floorCenterY(floor1))}
            rotation={face.rot}
            scale={[labelSize, labelSize, 1]}
          >
            <spriteMaterial map={textures[idx]} transparent depthWrite={false} toneMapped={false} />
          </sprite>
        )),
      )}
    </>
  )
}

function TowerNameLabel({ towerId, y }: { towerId: TowerBuildingId; y: number }) {
  const texture = useMemo(() => {
    const width = 384
    const height = 128
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')

    if (ctx) {
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#f0f0ec'
      ctx.strokeStyle = '#2c2c2c'
      ctx.lineWidth = 8
      ctx.font = '900 58px Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.strokeText(`Tower ${towerId}`, width / 2, height / 2)
      ctx.fillText(`Tower ${towerId}`, width / 2, height / 2)
    }

    const label = new THREE.CanvasTexture(canvas)
    label.colorSpace = THREE.SRGBColorSpace
    label.needsUpdate = true
    return label
  }, [towerId])

  return (
    <sprite position={[0, y, 0]} scale={[3.8 * VISUAL_SCALE, 1.25 * VISUAL_SCALE, 1]} renderOrder={8}>
      <spriteMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </sprite>
  )
}

function setHouseTransform(
  dummy: THREE.Object3D,
  houseIdx: number,
  cy: number,
  sy: number,
  half: number,
  inset: number,
): void {
  const bay = BAY_OFFSET()

  dummy.scale.set(1, sy, 1)

  if (houseIdx < 2) {
    const side = houseIdx === 0 ? -1 : 1
    dummy.position.set(side * bay, cy, half + inset)
    dummy.rotation.set(0, 0, 0)
  } else if (houseIdx < 4) {
    const side = houseIdx === 2 ? -1 : 1
    dummy.position.set(side * bay, cy, -half - inset)
    dummy.rotation.set(0, Math.PI, 0)
  } else if (houseIdx < 6) {
    const side = houseIdx === 4 ? -1 : 1
    dummy.position.set(half + inset, cy, side * bay)
    dummy.rotation.set(0, Math.PI / 2, 0)
  } else {
    const side = houseIdx === 6 ? -1 : 1
    dummy.position.set(-half - inset, cy, side * bay)
    dummy.rotation.set(0, -Math.PI / 2, 0)
  }

  dummy.updateMatrix()
}

export function Tower({ towerId, position, flatLookup, selected, onSelectHouse }: TowerProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const duplexDividerRef = useRef<THREE.InstancedMesh>(null)
  const baseRgb = useRef<Float32Array | null>(null)
  const [hoverId, setHoverId] = useState<number | null>(null)

  const half = TOWER_SPAN / 2
  const faceInset = 0.08 * (TOWER_SPAN / FOOTPRINT_BASE)

  const cellGeom = useMemo(() => {
    const tangent = Math.max(0.14, TOWER_SPAN / 4 - MARGIN_CELL * 2)
    const h = Math.max(0.1, FLOOR_HEIGHT - MARGIN_CELL * 2)
    const d = 0.1 * (TOWER_SPAN / FOOTPRINT_BASE)
    return new THREE.BoxGeometry(tangent, h, d)
  }, [])

  /**
   * Duplex (H5+H6): single flat partition wall — thin vertical slab, same opening height/depth as façade cells,
   * light gray so it reads as one interior wall between the two homes (not a mullion tube).
   */
  const duplexDividerGeom = useMemo(() => {
    const tangent = Math.max(0.14, TOWER_SPAN / 4 - MARGIN_CELL * 2)
    const h = Math.max(0.1, FLOOR_HEIGHT - MARGIN_CELL * 2)
    const cellDepth = 0.1 * (TOWER_SPAN / FOOTPRINT_BASE)
    const splitThickness = Math.max(0.026, tangent * 0.032)
    return new THREE.BoxGeometry(splitThickness, h, cellDepth * 0.98)
  }, [])

  const duplexDividerMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#d9dde2',
        toneMapped: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        depthWrite: false,
      }),
    [],
  )

  /** Nudge past the glass so the partition stays visible (same idea as window cells). */
  const duplexOutward = 0.042 * (TOWER_SPAN / FOOTPRINT_BASE)

  const cellMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        /** Must be false: BoxGeometry has no vertex `color` attr; true zeros diffuse → black façades. */
        vertexColors: false,
        wireframe: false,
        toneMapped: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -0.5,
        polygonOffsetUnits: -0.5,
      }),
    [],
  )

  const selectedInstanceId = useMemo(() => {
    if (!selected || selected.tower !== towerId) return null
    return (
      (selected.floor - 1) * HOUSES_PER_FLOOR + facadeHouseIndexFromLogicalHouse(selected.house)
    )
  }, [selected, towerId])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const dummy = new THREE.Object3D()

    if (!baseRgb.current || baseRgb.current.length !== FACADE_INSTANCE_COUNT * 3) {
      baseRgb.current = new Float32Array(FACADE_INSTANCE_COUNT * 3)
    }

    let i = 0
    for (let floorIdx = 0; floorIdx < FLOOR_COUNT; floorIdx++) {
      const floor1 = floorIdx + 1
      const fh = getFloorHeight(floor1)
      const cy = floorCenterY(floor1)
      const sy = (fh * WINDOW_BAND_FRAC) / FLOOR_HEIGHT

      for (let hi = 0; hi < HOUSES_PER_FLOOR; hi++) {
        const house1 = logicalHouseFromFacadeHouseIndex(hi)
        setHouseTransform(dummy, hi, cy, sy, half, faceInset)
        mesh.setMatrixAt(i, dummy.matrix)
        const col = getWindowWireframeColor(towerId, floor1, house1, flatLookup)
        mesh.setColorAt(i, col)
        col.toArray(baseRgb.current, i * 3)
        i++
      }
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    mesh.computeBoundingBox()
  }, [cellGeom, flatLookup, half, faceInset, towerId])

  /** Duplex mullion: separate pass + rAF so matrices apply after the divider instancedMesh mounts. */
  useLayoutEffect(() => {
    const outward = new THREE.Vector3()
    const dummy = new THREE.Object3D()

    const fill = () => {
      const divMesh = duplexDividerRef.current
      if (!divMesh) return

      for (let floorIdx = 0; floorIdx < FLOOR_COUNT; floorIdx++) {
        const floor1 = floorIdx + 1
        const fh = getFloorHeight(floor1)
        const cy = floorCenterY(floor1)
        const sy = (fh * WINDOW_BAND_FRAC) / FLOOR_HEIGHT

        setHouseTransform(dummy, DUPLEX_SHARED_FACADE_INDEX, cy, sy, half, faceInset)
        outward.set(0, 0, 1).applyQuaternion(dummy.quaternion).multiplyScalar(duplexOutward)
        dummy.position.add(outward)
        divMesh.setMatrixAt(floorIdx, dummy.matrix)
      }

      divMesh.instanceMatrix.needsUpdate = true
      divMesh.computeBoundingSphere()
    }

    fill()
    const id = requestAnimationFrame(fill)
    return () => cancelAnimationFrame(id)
  }, [half, faceInset, duplexOutward])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh || !baseRgb.current) return

    const c = new THREE.Color()
    for (let i = 0; i < FACADE_INSTANCE_COUNT; i++) {
      c.fromArray(baseRgb.current, i * 3)
      if (selectedInstanceId === i) {
        c.copy(COL_SELECT)
      } else if (hoverId === i) {
        c.copy(COL_HOVER)
      }
      mesh.setColorAt(i, c)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [hoverId, selectedInstanceId, flatLookup])

  /** Resolve `instanceId` for this tower’s mesh via intersection `uuid` (two InstancedMeshes share ray order ambiguity). */
  function instanceIdFromEvent(e: ThreeEvent<PointerEvent>): number | undefined {
    const uuid = meshRef.current?.uuid
    if (uuid) {
      const mine = e.intersections.find(
        (x) => x.object.uuid === uuid && typeof x.instanceId === 'number' && Number.isFinite(x.instanceId),
      )
      if (mine) return mine.instanceId
    }
    const id = e.instanceId
    if (typeof id === 'number' && Number.isFinite(id)) return id
    return undefined
  }

  const handlePick = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const instanceId = instanceIdFromEvent(e)
    if (instanceId === undefined || instanceId < 0 || instanceId >= FACADE_INSTANCE_COUNT) return
    const { floor, house } = facadeIndexToFloorHouse(instanceId)
    onSelectHouse(towerId, floor, house)
  }

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    const instanceId = instanceIdFromEvent(e)
    if (instanceId === undefined || instanceId < 0 || instanceId >= FACADE_INSTANCE_COUNT) return
    setHoverId((prev) => (prev === instanceId ? prev : instanceId))
  }

  const handleOut = () => setHoverId(null)

  const centerY = PODIUM_HEIGHT + BODY_HEIGHT / 2
  const podiumPad = 0.9 * VISUAL_SCALE
  const crownH = 0.22 * VISUAL_SCALE
  const crownCenterY = PODIUM_HEIGHT + BODY_HEIGHT + 0.12 * VISUAL_SCALE
  const crownTopY = crownCenterY + crownH / 2 + 0.1 * VISUAL_SCALE
  /** Lift the nameplate above the crown so it reads clear of the roof mass. */
  const towerNameLabelY = crownTopY + 0.35 * VISUAL_SCALE

  return (
    <group position={position}>
      <SolidBox
        size={TOWER_SPAN + podiumPad}
        height={PODIUM_HEIGHT}
        position={[0, PODIUM_HEIGHT / 2, 0]}
        color={PODIUM_SHELL}
      />
      <SolidBox size={TOWER_SPAN} height={BODY_HEIGHT} position={[0, centerY, 0]} color={SHELL_COLOR} />
      <SolidBox
        size={TOWER_SPAN * 0.92}
        height={crownH}
        position={[0, crownCenterY, 0]}
        color={SHELL_COLOR}
      />

      <TowerNameLabel towerId={towerId} y={towerNameLabelY} />

      <FloorRings half={half} />
      <FloorNumberLabels half={half} />

      <instancedMesh
        ref={meshRef}
        args={[cellGeom, cellMat, FACADE_INSTANCE_COUNT]}
        frustumCulled={false}
        renderOrder={1}
        onClick={handlePick}
        onPointerMove={handleMove}
        onPointerOut={handleOut}
      />

      {/* Duplex H5+H6: shared opening — light gray partition wall (non-pickable; draws after windows). */}
      <instancedMesh
        ref={duplexDividerRef}
        args={[duplexDividerGeom, duplexDividerMat, FLOOR_COUNT]}
        frustumCulled={false}
        renderOrder={4}
        raycast={() => null}
      />
    </group>
  )
}
