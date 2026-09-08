import React, { useContext } from 'react'
import { Navigate } from 'react-router-dom'
import { LayoutContext } from './Layout'

/*
 * Route guard for the administration pages.
 *
 * The sidebar now shows every entry to everybody, disabled where it does not
 * apply. That is deliberate, but it means the labels advertise which pages
 * exist - so somebody will read "Users" and type the URL. These pages never
 * guarded themselves; they simply rendered and let the API answer.
 *
 * This is a UI guard, not a security boundary. The endpoints behind these
 * pages are the real boundary and are unchanged. Worth knowing:
 * /admin/retrieve-users answers any signed-in user, because the user picker
 * needs it so ordinary people can choose who to send files to. Locking it to
 * admins would break Send files; splitting it into a picker-safe projection
 * and an admin list is an API change and belongs in its own ticket.
 */
export default function RequireAdmin({ children, allow = 'admin' }) {
  const { auths } = useContext(LayoutContext)

  // The shell has not resolved permissions yet; render nothing rather than
  // bouncing somebody who is in fact allowed.
  if (!auths) return null

  const isAdmin = !!(auths.is_admin || auths.is_super_admin)
  const permitted = allow === 'announce'
    ? isAdmin || !!auths.supervision_right
    : isAdmin

  if (!permitted) return <Navigate to="/dashboard" replace />

  return children
}
