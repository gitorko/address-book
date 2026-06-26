import { LOGICAL_HOUSE_MAX } from './buildingConstants'
import type { FlatLookup } from './flatLookup'

/** One flat unit entry stored in the DB / localStorage. */
export type FlatConfigEntry = {
  tower: number
  floor: number
  house: number
  flatNo: string
  owner: string
  phone: string
  /** Free-form text; searchable in the address book. */
  details: string
}

/**
 * Decode flat numbers like `6143` → tower **6**, floor **14**, house **3**
 * (first digit = tower, next two digits = floor, last digit = house).
 */
export function parseFlatNo(flatNo: string): { tower: number; floor: number; house: number } | null {
  const s = flatNo.trim().replace(/\s+/g, '')
  if (!/^\d{4}$/.test(s)) return null
  const tower = Number(s[0])
  const floor = Number(s.slice(1, 3))
  const house = Number(s[3])
  if (!tower || floor < 1 || house < 1 || house > LOGICAL_HOUSE_MAX) return null
  return { tower, floor, house }
}

/** Prefer coordinates derived from `flatNo` when it matches the 4-digit scheme. */
export function normalizeFlatEntry(
  e: Omit<FlatConfigEntry, 'phone' | 'details'> & { phone?: string; details?: string },
): FlatConfigEntry {
  const row: FlatConfigEntry = { ...e, phone: e.phone ?? '', details: e.details ?? '' }
  const parsed = parseFlatNo(row.flatNo)
  if (!parsed) return row
  return {
    ...row,
    tower: parsed.tower,
    floor: parsed.floor,
    house: parsed.house,
  }
}

export function flatLookupKey(tower: number, floor: number, house: number): string {
  return `${tower}:${floor}:${house}`
}

/** Build an O(1) lookup map from config rows. Later rows overwrite earlier ones for the same key. */
export function buildFlatLookup(entries: Iterable<FlatConfigEntry>): FlatLookup {
  const map: FlatLookup = new Map()
  for (const e of entries) {
    map.set(flatLookupKey(e.tower, e.floor, e.house), {
      flatNo: e.flatNo,
      owner: e.owner,
      phone: e.phone ?? '',
      details: e.details ?? '',
    })
  }
  return map
}
