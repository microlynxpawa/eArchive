import React, { useContext, useEffect, useMemo, useState } from 'react'
import Modal from '../components/Modal'
import { LayoutContext } from '../components/Layout'

/*
 * Announcements
 *
 * Written by admins and managers (supervision_right), seen by everyone through
 * the topbar bell and the dashboard card.
 *
 * Nothing is ever deleted from the database by design — the history view on the
 * dashboard depends on it — so "delete" here really does remove the row, and
 * the dialog says so.
 *
 * The endpoints already existed; what was missing was this page, the sidebar
 * entry, and a permission check on the writes.
 */

const PER_PAGE = 20

function formatMoment(value) {
  if (!value) return ''
  const d = new Date(value)
  return isNaN(d) ? '' : d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function Announcements() {
  const { auths = {} } = useContext(LayoutContext)
  const canManage = !!(auths.is_admin || auths.is_super_admin || auths.supervision_right)

  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const [editing, setEditing] = useState(null)   // { id, message } | { id: null }
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const showToast = (message, type = 'success') => {
    const t = document.createElement('div')
    t.innerText = message
    Object.assign(t.style, {
      position: 'fixed', right: '30px', bottom: '30px', padding: '12px 20px',
      color: '#fff', borderRadius: '6px', zIndex: 12000, fontSize: '0.95rem',
      boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
      background: type === 'success' ? '#22c55e' : '#dc3545',
    })
    document.body.appendChild(t)
    setTimeout(() => t.remove(), 2500)
  }

  const load = async (which = page) => {
    setLoading(true)
    try {
      const res = await fetch(`/admin/messages?page=${which}&limit=${PER_PAGE}`, {
        credentials: 'include',
      })
      const data = await res.json()
      setRows(data.messages || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error('[announcements] list', err)
    }
    setLoading(false)
  }

  useEffect(() => { load(page) }, [page])

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  const firstRow = total === 0 ? 0 : (page - 1) * PER_PAGE + 1
  const lastRow = Math.min(page * PER_PAGE, total)

  const save = async () => {
    const message = (editing.message || '').trim()
    if (!message) { setError('An announcement cannot be empty.'); return }

    setSaving(true)
    setError(null)
    try {
      const res = editing.id
        ? await fetch(`/admin/message/${editing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ message }),
          })
        : await fetch('/admin/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ message }),
          })

      const data = await res.json().catch(() => ({}))
      // The write endpoints answer 403 when the caller may not manage these.
      if (res.status === 403) {
        setError(data.error || 'You do not have permission to do that.')
        setSaving(false)
        return
      }
      if (!res.ok || data.success === false) {
        setError(data.error || 'Failed to save the announcement.')
        setSaving(false)
        return
      }

      showToast(editing.id ? 'Announcement updated.' : 'Announcement posted.')
      setEditing(null)
      // A new one belongs at the top, so go back to the first page.
      if (editing.id) load(page); else { setPage(1); load(1) }
    } catch (err) {
      console.error('[announcements] save', err)
      setError('Failed to save the announcement.')
    }
    setSaving(false)
  }

  const doDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/admin/message/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 403) {
        showToast(data.error || 'You do not have permission to do that.', 'error')
        setDeleting(false)
        setDeleteTarget(null)
        return
      }
      if (!res.ok || data.success === false) {
        showToast(data.error || 'Delete failed', 'error')
        setDeleting(false)
        return
      }
      showToast('Announcement deleted.')
      setDeleteTarget(null)
      // Stepping back a page if we just emptied the last one.
      const nextPage = rows.length === 1 && page > 1 ? page - 1 : page
      setPage(nextPage)
      load(nextPage)
    } catch (err) {
      console.error('[announcements] delete', err)
      showToast('Delete failed', 'error')
    }
    setDeleting(false)
  }

  return (
    <>
      <div className="row">
        <div className="col-12">
          <div className="page-title-box">
            <h4 className="page-title">Announcements</h4>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body">

              <p className="text-muted mb-3">
                Announcements are shown to every user, in the bell in the top bar and on their
                dashboard. They are kept permanently unless deleted here.
              </p>

              <div className="row mb-2">
                <div className="col-sm-6">
                  <button
                    className="btn btn-primary mb-2"
                    onClick={() => { setEditing({ id: null, message: '' }); setError(null) }}
                    disabled={!canManage}
                    title={canManage ? undefined : 'Administrator or supervision rights are required'}
                  >
                    <i className="mdi mdi-plus-circle me-1" />New announcement
                  </button>
                </div>
              </div>

              {!canManage && (
                <div className="alert alert-info py-2 px-3">
                  <i className="mdi mdi-information-outline me-1" />
                  You can read announcements here, but only administrators and supervisors can
                  write them.
                </div>
              )}

              {loading && (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary" role="status" />
                </div>
              )}

              {!loading && rows.length === 0 && (
                <div className="text-center py-5">
                  <i className="mdi mdi-bullhorn-outline text-muted" style={{ fontSize: 34 }} />
                  <h5 className="mt-2 mb-1">No announcements yet</h5>
                  <p className="text-muted mb-0">
                    {canManage
                      ? 'Post one and every user will see it.'
                      : 'Messages from your administrator will appear here.'}
                  </p>
                </div>
              )}

              {!loading && rows.map((m, i) => (
                <div
                  key={m.id}
                  className={`d-flex align-items-start ${i < rows.length - 1 ? 'border-bottom pb-3 mb-3' : ''}`}
                >
                  <div className="avatar-sm me-2 flex-shrink-0">
                    <span className="avatar-title bg-primary-lighten text-primary rounded">
                      <i className="mdi mdi-bullhorn-outline font-18" />
                    </span>
                  </div>
                  <div className="flex-grow-1 min-w-0">
                    <p className="mb-1" style={{ whiteSpace: 'pre-wrap' }}>{m.message}</p>
                    <span className="font-12 text-muted">{formatMoment(m.createdAt)}</span>
                  </div>
                  {canManage && (
                    <div className="flex-shrink-0 ms-2">
                      <button
                        className="btn btn-link p-0 text-muted me-2"
                        title="Edit"
                        onClick={() => { setEditing({ id: m.id, message: m.message }); setError(null) }}
                      >
                        <i className="mdi mdi-square-edit-outline font-16" />
                      </button>
                      <button
                        className="btn btn-link p-0 text-danger"
                        title="Delete"
                        onClick={() => setDeleteTarget(m)}
                      >
                        <i className="mdi mdi-delete-outline font-16" />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {!loading && total > 0 && (
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <span className="text-muted font-13">
                    Showing {firstRow} to {lastRow} of {total} announcement{total === 1 ? '' : 's'}
                  </span>
                  <div>
                    <span className="text-muted font-13 me-2">Page {page} of {totalPages}</span>
                    <button className="btn btn-sm btn-light" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      <i className="mdi mdi-chevron-left" />
                    </button>
                    <button className="btn btn-sm btn-light ms-1" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                      <i className="mdi mdi-chevron-right" />
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {editing && (
        <Modal
          title={editing.id ? 'Edit announcement' : 'New announcement'}
          onClose={() => setEditing(null)}
          busy={saving}
          footer={
            <>
              <button className="btn btn-light" onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-1" role="status" />}
                {saving ? 'Saving…' : (editing.id ? 'Save changes' : 'Post announcement')}
              </button>
            </>
          }
        >
          <label className="form-label" htmlFor="an-message">
            Message<span className="text-danger">*</span>
          </label>
          <textarea
            id="an-message"
            className={`form-control${error ? ' is-invalid' : ''}`}
            rows={4}
            placeholder="e.g. Scheduled maintenance this Saturday from 6pm."
            value={editing.message}
            onChange={(e) => setEditing({ ...editing, message: e.target.value })}
          />
          <div className="form-text">Every user will see this.</div>
          {error && (
            <div className="alert alert-danger py-2 px-3 mt-2 mb-0">
              <i className="mdi mdi-alert-circle-outline me-1" />{error}
            </div>
          )}
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="Delete announcement?"
          onClose={() => setDeleteTarget(null)}
          busy={deleting}
          footer={
            <>
              <button className="btn btn-light" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={doDelete} disabled={deleting}>
                {deleting && <span className="spinner-border spinner-border-sm me-1" role="status" />}
                {deleting ? 'Deleting…' : 'Delete announcement'}
              </button>
            </>
          }
        >
          <p className="mb-2">This announcement will be removed permanently:</p>
          <blockquote className="border-start border-3 ps-2 text-muted mb-2" style={{ whiteSpace: 'pre-wrap' }}>
            {deleteTarget.message}
          </blockquote>
          <div className="alert alert-warning py-2 px-3 mb-0">
            <i className="mdi mdi-alert-outline me-1" />
            It disappears from everyone&rsquo;s bell and from the history on their dashboard.
          </div>
        </Modal>
      )}
    </>
  )
}
