(() => {
    if (!window.AmyAuth?.isAuthenticated() || !window.AmyState?.hasMilo()) return
    const panel = document.getElementById('milo-chat-panel')
    const launcher = document.getElementById('milo-chat-launcher')
    const list = document.getElementById('milo-chat-messages')
    const input = document.getElementById('milo-chat-input')
    const send = document.getElementById('milo-chat-send')
    const typing = document.getElementById('milo-chat-typing')
    const suggestions = document.getElementById('milo-chat-suggestions')
    const uploads = window.MiloAttachments
    const storageKey = 'amy-milo-chat.v1'
    let messages = [], session, pending = false, controller, requestVersion = 0, returnFocus
    const greeting = { role: 'assistant', kind: 'welcome', parts: [{ text: 'Gâu gâu~ Milo nhỏ có mặt nè Kiki 🐾\nAnh là AI date buddy của Amy. Cần một bữa ăn ngon, ly trà jasmine, phim hay một góc đi chơi xinh thì gọi anh nha ♡\n\nAmy thích một buổi cozy ở Blacksburg hay đi chơi Christiansburg hơn?', citations: [] }], sources: [] }

    function node(tag, className, text) {
        const element = document.createElement(tag)
        if (className) element.className = className
        if (text !== undefined) element.textContent = text
        return element
    }
    function safeURL(value) {
        try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null } catch (_) { return null }
    }
    function link(url, text, className = '') {
        const element = node('a', className, text)
        element.href = url
        element.target = '_blank'
        element.rel = 'noopener noreferrer'
        return element
    }
    // Render a small Markdown subset with DOM text nodes, never model-provided HTML.
    function richText(container, text) {
        text = text.replace(/[^]*/gu, '')
        const pattern = /\[([^\]\n]{1,180})\]\((https?:\/\/[^\s)]+)\)|\*\*([^*\n]+)\*\*/gu
        let offset = 0
        for (const match of text.matchAll(pattern)) {
            container.append(document.createTextNode(text.slice(offset, match.index)))
            const url = match[2] && safeURL(match[2])
            container.append(url ? link(url, match[1]) : match[3] ? node('strong', '', match[3]) : document.createTextNode(match[0]))
            offset = match.index + match[0].length
        }
        container.append(document.createTextNode(text.slice(offset)))
    }
    function annotatedText(container, part) {
        const text = String(part.text || '')
        const points = Array.from(text)
        const ranges = (Array.isArray(part.citations) ? part.citations : []).filter(c => safeURL(c.url) && Number.isInteger(c.start) && Number.isInteger(c.end) && c.start >= 0 && c.end > c.start && c.end <= points.length).sort((a, b) => a.start - b.start || a.end - b.end)
        let offset = 0, number = 0
        for (let index = 0; index < ranges.length; index++) {
            const citation = ranges[index]
            if (citation.start < offset) continue
            richText(container, points.slice(offset, citation.start).join(''))
            const same = [citation]
            while (ranges[index + 1]?.start === citation.start && ranges[index + 1]?.end === citation.end) same.push(ranges[++index])
            const quoted = points.slice(citation.start, citation.end).join('')
            const citationOnly = /^\(?\[[^\]]+\]\(https?:\/\/[^\s]+\)\)?$/u.test(quoted)
            if (!quoted.includes('') && !citationOnly) richText(container, quoted)
            for (const source of same) {
                const anchor = link(safeURL(source.url), `[${++number}]`, 'milo-citation')
                anchor.title = source.title || new URL(source.url).hostname
                anchor.setAttribute('aria-label', `Nguồn ${number}: ${anchor.title}`)
                container.append(anchor)
            }
            offset = citation.end
        }
        richText(container, points.slice(offset).join(''))
    }
    function textOf(message) { return message.role === 'user' ? message.text : message.parts.map(part => part.text).join('\n\n') }
    function persist() {
        messages = messages.slice(-30)
        try { sessionStorage.setItem(storageKey, JSON.stringify(messages)) } catch (_) {}
    }
    function scrollMessages() { list.scrollTop = list.scrollHeight }
    function renderMessage(message) {
        const row = node('article', `milo-message ${message.role}`)
        row.append(node('span', 'milo-message-name', message.role === 'user' ? 'Amy ♡' : 'Milo nhỏ · AI 🐾'))
        const body = node('div', 'milo-message-body')
        if (message.role === 'user') body.textContent = message.text
        else for (const part of message.parts) {
            const paragraph = node('div')
            annotatedText(paragraph, part)
            body.append(paragraph)
        }
        row.append(body)
        if (Array.isArray(message.fileNames) && message.fileNames.length) {
            const files = node('div', 'milo-message-files')
            for (const name of message.fileNames.slice(0, 3)) files.append(node('span', '', `📎 ${String(name).slice(0, 180)}`))
            row.append(files)
        }
        if (message.contextLabel) row.append(node('span', 'milo-message-meta', message.contextLabel))
        if (message.searched) row.append(node('span', 'milo-message-meta', 'Milo vừa ngó nguồn trên web ↗'))
        const sources = (message.sources || []).filter(source => safeURL(source.url))
        if (sources.length) {
            const links = node('div', 'milo-sources')
            links.setAttribute('aria-label', 'Nguồn Milo tham khảo')
            for (const source of sources.slice(0, 8)) links.append(link(safeURL(source.url), `${source.title || new URL(source.url).hostname} ↗`))
            row.append(links)
        }
        list.append(row)
        scrollMessages()
    }
    function appendMessage(message) { messages.push(message); renderMessage(message); persist() }
    function snapshot() {
        const draft = window.AmyState.getDraft() || {}
        return { date: draft.date || '', time: draft.time || '', restaurant: draft.restaurant || '', activities: [...(draft.activities || [])], step: draft.step || 0 }
    }
    function contextLabel(context) {
        const time = DATE_OPTIONS.timeWindows.find(item => item.id === context.time)
        const restaurant = DATE_OPTIONS.restaurants.find(item => item.id === context.restaurant)
        return [context.date ? context.date.split('-').reverse().slice(0, 2).join('/') : '', time?.range, restaurant?.name].filter(Boolean).join(' · ') || 'Cùng Amy chọn một ngày xinh ♡'
    }
    function updateContext() {
        const context = snapshot()
        document.getElementById('milo-chat-context').textContent = contextLabel(context)
        suggestions.replaceChildren()
        const prompts = context.step < 2
            ? [['Một date cho Kiki ♡', 'Milo gợi ý một buổi date hợp với sở thích của Kiki nha?'], ['Trời hôm ấy sao nè? ☁️', 'Thời tiết ngày Amy chọn ra sao, tối có lạnh hong?'], ['Gâu gâu 🐾', null]]
            : [['Ăn gì hợp gu Amy? 🍜', 'So sánh các quán hợp gu của Amy trong danh sách nha?'], ['Plan theo lựa chọn ♡', 'Gợi ý lịch hẹn theo các lựa chọn hiện tại của Amy, đúng khung giờ nha.'], ['Gâu gâu 🐾', null]]
        for (const [label, prompt] of prompts) {
            const button = node('button', '', label)
            button.type = 'button'
            button.disabled = pending
            button.addEventListener('click', () => {
                if (prompt) sendMessage(prompt)
                else appendMessage({ role: 'assistant', kind: 'local', parts: [{ text: 'Gâu gâu~ 🐾 Milo nhỏ chạy tới liền nè Kiki ♡\nMột ly jasmine green tea, một chiếc date xinh… Amy muốn anh giúp chọn gì trước?', citations: [] }], sources: [] })
            })
            suggestions.append(button)
        }
    }
    function busy(value) {
        pending = value
        typing.hidden = !value
        send.disabled = value || uploads.isReading() || (!input.value.trim() && !uploads.hasFiles())
        uploads.setBusy(value)
        input.setAttribute('aria-busy', String(value))
        updateContext()
        scrollMessages()
    }
    async function getSession(signal, refresh = false) {
        if (session && !refresh) return session
        const response = await fetch('/api/milo/session', { signal, cache: 'no-store', credentials: 'same-origin' })
        if (!response.ok) throw new Error('Milo nhỏ chưa kết nối được. Amy thử gọi lại xíu nha ♡')
        const result = await response.json()
        if (!result.ready || typeof result.csrf !== 'string') throw new Error('Milo nhỏ chưa kết nối được. Amy vẫn chọn date bình thường rồi gọi anh lại nha ♡')
        session = result
        return result
    }
    function apiMessages() {
        const history = messages.filter(message => !message.kind).slice(-16).map(message => ({ role: message.role, content: textOf(message) }))
        while (history.length > 1 && history.reduce((sum, message) => sum + message.content.length, 0) > 22000) history.shift()
        return history
    }
    function showError(text, context) {
        list.querySelector('.milo-error')?.remove()
        const row = node('article', 'milo-message milo-error')
        const body = node('div', 'milo-message-body', text)
        const needsFiles = messages.filter(message => message.role === 'user').at(-1)?.fileNames?.length && !uploads.hasFiles()
        const retry = node('button', 'milo-retry', needsFiles ? 'Thêm lịch lại 📎' : 'Gọi Milo lại ♡')
        retry.type = 'button'
        retry.addEventListener('click', () => { if (!pending) { if (needsFiles && !uploads.hasFiles()) document.getElementById('milo-chat-attach').click(); else requestReply(context) } })
        body.append(retry)
        row.append(body)
        list.append(row)
        scrollMessages()
    }
    async function requestReply(context) {
        if (pending || uploads.isReading()) return
        const attachments = uploads.files()
        if (messages.filter(message => message.role === 'user').at(-1)?.fileNames?.length && !attachments.length) {
            showError('Amy đính kèm lại lịch để Milo ngó tiếp nha ♡', context)
            return
        }
        list.querySelector('.milo-error')?.remove()
        const version = ++requestVersion
        controller = new AbortController()
        const currentController = controller
        const timeout = setTimeout(() => currentController.abort('timeout'), 85000)
        busy(true)
        try {
            const signal = currentController.signal
            let token = await getSession(signal)
            const post = () => fetch('/api/milo/chat', { method: 'POST', credentials: 'same-origin', signal, headers: { 'Content-Type': 'application/json', 'X-Milo-CSRF': token.csrf }, body: JSON.stringify({ messages: apiMessages(), context, attachments }) })
            let response = await post()
            if (response.status === 403) { token = await getSession(signal, true); response = await post() }
            const data = await response.json()
            if (!response.ok) throw new Error(data.message || 'Milo nhỏ chưa nghe rõ rùi. Amy thử lại nha ♡')
            if (!Array.isArray(data.parts) || !data.parts.some(part => typeof part.text === 'string' && part.text.trim())) throw new Error('Milo chưa trả lời kịp. Amy gọi lại xíu nha ♡')
            if (version !== requestVersion) return
            appendMessage({ role: 'assistant', parts: data.parts, sources: data.sources || [], searched: data.searched === true })
        } catch (error) {
            if (version !== requestVersion) return
            const text = currentController.signal.aborted ? 'Milo đã dừng câu trả lời nè. Khi nào Amy muốn, gọi anh lại nha ♡' : error instanceof TypeError || error instanceof SyntaxError ? 'Milo đang mất kết nối một xíu 🥺 Amy vẫn chọn date được nha, rồi gọi anh lại ♡' : error.message
            showError(text, context)
        } finally {
            clearTimeout(timeout)
            if (version === requestVersion) { controller = null; busy(false) }
        }
    }
    function sendMessage(text) {
        text = text.trim().slice(0, 2000)
        if (pending || uploads.isReading() || (!text && !uploads.hasFiles())) return
        if (!text) text = 'Milo ngó giúp lịch Amy có trùng buổi hẹn đang chọn hông? ♡'
        const context = snapshot()
        appendMessage({ role: 'user', text, fileNames: uploads.names(), contextLabel: contextLabel(context) })
        input.value = ''
        input.style.height = ''
        requestReply(context)
    }
    function open(event) {
        returnFocus = event?.currentTarget || launcher
        panel.hidden = false
        launcher.hidden = true
        launcher.setAttribute('aria-expanded', 'true')
        updateContext()
        sizeForKeyboard()
        scrollMessages()
        // Avoid opening a phone keyboard just to read the welcome message.
        document.getElementById('milo-chat-close').focus({ preventScroll: true })
    }
    function close() {
        panel.hidden = true
        launcher.hidden = false
        launcher.setAttribute('aria-expanded', 'false')
        returnFocus?.focus({ preventScroll: true })
    }
    document.querySelectorAll('[data-milo-open]').forEach(button => button.addEventListener('click', open))
    document.getElementById('milo-chat-close').addEventListener('click', close)
    panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); close() } })
    document.getElementById('milo-chat-stop').addEventListener('click', () => controller?.abort())
    document.getElementById('milo-chat-form').addEventListener('submit', event => { event.preventDefault(); sendMessage(input.value) })
    const updateSend = () => { send.disabled = pending || uploads.isReading() || (!input.value.trim() && !uploads.hasFiles()) }
    window.addEventListener('milo:attachments', updateSend)
    input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 100) + 'px'; updateSend() })
    input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); sendMessage(input.value) } })
    document.getElementById('milo-chat-reset').addEventListener('click', () => {
        requestVersion++
        controller?.abort()
        controller = null
        messages = []
        uploads.clear()
        list.replaceChildren()
        appendMessage({ ...greeting })
        busy(false)
    })
    window.addEventListener('amy:planner-context', updateContext)
    function sizeForKeyboard() {
        const viewport = window.visualViewport
        if (!viewport) return
        panel.classList.toggle('milo-chat-compact', viewport.height < 480)
        panel.style.setProperty('--milo-visible-height', `${viewport.height}px`)
        panel.style.setProperty('--milo-keyboard-inset', `${Math.max(12, innerHeight - viewport.height - viewport.offsetTop + 12)}px`)
    }
    window.visualViewport?.addEventListener('resize', sizeForKeyboard)
    window.visualViewport?.addEventListener('scroll', sizeForKeyboard)
    try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey))
        if (Array.isArray(saved)) messages = saved.filter(message => message && (message.role === 'user' && typeof message.text === 'string' || message.role === 'assistant' && Array.isArray(message.parts) && message.parts.every(part => typeof part.text === 'string'))).slice(-30)
    } catch (_) {}
    if (!messages.length) appendMessage({ ...greeting })
    else messages.forEach(renderMessage)
    if (messages.filter(message => !message.kind).at(-1)?.role === 'user') showError('Cuộc trò chuyện còn dang dở nè. Amy muốn Milo trả lời tiếp hong? ♡', snapshot())
    busy(false)
    launcher.hidden = false
})()
