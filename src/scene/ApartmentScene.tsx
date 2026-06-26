import { OrbitControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import {
  BODY_HEIGHT,
  PODIUM_HEIGHT,
  SCENE_TARGET_OFFSET_X,
  TOWER_HALF_SPACING,
  TOWER_ID_LEFT,
  TOWER_ID_RIGHT,
  TOWER7_SIDEWAYS_OFFSET_Z,
} from '../buildingConstants'
import type { FlatLookup } from '../flatLookup'
import { CompassMap } from './CompassMap'
import { SceneRoads } from './SceneRoads'
import { Tower } from './Tower'

export type SelectedHouse = {
  tower: number
  floor: number
  house: number
}

type ApartmentSceneProps = {
  flatLookup: FlatLookup
  selected: SelectedHouse | null
  onSelectHouse: (tower: number, floor: number, house: number) => void
}

const TARGET_Y = PODIUM_HEIGHT + BODY_HEIGHT / 2
const CAMERA_TARGET: [number, number, number] = [SCENE_TARGET_OFFSET_X, TARGET_Y, 0]
const MAX_CAMERA_DISTANCE = 160

const SCENE_BG = '#bfe3ff'

function SoftSunGlow() {
  const texture = useMemo(() => {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')

    if (ctx) {
      const center = size / 2
      const gradient = ctx.createRadialGradient(center, center, 0, center, center, center)
      gradient.addColorStop(0, 'rgba(255, 246, 210, 0.88)')
      gradient.addColorStop(0.22, 'rgba(255, 229, 157, 0.46)')
      gradient.addColorStop(0.55, 'rgba(255, 205, 108, 0.15)')
      gradient.addColorStop(1, 'rgba(255, 205, 108, 0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, size, size)
    }

    const glow = new THREE.CanvasTexture(canvas)
    glow.colorSpace = THREE.SRGBColorSpace
    return glow
  }, [])

  return (
    <sprite position={[82, 88, 72]} scale={[34, 34, 1]}>
      <spriteMaterial
        map={texture}
        transparent
        opacity={0.74}
        depthWrite={false}
        toneMapped={false}
        blending={THREE.AdditiveBlending}
      />
    </sprite>
  )
}

/** Compact site pad around the towers and roads. */
function VirtualGround() {
  const width = 104
  const depth = 86
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 4]}>
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial color="#d8e0d6" toneMapped={false} />
    </mesh>
  )
}

function CameraDistanceClamp() {
  useFrame(({ camera }) => {
    const [tx, ty, tz] = CAMERA_TARGET
    const dx = camera.position.x - tx
    const dy = camera.position.y - ty
    const dz = camera.position.z - tz
    const distance = Math.hypot(dx, dy, dz)

    if (distance <= MAX_CAMERA_DISTANCE) return

    const scale = MAX_CAMERA_DISTANCE / distance
    camera.position.set(tx + dx * scale, ty + dy * scale, tz + dz * scale)
  })

  return null
}

export function ApartmentScene({ flatLookup, selected, onSelectHouse }: ApartmentSceneProps) {
  return (
    <>
      <color attach="background" args={[SCENE_BG]} />

      <CameraDistanceClamp />

      <SoftSunGlow />

      <VirtualGround />

      <CompassMap />

      <SceneRoads />

      <Tower
        towerId={TOWER_ID_LEFT}
        position={[-TOWER_HALF_SPACING, 0, 0]}
        flatLookup={flatLookup}
        selected={selected}
        onSelectHouse={onSelectHouse}
      />
      <Tower
        towerId={TOWER_ID_RIGHT}
        position={[TOWER_HALF_SPACING, 0, TOWER7_SIDEWAYS_OFFSET_Z]}
        flatLookup={flatLookup}
        selected={selected}
        onSelectHouse={onSelectHouse}
      />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        enablePan
        enableZoom
        enableRotate
        rotateSpeed={1.8}
        zoomSpeed={1.25}
        minPolarAngle={0.12}
        maxPolarAngle={Math.PI / 2 - 0.05}
        minDistance={54}
        maxDistance={MAX_CAMERA_DISTANCE}
        target={CAMERA_TARGET}
      />
    </>
  )
}
