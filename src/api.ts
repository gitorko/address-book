import {
  buildFlatLookup,
  normalizeFlatEntry,
  type FlatConfigEntry,
} from './flatConfig'
import type { FlatLookup } from './flatLookup'
import type { ServiceContact } from './servicesConfig'

// ─── Constants ────────────────────────────────────────────────────────────────

export const AUTH_KEY = 'address-book-auth'

export const IS_DEV = !import.meta.env.PROD

const LS_OWNERS_KEY = 'address-book-owners'
const LS_SERVICES_KEY = 'address-book-services'

// ─── Token helpers ────────────────────────────────────────────────────────────

function b64urlDecode(str: string): string {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  return atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
}

export function getStoredToken(): string | null {
  try {
    const token = localStorage.getItem(AUTH_KEY)
    if (!token) return null
    if (token === 'dev') return token // dev session — no expiry check needed locally
    const [payload] = token.split('.')
    if (!payload) return null
    const { exp } = JSON.parse(b64urlDecode(payload))
    if (!exp || exp < Date.now()) {
      localStorage.removeItem(AUTH_KEY)
      return null
    }
    return token
  } catch {
    localStorage.removeItem(AUTH_KEY)
    return null
  }
}

function authFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem(AUTH_KEY) || ''
  return fetch(url, {
    ...opts,
    headers: {
      ...((opts.headers as Record<string, string>) || {}),
      Authorization: `Bearer ${token}`,
    },
  }).then((r) => {
    if (r.status === 401) {
      localStorage.removeItem(AUTH_KEY)
      window.location.reload()
    }
    return r
  })
}

// ─── Owner storage ────────────────────────────────────────────────────────────

export function ownerEntryId(e: Pick<FlatConfigEntry, 'tower' | 'floor' | 'house'>): string {
  return `${e.tower}:${e.floor}:${e.house}`
}

const localOwners = {
  getAll: (): FlatConfigEntry[] => {
    try {
      return JSON.parse(localStorage.getItem(LS_OWNERS_KEY) || '[]')
    } catch {
      return []
    }
  },
  save: (entries: FlatConfigEntry[]) =>
    localStorage.setItem(LS_OWNERS_KEY, JSON.stringify(entries)),
}

export const ownersApi = IS_DEV
  ? {
      getAll: (): Promise<FlatConfigEntry[]> => Promise.resolve(localOwners.getAll()),
      upsert: (entry: FlatConfigEntry): Promise<FlatConfigEntry> => {
        const id = ownerEntryId(entry)
        const list = localOwners.getAll()
        const idx = list.findIndex((e) => ownerEntryId(e) === id)
        if (idx >= 0) list[idx] = entry
        else list.push(entry)
        localOwners.save(list)
        return Promise.resolve(entry)
      },
      remove: (id: string): Promise<void> => {
        localOwners.save(localOwners.getAll().filter((e) => ownerEntryId(e) !== id))
        return Promise.resolve()
      },
    }
  : {
      getAll: (): Promise<FlatConfigEntry[]> => fetch('/api/owners').then((r) => r.json()),
      upsert: (entry: FlatConfigEntry): Promise<FlatConfigEntry> =>
        authFetch('/api/owners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        }).then((r) => r.json()),
      remove: (id: string): Promise<void> =>
        authFetch(`/api/owners/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(() => undefined),
    }

/**
 * Load all owners from localStorage (dev) or Neon (prod).
 * No static-file fallback — use Admin → Import to seed data.
 */
export async function loadOwners(): Promise<{ lookup: FlatLookup; entries: FlatConfigEntry[] }> {
  if (IS_DEV) {
    const list = localOwners.getAll().map(normalizeFlatEntry)
    return { lookup: buildFlatLookup(list), entries: list }
  }
  const raw: FlatConfigEntry[] = await fetch('/api/owners').then((r) => r.json())
  const list = raw.map(normalizeFlatEntry)
  return { lookup: buildFlatLookup(list), entries: list }
}

// ─── Services storage ─────────────────────────────────────────────────────────

const localServices = {
  getAll: (): ServiceContact[] => {
    try {
      return JSON.parse(localStorage.getItem(LS_SERVICES_KEY) || '[]')
    } catch {
      return []
    }
  },
  save: (list: ServiceContact[]) =>
    localStorage.setItem(LS_SERVICES_KEY, JSON.stringify(list)),
}

export const servicesApi = IS_DEV
  ? {
      getAll: (): Promise<ServiceContact[]> => Promise.resolve(localServices.getAll()),
      create: (contact: ServiceContact): Promise<ServiceContact> => {
        const list = localServices.getAll()
        list.push(contact)
        localServices.save(list)
        return Promise.resolve(contact)
      },
      update: (contact: ServiceContact, originalLabel: string): Promise<ServiceContact> => {
        const list = localServices.getAll()
        const idx = list.findIndex((s) => s.label === originalLabel)
        if (idx >= 0) list[idx] = contact
        else list.push(contact)
        localServices.save(list)
        return Promise.resolve(contact)
      },
      remove: (label: string): Promise<void> => {
        localServices.save(localServices.getAll().filter((s) => s.label !== label))
        return Promise.resolve()
      },
    }
  : {
      getAll: (): Promise<ServiceContact[]> => fetch('/api/services').then((r) => r.json()),
      create: (contact: ServiceContact): Promise<ServiceContact> =>
        authFetch('/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(contact),
        }).then((r) => r.json()),
      update: (contact: ServiceContact, originalLabel: string): Promise<ServiceContact> =>
        authFetch(`/api/services/${encodeURIComponent(originalLabel)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(contact),
        }).then((r) => r.json()),
      remove: (label: string): Promise<void> =>
        authFetch(`/api/services/${encodeURIComponent(label)}`, { method: 'DELETE' }).then(
          () => undefined,
        ),
    }

/**
 * Load all services from localStorage (dev) or Neon (prod).
 * No static-file fallback — use Admin → Import to seed data.
 */
export async function loadServices(): Promise<ServiceContact[]> {
  if (IS_DEV) {
    return localServices.getAll()
  }
  return fetch('/api/services').then((r) => r.json())
}

// ─── Bulk import ──────────────────────────────────────────────────────────────

export type BulkImportPayload = {
  flats?: FlatConfigEntry[]
  services?: ServiceContact[]
}

export type BulkImportResult = {
  ownersImported: number
  servicesImported: number
}

export async function bulkImport(payload: BulkImportPayload): Promise<BulkImportResult> {
  const flats = (payload.flats ?? []).map(normalizeFlatEntry)
  const services = payload.services ?? []

  if (IS_DEV) {
    // Merge into localStorage (upsert — existing entries with the same key are replaced)
    const existingOwners = localOwners.getAll()
    const ownerMap = new Map(existingOwners.map((e) => [ownerEntryId(e), e]))
    for (const e of flats) ownerMap.set(ownerEntryId(e), e)
    localOwners.save([...ownerMap.values()])

    const existingServices = localServices.getAll()
    const svcMap = new Map(existingServices.map((s) => [s.label, s]))
    for (const s of services) svcMap.set(s.label, s)
    localServices.save([...svcMap.values()])

    return { ownersImported: flats.length, servicesImported: services.length }
  }

  return authFetch('/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flats, services }),
  }).then((r) => r.json())
}
