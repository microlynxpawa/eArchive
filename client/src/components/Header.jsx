import React from 'react'

export default function Header({ onNav }) {
  return (
    <header className="navbar navbar-light bg-white shadow-sm sticky-top">
      <div className="container-fluid d-flex align-items-center justify-content-between py-2">
        <div className="d-flex align-items-center gap-3">
          <img src="/assets/images/logo/logo.png" alt="logo" className="img-fluid" style={{height:32}} onError={(e)=>{e.target.style.display='none'}}/>
          <span className="h5 mb-0">e-Archive</span>
        </div>
        <nav>
          <button className="btn btn-link" onClick={() => onNav('dashboard')}>Dashboard</button>
          <button className="btn btn-link" onClick={() => onNav('upload')}>Upload</button>
          <button className="btn btn-link" onClick={() => onNav('reports')}>Reports</button>
          <button className="btn btn-primary" onClick={() => onNav('auth')}>Sign In</button>
        </nav>
      </div>
    </header>
  )
}
