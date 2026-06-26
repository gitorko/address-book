import * as THREE from 'three'
import { flatLookupKey } from './flatConfig'
import type { FlatLookup } from './flatLookup'

/** Listed in config but no owner string — treat as vacant / white. */
export const UNASSIGNED_WINDOW_COLOR = '#ffffff'

/** Row exists in directory with an owner — neutral gray infill. */
export const ASSIGNED_WINDOW_COLOR = '#aeb5bf'

/** Duplex façade: logical houses **5** and **6** share one window — occupied if either flat is listed. */
export function getWindowWireframeColor(
  tower: number,
  floor: number,
  house: number,
  lookup: FlatLookup,
): THREE.Color {
  const keys =
    house === 5 || house === 6
      ? [flatLookupKey(tower, floor, 5), flatLookupKey(tower, floor, 6)]
      : [flatLookupKey(tower, floor, house)]

  const occupied = keys.some((key) => {
    const info = lookup.get(key)
    return Boolean(info?.owner?.trim())
  })

  if (!occupied) {
    return new THREE.Color(UNASSIGNED_WINDOW_COLOR)
  }

  return new THREE.Color(ASSIGNED_WINDOW_COLOR)
}
