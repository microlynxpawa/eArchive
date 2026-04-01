import React, { useEffect, useState } from 'react'

export default function Dashboard() {
  const [user, setUser] = useState({ username: 'User', AuditLogs: [] })

  useEffect(() => {
    // UI: set static weather and fetch dashboard data from server
    updateWeatherSection()
    fetchDashboardData()
    startClock()
    // cleanup interval when unmounting
    return () => { try { clearInterval(window.__dashboardClockInterval) } catch (e) {} }
  }, [])

  function startClock() {
    const el = document.getElementById('current-date-time')
    if (!el) return
    function tick() {
      const d = new Date()
      el.textContent = d.toLocaleString()
    }
    tick()
    // store interval id globally to allow cleanup
    window.__dashboardClockInterval = setInterval(tick, 1000)
  }

  function updateWeatherSection() {
    // UI-only: populate static weather values to match the original layout
    const tempEl = document.getElementById('weather-temp')
    const iconEl = document.getElementById('weather-icon')
    const descEl = document.getElementById('weather-desc')
    const msgEl = document.getElementById('weather-message')
    if (tempEl) tempEl.innerHTML = `<span>28<sup><i class='fa fa-circle-o f-10'></i></sup>C </span>`
    if (iconEl) iconEl.innerHTML = `<i class='icofont icofont-sun font-primary'></i>`
    if (descEl) descEl.textContent = 'Sunny Day'
    if (msgEl) msgEl.textContent = 'Beautiful Sunny Day Walk'
  }

  async function fetchDashboardData() {
    try {
      const res = await fetch('/admin/dashboard-data', { credentials: 'include', headers: { Accept: 'application/json' } })
      if (!res.ok) return
      const data = await res.json()
      if (data && data.statusCode === 200) {
        setUser(data.user || { username: 'User', AuditLogs: [] })
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data', err)
    }
  }

  return (
    <div className="container-fluid dashboard-default">
      <div className="row g-3">
        {/* Profile Card */}
        <div className="col-12 col-md-6 col-lg-4">
          <div className="card profile-greeting">
            <div className="card-body">
              <div className="d-sm-flex d-block justify-content-between">
                <div className="flex-grow-1">
                  <div className="weather d-flex" id="weather-section">
                    <div id="weather-icon" style={{ fontSize: 28, marginRight: 8 }}></div>
                    <div id="weather-temp"></div>
                  </div>
                  <span className="font-primary f-w-700" id="weather-desc">Sunny Day</span>
                  <p id="weather-message">Beautiful Sunny Day Walk</p>
                </div>
                <div className="badge-group">
                  <div className="badge badge-light-primary f-12"> <i className="fa fa-clock-o"></i><span id="txt"></span></div>
                </div>
              </div>

              <div className="greeting-user">
                <div className="profile-vector">
                  <ul className="dots-images"></ul>
                  <img className="img-fluid" src={user && user.profilePicturePath ? ('/profile-pictures/' + (user.profilePicturePath.split(/\\|\//).pop()) + '?t=' + Date.now()) : '/assets/images/user/default.png'} alt="profile" loading="eager" />
                  <ul className="vector-image"></ul>
                </div>
                <h4>
                  <a href="/edit-profile"><span>View Profile</span> {user && user.username}</a>
                  <span className="right-circle"><i className="fa fa-check-circle font-primary f-14 middle"></i></span>
                </h4>
              </div>
            </div>
          </div>
        </div>

        {/* Date/Time Card */}
        <div className="col-12 col-md-6 col-lg-4">
          <div className="card total-revenue overflow-hidden">
            <div className="card-header">
              <div className="d-flex justify-content-between">
                <div className="flex-grow-1">
                  <p className="square-after f-w-600 header-text-primary">Current Date and Time<i className="fa fa-circle"></i></p>
                  <p id="current-date-time" className="f-w-800 mt-2"></p>
                </div>
              </div>
            </div>
            <div className="card-body p-0">
              <div className="revenue-chart" id="revenue-chart">{/* placeholder chart area */}</div>
            </div>
          </div>
        </div>

        {/* History Card */}
        <div className="col-12 col-md-6 col-lg-4">
          <div className="card total-investment">
            <div className="card-header pb-0">
              <div className="d-flex justify-content-between">
                <div className="flex-grow-1">
                  <p className="square-after f-w-600 header-text-primary">History<i className="fa fa-circle"> </i></p>
                  <h4 className="mb-2">Latest Login History</h4>
                  <h4>
                    {user && user.AuditLogs && user.AuditLogs.length > 0 ? (
                      <>
                        <p>Last Login Time: {user.AuditLogs[0].loginTime}</p>
                        <p>Last Logout Time: {user.AuditLogs[0].logoutTime}</p>
                      </>
                    ) : (
                      <p>No login or logout time data available.</p>
                    )}
                  </h4>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

