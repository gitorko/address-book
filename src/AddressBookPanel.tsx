import { useEffect, useMemo, useRef, useState } from 'react'
import { facadeHouseIndexFromLogicalHouse } from './buildingConstants'
import { flatLookupKey, normalizeFlatEntry } from './flatConfig'
import type { FlatConfigEntry } from './flatConfig'
import type { FlatLookup } from './flatLookup'
import type { SelectedHouse } from './scene/ApartmentScene'
import type { ServiceContact } from './servicesConfig'
import { buildTowerUnitRows } from './towerDirectory'
import { getWindowWireframeColor } from './windowColors'
import type { BulkImportPayload, BulkImportResult } from './api'

const PAGE_SIZE = 36

type AddressBookTab = 'tower-6' | 'tower-7' | 'services'

type AddressBookPanelProps = {
  lookup: FlatLookup
  entries: FlatConfigEntry[]
  serviceContacts: ServiceContact[]
  towerTab: 6 | 7
  onTowerTabChange: (t: 6 | 7) => void
  selected: SelectedHouse | null
  onSelectRow: (tower: number, floor: number, house: number) => void
  onDismissSelection: () => void
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  // Admin
  isAdmin: boolean
  onSignIn: () => void
  onSignOut: () => void
  onSaveOwner: (entry: FlatConfigEntry) => Promise<void>
  onDeleteOwner: (entry: FlatConfigEntry) => Promise<void>
  onSaveService: (contact: ServiceContact, originalLabel?: string) => Promise<void>
  onDeleteService: (label: string) => Promise<void>
  onBulkImport: (payload: BulkImportPayload) => Promise<BulkImportResult>
}

// ─── Shared input style ────────────────────────────────────────────────────────

const INP: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  border: '1.5px solid #e4e4e7',
  background: '#f9fafb',
  color: '#111',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
}

const LBL: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: '#71717a',
  marginBottom: 4,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
}

// ─── Owner form modal ─────────────────────────────────────────────────────────

type OwnerFormModalProps = {
  initial: FlatConfigEntry
  onSave: (entry: FlatConfigEntry) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

function OwnerFormModal({ initial, onSave, onDelete, onClose }: OwnerFormModalProps) {
  const [owner, setOwner] = useState(initial.owner)
  const [phone, setPhone] = useState(initial.phone)
  const [details, setDetails] = useState(initial.details)
  const [flatNo, setFlatNo] = useState(initial.flatNo)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const unitLabel = `Tower ${initial.tower} · Floor ${initial.floor} · House ${initial.house}`

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await onSave({ ...initial, owner: owner.trim(), phone: phone.trim(), details: details.trim(), flatNo: flatNo.trim() })
      onClose()
    } catch {
      setError('Failed to save — please try again.')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!onDelete) return
    if (!confirm(`Remove owner info for ${unitLabel}?`)) return
    setDeleting(true)
    try {
      await onDelete()
      onClose()
    } catch {
      setError('Failed to delete — please try again.')
      setDeleting(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.14)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontWeight: 800, fontSize: 17, color: '#111', marginBottom: 4 }}>Edit Owner Info</div>
        <div style={{ fontSize: 12, color: '#71717a', marginBottom: 20 }}>{unitLabel}</div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={LBL}>Flat No (optional override)</label>
            <input style={INP} value={flatNo} placeholder="e.g. 6143 (auto-derived if blank)" onChange={(e) => setFlatNo(e.target.value)} />
          </div>
          <div>
            <label style={LBL}>Owner Name</label>
            <input autoFocus style={INP} value={owner} placeholder="e.g. Ravi Kumar" onChange={(e) => setOwner(e.target.value)} />
          </div>
          <div>
            <label style={LBL}>Phone</label>
            <input style={INP} value={phone} placeholder="e.g. +91 98765 43210" onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label style={LBL}>Details (notes)</label>
            <input style={INP} value={details} placeholder="e.g. 2BHK, tenant: Sharma" onChange={(e) => setDetails(e.target.value)} />
          </div>

          {error && <div style={{ fontSize: 13, color: '#dc2626', background: '#fee2e2', borderRadius: 8, padding: '8px 12px' }}>{error}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {onDelete && (
              <button type="button" onClick={handleDelete} disabled={deleting}
                style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #fecaca', background: 'transparent', color: '#dc2626', cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
                {deleting ? '…' : 'Clear'}
              </button>
            )}
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1.5px solid #e4e4e7', background: 'transparent', color: '#71717a', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              style={{ flex: 2, padding: '10px 0', borderRadius: 10, border: 'none', background: saving ? '#93c5fd' : '#2563eb', color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Service form modal ────────────────────────────────────────────────────────

type ServiceFormModalProps = {
  initial?: ServiceContact
  onSave: (contact: ServiceContact, originalLabel?: string) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

function ServiceFormModal({ initial, onSave, onDelete, onClose }: ServiceFormModalProps) {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    if (!label.trim()) { setError('Service name is required.'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({ label: label.trim(), email: email.trim(), phone: phone.trim() }, initial?.label)
      onClose()
    } catch {
      setError('Failed to save — please try again.')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!onDelete) return
    if (!confirm(`Delete service "${initial?.label}"?`)) return
    setDeleting(true)
    try {
      await onDelete()
      onClose()
    } catch {
      setError('Failed to delete — please try again.')
      setDeleting(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.14)' }}>
        <div style={{ fontWeight: 800, fontSize: 17, color: '#111', marginBottom: 20 }}>
          {initial ? 'Edit Service' : 'Add Service'}
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={LBL}>Service Name *</label>
            <input autoFocus style={INP} value={label} placeholder="e.g. Main Gate" onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div>
            <label style={LBL}>Phone</label>
            <input style={INP} value={phone} placeholder="+91 98765 43210" onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label style={LBL}>Email</label>
            <input style={INP} value={email} placeholder="contact@example.com" onChange={(e) => setEmail(e.target.value)} />
          </div>

          {error && <div style={{ fontSize: 13, color: '#dc2626', background: '#fee2e2', borderRadius: 8, padding: '8px 12px' }}>{error}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {onDelete && (
              <button type="button" onClick={handleDelete} disabled={deleting}
                style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #fecaca', background: 'transparent', color: '#dc2626', cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
                {deleting ? '…' : 'Delete'}
              </button>
            )}
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1.5px solid #e4e4e7', background: 'transparent', color: '#71717a', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              style={{ flex: 2, padding: '10px 0', borderRadius: 10, border: 'none', background: saving ? '#93c5fd' : '#2563eb', color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving…' : initial ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Export modal ─────────────────────────────────────────────────────────────

type ExportModalProps = {
  entries: FlatConfigEntry[]
  serviceContacts: ServiceContact[]
  onClose: () => void
}

function ExportModal({ entries, serviceContacts, onClose }: ExportModalProps) {
  const data = { flats: entries, services: serviceContacts }
  const json = JSON.stringify(data, null, 2)

  const saveFile = () => {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `address-book-export-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const copyClipboard = () => {
    navigator.clipboard
      .writeText(json)
      .then(() => alert('Copied to clipboard!'))
      .catch(() => {
        const ta = document.querySelector<HTMLTextAreaElement>('#export-ta')
        if (ta) { ta.select(); document.execCommand('copy'); alert('Copied!') }
      })
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.14)' }}>
        <div style={{ fontWeight: 800, fontSize: 17, color: '#111', marginBottom: 4 }}>Export Data</div>
        <div style={{ fontSize: 13, color: '#71717a', marginBottom: 14 }}>
          {entries.length} owner entries · {serviceContacts.length} service contacts
        </div>
        <textarea
          id="export-ta"
          readOnly
          value={json}
          onFocus={(e) => e.target.select()}
          style={{ width: '100%', height: 240, fontFamily: 'monospace', fontSize: 12, background: '#f9fafb', border: '1.5px solid #e4e4e7', borderRadius: 10, padding: 12, color: '#111', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={onClose}
            style={{ flex: 1, background: '#f9fafb', border: '1.5px solid #e4e4e7', borderRadius: 10, padding: '10px', color: '#71717a', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600 }}>
            Close
          </button>
          <button onClick={copyClipboard}
            style={{ flex: 1, background: '#f9fafb', border: '1.5px solid #2563eb', borderRadius: 10, padding: '10px', color: '#2563eb', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}>
            Copy
          </button>
          <button onClick={saveFile}
            style={{ flex: 1, background: '#2563eb', border: 'none', borderRadius: 10, padding: '10px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
            Download
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Import modal ─────────────────────────────────────────────────────────────

type ImportModalProps = {
  onImport: (payload: BulkImportPayload) => Promise<BulkImportResult>
  onClose: () => void
}

function ImportModal({ onImport, onClose }: ImportModalProps) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{ flats: number; services: number } | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<BulkImportResult | null>(null)

  function parseJson(raw: string): BulkImportPayload | null {
    try {
      const parsed = JSON.parse(raw)
      // Accept { flats: [...] } (our format + static flats.config.json)
      // and { owners: [...] } as alias
      const flats = parsed.flats ?? parsed.owners ?? []
      const services = parsed.services ?? []
      if (!Array.isArray(flats) || !Array.isArray(services)) return null
      return { flats: flats.map(normalizeFlatEntry), services }
    } catch {
      return null
    }
  }

  function handleTextChange(raw: string) {
    setText(raw)
    setError('')
    setPreview(null)
    if (!raw.trim()) return
    const payload = parseJson(raw)
    if (!payload) { setError('Invalid JSON — make sure it has a "flats" or "services" array.'); return }
    setPreview({ flats: payload.flats?.length ?? 0, services: payload.services?.length ?? 0 })
  }

  function handleFile() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => handleTextChange(ev.target?.result as string ?? '')
      reader.readAsText(file)
    }
    input.click()
  }

  async function handleImport() {
    if (importing) return
    const payload = parseJson(text)
    if (!payload) { setError('Invalid JSON — cannot import.'); return }
    setImporting(true)
    setError('')
    try {
      const res = await onImport(payload)
      setResult(res)
    } catch {
      setError('Import failed — please try again.')
      setImporting(false)
    }
  }

  if (result) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 360, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.14)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#111', marginBottom: 8 }}>Import Complete</div>
          <div style={{ fontSize: 14, color: '#71717a', marginBottom: 24 }}>
            {result.ownersImported} owner entries · {result.servicesImported} service contacts imported
          </div>
          <button onClick={onClose}
            style={{ width: '100%', background: '#2563eb', border: 'none', borderRadius: 10, padding: '12px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 15 }}>
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.14)' }}>
        <div style={{ fontWeight: 800, fontSize: 17, color: '#111', marginBottom: 4 }}>Import Data</div>
        <div style={{ fontSize: 13, color: '#71717a', marginBottom: 14 }}>
          Paste JSON or upload a file. Accepts <code style={{ fontSize: 12 }}>flats.config.json</code> format directly.
          Existing entries with the same unit/label are overwritten; others are preserved.
        </div>
        <textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={'Paste JSON here…\n\nExpected format:\n{ "flats": [...], "services": [...] }'}
          style={{ width: '100%', height: 200, fontFamily: 'monospace', fontSize: 12, background: '#f9fafb', border: `1.5px solid ${error ? '#fca5a5' : '#e4e4e7'}`, borderRadius: 10, padding: 12, color: '#111', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
        />
        {error && <div style={{ fontSize: 13, color: '#dc2626', marginTop: 6 }}>⚠ {error}</div>}
        {preview && !error && (
          <div style={{ fontSize: 13, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 12px', marginTop: 8 }}>
            Ready to import: {preview.flats} owner entries · {preview.services} service contacts
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={onClose}
            style={{ flex: 1, background: '#f9fafb', border: '1.5px solid #e4e4e7', borderRadius: 10, padding: '10px', color: '#71717a', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600 }}>
            Cancel
          </button>
          <button onClick={handleFile}
            style={{ flex: 1, background: '#f9fafb', border: '1.5px solid #2563eb', borderRadius: 10, padding: '10px', color: '#2563eb', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}>
            Upload File
          </button>
          <button onClick={handleImport} disabled={!preview || importing}
            style={{ flex: 1, background: preview && !importing ? '#2563eb' : '#bfdbfe', border: 'none', borderRadius: 10, padding: '10px', color: '#fff', fontWeight: 700, cursor: preview && !importing ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: 14 }}>
            {importing ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Helper functions ──────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.trim().toLowerCase()
}

function formatPublicFlatNo(entry: Pick<FlatConfigEntry, 'tower' | 'floor' | 'house' | 'flatNo'>): string {
  const configured = entry.flatNo.trim()
  if (configured) return configured
  const publicFloor = String(entry.floor + 2).padStart(2, '0')
  const publicUnit = Math.max(1, facadeHouseIndexFromLogicalHouse(entry.house))
  return `${entry.tower}${publicFloor}${publicUnit}`
}

function formatUnitSummary(entry: Pick<FlatConfigEntry, 'tower' | 'floor' | 'house' | 'flatNo'>): string {
  return `Tower ${entry.tower} · Floor ${entry.floor} - Flat No: ${formatPublicFlatNo(entry)}`
}

function entryMatchesQuery(entry: FlatConfigEntry, q: string): boolean {
  if (!q.trim()) return true
  const n = normalize(q)
  return (
    normalize(entry.owner).includes(n) ||
    normalize(entry.phone).includes(n) ||
    normalize(entry.details).includes(n) ||
    normalize(formatPublicFlatNo(entry)).includes(n) ||
    String(entry.floor).includes(q.trim())
  )
}

function serviceContactMatchesQuery(contact: ServiceContact, q: string): boolean {
  if (!q.trim()) return true
  const n = normalize(q)
  return (
    normalize(contact.label).includes(n) ||
    normalize(contact.email).includes(n) ||
    normalize(contact.phone).includes(n)
  )
}

function flatNoExactlyMatchesQuery(entry: FlatConfigEntry, q: string): boolean {
  const t = q.trim()
  if (!t) return false
  return normalize(formatPublicFlatNo(entry)) === normalize(t)
}

// ─── AddressBookPanel ──────────────────────────────────────────────────────────

export function AddressBookPanel({
  lookup,
  entries,
  serviceContacts,
  towerTab,
  onTowerTabChange,
  selected,
  onSelectRow,
  onDismissSelection,
  collapsed,
  onCollapsedChange,
  isAdmin,
  onSignIn,
  onSignOut,
  onSaveOwner,
  onDeleteOwner,
  onSaveService,
  onDeleteService,
  onBulkImport,
}: AddressBookPanelProps) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [activeTab, setActiveTab] = useState<AddressBookTab>('services')
  const [editingOwner, setEditingOwner] = useState<FlatConfigEntry | null>(null)
  const [editingService, setEditingService] = useState<ServiceContact | 'new' | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const selectedRef = useRef(selected)
  // True when the search box itself triggered the selection — prevents clearing the query in that case
  const queryTriggeredSelectRef = useRef(false)

  useEffect(() => { selectedRef.current = selected }, [selected])

  const rowsTower6 = useMemo(() => buildTowerUnitRows(6, lookup), [lookup])
  const rowsTower7 = useMemo(() => buildTowerUnitRows(7, lookup), [lookup])
  const combinedRows = useMemo(() => [...rowsTower6, ...rowsTower7], [rowsTower6, rowsTower7])

  const towerRows = useMemo(() => {
    if (query.trim()) return combinedRows
    return towerTab === 6 ? rowsTower6 : rowsTower7
  }, [query, towerTab, combinedRows, rowsTower6, rowsTower7])

  const filtered = useMemo(() => towerRows.filter((e) => {
    const owner = e.owner.trim()
    return owner !== '' && owner !== '-' && entryMatchesQuery(e, query)
  }), [towerRows, query])

  const filteredServiceContacts = useMemo(
    () => serviceContacts.filter((contact) => serviceContactMatchesQuery(contact, query)),
    [serviceContacts, query],
  )

  useEffect(() => {
    const q = query.trim()
    if (!q) return
    const towers = new Set(filtered.map((e) => e.tower))
    if (towers.size !== 1) return
    const only = [...towers][0]
    if (only !== 6 && only !== 7) return
    if (towerTab !== only) onTowerTabChange(only)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTab(`tower-${only}`)
  }, [query, activeTab, filtered, towerTab, onTowerTabChange])

  useEffect(() => {
    const q = query.trim()
    if (!q) return
    const exactFlatMatches = combinedRows.filter((e) => flatNoExactlyMatchesQuery(e, q))
    if (exactFlatMatches.length === 1) {
      const e = exactFlatMatches[0]
      const sel = selectedRef.current
      if (!sel || sel.tower !== e.tower || sel.floor !== e.floor || sel.house !== e.house) {
        queryTriggeredSelectRef.current = true
        onSelectRow(e.tower, e.floor, e.house)
      }
      return
    }
    onDismissSelection()
  }, [query, activeTab, combinedRows, onSelectRow, onDismissSelection])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageSlice = useMemo(() => {
    const start = safePage * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, safePage])

  useEffect(() => { setPage(0) }, [towerTab])

  useEffect(() => {
    if (selected) {
      if (!queryTriggeredSelectRef.current) {
        // Selection came from a canvas click or a direct row click — clear the search box
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setQuery('')
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPage(0)
      }
      queryTriggeredSelectRef.current = false
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab(`tower-${selected.tower as 6 | 7}`)
    }
  }, [selected])

  const isRowSelected = (e: FlatConfigEntry) =>
    selected?.tower === e.tower && selected?.floor === e.floor && selected?.house === e.house

  const selectedInfo = selected
    ? lookup.get(flatLookupKey(selected.tower, selected.floor, selected.house))
    : undefined
  const selectedDisplayInfo = selected
    ? { tower: selected.tower, floor: selected.floor, house: selected.house, flatNo: selectedInfo?.flatNo ?? '' }
    : undefined

  if (collapsed) {
    return (
      <aside className="address-book address-book--collapsed" aria-label="Tower address book">
        <button type="button" className="address-book__toggle address-book__toggle--expand"
          onClick={() => onCollapsedChange(false)} aria-expanded="false" aria-label="Expand address book" title="Show address book">
          <span className="address-book__toggle-icon" aria-hidden>⟨</span>
        </button>
      </aside>
    )
  }

  return (
    <aside className="address-book" aria-label="Tower address book">
      <div className="address-book__header">
        <div className="address-book__header-top">
          <div className="address-book__title-wrap">
            <h2 className="address-book__title">Address book</h2>
            <span className="address-book__version" aria-label="Version 1.0">v1.0</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {isAdmin ? (
              <>
                {/* ⋮ Menu */}
                <div style={{ position: 'relative' }}>
                  <button type="button" onClick={() => setShowMenu((m) => !m)}
                    style={{ background: '#f9fafb', border: '1px solid #e4e4e7', borderRadius: 7, padding: '4px 9px', fontSize: 15, color: '#71717a', cursor: 'pointer', lineHeight: 1 }}>
                    ⋮
                  </button>
                  {showMenu && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setShowMenu(false)} />
                      <div style={{ position: 'absolute', right: 0, top: 34, background: '#fff', border: '1.5px solid #e4e4e7', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 170, overflow: 'hidden' }}>
                        {[
                          { icon: '📤', label: 'Export data', action: () => { setShowExport(true); setShowMenu(false) } },
                          { icon: '📥', label: 'Import data', action: () => { setShowImport(true); setShowMenu(false) } },
                          { icon: '🚪', label: 'Sign out', action: () => { setShowMenu(false); onSignOut() }, danger: false },
                        ].map(({ icon, label, action }) => (
                          <button key={label} onClick={action}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#111', fontFamily: 'inherit', textAlign: 'left' }}>
                            <span>{icon}</span>{label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <button type="button" onClick={onSignIn}
                style={{ background: '#2563eb', border: 'none', borderRadius: 7, padding: '4px 10px', fontSize: 12, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                Admin
              </button>
            )}
            <button type="button" className="address-book__toggle address-book__toggle--collapse"
              onClick={() => onCollapsedChange(true)} aria-expanded="true" aria-label="Collapse address book" title="Hide address book">
              <span className="address-book__toggle-icon" aria-hidden>⟩</span>
            </button>
          </div>
        </div>
        {isAdmin && (
          <div style={{ fontSize: 11, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '4px 10px', marginTop: 6, fontWeight: 600 }}>
            Admin mode — you can edit owners and services
          </div>
        )}
        <p className="address-book__hint">
          Search looks in both towers; the tab switches when your query matches only one tower
        </p>
      </div>

      <div className="address-book__tabs" role="tablist" aria-label="Address book sections">
        <button type="button" role="tab" aria-selected={activeTab === 'services'}
          className={`address-book__tab ${activeTab === 'services' ? 'address-book__tab--active' : ''}`}
          onClick={() => { setPage(0); setActiveTab('services') }}>
          Services
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'tower-6'}
          className={`address-book__tab ${activeTab === 'tower-6' ? 'address-book__tab--active' : ''}`}
          onClick={() => { setPage(0); setActiveTab('tower-6'); onTowerTabChange(6) }}>
          Tower 6
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'tower-7'}
          className={`address-book__tab ${activeTab === 'tower-7' ? 'address-book__tab--active' : ''}`}
          onClick={() => { setPage(0); setActiveTab('tower-7'); onTowerTabChange(7) }}>
          Tower 7
        </button>
      </div>

      <label className="address-book__search-label">
        <span className="visually-hidden">Search</span>
        <input className="address-book__search" type="search"
          placeholder="Search services, names, phone, details, flat no., floor..."
          value={query} onChange={(ev) => { setQuery(ev.target.value); setPage(0) }} autoComplete="off" />
      </label>

      {selected && activeTab !== 'services' && (
        <div className="address-book__selection">
          <div className="address-book__selection-head">
            <span className="address-book__selection-title">Selected unit</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {isAdmin && selectedDisplayInfo && (
                <button type="button"
                  onClick={() => {
                    const entry: FlatConfigEntry = {
                      tower: selectedDisplayInfo.tower as 6 | 7,
                      floor: selectedDisplayInfo.floor,
                      house: selectedDisplayInfo.house,
                      flatNo: selectedInfo?.flatNo ?? '',
                      owner: selectedInfo?.owner ?? '',
                      phone: selectedInfo?.phone ?? '',
                      details: selectedInfo?.details ?? '',
                    }
                    setEditingOwner(entry)
                  }}
                  style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#2563eb', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                  Edit
                </button>
              )}
              <button type="button" className="address-book__selection-clear"
                onClick={() => { setQuery(''); setPage(0); onDismissSelection() }}>
                Clear
              </button>
            </div>
          </div>
          {selectedDisplayInfo && (
            <p className="address-book__selection-line">{formatUnitSummary(selectedDisplayInfo)}</p>
          )}
          <p className="address-book__label-inline">Owner</p>
          <p className="address-book__selection-value address-book__selection-owner">
            {selectedInfo?.owner?.trim() ? selectedInfo.owner : 'Not listed (window shown white in model)'}
          </p>
          <p className="address-book__label-inline">Phone</p>
          <p className="address-book__selection-value">{selectedInfo?.phone?.trim() ? selectedInfo.phone : '—'}</p>
          <p className="address-book__label-inline">Details</p>
          <p className="address-book__selection-value address-book__selection-details">
            {selectedInfo?.details?.trim() ? selectedInfo.details : '—'}
          </p>
        </div>
      )}

      {/* ── Services tab ── */}
      {activeTab === 'services' ? (
        <div className="address-book__list-wrap">
          {isAdmin && (
            <div style={{ padding: '8px 12px 0' }}>
              <button type="button" onClick={() => setEditingService('new')}
                style={{ width: '100%', padding: '9px', borderRadius: 10, border: '1.5px dashed #bfdbfe', background: '#eff6ff', color: '#2563eb', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
                + Add Service
              </button>
            </div>
          )}
          <div className="address-book__list-scroll">
            <ul className="address-book__list address-book__services-list">
              {filteredServiceContacts.length === 0 ? (
                <li className="address-book__empty">No service contacts match.</li>
              ) : (
                filteredServiceContacts.map((contact) => {
                  const hasEmail = contact.email.trim()
                  const hasPhone = contact.phone.trim()
                  return (
                    <li key={contact.label}>
                      <article className="address-book__service-card">
                        <div className="address-book__service-head">
                          <span className="address-book__service-icon" aria-hidden>{contact.label.slice(0, 1)}</span>
                          <h3 className="address-book__service-title">{contact.label}</h3>
                          {isAdmin && (
                            <button type="button" onClick={() => setEditingService(contact)}
                              style={{ marginLeft: 'auto', background: '#f9fafb', border: '1px solid #e4e4e7', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#71717a', cursor: 'pointer', fontFamily: 'inherit' }}>
                              Edit
                            </button>
                          )}
                        </div>
                        <dl className="address-book__service-fields">
                          <div className="address-book__service-field">
                            <dt>Email</dt>
                            <dd>
                              {hasEmail ? <a href={`mailto:${contact.email}`}>{contact.email}</a>
                                : <span className="address-book__muted-value">Not added</span>}
                            </dd>
                          </div>
                          <div className="address-book__service-field">
                            <dt>Phone</dt>
                            <dd>
                              {hasPhone ? <a href={`tel:${contact.phone}`}>{contact.phone}</a>
                                : <span className="address-book__muted-value">Not added</span>}
                            </dd>
                          </div>
                        </dl>
                      </article>
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        </div>
      ) : (
        /* ── Tower directory tab ── */
        <div className="address-book__list-wrap">
          <div className="address-book__list-scroll">
            <ul className="address-book__list">
              {filtered.length === 0 ? (
                <li className="address-book__empty">No entries match.</li>
              ) : (
                pageSlice.map((e) => {
                  const col = getWindowWireframeColor(e.tower, e.floor, e.house, lookup)
                  const ownerLabel = e.owner.trim() || 'Vacant'
                  const phoneLabel = e.phone.trim()
                  const detailsRaw = e.details.trim()
                  const unitSummary = formatUnitSummary(e)
                  return (
                    <li key={`${e.tower}-${e.floor}-${e.house}`}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button type="button"
                          className={`address-book__row ${isRowSelected(e) ? 'address-book__row--active' : ''}`}
                          style={{ flex: 1 }}
                          onClick={() => { setQuery(''); setPage(0); onSelectRow(e.tower, e.floor, e.house) }}>
                          <span className="address-book__swatch"
                            style={{ backgroundColor: `#${col.getHexString()}` }}
                            title="Window color in the model" aria-hidden />
                          <span className="address-book__row-main">
                            <span className="address-book__row-columns">
                              <span className="address-book__owner">{ownerLabel}</span>
                              <span className="address-book__phone-col">{phoneLabel}</span>
                              <span className="address-book__details-col" title={detailsRaw || undefined}>{detailsRaw}</span>
                            </span>
                            <span className="address-book__meta">{unitSummary}</span>
                          </span>
                        </button>
                        {isAdmin && (
                          <button type="button"
                            onClick={() => setEditingOwner(e)}
                            style={{ background: '#f9fafb', border: '1px solid #e4e4e7', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#71717a', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                            Edit
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })
              )}
            </ul>
          </div>
          {filtered.length > 0 && pageCount > 1 && (
            <div className="address-book__pager" role="navigation" aria-label="Directory pages">
              <button type="button" className="address-book__pager-btn"
                disabled={safePage <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Previous
              </button>
              <span className="address-book__pager-meta">
                Page {safePage + 1} of {pageCount}
                <span className="address-book__pager-count"> ({filtered.length} units)</span>
              </span>
              <button type="button" className="address-book__pager-btn"
                disabled={safePage >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Owner edit modal ── */}
      {editingOwner && (
        <OwnerFormModal
          initial={editingOwner}
          onSave={async (entry) => { await onSaveOwner(entry) }}
          onDelete={
            editingOwner.owner.trim() || editingOwner.phone.trim() || editingOwner.details.trim()
              ? async () => { await onDeleteOwner(editingOwner) }
              : undefined
          }
          onClose={() => setEditingOwner(null)}
        />
      )}

      {/* ── Service edit/add modal ── */}
      {editingService !== null && (
        <ServiceFormModal
          initial={editingService === 'new' ? undefined : editingService}
          onSave={async (contact, originalLabel) => { await onSaveService(contact, originalLabel) }}
          onDelete={
            editingService !== 'new'
              ? async () => { await onDeleteService(editingService.label) }
              : undefined
          }
          onClose={() => setEditingService(null)}
        />
      )}

      {/* ── Export modal ── */}
      {showExport && (
        <ExportModal
          entries={entries}
          serviceContacts={serviceContacts}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* ── Import modal ── */}
      {showImport && (
        <ImportModal
          onImport={onBulkImport}
          onClose={() => setShowImport(false)}
        />
      )}
    </aside>
  )
}
