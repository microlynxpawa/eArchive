import React, { useEffect, useRef, useState, createContext } from 'react'
import RevealFoldersButton from '../components/RevealFoldersButton'
import AlertModal from '../components/AlertModal'
import UserPickerModal from '../components/UserPickerModal'
import FileSendingHistoryModal from '../components/FileSendingHistoryModal'

export const AuthsContext = createContext()

const galleryCss = `
/* inline styles ported from gallery.ejs (trimmed where appropriate) */
/* ...existing code... */
#full-screen-preview { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display:flex; justify-content:center; align-items:center; z-index:9999; }
#preview-content { max-width:90%; max-height:90%; overflow:auto; background:white; padding:20px; border-radius:10px; }
#close-preview { position:absolute; top:10px; right:10px; background:red; color:white; border:none; padding:10px; cursor:pointer; }
.preview-image{ max-width:100%; height:auto }
.preview-text{ font-size:16px; color:black }
.folder-icon{ margin-right:5px }
.file-icon{ margin-right:5px }
.file-name{ cursor:pointer; color:var(--link-color); display:inline-block; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; vertical-align:middle; }
.file-content{ border:1px solid var(--panel-border); height:300px; overflow-y:auto; padding:15px; background: var(--gallery-bg); color: var(--gallery-text) }
.sub-items{ margin-left:20px; display:block }
.file-name:hover{ text-decoration:underline }
.folder-button{ all:unset; cursor:pointer }
.folder-button:hover{ text-decoration:underline }
.file-item{ display:flex; align-items:center; word-break:break-all; max-width:100%; gap:8px; padding:4px 0 }
.folder-button{ display:block; width:100%; text-align:left; padding:6px 8px; border-radius:4px }
.sub-items{ margin-left:18px; padding-left:8px; border-left:1px dashed rgba(0,0,0,0.06) }
.file-checkbox{ margin-right:10px }
#file-viewer, .box-shadow{ box-shadow:2px 2px 4px 4px rgba(0,0,0,0.06); padding:20px; border-radius:8px; background:var(--gallery-bg); color:var(--gallery-text); border:1px solid var(--panel-border) }
#searchResultsModal{ position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:flex; justify-content:center; align-items:center; z-index:9999 }
#filesModalContent{ background:white; padding:20px; border-radius:10px; max-height:80%; overflow-y:auto }
#matchedFilesList{ list-style:none; padding:0 }
#matchedFilesList li{ margin:5px 0 }
/* Theme variables and dark-mode support */
:root{ --gallery-bg: #ffffff; --gallery-text: #0b1220; --link-color: #0d6efd; --panel-border: #e6eef6 }
/* Respect common dark-mode markers */
.dark, [data-theme='dark'], body.dark { --gallery-bg: #0b1220; --gallery-text: #e6eef6; --link-color: #66b2ff; --panel-border: #23303b }

#folder-tree{ min-width:0; max-width:100%; overflow-x:auto }
.box-shadow.col-4{ min-width:0; max-width:100%; overflow-x:auto }
/* Truncate long batch and file names, show full on hover */
.file-name, .folder-name {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
  vertical-align: middle;
  /* No width expansion on hover, rely on tooltip */
}
.file-name:hover, .folder-name:hover {
  background: #f5f5f5;
  z-index: 2;
  position: relative;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  /* No max-width change, prevents flicker */
}
`

export default function Gallery() {
  const [userAuths, setUserAuths] = useState({})
  const alertModalRef = useRef(null)
  const userPickerModalRef = useRef(null)
  const fileSendingHistoryModalRef = useRef(null)
  const fileTreeRef = useRef(null)

  // Handle navigating to a file in the gallery from history modal
  const handleNavigateToFile = (filePath, fileName) => {
    
    const searchAndHighlightFile = async () => {
      try {
        // First, try to find the file in currently visible items
        const allFileItems = document.querySelectorAll('.file-item')
        
        for (let item of allFileItems) {
          const fileNameElement = item.querySelector('.file-name')
          if (fileNameElement && fileNameElement.textContent.trim() === fileName) {
            await highlightFile(item, fileName)
            return true
          }
        }
        
        // If not found in visible items, we need to expand folders
        return expandFoldersAndFind(fileName)
        
      } catch (err) {
        console.error('[handleNavigateToFile] Error:', err)
        alertModalRef.current?.show({
          title: 'Error',
          message: 'Error navigating to file location',
          type: 'error'
        })
        return false
      }
    }
    
    const highlightFile = async (fileItem, fileName) => {
      // Step 1: Check if file is in a collapsed folder and expand it
      let parent = fileItem.parentElement
      let needsExpanding = false
      
      while (parent) {
        if (parent.classList.contains('sub-items')) {
          const isHidden = parent.style.display === 'none' || !parent.offsetHeight
          
          if (isHidden) {
            // Find the folder button that controls this sub-items
            const folderButton = parent.previousElementSibling
            if (folderButton && folderButton.classList.contains('folder-button')) {
              // Click the button to expand
              folderButton.click()
              needsExpanding = true
            }
            // Force display block
            parent.style.display = 'block'
          }
        }
        parent = parent.parentElement
      }
      
      // Wait for DOM to update if we expanded folders
      if (needsExpanding) {
        await new Promise(r => setTimeout(r, 200))
      }
      
      // Step 2: Now scroll into view
      try {
        fileItem.scrollIntoView({ behavior: 'auto', block: 'center' })
        await new Promise(r => setTimeout(r, 100))
        
      } catch (e) {
        // scrollIntoView error silently
      }
      
      // Store original styles
      const originalBackground = fileItem.style.backgroundColor
      const originalBorder = fileItem.style.border
      const originalBorderRadius = fileItem.style.borderRadius
      const originalPadding = fileItem.style.padding
      const originalBoxShadow = fileItem.style.boxShadow
      const originalZIndex = fileItem.style.zIndex
      const originalPosition = fileItem.style.position
      const originalOutline = fileItem.style.outline
      const originalOutlineOffset = fileItem.style.outlineOffset
      
      // Apply EXTREME highlight styles that will definitely show
      fileItem.style.position = 'relative'
      fileItem.style.backgroundColor = '#FFD700 !important'  // Bright gold
      fileItem.style.border = '5px solid #FF0000 !important'  // Bright red border
      fileItem.style.borderRadius = '10px'
      fileItem.style.padding = '10px 15px !important'
      fileItem.style.boxShadow = '0 0 20px rgba(255, 0, 0, 1), inset 0 0 10px rgba(255, 215, 0, 0.7) !important'
      fileItem.style.zIndex = '99999'
      fileItem.style.outline = '3px dashed #FF0000'
      fileItem.style.outlineOffset = '3px'
      fileItem.style.transition = 'none'
      
      // Remove highlight after 3 seconds
      setTimeout(() => {
        fileItem.style.backgroundColor = originalBackground
        fileItem.style.border = originalBorder
        fileItem.style.borderRadius = originalBorderRadius
        fileItem.style.padding = originalPadding
        fileItem.style.boxShadow = originalBoxShadow
        fileItem.style.zIndex = originalZIndex
        fileItem.style.position = originalPosition
        fileItem.style.outline = originalOutline
        fileItem.style.outlineOffset = originalOutlineOffset
      }, 3000)
    }
    
    const expandFoldersAndFind = (targetFileName) => {
      // Get all folder buttons that are currently visible
      const folderButtons = document.querySelectorAll('.folder-button')
      
      let foundAndHighlighted = false
      let expandedCount = 0
      
      // Click each folder to expand it and check if the file appears
      folderButtons.forEach((button) => {
        if (!foundAndHighlighted) {
          const folderName = button.textContent.trim()
          
          // Get the adjacent sub-items div
          const subItems = button.parentElement?.nextElementSibling
          if (subItems && subItems.classList.contains('sub-items')) {
            const isHidden = subItems.style.display === 'none' || !subItems.offsetHeight
            
            if (isHidden) {
              button.click()
              expandedCount++
              
              // Wait a bit for DOM to update, then search
              setTimeout(() => {
                const fileItems = subItems.querySelectorAll('.file-item')
                
                for (let item of fileItems) {
                  const fileNameElement = item.querySelector('.file-name')
                  if (fileNameElement && fileNameElement.textContent.trim() === targetFileName) {
                    highlightFile(item, targetFileName)
                    foundAndHighlighted = true
                    return
                  }
                }
              }, 100)
            }
          }
        }
      })
      
      // If we expanded folders but still haven't found the file, show info message
      if (expandedCount > 0 && !foundAndHighlighted) {
        setTimeout(() => {
          // Try one more search after all expansions
          const allVisibleItems = document.querySelectorAll('.file-item')
          for (let item of allVisibleItems) {
            const fileNameElement = item.querySelector('.file-name')
            if (fileNameElement && fileNameElement.textContent.trim() === targetFileName) {
              highlightFile(item, targetFileName)
              foundAndHighlighted = true
              return
            }
          }
          
          if (!foundAndHighlighted) {
            alertModalRef.current?.show({
              title: 'File Not Found',
              message: `Could not locate file "${targetFileName}" in the file structure. It may have been deleted or moved.`,
              type: 'warning'
            })
          }
        }, 500)
      }
      
      return foundAndHighlighted
    }
    
    // Start the search after a small delay to ensure modal is closed
    setTimeout(searchAndHighlightFile, 100)
  }

  // Handle resending files from history
  const handleResendFile = (fileNames, filePaths) => {
    // Pre-select the files and open the send dialog
    const fileList = Array.isArray(fileNames) ? fileNames : [fileNames]
    const files = fileList.map((name, idx) => ({
      name: name,
      path: filePaths[idx] || filePaths[0]
    }))
    
    // Set up the file picker with these files
    const fileCheckboxes = document.querySelectorAll('.file-checkbox')
    fileCheckboxes.forEach(checkbox => {
      const label = checkbox.parentElement.textContent
      if (files.some(f => label.includes(f.name))) {
        checkbox.checked = true
      }
    })
    
    // Open the user picker modal to select recipients
    userPickerModalRef.current?.show()
  }

  // Handle deleting files from history
  const handleDeleteFile = async (fileNames, filePaths) => {
    try {
      const fileList = Array.isArray(fileNames) ? fileNames : [fileNames]
      // Call the delete endpoint for each file
      for (let i = 0; i < fileList.length; i++) {
        const response = await fetch('/admin/deleteFile', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: fileList[i] })
        })
        
        if (!response.ok) {
          throw new Error(`Failed to delete ${fileList[i]}`)
        }
      }
      
      alertModalRef.current?.show({
        title: 'Files Deleted',
        message: `Successfully deleted ${fileList.length} file(s).`,
        type: 'success'
      })
      
      // Refresh the folder structure
      location.reload()
    } catch (err) {
      alertModalRef.current?.show({
        title: 'Delete Error',
        message: `Error deleting files: ${err.message}`,
        type: 'error'
      })
    }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      // Fetch user authorization data first
      let authData = null
      try {
        const authRes = await fetch('/admin/dashboard-data', { 
          credentials: 'include', 
          headers: { Accept: 'application/json' } 
        })
        if (authRes.ok) {
          authData = await authRes.json()
          if (authData && authData.statusCode === 200 && authData.auths) {
            console.log('[Gallery] Setting userAuths:', authData.auths)
            if (mounted) setUserAuths(authData.auths)
            
            // Hide buttons based on permissions immediately after fetching
            const pickSendBtn = document.getElementById('pick-send-button')
            const deleteBtn = document.getElementById('delete-button')
            const cancelDeleteBtn = document.getElementById('cancel-delete-button')
            const sendBtn = document.getElementById('send-button')

            // Pick & Send button: requires view_upload and not disabled
            if (pickSendBtn) {
              if (!(authData.auths && !authData.auths.is_disabled && authData.auths.view_upload)) {
                pickSendBtn.style.display = 'none'
              }
            }
            
            // Delete and Cancel Delete buttons: requires is_admin
            if (deleteBtn) {
              if (!(authData.auths && authData.auths.is_admin)) {
                deleteBtn.style.display = 'none'
              }
            }
            if (cancelDeleteBtn) {
              if (!(authData.auths && authData.auths.is_admin)) {
                cancelDeleteBtn.remove()
              }
            }
            
            // Send button: requires view_upload and not disabled
            if (sendBtn) {
              if (!(authData.auths && !authData.auths.is_disabled && authData.auths.view_upload)) {
                sendBtn.remove()
              }
            }
          }
        }
      } catch (e) {
        console.error('Failed to fetch user authorizations', e)
      }

      // Fetch server-provided file structure for the authenticated user
      let serverStructure = null
      try {
        const res = await fetch('/admin/file-structure', { credentials: 'include', headers: { Accept: 'application/json' } })
        if (res.ok) {
          const j = await res.json()
          serverStructure = j && j.fileStructure ? j.fileStructure : null
        }
      } catch (e) {
        serverStructure = null
      }

        // Always use the file structure from the API/database only
        const fileStructure = serverStructure
        const folderTree = document.getElementById('folder-tree')
        if (folderTree) {
          // Clear folder tree (the RevealFoldersButton component will be rendered in JSX)
          folderTree.innerHTML = ''
        }

    // --- Helpers for file grouping / date extraction (ported from EJS) ---
    function extractDateFromFilename(filename) {
      const match = filename.match(/[\s_\-\.](\d{1,2})-(\d{1,2})-(\d{4})\./)
      if (!match) return null
      const day = parseInt(match[1], 10)
      const month = parseInt(match[2], 10) - 1
      const year = parseInt(match[3], 10)
      return new Date(year, month, day)
    }

    function sortFilesByDateDesc(files) {
      return files.slice().sort(function (a, b) {
        const dateA = extractDateFromFilename(a) || new Date(0)
        const dateB = extractDateFromFilename(b) || new Date(0)
        return dateB - dateA
      })
    }

    function extractBatchName(filename) {
      // Extract everything after the first '@' up to the last dot before the extension
      // Example: file@batch_name-2024_01_23.pdf => batch_name-2024_01_23
      const atIdx = filename.indexOf('@')
      if (atIdx === -1) return null
      // Find the last dot before the extension
      const lastDotIdx = filename.lastIndexOf('.')
      if (lastDotIdx === -1 || lastDotIdx < atIdx) return filename.slice(atIdx + 1)
      return filename.slice(atIdx + 1, lastDotIdx)
    }

    function groupFilesByBatch(files) {
      const groups = {}
      files.forEach(file => {
        const batch = extractBatchName(file) || '__none__'
        if (!groups[batch]) groups[batch] = []
        groups[batch].push(file)
      })
      return groups
    }

    function createFileItem(fileName, parentKey) {
      const wrapper = document.createElement('div')
      wrapper.className = 'file-item'

      const cb = document.createElement('input')
      cb.type = 'checkbox'
      cb.className = 'file-checkbox'
      cb.setAttribute('data-file', fileName)
      cb.style.display = 'none'
      // Normalize path: replace forward slashes with backslashes, remove leading/trailing slashes
      const normalizedParent = parentKey ? parentKey.replace(/^[/\\]+|[/\\]+$/g, '').replace(/\//g, '\\') : ''
      const fullPath = normalizedParent ? `C:\\e-archiveUploads\\${normalizedParent}\\${fileName}` : `C:\\e-archiveUploads\\${fileName}`
      cb.setAttribute('data-fullpath', fullPath)


      // Use a small inline SVG file icon to avoid relying on FontAwesome
      const icon = document.createElement('span')
      icon.className = 'file-icon'
      icon.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="#6b7280" />
          <path d="M14 2v6h6" fill="#9ca3af" />
        </svg>`

      const span = document.createElement('span')
      span.className = 'file-name'
      span.setAttribute('data-file', fileName)
      span.title = fileName
      span.style.maxWidth = '220px'
      span.innerText = fileName

      wrapper.appendChild(cb)
      wrapper.appendChild(icon)
      wrapper.appendChild(span)
      return wrapper
    }

    function renderFiles(files, parentKey, container) {
      // files: array of filenames
      const sorted = sortFilesByDateDesc(files)
      const grouped = groupFilesByBatch(sorted)

      Object.keys(grouped).forEach(batch => {
        const batchFiles = grouped[batch]
        const target = container || folderTree
        if (batch === '__none__') {
          if (batchFiles.length > 0) {
            const singleFolderBtn = document.createElement('button')
            singleFolderBtn.className = 'folder-button'
            const singleKey = parentKey ? `${parentKey}/Single Uploads` : 'Single Uploads'
            singleFolderBtn.setAttribute('data-folder', singleKey)
            singleFolderBtn.innerHTML = `<svg width=14 height=14 viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' aria-hidden><path d='M3 7h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z' fill='#6b7280'/></svg> <strong class="folder-name" title="Single Uploads">Single Uploads</strong> <span class='badge badge-secondary' style='margin-left:8px'>${batchFiles.length}</span>`
            const singleSub = document.createElement('div')
            singleSub.className = 'sub-items'
            singleSub.style.display = 'none'
            target.appendChild(singleFolderBtn)
            target.appendChild(singleSub)
            singleFolderBtn.addEventListener('click', function (ev) {
              ev.preventDefault()
              const isClosed = singleSub.style.display === 'none' || !singleSub.style.display
              // Always toggle open/close
              singleSub.style.display = isClosed ? 'block' : 'none'
              // In delete mode, only toggle checkboxes if folder is already open (on second click)
              if (window.__galleryIsDeleteMode && !isClosed) {
                const checkboxes = singleSub.querySelectorAll('.file-checkbox')
                const allChecked = Array.from(checkboxes).every(cb => cb.checked)
                checkboxes.forEach(cb => { cb.checked = !allChecked; cb.dispatchEvent(new Event('change', { bubbles: true })) })
              }
            })
            batchFiles.forEach(f => singleSub.appendChild(createFileItem(f, parentKey)))
          }
        } else {
          const batchFolderBtn = document.createElement('button')
          batchFolderBtn.className = 'folder-button'
          const batchKey = parentKey ? `${parentKey}/${batch}` : batch
          batchFolderBtn.setAttribute('data-folder', batchKey)
          batchFolderBtn.innerHTML = `<svg width=14 height=14 viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' aria-hidden><path d='M3 7h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z' fill='#6b7280'/></svg> <strong class="folder-name" title="${batch}">${batch}</strong> <span class='badge badge-secondary' style='margin-left:8px'>${batchFiles.length}</span>`
          const batchSub = document.createElement('div')
          batchSub.className = 'sub-items'
          batchSub.style.display = 'none'
          ;(container || target).appendChild(batchFolderBtn)
          ;(container || target).appendChild(batchSub)
          batchFolderBtn.addEventListener('click', function (ev) {
            ev.preventDefault()
            const isClosed = batchSub.style.display === 'none' || !batchSub.style.display
            // Always toggle open/close
            batchSub.style.display = isClosed ? 'block' : 'none'
            // In delete mode, only toggle checkboxes if folder is already open (on second click)
            if (window.__galleryIsDeleteMode && !isClosed) {
              const checkboxes = batchSub.querySelectorAll('.file-checkbox')
              const allChecked = Array.from(checkboxes).every(cb => cb.checked)
              checkboxes.forEach(cb => { cb.checked = !allChecked; cb.dispatchEvent(new Event('change', { bubbles: true })) })
            }
          })
          batchFiles.forEach(f => batchSub.appendChild(createFileItem(f, batchKey)))
        }
      })
    }

    function renderStructure(structure, parentKey = '', container) {
      if (!folderTree) return
      if (typeof structure !== 'object') return

      const keys = Object.keys(structure)
      keys.forEach(key => {
        if (key === 'files' && Array.isArray(structure[key])) {
          // append files into the provided container (or folderTree if none)
          renderFiles(structure[key], parentKey, container || folderTree)
        } else if (Array.isArray(structure[key])) {
          // folder contains files array — render into a sub container first
          if (!structure[key] || structure[key].length === 0) return // skip empty folders
          const sub = document.createElement('div')
          sub.className = 'sub-items'
          sub.style.display = 'none'
          // populate sub
          renderFiles(structure[key], parentKey ? `${parentKey}/${key}` : key, sub)
          // only append folder if sub has children
          if (sub.children.length > 0) {
            const folderBtn = document.createElement('button')
            folderBtn.className = 'folder-button'
            folderBtn.setAttribute('data-folder', parentKey ? `${parentKey}/${key}` : key)
            folderBtn.innerHTML = `<svg width=14 height=14 viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' aria-hidden><path d='M10 4H4a2 2 0 0 0-2 2v2h20V8a2 2 0 0 0-2-2h-8z' fill='#6b7280'/><path d='M2 10v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-8H2z' fill='#9ca3af'/></svg><strong class="folder-name" title="${key}">${key}</strong>`
            ;(container || folderTree).appendChild(folderBtn)
            ;(container || folderTree).appendChild(sub)
            // attach click handler directly to ensure toggle works reliably
            folderBtn.addEventListener('click', function (ev) {
              ev.preventDefault()
              sub.style.display = sub.style.display === 'none' || !sub.style.display ? 'block' : 'none'
            })
          }
        } else if (typeof structure[key] === 'object') {
          // nested folder object — render into sub first and check children
          const sub = document.createElement('div')
          sub.className = 'sub-items'
          sub.style.display = 'none'
          renderStructure(structure[key], parentKey ? `${parentKey}/${key}` : key, sub)
          if (sub.children.length > 0) {
            const folderBtn = document.createElement('button')
            folderBtn.className = 'folder-button'
            folderBtn.setAttribute('data-folder', parentKey ? `${parentKey}/${key}` : key)
            folderBtn.innerHTML = `<svg width=14 height=14 viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' aria-hidden><path d='M10 4H4a2 2 0 0 0-2 2v2h20V8a2 2 0 0 0-2-2h-8z' fill='#6b7280'/><path d='M2 10v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-8H2z' fill='#9ca3af'/></svg><strong class="folder-name" title="${key}">${key}</strong>`
            ;(container || folderTree).appendChild(folderBtn)
            ;(container || folderTree).appendChild(sub)
            // attach click handler directly to ensure toggle works reliably
            folderBtn.addEventListener('click', function (ev) {
              ev.preventDefault()
              sub.style.display = sub.style.display === 'none' || !sub.style.display ? 'block' : 'none'
            })
          }
        }
      })
    }

    // Only render structure if received from server
    if (fileStructure) {
      // if root contains single Admin, use that
      const keys = Object.keys(fileStructure)
      if (keys.length === 1 && keys[0] === 'Admin') renderStructure(fileStructure['Admin'])
      else renderStructure(fileStructure)
    }

    // -------------------------
    // Client wiring for interactions
    // -------------------------
    const wireUi = () => {
      const pickSendButton = document.getElementById('pick-send-button')
      const deleteButton = document.getElementById('delete-button')
      const cancelDeleteButton = document.getElementById('cancel-delete-button')
      const sendButton = document.getElementById('send-button')
      const selectFileMessage = document.getElementById('select-file-message')
      const deleteInfo = document.getElementById('delete-info')
      const searchBtn = document.getElementById('searchButton')
      const searchInputEl = document.getElementById('search-input')

      let isPickSendMode = false
      let isDeleteMode = false
      let userCanDelete = false  // Track if user has delete permissions
      // Expose delete mode flag globally for batch click logic
      window.__galleryIsDeleteMode = false

      // Determine if user has delete permissions (is_admin)
      if (authData && authData.auths && authData.auths.is_admin) {
        userCanDelete = true
      }

      function updateCheckboxVisibility(visible) {
        document.querySelectorAll('.file-checkbox').forEach(cb => {
          cb.style.display = visible ? 'inline-block' : 'none'
          if (!visible) cb.checked = false
          // Add change listener to update send button visibility
          if (visible && !cb.dataset.listenerAttached) {
            cb.addEventListener('change', updateSendButtonVisibility)
            cb.dataset.listenerAttached = 'true'
          }
        })
        if (visible) updateSendButtonVisibility()
      }

      function getSelectedFilePaths() {
        const paths = []
        document.querySelectorAll('.file-checkbox:checked').forEach(cb => {
          let fullPath = cb.getAttribute('data-fullpath')
          const fileName = cb.getAttribute('data-file')
          // Extract batch name from fileName (after @, before .)
          let batchName = null
          const atIdx = fileName.indexOf('@')
          const lastDotIdx = fileName.lastIndexOf('.')
          if (atIdx !== -1) {
            batchName = lastDotIdx > atIdx ? fileName.slice(atIdx + 1, lastDotIdx) : fileName.slice(atIdx + 1)
          }
          if (batchName) {
            // Look for the pattern \\batchName\\fileName at the end of the path
            const batchFolderPattern = new RegExp(`\\\\${batchName}\\\\${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
            if (batchFolderPattern.test(fullPath)) {
              // Remove the batch folder from the path
              fullPath = fullPath.replace(new RegExp(`\\\\${batchName}\\\\${fileName}$`), `\\${fileName}`)
            }
          }
          if (fullPath) paths.push(fullPath)
        })
        return paths
      }

      function getSelectedFileNames() {
        const names = []
        document.querySelectorAll('.file-checkbox:checked').forEach(cb => {
          const fileName = cb.getAttribute('data-file')
          if (fileName) names.push(fileName)
        })
        return names
      }

      // Update send button visibility based on selection (like EJS)
      function updateSendButtonVisibility() {
        const anyChecked = document.querySelectorAll('.file-checkbox:checked').length > 0
        if (isPickSendMode) {
          // Always keep pickSendButton visible in Pick & Send mode as the cancel button
          if (pickSendButton) pickSendButton.style.display = 'inline-block'
          
          if (anyChecked) {
            if (selectFileMessage) selectFileMessage.style.display = 'none'
            if (sendButton) sendButton.style.display = 'inline-block'
          } else {
            if (selectFileMessage) selectFileMessage.style.display = 'block'
            if (sendButton) sendButton.style.display = 'none'
          }
        } else {
          // Not in Pick & Send mode - hide send button and message
          if (sendButton) sendButton.style.display = 'none'
          if (selectFileMessage) selectFileMessage.style.display = 'none'
          if (isDeleteMode) {
            // In delete mode but not in pick & send
          } else {
            if (cancelDeleteButton) cancelDeleteButton.style.display = 'none'
          }
        }
      }

      if (pickSendButton) {
        pickSendButton.addEventListener('click', () => {
          isPickSendMode = !isPickSendMode
          if (isPickSendMode) {
            isDeleteMode = false
            updateCheckboxVisibility(true)
            selectFileMessage.style.display = 'block'
            pickSendButton.innerText = 'Cancel file sending'
            pickSendButton.classList.remove('btn-primary')
            pickSendButton.classList.add('btn-danger')
            pickSendButton.style.display = 'inline-block'
            if (deleteButton) deleteButton.style.display = 'none'
          } else {
            updateCheckboxVisibility(false)
            selectFileMessage.style.display = 'none'
            pickSendButton.innerText = 'Pick & Send'
            pickSendButton.classList.remove('btn-danger')
            pickSendButton.classList.add('btn-primary')
            pickSendButton.style.display = 'inline-block'
            // Only show delete button if user has delete permissions
            if (deleteButton && userCanDelete) deleteButton.style.display = 'inline-block'
            updateSendButtonVisibility()
          }
        })
      }

      if (deleteButton) {
        deleteButton.addEventListener('click', async () => {
          if (!isDeleteMode) {
            // activate delete mode
            isDeleteMode = true
            window.__galleryIsDeleteMode = true
            updateCheckboxVisibility(true)
            deleteInfo.style.display = 'block'
            if (cancelDeleteButton) {
              cancelDeleteButton.style.display = 'inline-block'
              cancelDeleteButton.innerText = 'Cancel Delete'
            }
            deleteButton.innerText = 'Confirm Delete'
            deleteButton.classList.remove('btn-secondary')
            deleteButton.classList.add('btn-danger')
            if (pickSendButton) pickSendButton.style.display = 'none'
            return
          }

          // Confirm delete
          const filePaths = getSelectedFilePaths()
          if (filePaths.length === 0) {
            if (window.Swal && window.Swal.fire) {
              await window.Swal.fire('No Files Selected', 'Please select at least one file to delete.', 'warning')
            } else if (window.swal) {
              window.swal('No Files Selected', 'Please select at least one file to delete.', 'warning')
            } else {
              alert('Please select at least one file to delete.')
            }
            return
          }
          let confirmed = false;
          if (window.Swal && window.Swal.fire) {
            const result = await window.Swal.fire({
              title: 'Confirm Delete',
              text: `Delete ${filePaths.length} file(s)? This action cannot be undone.`,
              icon: 'warning',
              showCancelButton: true,
              confirmButtonText: 'Delete',
              cancelButtonText: 'Cancel',
              reverseButtons: true
            });
            confirmed = !!result.isConfirmed;
          } else if (window.swal) {
            confirmed = await window.swal({
              title: 'Confirm Delete',
              text: `Delete ${filePaths.length} file(s)? This action cannot be undone.`,
              icon: 'warning',
              buttons: ['Cancel', 'Delete'],
              dangerMode: true
            });
          } else {
            confirmed = window.confirm(`Delete ${filePaths.length} file(s)? This action cannot be undone.`);
          }
          if (!confirmed) return;
          try {
            const res = await fetch('/admin/delete-file', {
              method: 'DELETE',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ files: filePaths }),
            })
            const j = await res.json().catch(() => null)
            if (res.ok) {
              if (window.Swal && window.Swal.fire) {
                await window.Swal.fire('Success', 'Files deleted successfully.', 'success')
              } else if (window.swal) {
                await window.swal('Success', 'Files deleted successfully.', 'success')
              } else {
                alert('Files deleted successfully.')
              }
              window.location.reload()
            } else {
              if (window.Swal && window.Swal.fire) {
                await window.Swal.fire('Delete Failed', (j && j.message) || 'Failed to delete files.', 'error')
              } else if (window.swal) {
                await window.swal('Delete Failed', (j && j.message) || 'Failed to delete files.', 'error')
              } else {
                alert((j && j.message) || 'Failed to delete files.')
              }
            }
          } catch (err) {
            if (window.Swal && window.Swal.fire) {
              await window.Swal.fire('Network Error', 'Unable to delete files. Please check your connection and try again.', 'error')
            } else if (window.swal) {
              await window.swal('Network Error', 'Unable to delete files. Please check your connection and try again.', 'error')
            } else {
              alert('Unable to delete files. Please check your connection and try again.')
            }
          }
        })
      }

      if (cancelDeleteButton) {
        cancelDeleteButton.addEventListener('click', () => {
          if (isDeleteMode) {
            isDeleteMode = false
            window.__galleryIsDeleteMode = false
            updateCheckboxVisibility(false)
            deleteInfo.style.display = 'none'
            cancelDeleteButton.style.display = 'none'
            cancelDeleteButton.innerText = 'Cancel Delete'
            deleteButton.innerText = 'Delete'
            deleteButton.classList.remove('btn-danger')
            deleteButton.classList.add('btn-secondary')
            if (pickSendButton) pickSendButton.style.display = 'inline-block'
          }
        })
      }

      if (sendButton) {
        sendButton.addEventListener('click', async () => {
          const files = getSelectedFileNames() // Changed from getSelectedFilePaths to getSelectedFileNames
          if (files.length === 0) { 
            alertModalRef.current?.show({ 
              title: 'No Files Selected', 
              message: 'Please select at least one file to send.', 
              type: 'warning' 
            })
            return 
          }
          const recipients = await userPickerModalRef.current?.show()
          if (!recipients || recipients.length === 0) return
          try {
            const res = await fetch('/admin/sendFilesToUsers', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ users: recipients, files }),
            })
            const j = await res.json().catch(() => null)
            if (res.ok) {
              showToast((j && j.message) || 'Files sent successfully', 'success')
              // reset UI
              updateCheckboxVisibility(false)
              isPickSendMode = false
              selectFileMessage.style.display = 'none'
              if (sendButton) sendButton.style.display = 'none'
              if (pickSendButton) { pickSendButton.style.display = 'inline-block'; pickSendButton.innerText = 'Pick & Send'; pickSendButton.classList.remove('btn-danger'); pickSendButton.classList.add('btn-primary') }
              if (deleteButton) deleteButton.style.display = 'inline-block'
              // Reload page after sending files to keep content up to date
              setTimeout(() => window.location.reload(), 500)
            } else {
              showToast((j && j.message) || 'Failed to send files', 'error')
            }
          } catch (err) {
            alertModalRef.current?.show({ 
              title: 'Network Error', 
              message: 'Unable to send files. Please check your connection and try again.', 
              type: 'error' 
            })
          }
        })
      }

      // File preview via API
      folderTree && folderTree.addEventListener('click', async (e) => {
        const target = e.target.closest && e.target.closest('.file-name')
        if (!target) return
        const fileName = target.getAttribute('data-file')
        try {
          const res = await fetch(`/admin/file-content?fileName=${encodeURIComponent(fileName)}`, { credentials: 'include' })
          if (!res.ok) { 
            alertModalRef.current?.show({ 
              title: 'Error', 
              message: 'Unable to fetch file. The file may not exist or you may not have permission.', 
              type: 'error' 
            })
            return 
          }
          const blob = await res.blob()
          const viewer = document.getElementById('file-viewer')
          if (!viewer) return
          const type = blob.type || ''
          const url = URL.createObjectURL(blob)
          if (type.startsWith('image/')) {
            viewer.innerHTML = `<img src="${url}" style="max-width:100%; height:auto" />`
          } else if (type === 'application/pdf') {
            viewer.innerHTML = `<object data="${url}" type="application/pdf" width="100%" height="100%"></object>`
          } else {
            // attempt text
            const text = await blob.text()
            viewer.innerHTML = `<pre style="white-space:pre-wrap;">${escapeHtml(text)}</pre>`
          }
        } catch (err) {
          alertModalRef.current?.show({ 
            title: 'Preview Error', 
            message: 'Error loading file preview.', 
            type: 'error' 
          })
        }
      })

      // helper escape
      function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]) }

      // Toast notification function (matches EJS pattern)
      function showToast(message, type) {
        // Check for jQuery notify plugin first
        if (window.$ && window.$.notify) {
          window.$.notify({ message }, { type: type || 'info', delay: 3000 })
          return
        }
        // Fallback: create custom notification modal (like EJS)
        let notif = document.getElementById('customNotificationModal')
        const bgColor = type === 'error' ? '#dc3545' : 'white'
        const textColor = type === 'error' ? 'white' : '#333'
        if (!notif) {
          notif = document.createElement('div')
          notif.id = 'customNotificationModal'
          notif.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.4);display:flex;justify-content:center;align-items:center;z-index:10000'
          notif.innerHTML = `<div style="background:${bgColor};padding:30px 40px;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.18);font-size:1.2rem;min-width:250px;text-align:center">
            <p id="notificationMessage" style="margin:0 0 20px 0;color:${textColor}">${message}</p>
            <button id="closeNotificationModal" class="btn ${type === 'error' ? 'btn-light' : 'btn-primary'}" style="color:${type === 'error' ? '#dc3545' : 'inherit'}">OK</button>
          </div>`
          document.body.appendChild(notif)
          document.getElementById('closeNotificationModal').onclick = () => { notif.remove() }
        } else {
          document.getElementById('notificationMessage').textContent = message
          notif.style.display = 'flex'
          const div = notif.querySelector('div')
          if (div) {
            div.style.background = bgColor
            div.querySelector('p').style.color = textColor
            const btn = div.querySelector('button')
            if (btn) {
              btn.className = type === 'error' ? 'btn btn-light' : 'btn btn-primary'
              btn.style.color = type === 'error' ? '#dc3545' : 'inherit'
            }
          }
        }
        // Auto-close after 3 seconds for success messages
        if (type === 'success') {
          setTimeout(() => { if (notif) notif.remove() }, 3000)
        }
      }
    }

    // If folder-tree ends up empty (only reveal link present), show a friendly message
    if (folderTree) {
      const hasReveal = !!folderTree.querySelector('#reveal-all-folders')
      const onlyReveal = hasReveal && folderTree.children.length === 1
      if (onlyReveal) {
        const info = document.createElement('div')
        info.className = 'text-muted'
        info.style.marginTop = '8px'
        info.innerText = 'No files or folders available.'
        folderTree.appendChild(info)
      }
    }

    // wire UI after a short timeout to ensure DOM nodes created
    setTimeout(() => { try { wireUi() } catch (e) { console.error('wireUi error', e) } }, 50)

    // Add username search button logic
    setTimeout(() => {
      const searchUsernameBtn = document.getElementById('search-username-btn')
      if (searchUsernameBtn && userPickerModalRef.current?.show) {
        searchUsernameBtn.onclick = async () => {
          const selectedUsernames = await userPickerModalRef.current.show()
          if (!selectedUsernames || !selectedUsernames.length) return

          // Recursively search for the folder button with data-folder ending in /username or =username
          function findFolderBtn(username) {
            // Try exact match first
            let btn = document.querySelector(`.folder-button[data-folder='${username}']`)
            if (btn) return btn
            // Try nested: look for any folder whose data-folder ends with /username
            const allBtns = Array.from(document.querySelectorAll('.folder-button[data-folder]'))
            return allBtns.find(b => {
              const folder = b.getAttribute('data-folder')
              return folder === username || folder.endsWith('/' + username) || folder.split('/').includes(username)
            })
          }

          // Process each selected username
          let firstFolder = null
          selectedUsernames.forEach((username) => {
            const folderBtn = findFolderBtn(username)
            if (folderBtn) {
              // Reveal all parent folders
              let parent = folderBtn.parentElement
              while (parent) {
                if (parent.classList && parent.classList.contains('sub-items')) {
                  parent.style.display = 'block'
                }
                parent = parent.parentElement
              }
              
              // Open this folder
              const subItems = folderBtn.nextElementSibling
              if (subItems && subItems.classList.contains('sub-items')) {
                subItems.style.display = 'block'
              }
              
              // Store first folder for scrolling
              if (!firstFolder) {
                firstFolder = folderBtn
              }
            }
          })
          
          // Scroll to the first found folder
          if (firstFolder) {
            firstFolder.scrollIntoView({ behavior: 'smooth', block: 'center' })
          } else {
            const notFoundUsernames = selectedUsernames.join(', ')
            if (window.$ && window.$.notify) {
              window.$.notify({ message: `No folders found for: ${notFoundUsernames}` }, { type: 'warning', delay: 3000 })
            } else {
              alert(`No folders found for: ${notFoundUsernames}`)
            }
          }
        }
      }
    }, 200)

    // Hash-based auto-activation: check if URL has #picksend and auto-activate Pick & Send mode (like EJS)
    if (window.location.hash === '#picksend') {
      setTimeout(() => {
        const pickSendBtn = document.getElementById('pick-send-button')
        if (pickSendBtn) pickSendBtn.click()
      }, 150)
    }

    // Scoped native handlers: avoid duplicating handlers and conflicting with the reveal link's dedicated listener
    document.addEventListener('click', function (e) {
      // Fullscreen preview from the file viewer area
      const fv = document.getElementById('file-viewer')
      if ((e.target === fv || e.target.closest && e.target.closest('#file-viewer')) && fv) {
        const content = fv.innerHTML.trim()
        if (!content || content.includes('Select a file to preview')) return
        // create full-screen preview
        if (!document.getElementById('full-screen-preview')) {
          const fs = document.createElement('div')
          fs.id = 'full-screen-preview'
          fs.innerHTML = `<div id="preview-content">${content}</div><button id="close-preview">Close</button>`
          document.body.appendChild(fs)
        }
        return
      }

      // Close fullscreen preview
      if (e.target && e.target.id === 'close-preview') {
        const el = document.getElementById('full-screen-preview')
        if (el) el.remove()
        return
      }
    })

    // Panel resizer logic (native)
    const folderPanel = document.getElementById('folder-panel')
    const fileViewerPanel = document.getElementById('file-viewer-panel')
    const resizer = document.getElementById('panel-resizer')
    let isResizing = false
    let lastDownX = 0
    if (resizer && folderPanel) {
      resizer.addEventListener('mousedown', e => { isResizing = true; lastDownX = e.clientX; document.body.style.cursor = 'ew-resize'; document.body.style.userSelect = 'none' })
      document.addEventListener('mousemove', e => {
        if (!isResizing) return
        let newWidth = e.clientX - folderPanel.getBoundingClientRect().left
        if (newWidth < 120) newWidth = 120
        if (newWidth > window.innerWidth * 0.6) newWidth = window.innerWidth * 0.6
        folderPanel.style.flex = `0 0 ${newWidth}px`
        folderPanel.style.maxWidth = `${newWidth}px`
      })
      document.addEventListener('mouseup', () => { if (isResizing) { isResizing = false; document.body.style.cursor = ''; document.body.style.userSelect = '' } })
    }

    // Horizontal resizer
    const fileViewer = document.getElementById('file-viewer')
    const horizontalResizer = document.getElementById('horizontal-resizer')
    const fileViewerBelow = document.getElementById('file-viewer-below')
    let isResizingH = false
    let lastDownY = 0
    let startHeight = 0
    if (horizontalResizer && fileViewer) {
      horizontalResizer.addEventListener('mousedown', function (e) {
        isResizingH = true; lastDownY = e.clientY; startHeight = fileViewer.offsetHeight; document.body.style.cursor = 'ns-resize'; document.body.style.userSelect = 'none'; e.preventDefault()
      })
      document.addEventListener('mousemove', function (e) {
        if (!isResizingH) return
        let newHeight = startHeight + (e.clientY - lastDownY)
        if (newHeight < 120) newHeight = 120
        if (newHeight > window.innerHeight * 0.7) newHeight = window.innerHeight * 0.7
        fileViewer.style.flex = `0 0 ${newHeight}px`
        fileViewer.style.maxHeight = `${newHeight}px`
      })
      document.addEventListener('mouseup', function () { if (isResizingH) { isResizingH = false; document.body.style.cursor = ''; document.body.style.userSelect = '' } })
    }

    // Search logic
    const searchInput = document.getElementById('search-input')
    const searchButton = document.getElementById('searchButton')
    const fileSearchInfo = document.getElementById('fileSearchInfo')
    const searchResultsModal = document.getElementById('searchResultsModal')
    const modalList = document.getElementById('matchedFilesList')
    const closeFilesModalButton = document.getElementById('closeFilesModalButton')

    if (searchInput) searchInput.addEventListener('click', () => { if (fileSearchInfo) fileSearchInfo.style.display = 'inline-block' })
    if (searchButton) searchButton.addEventListener('click', () => {
      const searchDateRaw = (searchInput && searchInput.value) ? searchInput.value.trim() : ''
      const normalizedDate = normalizeDateInput(searchDateRaw)
      if (!searchDateRaw) { 
        alertModalRef.current?.show({ 
          title: 'Invalid Input', 
          message: 'Please enter a valid date in the format (d-m-yyyy)', 
          type: 'warning' 
        })
        return 
      }
      if (!normalizedDate) { 
        alertModalRef.current?.show({ 
          title: 'Invalid Format', 
          message: 'Invalid date format. Please enter date as (day-month-year) like 12-4-2024.', 
          type: 'warning' 
        })
        return 
      }
      const matchedFiles = filterFileStructure(normalizedDate)
      if (matchedFiles.length === 0) { 
        alertModalRef.current?.show({ 
          title: 'No Results', 
          message: 'No files found for the given date.', 
          type: 'info' 
        })
      } else { showModal(matchedFiles, normalizedDate); matchedFiles.forEach(revealFileInTree) }
    })

    if (closeFilesModalButton) closeFilesModalButton.addEventListener('click', () => { if (searchResultsModal) searchResultsModal.style.display = 'none' })
    if (searchResultsModal) searchResultsModal.addEventListener('mousedown', function (e) { if (e.target === searchResultsModal) searchResultsModal.style.display = 'none' })

    function normalizeDateInput(input) {
      input = (input || '').trim().replace(/[\s\/\.]+/g, '-')
      const match = input.match(/^0*(\d{1,2})-0*(\d{1,2})-(\d{4})$/)
      if (!match) return null
      const day = String(Number(match[1]))
      const month = String(Number(match[2]))
      const year = match[3]
      return `${day}-${month}-${year}`
    }

    function revealFileInTree(fileName) {
      const fileSpans = document.querySelectorAll(`.file-name[data-file='${fileName}']`)
      if (!fileSpans.length) return
      fileSpans.forEach(fileSpan => {
        let parent = fileSpan.parentElement
        while (parent) {
          if (parent.classList && parent.classList.contains('sub-items')) parent.style.display = 'block'
          parent = parent.parentElement
        }
        fileSpan.style.background = '#ffff99'
      })
    }

    function filterFileStructure(searchDate) {
      const matchedFiles = []
      const fileItems = document.querySelectorAll('.file-item')
      fileItems.forEach(fileItem => {
        const fnEl = fileItem.querySelector('.file-name')
        if (!fnEl) return
        const fileName = fnEl.getAttribute('data-file')
        fnEl.style.background = ''
        const regex = new RegExp(`${searchDate}\\.[^.]+$`)
        if (regex.test(fileName)) matchedFiles.push(fileName)
        fileItem.style.display = 'block'
      })
      return matchedFiles
    }

    function showModal(matchedFiles, normalizedDate) {
      if (!modalList) return
      modalList.innerHTML = ''
      // Update modal title with formatted date (like EJS)
      const modalTitle = document.querySelector('#filesModalContent h2')
      if (modalTitle && normalizedDate) {
        const formattedDate = formatDateForDisplay(normalizedDate)
        modalTitle.innerHTML = `<i class='fa fa-calendar text-primary'></i> <span style='font-size:1.1em;'>Files uploaded on <b>${formattedDate}</b></span>`
      }
      matchedFiles.forEach((fileName, index) => {
        const li = document.createElement('li')
        li.innerHTML = `<span class="modal-file-name" data-file="${fileName}" style="padding:8px 12px; border-radius:6px; background:#f5f7fa; margin-bottom:6px; display:inline-block; cursor:pointer; transition:background 0.2s;">${index+1}. <b>${fileName}</b></span>`
        modalList.appendChild(li)
      })
      // Apply styled modal (like EJS)
      const modalContent = document.getElementById('filesModalContent')
      if (modalContent) {
        modalContent.style.boxShadow = '0 6px 32px rgba(0,0,0,0.18)'
        modalContent.style.border = '1px solid #e3e3e3'
        modalContent.style.background = 'linear-gradient(135deg, #f8fafc 0%, #e9ecef 100%)'
        modalContent.style.color = '#333' // Ensure dark text for readability
      }
      if (searchResultsModal) searchResultsModal.style.display = 'flex'
      document.querySelectorAll('.modal-file-name').forEach(fileEl => fileEl.addEventListener('click', function () { const fileName = this.getAttribute('data-file'); loadFilePreview(fileName); if (searchResultsModal) searchResultsModal.style.display = 'none' }))
    }

    function formatDateForDisplay(normalizedDate) {
      const [d, m, y] = normalizedDate.split('-')
      const day = d.padStart(2, '0')
      const month = m.padStart(2, '0')
      return `${day}-${month}-${y}`
    }

    async function loadFilePreview(fileName) {
      const viewer = document.getElementById('file-viewer')
      if (!viewer) return
      
      try {
        const res = await fetch(`/admin/file-content?fileName=${encodeURIComponent(fileName)}`, { credentials: 'include' })
        if (!res.ok) { 
          alertModalRef.current?.show({ 
            title: 'Error', 
            message: 'Unable to fetch file. The file may not exist or you may not have permission.', 
            type: 'error' 
          })
          return 
        }
        const blob = await res.blob()
        const type = blob.type || ''
        const url = URL.createObjectURL(blob)
        
        if (type.startsWith('image/')) {
          viewer.innerHTML = `<img src="${url}" style="max-width:100%; height:auto" />`
        } else if (type === 'application/pdf') {
          viewer.innerHTML = `<object data="${url}" type="application/pdf" width="100%" height="100%"></object>`
        } else {
          // attempt text
          const text = await blob.text()
          viewer.innerHTML = `<pre style="white-space:pre-wrap;">${escapeHtml(text)}</pre>`
        }
      } catch (err) {
        alertModalRef.current?.show({ 
          title: 'Preview Error', 
          message: 'Error loading file preview: ' + (err.message || err), 
          type: 'error' 
        })
      }
    }

    })();

    // Cleanup on unmount: remove listeners added to document
    return () => {
      mounted = false
      // no-op for now
    }
  }, [])

  return (
    <AuthsContext.Provider value={userAuths}>
      <div>
        <style dangerouslySetInnerHTML={{ __html: galleryCss }} />
        <AlertModal ref={alertModalRef} />
        <UserPickerModal ref={userPickerModalRef} />
        <FileSendingHistoryModal 
          ref={fileSendingHistoryModalRef}
          onNavigateToFile={handleNavigateToFile}
          onDeleteFile={handleDeleteFile}
        />

        <div className="container mt-5 mb-5">
        <div className="mb-3">
          <em id="fileSearchInfo" style={{ color: 'rgb(5,196,5)', display: 'none' }}>Enter a search date in this format (d-m-yyy)</em>
          <div className="input-group mb-2 align-items-center">
            <div className="input-group-prepend" id="searchButton">
              <span className="input-group-text mobile-search" style={{height: '100%', display: 'flex', alignItems: 'center'}}><i className="fa fa-search" /></span>
            </div>
            <input id="search-input" className="form-control" type="text" placeholder="Search Here........" style={{height: '38px'}} />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button id="search-username-btn" className="btn btn-outline-primary btn-sm" type="button" style={{marginTop:4}}>Search by Username</button>
            <button id="history-button" className="btn btn-info btn-sm" type="button" style={{marginTop:4, visibility: 'hidden'}} onClick={() => fileSendingHistoryModalRef.current?.show()}>📋 Sending History</button>
          </div>
        </div>

        <div className="row" id="resizable-panels-row" style={{ display: 'flex', flexDirection: 'row', minWidth: 0 }}>
          <div className="bg-white box-shadow col-4 border p-3" id="folder-panel" style={{ minWidth: 120, maxWidth: '60vw', flex: '0 0 28vw', overflowX: 'auto' }}>
            <input type="hidden" id="baseUploadPath" value="C:\\e-archiveUploads" />
            <RevealFoldersButton containerId="folder-tree" />
            <div id="folder-tree"></div>
          </div>

          <div id="panel-resizer" style={{ width: 3, cursor: 'ew-resize', background: '#e0e0e003', minHeight: '100%', zIndex: 10, transition: 'background 0.2s' }} />

          <div className="col-8" id="file-viewer-panel" style={{ flex: '1 1 0', minWidth: 200, maxWidth: '100vw', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="bg-white box-shadow file-content" id="file-viewer" style={{ flex: '0 0 300px', minHeight: 120, maxHeight: '70vh', overflowY: 'auto', position: 'relative' }}>
              <em>Select a file to preview its content here.</em>
              <div id="horizontal-resizer" style={{ height: 3, width: '100%', cursor: 'ns-resize', background: '#e0e0e0', position: 'absolute', bottom: 0, left: 0, zIndex: 11, transition: 'background 0.2s' }} />
            </div>
            <div id="file-viewer-below" style={{ flex: '1 1 auto' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button id="pick-send-button" className="btn btn-primary mt-3">Pick &amp; Send</button>
                <button id="delete-button" className="btn btn-secondary mt-3">Delete</button>
                <button id="cancel-delete-button" style={{ display: 'none' }} className="btn btn-secondary mt-3">Cancel</button>
                <button id="send-button" style={{ display: 'none' }} className="btn btn-success mt-3">Send</button>
                {/* History button moved to search area above */}
                <p id="select-file-message" style={{ display: 'none', color: 'green', margin: '0', marginLeft: '8px' }}>Please select a file.</p>
                <p id="delete-info" className="delete-info" style={{ display: 'none', color: 'green', margin: '0', marginLeft: '8px' }}>Select file(s) to delete.</p>
              </div>
            </div>
          </div>

          <div id="searchResultsModal" style={{ display: 'none' }}>
            <div id="filesModalContent" style={{ width: '30%' }}>
              <h2>Matched Files</h2>
              <ul id="matchedFilesList" />
              <button className="btn btn-primary" id="closeFilesModalButton">Close</button>
            </div>
          </div>
        </div>
        </div>
      </div>
    </AuthsContext.Provider>
  )
}

