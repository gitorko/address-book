import { FLOOR_COUNT, LOGICAL_HOUSE_MAX } from './buildingConstants'
import { flatLookupKey, type FlatConfigEntry } from './flatConfig'
import type { FlatLookup } from './flatLookup'

/** Every unit in one tower (vacant rows use empty strings when not in config). */
export function buildTowerUnitRows(tower: 6 | 7, lookup: FlatLookup): FlatConfigEntry[] {
  const rows: FlatConfigEntry[] = []
  for (let floor = 1; floor <= FLOOR_COUNT; floor++) {
    for (let house = 1; house <= LOGICAL_HOUSE_MAX; house++) {
      const key = flatLookupKey(tower, floor, house)
      const info = lookup.get(key)
      rows.push({
        tower,
        floor,
        house,
        flatNo: info?.flatNo ?? '',
        owner: info?.owner ?? '',
        phone: info?.phone ?? '',
        details: info?.details ?? '',
      })
    }
  }
  return rows
}
