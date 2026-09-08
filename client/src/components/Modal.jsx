import React, { useEffect } from 'react'

/*
 * Modal
 *
 * The admin pages render their dialogs from React state rather than driving
 * Bootstrap's JS, so something has to place the backdrop and set the stacking -
 * Hyper's own modal CSS only positions the dialog once a backdrop exists. Each
 * page used to carry its own copy of that CSS, which is why they had drifted
 * apart on colours, scrolling and dark mode.
 *
 * Closing is deliberately blocked while `busy` is set: a dialog that vanishes
 * mid-save leaves the user unsure whether the save happened.
 */

export default function Modal({
  title,
  onClose,
  children,
  footer,
  size = '',           // '' | 'lg' | 'xl'
  scrollable = false,
  busy = false,
}) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  return (
    <>
      <style>{MODAL_CSS}</style>
      <div
        className="modal fade show d-block ea-modal-backdrop"
        role="dialog"
        onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}
      >
        <div
          className={[
            'modal-dialog modal-dialog-centered ea-modal',
            size && `modal-${size}`,
            scrollable && 'modal-dialog-scrollable',
          ].filter(Boolean).join(' ')}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">{title}</h4>
              <button type="button" className="btn-close" onClick={onClose} disabled={busy} />
            </div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-footer">{footer}</div>}
          </div>
        </div>
      </div>
    </>
  )
}

const MODAL_CSS = `
.ea-modal-backdrop{position:fixed;inset:0;z-index:1055;background:rgba(0,0,0,.45);
  display:flex;align-items:center;justify-content:center;overflow-y:auto}
.ea-modal{pointer-events:auto;width:100%}
.ea-modal .modal-content{background-color:#fff;color:#313a46}
.ea-modal .modal-body{max-height:70vh;overflow-y:auto}
`
