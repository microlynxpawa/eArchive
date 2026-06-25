import React, { useState, useEffect, useRef } from 'react'

export default function StorageSettingsModal() {
  const [visible, setVisible] = useState(false)
  const activeProviderRef = useRef('local')
  const [selected, setSelected] = useState('local')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const handleOpen = () => openModal()
    window.addEventListener('open-storage-settings', handleOpen)
    return () => window.removeEventListener('open-storage-settings', handleOpen)
  }, [])

  const openModal = async () => {
    setLoading(true)
    setVisible(true)
    try {
      const res = await fetch('/admin/storage-settings', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        activeProviderRef.current = data.activeProvider
        setSelected(data.activeProvider)
      }
    } catch (e) {
      console.error('Failed to fetch storage settings', e)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (selected === activeProviderRef.current) {
      setVisible(false)
      return
    }

    const confirmed =
      window.Swal && window.Swal.fire
        ? (
            await window.Swal.fire({
              title: 'Switch Storage Provider?',
              html:
                selected === 's3'
                  ? '<b>Switching to AWS S3 will not move existing local files.</b><br/>Files currently on the server will not be accessible in S3 mode until you run the migration script manually.'
                  : '<b>Switching to Local storage.</b><br/>Files stored in S3 will not be accessible until you switch back or migrate them.',
              icon: 'warning',
              showCancelButton: true,
              confirmButtonText: 'Switch',
              cancelButtonText: 'Cancel',
            })
          ).isConfirmed
        : window.confirm(
            `Switch storage to ${selected}?\n\nExisting files will NOT be moved automatically.`
          )

    if (!confirmed) return

    setSaving(true)
    try {
      const res = await fetch('/admin/storage-settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: selected }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok) {
        activeProviderRef.current = selected
        setVisible(false)
        showToast(data?.message || 'Storage provider updated.', 'success')
      } else {
        showToast(data?.message || 'Failed to update storage provider.', 'error')
      }
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  function showToast(message, type) {
    if (window.Swal && window.Swal.mixin) {
      window.Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
      }).fire({ icon: type, title: message })
    } else {
      alert(message)
    }
  }

  if (!visible) return null

  return (
    <div
      className="modal fade show"
      style={{ display: 'block', background: 'rgba(0,0,0,0.5)' }}
      tabIndex="-1"
      role="dialog"
    >
      <div className="modal-dialog modal-dialog-centered" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Storage Provider</h5>
            <button
              type="button"
              className="btn-close"
              onClick={() => setVisible(false)}
              aria-label="Close"
            />
          </div>

          <div className="modal-body">
            {loading ? (
              <div className="text-center py-3">
                <div className="spinner-border text-primary" role="status" />
              </div>
            ) : (
              <>
                <p className="text-muted mb-3">
                  Select where files are stored and served from. Only one provider is active at a
                  time.
                </p>

                <div className="form-check mb-3">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="storageProvider"
                    id="providerLocal"
                    value="local"
                    checked={selected === 'local'}
                    onChange={() => setSelected('local')}
                  />
                  <label className="form-check-label" htmlFor="providerLocal">
                    <strong>Local (server disk)</strong>
                    <div className="text-muted small">Files stored on the server filesystem.</div>
                  </label>
                </div>

                <div className="form-check mb-3">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="storageProvider"
                    id="providerS3"
                    value="s3"
                    checked={selected === 's3'}
                    onChange={() => setSelected('s3')}
                  />
                  <label className="form-check-label" htmlFor="providerS3">
                    <strong>AWS S3</strong>
                    <div className="text-muted small">
                      Files stored in an Amazon S3 bucket. Requires AWS credentials in server
                      environment variables.
                    </div>
                  </label>
                </div>

                {selected !== activeProviderRef.current && (
                  <div className="alert alert-warning py-2 mb-0">
                    <strong>Note:</strong> Switching providers does not move existing files
                    automatically. Run the migration script after switching if needed.
                  </div>
                )}
              </>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setVisible(false)}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || loading}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
