// Attachment bytes live in this tab's memory, never in saved chat or browser storage.
window.MiloAttachments = (() => {
    if (!window.AmyAuth?.isAuthenticated() || !window.AmyState?.hasMilo()) return null
    const panel = document.getElementById('milo-chat-panel')
    const picker = document.getElementById('milo-chat-files')
    const attach = document.getElementById('milo-chat-attach')
    const tray = document.getElementById('milo-upload-tray')
    const list = document.getElementById('milo-upload-list')
    const status = document.getElementById('milo-upload-status')
    const maxBytes = 2.5 * 1024 * 1024
    let files = [], pending = false, reading = false, version = 0, dragDepth = 0
    const changed = () => window.dispatchEvent(new Event('milo:attachments'))
    const message = text => { status.textContent = text; status.hidden = !text }
    function render() {
        list.replaceChildren()
        tray.hidden = !files.length
        panel.classList.toggle('has-attachments', files.length > 0)
        attach.disabled = picker.disabled = pending || reading
        for (const [index, file] of files.entries()) {
            const item = document.createElement('div')
            item.className = 'milo-upload-chip'
            if (file.type.startsWith('image/')) {
                const preview = document.createElement('img')
                preview.src = file.data; preview.alt = ''; preview.width = 36; preview.height = 36
                item.append(preview)
            } else {
                const icon = document.createElement('span')
                icon.textContent = file.type === 'text/calendar' ? '📅' : '📄'
                icon.setAttribute('aria-hidden', 'true'); item.append(icon)
            }
            const name = document.createElement('span')
            name.className = 'milo-upload-name'; name.textContent = file.name; name.title = file.name
            const remove = document.createElement('button')
            remove.type = 'button'; remove.textContent = '×'; remove.disabled = pending || reading
            remove.setAttribute('aria-label', `Gỡ ${file.name}`)
            remove.addEventListener('click', () => {
                files.splice(index, 1); message(''); render(); changed(); attach.focus({ preventScroll: true })
            })
            item.append(name, remove); list.append(item)
        }
    }
    function dataURL(file, type) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = () => reject(new Error('File chưa mở được, Amy thử lại nha ♡'))
            reader.readAsDataURL(new Blob([file], { type }))
        })
    }
    async function prepare(file) {
        const extension = file.name.split('.').at(-1)?.toLowerCase()
        const types = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf', ics: 'text/calendar' }
        const type = Object.hasOwn(types, extension) ? types[extension] : ''
        if (!type || file.name.length > 180 || /[\x00-\x1f/\\]/u.test(file.name)) throw new Error('Amy chọn ảnh PNG/JPG/WebP, PDF hoặc lịch .ics nha ♡')
        if (!file.size || file.size > maxBytes) throw new Error('Tổng file tối đa 2.5 MB nha Amy ♡')
        if (type === 'text/calendar') {
            if (file.size > 512 * 1024) throw new Error('Lịch .ics hơi lớn, Amy xuất riêng tuần hẹn nha ♡')
            const data = await file.text()
            if (!/^\s*BEGIN:VCALENDAR\s*$/im.test(data) || !/^END:VCALENDAR\s*$/im.test(data)) throw new Error('File .ics chưa đúng, Amy xuất lịch rồi gửi lại nha ♡')
            return { name: file.name, type, data, size: file.size }
        }
        const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
        const ascii = new TextDecoder().decode(bytes)
        const valid = type === 'image/png' ? [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)
            : type === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
            : type === 'image/webp' ? ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP' : ascii.startsWith('%PDF-')
        if (!valid) throw new Error('File chưa đúng định dạng, Amy chọn lại nha ♡')
        const data = await dataURL(file, type)
        if (type.startsWith('image/')) {
            const image = new Image()
            image.src = data
            try { await image.decode() } catch (_) { throw new Error('Ảnh chưa mở được, Amy gửi lại ảnh rõ nha ♡') }
        }
        return { name: file.name, type, data, size: file.size }
    }
    async function addFiles(incoming) {
        if (pending || reading) { message('Đợi Milo ngó xong nha ♡'); return }
        if (!incoming.length) return
        if (files.length + incoming.length > 3) { message('Mỗi lần giữ tối đa 3 file nha Amy ♡'); return }
        if ([...files, ...incoming].reduce((sum, file) => sum + file.size, 0) > maxBytes) { message('Tổng file tối đa 2.5 MB nha Amy ♡'); return }
        const current = ++version
        reading = true; message('Đang mở lịch Amy…'); render(); changed()
        try {
            const prepared = []
            for (const file of incoming) prepared.push(await prepare(file))
            if (current !== version) return
            files.push(...prepared); message('')
        } catch (error) { if (current === version) message(error.message) }
        finally { if (current === version) { reading = false; picker.value = ''; render(); changed() } }
    }
    attach.addEventListener('click', () => picker.click())
    picker.addEventListener('change', () => {
        const incoming = [...picker.files]
        picker.value = ''
        addFiles(incoming)
    })
    const hasFiles = event => [...(event.dataTransfer?.types || [])].includes('Files')
    panel.addEventListener('dragenter', event => {
        if (!hasFiles(event)) return
        event.preventDefault(); dragDepth++
        if (!pending && !reading) panel.classList.add('is-dragging')
    })
    panel.addEventListener('dragover', event => { if (hasFiles(event)) { event.preventDefault(); event.dataTransfer.dropEffect = pending || reading ? 'none' : 'copy' } })
    panel.addEventListener('dragleave', event => {
        if (!dragDepth) return
        if (--dragDepth <= 0) { dragDepth = 0; panel.classList.remove('is-dragging') }
    })
    panel.addEventListener('drop', event => {
        if (!hasFiles(event)) return
        event.preventDefault(); dragDepth = 0; panel.classList.remove('is-dragging')
        addFiles([...event.dataTransfer.files])
    })
    // Dropping beside an open chat should not replace the whole page with a file.
    document.addEventListener('dragover', event => { if (!panel.hidden && hasFiles(event)) event.preventDefault() })
    const clearDrag = () => { dragDepth = 0; panel.classList.remove('is-dragging') }
    document.addEventListener('drop', event => { if (!panel.hidden && hasFiles(event)) { event.preventDefault(); clearDrag() } })
    document.addEventListener('dragend', clearDrag)
    render()
    return {
        files: () => files.map(({ name, type, data }) => ({ name, type, data })),
        names: () => files.map(file => file.name),
        hasFiles: () => files.length > 0,
        isReading: () => reading,
        setBusy(value) { const wasPending = pending; pending = value; if (value || wasPending) message(''); render() },
        clear() { version++; files = []; reading = false; picker.value = ''; dragDepth = 0; panel.classList.remove('is-dragging'); message(''); render(); changed() },
    }
})()
