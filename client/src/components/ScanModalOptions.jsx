import React from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from './Modal'

/*
 * Scan
 *
 * There is no scanning feature: no endpoint, no integration, nothing to buy -
 * the app runs on the client's own server. The modal that used to sit here was
 * titled "Upgrade Your Plan" and offered an Upgrade button that revealed a
 * mailto: template, which is an upsell for something that does not exist and
 * cannot be bought.
 *
 * This says so plainly and points at the thing that does work.
 */

export default function ScanModalOptions({ open = false, onClose = () => {} }) {
  const navigate = useNavigate()

  if (!open) return null

  const goToUpload = () => {
    onClose()
    navigate('/file-upload')
  }

  return (
    <Modal
      title="Scanning"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-light" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={goToUpload}>
            <i className="mdi mdi-cloud-upload-outline me-1" />Go to Upload
          </button>
        </>
      }
    >
      <div className="text-center py-2">
        <i className="mdi mdi-scanner text-muted" style={{ fontSize: 40 }} />
        <h5 className="mt-2 mb-2">Scanning from the app is not available</h5>
        <p className="text-muted mb-0">
          Scan the document with your office scanner, save it as a PDF or an image, then upload it
          here. JPG, PNG and PDF are accepted.
        </p>
      </div>
    </Modal>
  )
}
