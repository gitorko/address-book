import * as THREE from 'three'
import { flatLookupKey, isFireRefugeCoordinates, isFireRefugeFlat } from './flatConfig'
import type { FlatLookup } from './flatLookup'

/** Listed in config but no owner string — treat as vacant / white. */
export const UNASSIGNED_WINDOW_COLOR = '#ffffff'

/** Row exists in directory with an owner — neutral gray infill. */
export const ASSIGNED_WINDOW_COLOR = '#aeb5bf'

/** Fire refuge areas are shown in red and should never be assigned to owners. */
export const FIRE_REFUGE_WINDOW_COLOR = '#dc2626'

/** Duplex façade: logical houses **5** and **6** share one window — occupied if either flat is listed. */
export function getWindowWireframeColor(
  tower: number,
  floor: number,
  house: number,
  lookup: FlatLookup,
): THREE.Color {
  if (isFireRefugeCoordinates(tower, floor, house)) {
    return new THREE.Color(FIRE_REFUGE_WINDOW_COLOR)
  }

  const keys =
    house === 5 || house === 6
      ? [flatLookupKey(tower, floor, 5), flatLookupKey(tower, floor, 6)]
      : [flatLookupKey(tower, floor, house)]

  const fireRefuge = keys.some((key) => {
    const info = lookup.get(key)
    return info ? isFireRefugeFlat({ tower, floor, house, flatNo: info.flatNo, details: info.details }) : false
  })

  if (fireRefuge) {
    return new THREE.Color(FIRE_REFUGE_WINDOW_COLOR)
  }

  const occupied = keys.some((key) => {
    const info = lookup.get(key)
    return Boolean(info?.owner?.trim())
  })

  if (!occupied) {
    return new THREE.Color(UNASSIGNED_WINDOW_COLOR)
  }

  return new THREE.Color(ASSIGNED_WINDOW_COLOR)
}
