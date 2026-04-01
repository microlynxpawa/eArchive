import React, { useState, useEffect } from 'react'

/**
 * AlertModal - A reusable modal component for alerts and confirmations
 * Replaces browser alert() and confirm() with a styled modal interface
 * 
 * Usage:
 * 1. Add <AlertModal ref={alertModalRef} /> to your component
 * 2. Call alertModalRef.current.show({ ... }) to display
 * 
 * Examples:
 * - Alert: alertModalRef.current.show({ title: 'Error', message: 'Something went wrong', type: 'error' })
 * - Confirm: const confirmed = await alertModalRef.current.confirm({ message: 'Are you sure?', confirmText: 'Yes' })
 */
const AlertModal = React.forwardRef((props, ref) => {
  const [isVisible, setIsVisible] = useState(false)
  const [config, setConfig] = useState({
    title: '',
    message: '',
    type: 'info', // 'info', 'error', 'warning', 'success', 'confirm'
    confirmText: 'OK',
    cancelText: 'Cancel',
    showCancel: false,
    onConfirm: null,
    onCancel: null,
    onClose: null
  })

  // Expose methods to parent via ref
  React.useImperativeHandle(ref, () => ({
    // Show alert dialog
    show: ({ title = '', message = '', type = 'info', confirmText = 'OK', onClose = null }) => {
      setConfig({
        title,
        message,
        type,
        confirmText,
        cancelText: 'Cancel',
        showCancel: false,
        onConfirm: null,
        onCancel: null,
        onClose: onClose || null
      })
      setIsVisible(true)
    },
    
    // Show confirmation dialog and return a promise
    confirm: ({ title = 'Confirm', message = '', confirmText = 'Confirm', cancelText = 'Cancel', type = 'confirm' }) => {
      return new Promise((resolve) => {
        setConfig({
          title,
          message,
          type,
          confirmText,
          cancelText,
          showCancel: true,
          onConfirm: () => {
            setIsVisible(false)
            resolve(true)
          },
          onCancel: () => {
            setIsVisible(false)
            resolve(false)
          }
        })
        setIsVisible(true)
      })
    },
    
    // Hide modal
    hide: () => {
      setIsVisible(false)
    }
  }))

  const handleConfirm = () => {
    if (config.onConfirm) {
      config.onConfirm()
    } else {
      setIsVisible(false)
      if (typeof config.onClose === 'function') {
        setTimeout(() => config.onClose(), 0)
      }
    }
  }

  const handleCancel = () => {
    if (config.onCancel) {
      config.onCancel()
    } else {
      setIsVisible(false)
      if (typeof config.onClose === 'function') {
        setTimeout(() => config.onClose(), 0)
      }
    }
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !config.showCancel) {
      setIsVisible(false)
    }
  }

  if (!isVisible) return null

  // Determine icon and colors based on type
  const getTypeStyles = () => {
    switch (config.type) {
      case 'error':
        return {
          icon: '❌',
          color: '#dc3545',
          bgColor: '#f8d7da'
        }
      case 'warning':
        return {
          icon: '⚠️',
          color: '#ffc107',
          bgColor: '#fff3cd'
        }
      case 'success':
        return {
          icon: '✅',
          color: '#28a745',
          bgColor: '#d4edda'
        }
      case 'confirm':
        return {
          icon: '❓',
          color: '#007bff',
          bgColor: '#d1ecf1'
        }
      default: // info
        return {
          icon: 'ℹ️',
          color: '#17a2b8',
          bgColor: '#d1ecf1'
        }
    }
  }

  const typeStyles = getTypeStyles()

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10001,
        animation: 'fadeIn 0.2s ease-in-out'
      }}
      onClick={handleBackdropClick}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          minWidth: '320px',
          maxWidth: '500px',
          width: '90%',
          padding: '0',
          animation: 'slideIn 0.3s ease-out',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {config.title && (
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e9ecef',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: typeStyles.bgColor
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>{typeStyles.icon}</span>
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#333', fontWeight: 600 }}>
              {config.title}
            </h3>
          </div>
        )}

        {/* Body */}
        <div
          style={{
            padding: '24px',
            fontSize: '1rem',
            color: '#495057',
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap'
          }}
        >
          {config.message}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e9ecef',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            background: '#f8f9fa'
          }}
        >
          {config.showCancel && (
            <button
              onClick={handleCancel}
              className="btn btn-secondary"
              style={{
                padding: '8px 20px',
                fontSize: '0.95rem',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              {config.cancelText}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className={`btn ${config.type === 'error' ? 'btn-danger' : config.type === 'warning' ? 'btn-warning' : 'btn-primary'}`}
            style={{
              padding: '8px 20px',
              fontSize: '0.95rem',
              fontWeight: 500,
              cursor: 'pointer'
            }}
            autoFocus
          >
            {config.confirmText}
          </button>
        </div>
      </div>
    </div>
  )
})

AlertModal.displayName = 'AlertModal'

export default AlertModal
