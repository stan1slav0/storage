import { initCatProgress } from './catProgress.js'

// --- GLOBAL VARIABLES AND STATE ---
let selectedFiles = []
let nameMode = 'auto'
let isBusy = false
let isLicensed = false

// Your personal Cloudflare CORS proxy address
const PROXY_URL = "https://small-fire-960e.pingo-mw2.workers.dev/"

// UI Elements
const imageEl = document.getElementById('image') // This is our tinify-drop-zone
const heroSection = document.querySelector('.hero-section')
const filePicker = document.getElementById('filePicker')
const uploadBtn = document.getElementById('upload')
const historyEl = document.getElementById('history')
const clearHistoryBtn = document.getElementById('clearHistory')
const historyHeader = document.getElementById('historyHeader')
const emptyState = document.getElementById('emptyState')
const folderNameInput = document.getElementById('folderNameInput')
const clearFolderInput = document.getElementById('clearFolderInput')
const categorySelect = document.getElementById('categorySelect')

// --- CUSTOM CATEGORY DROPDOWN UI ELEMENTS ---
const customDropdown = document.getElementById('customDropdown')
const dropdownTrigger = document.getElementById('dropdownTrigger')
const dropdownMenu = document.getElementById('dropdownMenu')
const dropdownItems = dropdownMenu.querySelectorAll('.dropdown-item')
const triggerIcon = customDropdown.querySelector('.dropdown-trigger-icon')
const triggerText = customDropdown.querySelector('.dropdown-trigger-text')

// --- FOLDER INPUT CLEAR BUTTON (X) ---
folderNameInput.oninput = () => {
  clearFolderInput.style.display = folderNameInput.value.length > 0 ? 'block' : 'none'
  checkFormValidity()
}

clearFolderInput.onclick = () => {
  folderNameInput.value = ''
  clearFolderInput.style.display = 'none'
  checkFormValidity()
}

// --- FORM VALIDATION ---
function checkFormValidity() {
  const hasFolder = !!folderNameInput.value.trim()
  const hasFiles = selectedFiles.length > 0

  // Кнопка Upload станет активна только при наличии папки, файлов и успешной лицензии
  uploadBtn.disabled = !hasFolder || !hasFiles || !isLicensed || isBusy
}

// --- CUSTOM CATEGORY DROPDOWN LOGIC ---
dropdownTrigger.onclick = (e) => {
  e.stopPropagation()
  customDropdown.classList.toggle('open')
}

dropdownItems.forEach(item => {
  item.onclick = (e) => {
    e.stopPropagation()
    const value = item.getAttribute('data-value')
    const icon = item.getAttribute('data-icon')
    const text = item.innerText.replace(icon, '').trim()

    triggerIcon.innerText = icon
    triggerText.innerText = text
    categorySelect.value = value
    localStorage.setItem('last_category', value)

    dropdownItems.forEach(i => i.classList.remove('active'))
    item.classList.add('active')
    customDropdown.classList.remove('open')
    checkFormValidity()
  }
})

window.addEventListener('click', () => {
  customDropdown.classList.remove('open')
})

// --- THEME TOGGLE ---
document.getElementById('themeToggle').onclick = () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light'
  const next = current === 'light' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', next)
}

// --- LICENSE API (ЖЕСТКАЯ ПРОВЕРКА ЧЕРЕЗ CLOUDFLARE KV) ---
const activateBtn = document.getElementById('activateBtn')
const licenseInput = document.getElementById('licenseInput')
const licenseError = document.getElementById('licenseError')
const licenseScreen = document.getElementById('licenseScreen')

const savedLicense = localStorage.getItem('license_key')
if (savedLicense) {
  isLicensed = true
  if (licenseScreen) {
    licenseScreen.classList.add('hidden')
    licenseScreen.style.display = 'none'
  }
} else {
  isLicensed = false
  if (licenseScreen) {
    licenseScreen.classList.remove('hidden')
    licenseScreen.style.display = 'flex'
  }
}

activateBtn.onclick = async () => {
  const key = licenseInput.value.trim()

  if (key.length < 6) {
    licenseError.style.display = 'block'
    licenseError.innerText = 'License key must be at least 6 characters.'
    return
  }

  activateBtn.disabled = true
  activateBtn.innerText = 'CHECKING...'
  licenseError.style.display = 'none'

  try {
    const response = await fetch(PROXY_URL, {
      method: 'GET',
      headers: {
        'Authorization': `License ${key}`
      }
    })

    if (response.ok) {
      isLicensed = true
      localStorage.setItem('license_key', key)

      if (licenseScreen) {
        licenseScreen.classList.add('hidden')
        licenseScreen.style.display = 'none'
      }
      checkFormValidity()
    } else {
      throw new Error('Invalid key')
    }

  } catch (err) {
    isLicensed = false
    localStorage.removeItem('license_key')
    licenseError.style.display = 'block'
    licenseError.innerText = 'Error: Invalid or inactive license key.'
  } finally {
    activateBtn.disabled = false
    activateBtn.innerText = 'ACTIVATE'
  }
}

licenseInput.oninput = () => {
  activateBtn.disabled = licenseInput.value.trim().length === 0
}

// --- DRAG & DROP / FILE PICKER ---
imageEl.onclick = () => filePicker.click()
filePicker.onchange = () => { if (filePicker.files.length) updateSelection(Array.from(filePicker.files)) }

window.addEventListener('dragover', ev => ev.preventDefault())
window.addEventListener('drop', ev => ev.preventDefault())

heroSection.addEventListener('dragenter', (e) => {
  e.preventDefault()
  if (!isBusy) imageEl.classList.add('drag-over')
})

heroSection.addEventListener('dragover', (e) => {
  e.preventDefault()
})

heroSection.addEventListener('dragleave', (e) => {
  if (!heroSection.contains(e.relatedTarget)) {
    imageEl.classList.remove('drag-over')
  }
})

heroSection.addEventListener('drop', async (e) => {
  e.preventDefault()
  imageEl.classList.remove('drag-over')

  if (isBusy) return

  const items = e.dataTransfer.items
  if (!items) return

  let filesFromEntries = []
  let detectedFolderName = ""

  async function traverseFileTree(item) {
    return new Promise((resolve) => {
      if (item.isFile) {
        item.file((file) => {
          if (file.type.startsWith('image/')) {
            filesFromEntries.push(file)
          }
          resolve()
        })
      } else if (item.isDirectory) {
        if (!detectedFolderName) {
          detectedFolderName = item.name
        }
        const dirReader = item.createReader()
        const readEntries = () => {
          dirReader.readEntries(async (entries) => {
            if (entries.length) {
              for (const entry of entries) {
                await traverseFileTree(entry)
              }
              readEntries()
            } else {
              resolve()
            }
          })
        }
        readEntries()
      } else {
        resolve()
      }
    })
  }

  const promises = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i].webkitGetAsEntry()
    if (item) {
      promises.push(traverseFileTree(item))
    }
  }

  await Promise.all(promises)

  if (detectedFolderName) {
    folderNameInput.value = detectedFolderName.trim()
    clearFolderInput.style.display = folderNameInput.value.length > 0 ? 'block' : 'none'
  }

  if (filesFromEntries.length) {
    updateSelection(filesFromEntries)
  }
})

// Нативный парсер метаданных, оптимизированный под JPEG EXIF (ImageDescription) и PNG текстовые чанки
async function extractCategoryFromMetadata(file) {
  if (!file) return null

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = function (e) {
      try {
        const buffer = e.target.result
        const view = new DataView(buffer)

        // --- 1. КЕЙС: ДЕКОДИРОВАНИЕ JPEG EXIF ---
        if (buffer.byteLength > 4 && view.getUint16(0) === 0xFFD8) {
          let offset = 2
          while (offset < buffer.byteLength) {
            if (offset + 4 > buffer.byteLength) break
            const marker = view.getUint16(offset)
            const length = view.getUint16(offset + 2)

            if (marker === 0xFFE1) {
              if (offset + 10 > buffer.byteLength) break
              if (view.getUint32(offset + 4) === 0x45786966 && view.getUint16(offset + 8) === 0x0000) {
                const exifRoot = offset + 10
                const isLittleEndian = view.getUint16(exifRoot) === 0x4949
                const ifdOffset = view.getUint32(exifRoot + 4, isLittleEndian)
                let tagAddress = exifRoot + ifdOffset

                if (tagAddress + 2 <= buffer.byteLength) {
                  const numberOfTags = view.getUint16(tagAddress, isLittleEndian)
                  tagAddress += 2

                  for (let i = 0; i < numberOfTags; i++) {
                    if (tagAddress + 12 > buffer.byteLength) break
                    const tagId = view.getUint16(tagAddress, isLittleEndian)

                    if (tagId === 0x010E) {
                      const type = view.getUint16(tagAddress + 2, isLittleEndian)
                      const count = view.getUint32(tagAddress + 4, isLittleEndian)
                      const valueOffset = view.getUint32(tagAddress + 8, isLittleEndian)

                      let dataPos = exifRoot + valueOffset
                      if (count <= 4) dataPos = tagAddress + 8

                      if (dataPos + count <= buffer.byteLength) {
                        const txtBytes = new Uint8Array(buffer, dataPos, count)
                        const txt = new TextDecoder('utf-8').decode(txtBytes).replace(/\0+$/, '').trim()
                        if (txt) {
                          resolve(txt.toLowerCase())
                          return
                        }
                      }
                    }
                    tagAddress += 12
                  }
                }
              }
            }
            offset += 2 + length
          }
        }

        // --- 2. КЕЙС: ДЕКОДИРОВАНИЕ PNG (tEXt/iTXt чанки) ---
        if (buffer.byteLength > 8 && view.getUint32(0) === 0x89504E47) {
          let pos = 8
          while (pos < buffer.byteLength) {
            if (pos + 8 > buffer.byteLength) break
            const length = view.getUint32(pos)
            const type = String.fromCharCode(
              view.getUint8(pos + 4),
              view.getUint8(pos + 5),
              view.getUint8(pos + 6),
              view.getUint8(pos + 7)
            )

            if (type === 'tEXt' || type === 'iTXt' || type === 'zTXt') {
              const dataOffset = pos + 8
              if (dataOffset + length <= buffer.byteLength) {
                const bytes = new Uint8Array(buffer, dataOffset, length)
                const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)

                const match = text.match(/(?:category|detectedCategory|description|desc)[\0\s"':=\-_]+([\w-]+)/i)
                if (match && match[1]) {
                  resolve(match[1].trim().toLowerCase())
                  return
                }
              }
            }
            pos += 12 + length
          }
        }

        // --- 3. ЗАПАСНОЙ ВСЕЯДНЫЙ ФОЛБЕК-ПОИСК ПО ВСЕМУ ТЕКСТУ ФАЙЛА ---
        const bytes = new Uint8Array(buffer)
        let binaryString = ''
        const len = bytes.byteLength
        for (let i = 0; i < Math.min(len, 102400); i++) {
          if ((bytes[i] >= 32 && bytes[i] <= 126) || bytes[i] === 0 || bytes[i] === 10) {
            binaryString += String.fromCharCode(bytes[i])
          } else {
            binaryString += ' '
          }
        }

        const match = binaryString.match(/(?:category|detectedCategory|description|desc)[\0\s"':=\-_]+([a-zA-Z0-9\-_]+)/i)
        if (match && match[1]) {
          const result = match[1].trim().toLowerCase()
          if (result.length > 2 && result.length < 30) {
            resolve(result)
            return
          }
        }
      } catch (err) {
        console.error('[Metadata] Ошибка разбора структуры EXIF/PNG:', err)
      }
      resolve(null)
    }
    reader.readAsArrayBuffer(file.slice(0, 524288))
  })
}

async function updateSelection(files) {
  const newFiles = Array.from(files)

  // --- АВТОМАТИЧЕСКИЙ МЕТАНАЛИЗ КАТЕГОРИИ ДЛЯ ДРОПА ФАЙЛОВ / ПАПОК ---
  if (newFiles.length > 0) {
    const firstImageFile = newFiles.find(f => f.type && f.type.startsWith('image/')) || newFiles[0]

    if (firstImageFile) {
      console.log(`[Metadata] Начинаем сканирование файла: ${firstImageFile.name}`)

      const detectedCategory = await extractCategoryFromMetadata(firstImageFile)

      if (detectedCategory) {
        console.log(`[Metadata] Успех! Из файла извлечена категория/описание: "${detectedCategory}"`)

        const targetItem = Array.from(dropdownItems).find(i => {
          const val = i.getAttribute('data-value')
          return val && val.toLowerCase() === detectedCategory
        })

        if (targetItem) {
          const icon = targetItem.getAttribute('data-icon')
          const text = targetItem.innerText.replace(icon, '').trim()

          triggerIcon.innerText = icon
          triggerText.innerText = text
          categorySelect.value = targetItem.getAttribute('data-value')
          localStorage.setItem('last_category', categorySelect.value)

          dropdownItems.forEach(i => i.classList.remove('active'))
          targetItem.classList.add('active')
          customDropdown.classList.remove('open')

          console.log(`[Metadata] Интерфейс успешно переключен на: ${categorySelect.value}`)
        } else {
          console.warn(`[Metadata] Значение "${detectedCategory}" найдено в файле, но отсутствует в списке data-value вашего UI.`)
        }
      } else {
        console.log(`[Metadata] В структуре файла ${firstImageFile.name} теги категории или описания не обнаружены.`)
      }
    }
  }

  newFiles.forEach(newFile => {
    const isDuplicate = selectedFiles.some(f => f.name === newFile.name && f.size === newFile.size)
    if (!isDuplicate) selectedFiles.push(newFile)
  })
  renderGrid()
  checkFormValidity()
}

function renderGrid() {
  if (!selectedFiles.length) {
    clearSelection()
    return
  }
  const clearAllBtn = document.getElementById('clearAllImagesBtn')
  if (clearAllBtn) clearAllBtn.classList.add('visible')

  let wrapper = document.getElementById('gridWrapper')
  if (!wrapper) {
    const dropContent = imageEl.querySelector('.drop-zone-content')
    if (dropContent) dropContent.style.display = 'none'
    wrapper = document.createElement('div')
    wrapper.className = 'grid-scroll-wrapper'
    wrapper.id = 'gridWrapper'
    imageEl.appendChild(wrapper)
  } else {
    wrapper.innerHTML = ''
  }

  selectedFiles.forEach((file, index) => {
    const objectUrl = file.previewUrl || URL.createObjectURL(file)
    file.previewUrl = objectUrl
    const tile = document.createElement('div')
    tile.className = 'grid-tile-item'
    tile.innerHTML = `
            <img src="${objectUrl}">
            <div class="tile-info-overlay"><span class="tile-name-text">${file.name}</span></div>
            <button class="tile-remove-btn" data-idx="${index}">&times;</button>
        `
    tile.querySelector('.tile-remove-btn').onclick = (e) => {
      e.stopPropagation()
      selectedFiles.splice(index, 1)
      renderGrid()
      checkFormValidity()
    }
    wrapper.appendChild(tile)
  })
}

function clearSelection() {
  selectedFiles = []

  const folderNameInput = document.getElementById('folderNameInput')
  const clearFolderInput = document.getElementById('clearFolderInput')

  if (folderNameInput) {
    folderNameInput.value = ''
  }
  if (clearFolderInput) {
    clearFolderInput.style.display = 'none'
  }

  const clearAllBtn = document.getElementById('clearAllImagesBtn')
  if (clearAllBtn) clearAllBtn.classList.remove('visible')
  const wrapper = document.getElementById('gridWrapper')
  if (wrapper) wrapper.remove()
  const dropContent = imageEl.querySelector('.drop-zone-content')
  if (dropContent) dropContent.style.display = 'flex'
  checkFormValidity()
}

document.getElementById('clearAllImagesBtn').onclick = (e) => {
  e.stopPropagation()
  clearSelection()
}

// --- UPLOAD HISTORY ---
function updateHistoryVisibility() {
  const hasItems = historyEl.children.length > 0
  historyHeader.style.display = hasItems ? 'flex' : 'none'
  emptyState.style.display = hasItems ? 'none' : 'flex'
}
function getHistory() { try { return JSON.parse(localStorage.getItem('upload_history')) || [] } catch (e) { return [] } }

function saveToHistory(name, serverPath, isExists, objectUrl, browserUrl = '') {
  let history = getHistory()
  history = history.filter(item => !(item.name === name && item.serverPath === serverPath))
  history.unshift({ name, serverPath, exists: isExists, date: Date.now(), objectUrl: objectUrl, browserUrl: browserUrl })
  localStorage.setItem('upload_history', JSON.stringify(history.slice(0, 50)))
  updateHistoryVisibility()
}

function loadHistory() {
  const history = getHistory(); historyEl.innerHTML = ''
  for (let i = history.length - 1; i >= 0; i--) {
    createCard(history[i].name, history[i].objectUrl || history[i].serverPath || '', history[i])
  }
  updateHistoryVisibility()
}
clearHistoryBtn.onclick = () => { if (confirm('Clear entire history?')) { historyEl.innerHTML = ''; localStorage.setItem('upload_history', '[]'); updateHistoryVisibility() } }

function createCard(name, imgUrl, savedData = null) {
  const div = document.createElement('div')
  div.className = 'item'
  div.setAttribute('data-filename', name)

  if (savedData) {
    if (savedData.exists) div.classList.add('exists')
    else if (savedData.serverPath) div.classList.add('done')
  }
  let statusText = 'Uploading...'
  if (savedData) {
    if (savedData.exists) statusText = 'Already exists'
    else if (savedData.serverPath) statusText = `<a href="${savedData.serverPath}" target="_blank" class="history-link">${savedData.serverPath}</a>`
  }

  div.innerHTML = `
    <img src="${imgUrl || ''}">
    <div class="item-body">
      <div class="item-name">${name}</div>
      <div class="item-status">${statusText}</div>
    </div>
    <a class="server-btn" title="Open folder on server" target="_blank" style="text-decoration: none;">🖥️</a>
    <div class="copy-btn" title="Copy link">📋</div>
    <div class="progress-container">
        <canvas class="progress-canvas" width="600" height="36"></canvas>
    </div>`

  const statusEl = div.querySelector('.item-status')
  const canvas = div.querySelector('.progress-canvas')
  const serverBtn = div.querySelector('.server-btn')

  const catController = initCatProgress(canvas)

  if (savedData) {
    catController.hideImmediately()
  } else {
    catController.updateProgress(0)
    catController.start()
  }

  const barMock = {
    style: {
      set width(val) {
        const match = typeof val === 'string' ? val.match(/(\d+(\.\d+)?)/) : null
        if (match) {
          const percent = parseFloat(match[1])
          catController.updateProgress(percent)
        }
      }
    }
  }

  const setCopy = (url) => {
    div.querySelector('.copy-btn').onclick = (e) => {
      e.stopPropagation(); navigator.clipboard.writeText(url)
      const oldInner = statusEl.innerHTML; statusEl.innerText = 'Copied!'
      setTimeout(() => { statusEl.innerHTML = oldInner }, 1000)
    }
  }

  const setServerLink = (url) => {
    if (url) {
      serverBtn.setAttribute('href', url)
      serverBtn.style.opacity = "1"
      serverBtn.style.pointerEvents = "auto"
      serverBtn.onclick = (e) => { e.stopPropagation() }
    } else {
      serverBtn.removeAttribute('href')
      serverBtn.style.opacity = "0.3"
      serverBtn.style.pointerEvents = "none"
    }
  }

  if (savedData && savedData.serverPath) setCopy(savedData.serverPath)
  if (savedData && savedData.browserUrl) {
    setServerLink(savedData.browserUrl)
  } else {
    setServerLink('')
  }

  historyEl.prepend(div); updateHistoryVisibility()

  return { div, statusEl, bar: barMock, setCopy, setServerLink }
}

// --- NETWORK UPLOAD PROCESS ---
async function processSingleFile(file, serverCategory, folderName, onProgress, onSuccess, onError) {
  let currentProgress = 0
  const progressInterval = setInterval(() => {
    if (currentProgress < 70) currentProgress += Math.random() * 8 + 4
    else if (currentProgress < 92) currentProgress += Math.random() * 2 + 0.5
    onProgress(Math.min(currentProgress, 92))
  }, 80)

  const letters = folderName.replace(/[^a-zA-Z]/g, '').toLowerCase()
  const digits = folderName.replace(/[^0-9]/g, '')
  if (!letters || !digits) {
    clearInterval(progressInterval)
    onError('Wrong folder format (Requires letters and numbers)')
    return
  }

  let apiPath = ''
  let serverFilePath = ''
  let browserUrl = ''
  let parentParam = 'global'
  const currentCat = serverCategory.toLowerCase()

  if (currentCat === 'alpha') {
    parentParam = 'alpha'
    const formattedName = `${letters}/lift-${digits}`
    apiPath = `promo/${formattedName}/${file.name}`
    serverFilePath = `https://alphaonest.com/files/promo/${formattedName}/${file.name}`
    browserUrl = `https://storage.epcnetwork.dev/browser/alphaone/promo/${letters}/lift-${digits}/`
  } else if (currentCat === 'organic') {
    parentParam = 'organic'
    const formattedName = `${letters}/creative-${digits}`
    apiPath = `creatives/${formattedName}/${file.name}`
    serverFilePath = `https://ogfinstorage.com/files/creatives/${formattedName}/${file.name}`
    browserUrl = `https://storage.epcnetwork.dev/browser/organic/creatives/${letters}/creative-${digits}/`
  } else if (currentCat === 'redeagle') {
    parentParam = 'redeagle'
    const formattedName = `${letters}/lift-${digits}`
    apiPath = `promo/${formattedName}/${file.name}`
    serverFilePath = `https://reagstr.com/files/promo/${formattedName}/${file.name}`
    browserUrl = `https://s3-browser.epcnetwork.dev/bucket/redeagle/promo/${letters}/lift-${digits}/`
  } else {
    parentParam = 'global'
    const formattedName = `${letters}/lift-${digits}`
    apiPath = `Promo/${serverCategory}/${formattedName}/${file.name}`
    const mainDomain = "https://storage.5th-elementagency.com"
    serverFilePath = `${mainDomain}/files/${apiPath}`
    browserUrl = `https://storage.epcnetwork.dev/browser/files/Promo/${encodeURIComponent(serverCategory)}/${letters}/lift-${digits}/`
  }

  const originalApiUrl = `https://public.epcnetwork.dev/upload?parent=${parentParam}&path=${apiPath}`
  const apiUrl = `${PROXY_URL}?url=${encodeURIComponent(originalApiUrl)}`

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'Authorization': `License ${localStorage.getItem('license_key') || 'none'}`
      },
      body: file
    })

    const responseText = await response.text()
    clearInterval(progressInterval)
    onProgress(100)

    if (!response.ok) {
      if (response.status === 409 || responseText.includes('already exists')) {
        onSuccess({ serverFilePath: serverFilePath, browserUrl: browserUrl, isDuplicate: true })
        return
      } else if (response.status === 521) {
        throw new Error("Server Down (Error 521). S3 API is unavailable.")
      } else if (response.status === 403) {
        throw new Error("License Denied: Access blocked by Cloudflare verification.")
      } else {
        throw new Error(`Server error ${response.status}`)
      }
    }

    onSuccess({ serverFilePath: serverFilePath, browserUrl: browserUrl, isDuplicate: false })

  } catch (e) {
    clearInterval(progressInterval); onProgress(100); onError(e.message)
  }
}

// --- UPLOAD BUTTON CLICK HANDLER ---
uploadBtn.onclick = async () => {
  if (isBusy) return
  isBusy = true; checkFormValidity()
  uploadBtn.innerText = 'UPLOADING...'

  const files = [...selectedFiles]
  const currentCategory = categorySelect.value
  const folderName = folderNameInput.value.trim()

  const filesWithUrls = files.map(f => ({ file: f, url: f.previewUrl || '' }))
  clearSelection()

  for (const item of filesWithUrls) {
    const currentFile = item.file
    const objectUrl = item.url
    const card = createCard(currentFile.name, objectUrl)

    let catFinished = false

    await processSingleFile(currentFile, currentCategory, folderName,
      (p) => { card.bar.style.width = `${p}%` },
      ({ serverFilePath, browserUrl, isDuplicate }) => {
        card.bar.style.width = '100%'

        const cardImg = document.querySelector(`[data-filename="${currentFile.name}"] img`)
        if (cardImg && serverFilePath) {
          cardImg.src = serverFilePath
        }

        card.setServerLink(browserUrl)

        if (isDuplicate) {
          card.div.classList.add('exists')
          card.statusEl.innerText = 'Already exists'
          card.statusEl.style.color = '#fb923c'
          saveToHistory(currentFile.name, serverFilePath, true, serverFilePath, browserUrl)
        } else {
          card.div.classList.add('done')
          card.statusEl.innerHTML = `<a href="${serverFilePath}" target="_blank" class="history-link">${serverFilePath}</a>`
          card.statusEl.style.color = 'var(--accent)'
          card.setCopy(serverFilePath); navigator.clipboard.writeText(serverFilePath).catch(() => { })
          saveToHistory(currentFile.name, serverFilePath, false, serverFilePath, browserUrl)
        }
      },
      (err) => {
        card.bar.style.width = '100%'; card.div.classList.add('error')
        card.statusEl.innerText = err; card.statusEl.style.color = '#ef4444'
        card.setServerLink('')
      }
    )

    const canvasElement = card.div.querySelector('.progress-canvas')
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!canvasElement || canvasElement.style.display === 'none') {
          clearInterval(checkInterval)
          resolve()
        }
      }, 50)
    })
  }
  isBusy = false; uploadBtn.innerText = 'UPLOAD FILES'; checkFormValidity()
}

// --- INITIALIZATION ON LOAD ---
window.addEventListener('DOMContentLoaded', () => {
  folderNameInput.value = ''

  localStorage.removeItem('storage_token')
  localStorage.removeItem('storage_token_encrypted')

  // --- ЗАПРОС РАЗРЕШЕНИЯ НА СИСТЕМНЫЕ ПУШ-УВЕДОМЛЕНИЯ ---
  if ('Notification' in window) {
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission()
    }
  }

  const savedCategory = localStorage.getItem('last_category')
  if (savedCategory) {
    categorySelect.value = savedCategory
    const targetItem = Array.from(dropdownItems).find(i => i.getAttribute('data-value') === savedCategory)
    if (targetItem) {
      const icon = targetItem.getAttribute('data-icon'); triggerIcon.innerText = icon
      triggerText.innerText = targetItem.innerText.replace(icon, '').trim()
      dropdownItems.forEach(i => i.classList.remove('active')); targetItem.classList.add('active')
    }
  }
  loadHistory(); checkFormValidity()

  // --- ПОДКЛЮЧЕНИЕ К СЕРВЕРУ ЧЕРЕЗ WEBSOCKET ---
  function initAutomationWebSocket() {
    const ws = new WebSocket('ws://localhost:3001')

    ws.onopen = () => {
      console.log('[WebSocket] Успешно подключено к фоновому мосту S3.')
    }

    // МГНОВЕННЫЙ ПЕРЕХВАТ ПРИ СИГНАЛЕ ОТ СЕРВЕРА С ДОБАВЛЕНИЕМ ПУШЕЙ
    ws.onmessage = (event) => {
      if (isBusy) return

      try {
        const data = JSON.parse(event.data)

        if (data && data.folderName && data.files && data.files.length) {
          console.log(`[WebSocket] Получена новая папка: ${data.folderName}`)

          // --- ОТПРАВКА БРАУЗЕРНОГО PUSH-УВЕДОМЛЕНИЯ ---
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🖼️ New images received', {
              body: `Folder: ${data.folderName}\nImage count: ${data.files.length}`,
              icon: './src/images/favicons/favicon.svg'
            })
          }

          folderNameInput.value = data.folderName.trim()
          clearFolderInput.style.display = 'block'

          if (data.detectedCategory) {
            const targetItem = Array.from(dropdownItems).find(i => i.getAttribute('data-value') === data.detectedCategory)
            if (targetItem) {
              targetItem.click()
            }
          }

          const filesToUpload = data.files.map(f => {
            const byteCharacters = atob(f.base64)
            const byteNumbers = new Array(byteCharacters.length)
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i)
            }
            const byteArray = new Uint8Array(byteNumbers)
            return new File([byteArray], f.name, { type: 'image/png' })
          })

          if (filesToUpload.length) {
            selectedFiles = []
            updateSelection(filesToUpload)
          }
        }
      } catch (err) {
        console.error('[WebSocket] Ошибка обработки данных:', err)
      }
    }

    ws.onclose = () => {
      console.log('[WebSocket] Соединение потеряно. Попытка переподключения через 5 секунд...')
      setTimeout(initAutomationWebSocket, 5000)
    }

    ws.onerror = (err) => {
      console.error('[WebSocket] Ошибка:', err.message)
    }
  }

  initAutomationWebSocket()

  // --- АНТИ-ИНСПЕКТ С СЕКРЕТНЫМ РЕЖИМОМ РАЗРАБОТЧИКА ---
  // const urlParams = new URLSearchParams(window.location.search)
  // const isDeveloperMode = urlParams.get('dev') === 'true'

  // if (isDeveloperMode) {
  //   console.log("Welcome back, Master! Inspect Element protection is DISABLED.")
  // } else {
  //   setInterval(function () { debugger }, 100)
  //   window.addEventListener('contextmenu', e => e.preventDefault())
  //   document.onkeydown = function (e) {
  //     if (e.keyCode == 123) return false
  //     if (e.ctrlKey && e.shiftKey && e.keyCode == 73) return false
  //   }
  // }

})