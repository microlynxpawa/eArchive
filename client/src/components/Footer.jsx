import React from 'react'

export default function Footer({ user = {} }) {
  const place = [user.archive_category?.name, user.branch?.name].filter(Boolean).join(' · ')

  return (
    <footer className="footer">
      <div className="container-fluid">
        <div className="row">
          <div className="col-md-6">
            {new Date().getFullYear()} &copy; xCore eArchive
          </div>
          <div className="col-md-6">
            <div className="text-md-end footer-links d-none d-md-block">
              <span className="text-muted">{place}</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
