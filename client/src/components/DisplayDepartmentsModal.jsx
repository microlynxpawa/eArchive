import React, { useState, useEffect } from 'react'

export default function DisplayDepartmentsModal() {
  const [visible, setVisible] = useState(false)
  const [departments, setDepartments] = useState([])
  const [branchName, setBranchName] = useState('')

  useEffect(() => {
    // Bind click handler to rows by delegated event in consumer code - here we expose a helper
    function onClickHandler(e) {
      const target = e.target.closest('.department-column')
      if (target) {
        const names = target.textContent.split(',').map(s=>s.trim())
        setDepartments(names)
        const br = target.closest('tr')?.querySelector('.branchName')?.textContent || ''
        setBranchName(br)
        setVisible(true)
      }
    }
    document.addEventListener('click', onClickHandler)
    return () => document.removeEventListener('click', onClickHandler)
  }, [])

  async function deleteSelected(department) {
    if (!department) return alert('Select a department')
    try {
      const res = await fetch('/admin/delete-dep', { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ branchName, departmentName: department }) })
      if (!res.ok) throw new Error('Failed')
      alert('Deleted')
      setVisible(false)
      location.reload()
    } catch (err) { alert('Failed to delete') }
  }

  if (!visible) return null

  return (
    <div className="modal fade" style={{position:'fixed',inset:0,display:'flex',justifyContent:'center',alignItems:'center',background:'rgba(0,0,0,0.35)',zIndex:1200}}>
      <div className="modal-dialog">
        <div className="modal-content" style={{width:'90%'}}>
          <div className="modal-header">
            <h5>Select Only one Department for deletion at a time</h5>
            <button className="btn-close" onClick={() => setVisible(false)}>×</button>
          </div>
          <div className="modal-body">
            {departments.map(d => (
              <div key={d} className="form-check">
                <input className="form-check-input" type="radio" name="selectedDepartment" value={d} id={`dept-${d}`} />
                <label className="form-check-label" htmlFor={`dept-${d}`}>{d}</label>
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setVisible(false)}>Close</button>
            <button className="btn btn-danger" onClick={() => {
              const selected = document.querySelector('input[name="selectedDepartment"]:checked')?.value
              deleteSelected(selected)
            }}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  )
}
