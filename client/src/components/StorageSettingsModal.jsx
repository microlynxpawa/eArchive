import React, { useEffect, useState } from 'react'
import Modal from './Modal'

/*
 * Storage provider
 *
 * Unchanged: the provider is read from GET /admin/storage-settings, there are
 * two options, the action is disabled while the selection matches what is
 * already active, a confirmation precedes the switch, and it saves with
 * PUT /admin/storage-settings { provider }.
 *
 * The migration warning is the consequential fact here - switching moves
 * nothing, and files under the old provider stop being reachable - so it is a
 * permanent panel while choosing rather than a line that only appears once the
 * decision has already been made.
 */

const PROVIDERS = [
  {
    key: 'local',
    label: 'Local disk',
    detail: 'Files are written to this server, under the configured archive folder.',
    icon: 'mdi-harddisk',
  },
  {
    key: 's3',
    label: 'Amazon S3',
    detail: 'Files are written to the configured S3 bucket.',
    icon: 'mdi-cloud-outline',
  },
]

export default function StorageSettingsModal({ open = false, onClose = () => {} }) {
  const [active, setActive] = useState(null)
  const [choice, setChoice] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) { setConfirming(false); setError(null); return }
    loadCurrent()
  }, [open])

  const showToast = (type, message) => {
    if (window.Swal?.mixin) {
      window.Swal.mixin({
        toast: true, position: 'top-end', showConfirmButton: false,
        timer: 3000, timerProgressBar: true,
      }).fire({ icon: type, title: message })
      return
    }
    const t = document.createElement('div')
    t.innerText = message
    Object.assign(t.style, {
      position: 'fixed', right: '30px', bottom: '30px', padding: '12px 20px',
      color: '#fff', borderRadius: '6px', zIndex: 12000,
      background: type === 'success' ? '#22c55e' : '#dc3545',
    })
    document.body.appendChild(t)
    setTimeout(() => t.remove(), 2500)
  }

  const loadCurrent = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/admin/storage-settings', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load the current provider')
      const data = await res.json()
      setActive(data.activeProvider || 'local')
      setChoice(data.activeProvider || 'local')
    } catch (err) {
      console.error('[storage] load', err)
      setError('Could not load the current storage provider.')
    }
    setLoading(false)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/admin/storage-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider: choice }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Failed to switch provider')
      showToast('success', data.message || `Storage provider updated to ${choice}`)
      setActive(choice)
      setConfirming(false)
      onClose()
    } catch (err) {
      console.error('[storage] save', err)
      setError(err.message || 'Failed to switch provider')
      showToast('error', err.message || 'Failed to switch provider')
      setConfirming(false)
    }
    setSaving(false)
  }

  if (!open) return null

  // No change means no request.
  const unchanged = !choice || choice === active

  if (confirming) {
    return (
      <Modal
        title="Switch storage provider?"
        onClose={() => setConfirming(false)}
        busy={saving}
        footer={
          <>
            <button className="btn btn-light" onClick={() => setConfirming(false)} disabled={saving}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving && <span className="spinner-border spinner-border-sm me-1" role="status" />}
              {saving ? 'Switching…' : 'Switch provider'}
            </button>
          </>
        }
      >
        <p>
          New files will be written to{' '}
          <strong>{PROVIDERS.find((p) => p.key === choice)?.label}</strong>.
        </p>
        <div className="alert alert-warning py-2 px-3 mb-0">
          <i className="mdi mdi-alert-outline me-1" />
          Existing files are <strong>not moved</strong>. Anything already stored under{' '}
          {PROVIDERS.find((p) => p.key === active)?.label} stays there and will not be reachable
          until you switch back or migrate it yourself.
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title="Storage provider"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-light" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={unchanged || loading}
            onClick={() => setConfirming(true)}
            title={unchanged ? 'This is already the active provider' : undefined}
          >
            Switch provider
          </button>
        </>
      }
    >
      {loading && (
        <div className="text-center py-4">
          <div className="spinner-border text-primary" role="status" />
          <p className="text-muted mb-0 mt-2">Loading the current provider…</p>
        </div>
      )}

      {!loading && (
        <>
          {PROVIDERS.map((p) => (
            <div className="form-check mb-2" key={p.key}>
              <input
                className="form-check-input"
                type="radio"
                name="storage-provider"
                id={`sp-${p.key}`}
                checked={choice === p.key}
                onChange={() => setChoice(p.key)}
              />
              <label className="form-check-label" htmlFor={`sp-${p.key}`}>
                <span className="fw-semibold">
                  <i className={`mdi ${p.icon} me-1`} />{p.label}
                </span>
                {active === p.key && (
                  <span className="badge bg-success-lighten text-success ms-2">In use</span>
                )}
                <span className="text-muted font-12 d-block">{p.detail}</span>
              </label>
            </div>
          ))}

          {/* Visible while choosing, not only after the decision is made. */}
          <div className="alert alert-warning py-2 px-3 mt-3 mb-0">
            <i className="mdi mdi-alert-outline me-1" />
            Switching changes where <strong>new</strong> files go. Existing files are not moved, and
            anything stored under the other provider will not be reachable while it is inactive.
          </div>
        </>
      )}

      {error && (
        <div className="alert alert-danger py-2 px-3 mt-3 mb-0">
          <i className="mdi mdi-alert-circle-outline me-1" />{error}
        </div>
      )}
    </Modal>
  )
}
