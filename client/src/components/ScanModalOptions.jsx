import React from 'react'

export default function ScanModalOptions() {
  return (
    <div className="modal fade" id="upgradeModal" style={{display:'none'}}>
      <div className="modal-dialog">
        <div className="modal-content" style={{width:'100%'}}>
          <div className="modal-header">
            <h5>Upgrade Your Plan</h5>
            <button className="btn-close">×</button>
          </div>
          <div className="modal-body">
            <p>This feature is only available on advanced plans. To upgrade, click the <b>Upgrade</b> button below to contact us at info@microlynxe.com or click <b>Upload existing file</b> to continue.</p>
            <div id="emailTemplateBox" style={{display:'none',marginTop:10}}>
              <label htmlFor="upgradeEmailTemplate">Email Template:</label>
              <textarea id="upgradeEmailTemplate" className="form-control" rows={7} readOnly defaultValue={`Subject: Request for Plan Upgrade\n\nHello Microlynxe Team,\n\nI would like to upgrade my plan to access advanced features. Please provide me with the available options and next steps.\n\nMy details:\n- Name: [Your Name]\n- Organization: [Your Organization]\n- Current Plan: [Your Current Plan]\n\nThank you.`}></textarea>
              <div className="mt-2"><a id="mailtoLink" href="#" className="btn btn-success" target="_blank">Send Email</a></div>
            </div>
          </div>
          <div className="modal-footer row d-flex justify-content-between">
            <button className="btn btn-secondary col-5" id="cancelUpgrade">Upload existing file</button>
            <button className="btn btn-primary col-5" id="upgradeButton">Upgrade</button>
          </div>
        </div>
      </div>
    </div>
  )
}
