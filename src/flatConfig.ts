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

export const FIRE_REFUGE_FLATS = [
  { tower: 6, floor: 18, house: 5, flatNo: '6185' },
  { tower: 6, floor: 28, house: 5, flatNo: '6305' },
  { tower: 7, floor: 18, house: 5, flatNo: '7185' },
  { tower: 7, floor: 28, house: 5, flatNo: '7285' },

] as const

export const FIRE_REFUGE_FLAT_NUMBERS: readonly string[] = FIRE_REFUGE_FLATS.map((flat) => flat.flatNo)

export function isFireRefugeCoordinates(tower: number, floor: number, house: number): boolean {
  return FIRE_REFUGE_FLATS.some((flat) => flat.tower === tower && flat.floor === floor && flat.house === house)
}

export function isFireRefugeFlat(
  entry: Pick<FlatConfigEntry, 'tower' | 'floor' | 'house' | 'flatNo' | 'details'>,
): boolean {
  if (isFireRefugeCoordinates(entry.tower, entry.floor, entry.house)) {
    return true
  }
  const flatNo = entry.flatNo?.trim() ?? ''
  if (flatNo && FIRE_REFUGE_FLAT_NUMBERS.includes(flatNo)) {
    return true
  }
  if (flatNo && /fire refuge/i.test(flatNo)) {
    return true
  }
  return Boolean(entry.details?.trim().toLowerCase().includes('fire refuge'))
}

export function fireRefugeEntryFor(tower: number, floor: number, house: number): FlatConfigEntry | null {
  const flat = FIRE_REFUGE_FLATS.find((x) => x.tower === tower && x.floor === floor && x.house === house)
  if (!flat) return null
  return {
    tower: flat.tower,
    floor: flat.floor,
    house: flat.house,
    flatNo: flat.flatNo,
    owner: '',
    phone: '',
    details: 'Fire refuge area',
  }
}

export function stripFireRefugeOwners(entries: Iterable<FlatConfigEntry>): FlatConfigEntry[] {
  return [...entries].filter((entry) => !isFireRefugeFlat(entry))
}

/** Build an O(1) lookup map from config rows. Later rows overwrite earlier ones for the same key. */
export function buildFlatLookup(entries: Iterable<FlatConfigEntry>): FlatLookup {
  const map: FlatLookup = new Map()
  for (const e of stripFireRefugeOwners(entries)) {
    map.set(flatLookupKey(e.tower, e.floor, e.house), {
      flatNo: e.flatNo,
      owner: e.owner,
      phone: e.phone ?? '',
      details: e.details ?? '',
    })
  }
  for (const e of FIRE_REFUGE_FLATS) {
    map.set(flatLookupKey(e.tower, e.floor, e.house), {
      flatNo: e.flatNo,
      owner: '',
      phone: '',
      details: 'Fire refuge area',
    })
  }
  return map
}
