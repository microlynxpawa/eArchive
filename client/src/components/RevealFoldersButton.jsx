import React, { useEffect, useRef } from 'react'

/**
 * RevealFoldersButton - A button component to toggle visibility of all folder trees
 * 
 * Props:
 * - containerId: ID of the container element that holds the folder tree (default: 'folder-tree')
 * - className: Additional CSS classes to apply to the button
 * - style: Inline styles for the button
 */
export default function RevealFoldersButton({ containerId = 'folder-tree', className = '', style = {} }) {
  const buttonRef = useRef(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    const button = buttonRef.current
    if (!button) return

    // Function to check and update button text based on actual folder visibility
    const updateButtonText = () => {
      const container = document.getElementById(containerId)
      if (!container) return

      const allSubItems = container.querySelectorAll('.sub-items')
      if (allSubItems.length === 0) {
        button.textContent = 'Show all folders'
        button.dataset.state = 'closed'
        return
      }

      // Check if any folder is visible
      const anyVisible = Array.from(allSubItems).some(el => 
        el.style.display === 'block' || el.style.display === ''
      )
      
      button.textContent = anyVisible ? 'Hide all folders' : 'Show all folders'
      button.dataset.state = anyVisible ? 'open' : 'closed'
    }

    // Handle button click
    const handleClick = (e) => {
      e.preventDefault()
      
      const container = document.getElementById(containerId)
      if (!container) return

      const allSubItems = container.querySelectorAll('.sub-items')
      if (allSubItems.length === 0) return

      // Check current state
      const anyVisible = Array.from(allSubItems).some(el => 
        el.style.display === 'block' || el.style.display === ''
      )

      if (anyVisible) {
        // Hide all folders
        allSubItems.forEach(el => { el.style.display = 'none' })
        button.textContent = 'Show all folders'
        button.dataset.state = 'closed'
      } else {
        // Show all folders
        allSubItems.forEach(el => { el.style.display = 'block' })
        button.textContent = 'Hide all folders'
        button.dataset.state = 'open'
      }
    }

    // Set initial button text
    updateButtonText()

    // Attach click listener
    button.addEventListener('click', handleClick)

    // Poll for changes in folder visibility (updates button text when folders are clicked individually)
    intervalRef.current = setInterval(updateButtonText, 200)

    // Cleanup
    return () => {
      button.removeEventListener('click', handleClick)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [containerId])

  const defaultStyle = {
    fontSize: '0.95em',
    color: '#888',
    textDecoration: 'underline',
    cursor: 'pointer',
    marginBottom: 8,
    display: 'inline-block',
    background: 'none',
    border: 'none',
    padding: 0,
    ...style
  }

  return (
    <button
      ref={buttonRef}
      className={className}
      style={defaultStyle}
      data-state="closed"
    >
      Show all folders
    </button>
  )
}
