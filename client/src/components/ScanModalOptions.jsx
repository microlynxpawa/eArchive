import React, { useEffect } from 'react'

export default function ScanModalOptions() {
  useEffect(() => {
    const handleOpenScan = () => {
      const modal = document.getElementById('upgradeModal')
      if (modal) {
        modal.style.display = 'block'
        modal.classList.add('show')
        document.body.classList.add('modal-open')
        // Add backdrop
        const backdrop = document.createElement('div')
        backdrop.className = 'modal-backdrop fade show'
        backdrop.id = 'scan-modal-backdrop'
        document.body.appendChild(backdrop)
      }
    }

    const handleClose = () => {
      const modal = document.getElementById('upgradeModal')
      const backdrop = document.getElementById('scan-modal-backdrop')
      if (modal) {
        modal.style.display = 'none'
        modal.classList.remove('show')
        document.body.classList.remove('modal-open')
      }
      if (backdrop) {
        backdrop.remove()
      }
    }

    window.addEventListener('open-scan-modal', handleOpenScan)

    // Add click handlers for close buttons
    const closeBtn = document.querySelector('#upgradeModal .btn-close')
    const cancelBtn = document.getElementById('cancelUpgrade')
    const upgradeBtn = document.getElementById('upgradeButton')

    if (closeBtn) closeBtn.addEventListener('click', handleClose)
    if (cancelBtn) cancelBtn.addEventListener('click', handleClose)
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => {
        const emailBox = document.getElementById('emailTemplateBox')
        if (emailBox) emailBox.style.display = 'block'
      })
    }

    return () => {
      window.removeEventListener('open-scan-modal', handleOpenScan)
      if (closeBtn) closeBtn.removeEventListener('click', handleClose)
      if (cancelBtn) cancelBtn.removeEventListener('click', handleClose)
    }
  }, [])

  return (
    <div className="modal fade" id="upgradeModal" style={{display:'none', zIndex: 1055}}>
      <div className="modal-dialog" style={{marginTop: '80px'}}>
        <div className="modal-content" style={{width:'100%', backgroundColor: '#fff'}}>
          <div className="modal-header" style={{borderBottom: '1px solid #dee2e6'}}>
            <h5 style={{color: '#000', margin: 0}}>Upgrade Your Plan</h5>
            <button className="btn-close" style={{cursor: 'pointer'}}>×</button>
          </div>
          <div className="modal-body" style={{color: '#000'}}>
            <p>This feature is only available on advanced plans. To upgrade, click the <b>Upgrade</b> button below to contact us at info@microlynxe.com or click <b>Upload existing file</b> to continue.</p>
            <div id="emailTemplateBox" style={{display:'none',marginTop:10}}>
              <label htmlFor="upgradeEmailTemplate" style={{color: '#000'}}>Email Template:</label>
              <textarea id="upgradeEmailTemplate" className="form-control" rows={7} readOnly defaultValue={`Subject: Request for Plan Upgrade\n\nHello Microlynxe Team,\n\nI would like to upgrade my plan to access advanced features. Please provide me with the available options and next steps.\n\nMy details:\n- Name: [Your Name]\n- Organization: [Your Organization]\n- Current Plan: [Your Current Plan]\n\nThank you.`}></textarea>
              <div className="mt-2"><a id="mailtoLink" href="#" className="btn btn-success" target="_blank">Send Email</a></div>
            </div>
          </div>
          <div className="modal-footer row d-flex justify-content-between" style={{borderTop: '1px solid #dee2e6'}}>
            <button className="btn btn-secondary col-5" id="cancelUpgrade">Upload existing file</button>
            <button className="btn btn-primary col-5" id="upgradeButton">Upgrade</button>
          </div>
        </div>
      </div>
    </div>
  )
}
