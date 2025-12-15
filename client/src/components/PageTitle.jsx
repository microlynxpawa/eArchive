import React from 'react'

export default function PageTitle({ title, subTitle }) {
  return (
    <div className="page-title">
      <div className="row">
        <div className="col-sm-6">
          <h3>{title}</h3>
        </div>
        <div className="col-sm-6">
          <ol className="breadcrumb">
            <li className="breadcrumb-item"><a href="/dashboard">🏠</a></li>
            <li className="breadcrumb-item">{title}</li>
            {subTitle && <li className="breadcrumb-item active">{subTitle}</li>}
          </ol>
        </div>
      </div>
    </div>
  )
}
