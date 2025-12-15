import React, { useEffect, useRef } from 'react'
import RevealFoldersButton from '../components/RevealFoldersButton'
import AlertModal from '../components/AlertModal'
import UserPickerModal from '../components/UserPickerModal'

const galleryCss = `
/* inline styles ported from gallery.ejs (trimmed where appropriate) */
#full-screen-preview { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display:flex; justify-content:center; align-items:center; z-index:9999; }
#preview-content { max-width:90%; max-height:90%; overflow:auto; background:white; padding:20px; border-radius:10px; }
#close-preview { position:absolute; top:10px; right:10px; background:red; color:white; border:none; padding:10px; cursor:pointer; }
.preview-image{ max-width:100%; height:auto }
.preview-text{ font-size:16px; color:black }
.folder-icon{ margin-right:5px }
.file-icon{ margin-right:5px }
.file-name{ cursor:pointer; color:var(--link-color); display:inline-block; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; vertical-align:middle }
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
/* Debug panel removed */
`

export default function Gallery() {
  const alertModalRef = useRef(null)
  const userPickerModalRef = useRef(null)
  
  useEffect(() => {
    let mounted = true
    ;(async () => {
      // Fetch server-provided file structure for the authenticated user
      let serverStructure = null
      try {
        const res = await fetch('http://localhost:4801/admin/file-structure', { credentials: 'include', headers: { Accept: 'application/json' } })
        if (res.ok) {
          const j = await res.json()
          serverStructure = j && j.fileStructure ? j.fileStructure : null
        }
      } catch (e) {
        serverStructure = null
      }

      // Helper: build DOM for folder tree from window.fileStructure if available
      if (mounted) window.fileStructure = serverStructure
      const fileStructure = serverStructure || window.fileStructure || null
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
      const match = filename.match(/@([^@_\-\.]+)[_\-\.]/)
      return match ? match[1] : null
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
          batchFiles.forEach(f => target.appendChild(createFileItem(f, parentKey)))
        } else {
          // Render batch group as a collapsible sub-folder so batches behave like folders
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
          // attach toggle for the batch folder
          batchFolderBtn.addEventListener('click', function (ev) {
            ev.preventDefault()
            batchSub.style.display = batchSub.style.display === 'none' || !batchSub.style.display ? 'block' : 'none'
          })
          // render files into the batch sub-folder (use batchKey so full path includes batch)
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

    // If fileStructure provided by server, render it, else add sample items
    if (fileStructure) {
      // if root contains single Admin, use that
      const keys = Object.keys(fileStructure)
      if (keys.length === 1 && keys[0] === 'Admin') renderStructure(fileStructure['Admin'])
      else renderStructure(fileStructure)

      // Debug UI removed per request; batch groups will be rendered as collapsible sub-folders below

    } else if (folderTree) {
      // sample files for UI-only
      const sampleFiles = ['document_12-4-2024.pdf', 'report_1-1-2025.txt', 'image_5-6-2025.jpg']
      sampleFiles.forEach(f => folderTree.appendChild(createFileItem(f, 'Single-Files')))
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
          const p = cb.getAttribute('data-fullpath')
          if (p) paths.push(p)
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
          if (anyChecked) {
            if (selectFileMessage) selectFileMessage.style.display = 'none'
            if (pickSendButton) pickSendButton.style.display = 'none'
            if (sendButton) sendButton.style.display = 'inline-block'
          } else {
            if (selectFileMessage) selectFileMessage.style.display = 'block'
            if (pickSendButton) pickSendButton.style.display = 'inline-block'
            if (sendButton) sendButton.style.display = 'none'
          }
        }
      }

      if (pickSendButton) {
        pickSendButton.addEventListener('click', () => {
          isPickSendMode = !isPickSendMode
          if (isPickSendMode) {
            updateCheckboxVisibility(true)
            selectFileMessage.style.display = 'block'
            pickSendButton.innerText = 'Cancel file sending'
            pickSendButton.classList.remove('btn-primary')
            pickSendButton.classList.add('btn-danger')
            if (deleteButton) deleteButton.style.display = 'none'
            // Auto-expand all folders when activating Pick & Send (like EJS)
            document.querySelectorAll('#folder-tree .sub-items').forEach(el => { el.style.display = 'block' })
          } else {
            updateCheckboxVisibility(false)
            selectFileMessage.style.display = 'none'
            pickSendButton.innerText = 'Pick & Send'
            pickSendButton.classList.remove('btn-danger')
            pickSendButton.classList.add('btn-primary')
            if (deleteButton) deleteButton.style.display = 'inline-block'
          }
        })
      }

      if (deleteButton) {
        deleteButton.addEventListener('click', async () => {
          if (!isDeleteMode) {
            // activate delete mode
            isDeleteMode = true
            updateCheckboxVisibility(true)
            deleteInfo.style.display = 'block'
            if (cancelDeleteButton) cancelDeleteButton.style.display = 'inline-block'
            deleteButton.innerText = 'Confirm Delete'
            deleteButton.classList.remove('btn-secondary')
            deleteButton.classList.add('btn-danger')
            if (pickSendButton) pickSendButton.style.display = 'none'
            // Auto-expand all folders when activating Delete (like EJS)
            document.querySelectorAll('#folder-tree .sub-items').forEach(el => { el.style.display = 'block' })
            return
          }

          // Confirm delete
          const filePaths = getSelectedFilePaths()
          if (filePaths.length === 0) { 
            alertModalRef.current?.show({ 
              title: 'No Files Selected', 
              message: 'Please select at least one file to delete.', 
              type: 'warning' 
            })
            return 
          }
          const confirmed = await alertModalRef.current?.confirm({
            title: 'Confirm Delete',
            message: `Delete ${filePaths.length} file(s)? This action cannot be undone.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            type: 'error'
          })
          if (!confirmed) return
          try {
            const res = await fetch('http://localhost:4801/admin/delete-file', {
              method: 'DELETE',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ files: filePaths }),
            })
            const j = await res.json().catch(() => null)
            if (res.ok) {
              showToast((j && j.message) || 'Files deleted successfully', 'success')
              // Reload folder tree simply by refreshing page for now
              setTimeout(() => window.location.reload(), 1200)
            } else {
              showToast((j && j.message) || 'Failed to delete files', 'error')
            }
          } catch (err) {
            alertModalRef.current?.show({ 
              title: 'Network Error', 
              message: 'Unable to delete files. Please check your connection and try again.', 
              type: 'error' 
            })
          }
        })
      }

      if (cancelDeleteButton) {
        cancelDeleteButton.addEventListener('click', () => {
          isDeleteMode = false
          updateCheckboxVisibility(false)
          deleteInfo.style.display = 'none'
          cancelDeleteButton.style.display = 'none'
          deleteButton.innerText = 'Delete'
          deleteButton.classList.remove('btn-danger')
          deleteButton.classList.add('btn-secondary')
          if (pickSendButton) pickSendButton.style.display = 'inline-block'
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
            const res = await fetch('http://localhost:4801/admin/sendFilesToUsers', {
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
          const res = await fetch(`http://localhost:4801/admin/file-content?fileName=${encodeURIComponent(fileName)}`, { credentials: 'include' })
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
        if (!notif) {
          notif = document.createElement('div')
          notif.id = 'customNotificationModal'
          notif.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.4);display:flex;justify-content:center;align-items:center;z-index:10000'
          notif.innerHTML = `<div style="background:white;padding:30px 40px;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.18);font-size:1.2rem;min-width:250px;text-align:center">
            <p id="notificationMessage" style="margin:0 0 20px 0;color:#333">${message}</p>
            <button id="closeNotificationModal" class="btn btn-primary">OK</button>
          </div>`
          document.body.appendChild(notif)
          document.getElementById('closeNotificationModal').onclick = () => { notif.remove() }
        } else {
          document.getElementById('notificationMessage').textContent = message
          notif.style.display = 'flex'
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
        const res = await fetch(`http://localhost:4801/admin/file-content?fileName=${encodeURIComponent(fileName)}`, { credentials: 'include' })
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
    <div>
      <style dangerouslySetInnerHTML={{ __html: galleryCss }} />
      <AlertModal ref={alertModalRef} />
      <UserPickerModal ref={userPickerModalRef} />

      <div className="container mt-5 mb-5">
        <div className="mb-3">
          <em id="fileSearchInfo" style={{ color: 'rgb(5,196,5)', display: 'none' }}>Enter a search date in this format (d-m-yyy)</em>
          <div className="input-group">
            <div className="input-group-prepend" id="searchButton">
              <span className="input-group-text mobile-search"><i className="fa fa-search" /></span>
            </div>
            <input id="search-input" className="form-control" type="text" placeholder="Search Here........" />
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
                <button id="cancel-delete-button" style={{ display: 'none' }} className="btn btn-secondary mt-3">Cancel Delete</button>
                <button id="send-button" style={{ display: 'none' }} className="btn btn-success mt-3">Send</button>
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
  )
}
