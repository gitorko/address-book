import { useCallback, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { AddressBookPanel } from './AddressBookPanel'
import {
  AUTH_KEY,
  IS_DEV,
  getStoredToken,
  loadOwners,
  loadServices,
  ownersApi,
  ownerEntryId,
  servicesApi,
  bulkImport,
  type BulkImportPayload,
} from './api'
import { SCENE_TARGET_OFFSET_X, TOWER_ID_LEFT } from './buildingConstants'
import { buildFlatLookup, type FlatConfigEntry } from './flatConfig'
import type { FlatLookup } from './flatLookup'
import { ApartmentScene, type SelectedHouse } from './scene/ApartmentScene'
import type { ServiceContact } from './servicesConfig'
import './index.css'

// ─── Login modal ──────────────────────────────────────────────────────────────

function LoginModal({ onLogin, onClose }: { onLogin: (token: string) => void; onClose: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    try {
      if (!import.meta.env.PROD) {
        // Dev mode: validate against VITE_AUTH_USER / VITE_AUTH_PASS in .env.local
        if (username === import.meta.env.VITE_AUTH_USER && password === import.meta.env.VITE_AUTH_PASS) {
          localStorage.setItem(AUTH_KEY, 'dev')
          onLogin('dev')
        } else {
          setError('Invalid username or password')
        }
        setLoading(false)
        return
      }
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) {
        const { token } = await res.json()
        localStorage.setItem(AUTH_KEY, token)
        onLogin(token)
      } else {
        setError('Invalid username or password')
      }
    } catch {
      setError('Connection error — please try again')
    }
    setLoading(false)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: '#fff', borderRadius: 20, padding: 32, width: '100%', maxWidth: 380,
        boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🏢</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#111' }}>Admin Sign In</div>
          <div style={{ fontSize: 13, color: '#71717a', marginTop: 4 }}>Meru &amp; Meadow Directory</div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#71717a', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.7 }}>
              Username
            </label>
            <input
              autoFocus autoComplete="username" value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e4e4e7', background: '#f9fafb', color: '#111', fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#71717a', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.7 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPwd ? 'text' : 'password'} autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', padding: '10px 44px 10px 14px', borderRadius: 10, border: '1.5px solid #e4e4e7', background: '#f9fafb', color: '#111', fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              />
              <button type="button" onClick={() => setShowPwd((v) => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#a1a1aa', padding: 2 }}>
                {showPwd ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          {error && (
            <div style={{ fontSize: 13, color: '#dc2626', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1.5px solid #e4e4e7', background: 'transparent', color: '#71717a', fontFamily: 'inherit', fontSize: 15, cursor: 'pointer', fontWeight: 600 }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              style={{ flex: 2, background: loading ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 0', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [authToken, setAuthToken] = useState<string | null>(() => getStoredToken())
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [flatLookup, setFlatLookup] = useState<FlatLookup>(() => new Map())
  const [entries, setEntries] = useState<FlatConfigEntry[]>([])
  const [serviceContacts, setServiceContacts] = useState<ServiceContact[]>([])
  const [selected, setSelected] = useState<SelectedHouse | null>(null)
  const [addressBookTower, setAddressBookTower] = useState<6 | 7>(TOWER_ID_LEFT)
  const [addressBookCollapsed, setAddressBookCollapsed] = useState(false)

  const isAdmin = !!authToken

  useEffect(() => {
    let cancelled = false
    Promise.all([loadOwners(), loadServices()]).then(([{ lookup, entries: e }, services]) => {
      if (!cancelled) {
        setFlatLookup(lookup)
        setEntries(e)
        setServiceContacts(services)
      }
    })
    return () => { cancelled = true }
  }, [])

  const handleSelectHouse = useCallback((tower: number, floor: number, house: number) => {
    setSelected({ tower, floor, house })
    setAddressBookCollapsed(false)
    if (tower === 6 || tower === 7) setAddressBookTower(tower)
  }, [])

  const handleDismiss = useCallback(() => setSelected(null), [])

  const handleLogin = useCallback((token: string) => {
    setAuthToken(token)
    setShowLoginModal(false)
  }, [])

  const handleLogout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY)
    setAuthToken(null)
  }, [])

  const handleSaveOwner = useCallback(async (entry: FlatConfigEntry) => {
    await ownersApi.upsert(entry)
    setEntries((prev) => {
      const id = ownerEntryId(entry)
      const idx = prev.findIndex((e) => ownerEntryId(e) === id)
      const next = idx >= 0 ? prev.map((e, i) => (i === idx ? entry : e)) : [...prev, entry]
      setFlatLookup(buildFlatLookup(next))
      return next
    })
  }, [])

  const handleDeleteOwner = useCallback(async (entry: FlatConfigEntry) => {
    const id = ownerEntryId(entry)
    await ownersApi.remove(id)
    setEntries((prev) => {
      const next = prev.filter((e) => ownerEntryId(e) !== id)
      setFlatLookup(buildFlatLookup(next))
      return next
    })
  }, [])

  const handleSaveService = useCallback(
    async (contact: ServiceContact, originalLabel?: string) => {
      if (originalLabel) {
        await servicesApi.update(contact, originalLabel)
        setServiceContacts((prev) => prev.map((s) => s.label === originalLabel ? contact : s))
      } else {
        await servicesApi.create(contact)
        setServiceContacts((prev) => [...prev, contact])
      }
    },
    [],
  )

  const handleDeleteService = useCallback(async (label: string) => {
    await servicesApi.remove(label)
    setServiceContacts((prev) => prev.filter((s) => s.label !== label))
  }, [])

  const handleBulkImport = useCallback(
    async (payload: BulkImportPayload) => {
      const result = await bulkImport(payload)
      // Reload all data after import
      const [{ lookup, entries: e }, services] = await Promise.all([loadOwners(), loadServices()])
      setFlatLookup(lookup)
      setEntries(e)
      setServiceContacts(services)
      return result
    },
    [],
  )

  return (
    <div className="app-root">
      <div className="canvas-wrap">
        <Canvas
          dpr={[1, 1.5]}
          camera={{
            position: [82 + SCENE_TARGET_OFFSET_X, 49, 104],
            fov: 42,
            near: 1,
            far: 260,
          }}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.NoToneMapping,
          }}
          onPointerMissed={handleDismiss}
        >
          <ApartmentScene flatLookup={flatLookup} selected={selected} onSelectHouse={handleSelectHouse} />
        </Canvas>

        <header className="app-header">
          <h1 className="app-title">
            <span className="app-title__word">Meru</span>
            <span className="app-title__amp">&amp;</span>
            <span className="app-title__word app-title__word--secondary">Meadow</span>
          </h1>
        </header>

        {IS_DEV && (
          <div style={{
            position: 'absolute', bottom: 12, left: 12, zIndex: 10,
            background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
            padding: '6px 12px', fontSize: 12, color: '#92400e',
          }}>
            🧪 Dev mode — data saved to localStorage
          </div>
        )}
      </div>

      <AddressBookPanel
        lookup={flatLookup}
        entries={entries}
        serviceContacts={serviceContacts}
        towerTab={addressBookTower}
        onTowerTabChange={setAddressBookTower}
        selected={selected}
        onSelectRow={handleSelectHouse}
        onDismissSelection={handleDismiss}
        collapsed={addressBookCollapsed}
        onCollapsedChange={setAddressBookCollapsed}
        isAdmin={isAdmin}
        onSignIn={() => setShowLoginModal(true)}
        onSignOut={handleLogout}
        onSaveOwner={handleSaveOwner}
        onDeleteOwner={handleDeleteOwner}
        onSaveService={handleSaveService}
        onDeleteService={handleDeleteService}
        onBulkImport={handleBulkImport}
      />

      {showLoginModal && (
        <LoginModal onLogin={handleLogin} onClose={() => setShowLoginModal(false)} />
      )}
    </div>
  )
}
