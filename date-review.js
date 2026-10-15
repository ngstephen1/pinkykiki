(() => {
    if (!window.AmyPlanner || !window.AmyAuth?.isAuthenticated() || !window.AmyState?.hasMilo()) return
    const options = window.DATE_OPTIONS
    const byId = id => document.getElementById(id)
    const dialog = byId('review-dialog')
    const openButton = byId('review-open')
    const refreshButton = byId('review-refresh')
    const stopButton = byId('review-stop')
    const agreeButton = byId('review-agree')
    const storageKey = 'amy-milo-review.v1'
    const keyOf = plan => JSON.stringify([plan.date, plan.time, plan.restaurant, [...plan.activities].sort()])
    let cache = {}, currentKey = '', session, controller, pending = false, generation = 0, applying = false
    try { cache = JSON.parse(sessionStorage.getItem(storageKey)) || {} } catch (_) {}
    if (!cache || typeof cache !== 'object' || Array.isArray(cache)) cache = {}

    function node(tag, className, text) {
        const element = document.createElement(tag)
        if (className) element.className = className
        if (text !== undefined) element.textContent = text
        return element
    }
    function reviewError(message) {
        const error = new Error('review_unavailable')
        error.publicMessage = message
        return error
    }
    function save() {
        const entries = Object.entries(cache).slice(-8)
        cache = Object.fromEntries(entries)
        try { sessionStorage.setItem(storageKey, JSON.stringify(cache)) } catch (_) {}
    }
    function validPlan(plan) {
        return !!plan && options.dates.includes(plan.date) && options.timeWindows.some(item => item.id === plan.time) &&
            options.restaurants.some(item => item.id === plan.restaurant) && Array.isArray(plan.activities) &&
            plan.activities.length > 0 && plan.activities.length <= options.activities.length &&
            new Set(plan.activities).size === plan.activities.length &&
            plan.activities.every(id => options.activities.some(item => item.id === id))
    }
    function validResult(result, key) {
        return result && validPlan(result.basePlan) && keyOf(result.basePlan) === key &&
            typeof result.comment === 'string' && result.comment.trim() && result.comment.length <= 4000 &&
            (result.suggestion === null || (result.suggestion && typeof result.suggestion.title === 'string' &&
                typeof result.suggestion.reason === 'string' && validPlan(result.suggestion.plan) && keyOf(result.suggestion.plan) !== key))
    }
    function safeURL(value) {
        try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null } catch (_) { return null }
    }
    function visibleCopy(value) {
        return String(value || '').replace(/[^]*/gu, '').replace(/\b[a-z]+(?:-[a-z]+)+\b/gu,
            token => options.timeWindows.find(item => item.id === token)?.range || token)
    }
    function text(value) { return visibleCopy(value).replace(/\*\*/gu, '') }
    function renderComment(container, value) {
        container.replaceChildren()
        const content = visibleCopy(value)
        const pattern = /\[([^\]\n]{1,180})\]\((https?:\/\/[^\s)]+)\)|\*\*([^*\n]+)\*\*/gu
        let offset = 0
        for (const match of content.matchAll(pattern)) {
            container.append(document.createTextNode(content.slice(offset, match.index)))
            const url = match[2] && safeURL(match[2])
            if (url) {
                const link = node('a', '', match[1])
                link.href = url
                link.target = '_blank'
                link.rel = 'noopener noreferrer'
                container.append(link)
            } else container.append(match[3] ? node('strong', '', match[3]) : document.createTextNode(match[0]))
            offset = match.index + match[0].length
        }
        container.append(document.createTextNode(content.slice(offset)))
    }
    function renderSources(container, sources) {
        container.replaceChildren()
        for (const source of (Array.isArray(sources) ? sources : []).slice(0, 8)) {
            const url = safeURL(source?.url)
            if (!url) continue
            const link = node('a', '', `${source.title || new URL(url).hostname} ↗`)
            link.href = url
            link.target = '_blank'
            link.rel = 'noopener noreferrer'
            container.append(link)
        }
        container.hidden = !container.childElementCount
    }
    function entry() { return cache[currentKey] }
    function render() {
        const item = entry()
        const result = item?.result
        openButton.disabled = pending
        openButton.textContent = pending ? 'Milo đang ngó lịch hẹn…' : result ? 'Xem lời nhắn của Milo ♡' : 'Milo góp ý xíu ♡'
        openButton.setAttribute('aria-busy', String(pending))
        refreshButton.hidden = pending || !item
        stopButton.hidden = !pending
        byId('review-comment').hidden = !result
        renderComment(byId('review-comment'), result?.comment)
        renderSources(byId('review-sources'), result?.sources)
        byId('review-status').textContent = pending ? 'Gâu gâu~ Milo đang xem thời gian, thời tiết và các điểm hẹn của Amy 🐾'
            : item?.status === 'applied' ? 'Đã sửa theo ý Amy rồiii ♡ Lời nhắn dưới đây là góp ý trước khi chỉnh; bản đồ & PDF tải tiếp theo dùng lịch mới nha.'
            : item?.status === 'dismissed' ? 'Mình giữ lịch Amy chọn nha ♡ Góp ý vẫn ở đây nếu Amy muốn ngó lại.'
            : result ? 'Milo có lời nhắn cho Kiki nè ♡ Amy xem rồi quyết định nha.'
            : item?.message || 'Lịch hẹn sẵn rồi, gọi Milo góp ý xíu nha ♡'
    }
    function label(field, plan) {
        if (field === 'date') {
            return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${plan.date}T12:00:00Z`))
        }
        if (field === 'time') return `${options.timeWindows.find(item => item.id === plan.time).range} · giờ Virginia`
        if (field === 'restaurant') return options.restaurants.find(item => item.id === plan.restaurant).name
        return options.activities.filter(item => plan.activities.includes(item.id)).map(item => item.name).join(' → ')
    }
    function showReview() {
        const item = entry(), result = item?.result
        if (!result || !window.AmyPlanner.getPlan()) return
        byId('review-dialog-intro').textContent = item.status === 'applied'
            ? 'Đây là lời góp ý trước khi Amy đồng ý sửa. Chiếc hẹn mới đã được lưu rồi nha ♡'
            : 'AI Milo ngó lại chiếc hẹn của tụi mình. Amy vẫn là người quyết định nha.'
        renderComment(byId('review-dialog-comment'), result.comment)
        renderSources(byId('review-dialog-sources'), result.sources)
        const suggestion = item.status === 'applied' ? null : result.suggestion
        byId('review-proposal').hidden = !suggestion
        agreeButton.hidden = !suggestion
        agreeButton.disabled = false
        byId('review-keep').textContent = item.status === 'applied' || !suggestion ? 'Okii, cảm ơn Milo ♡' : 'Giữ lịch Amy chọn ♡'
        byId('review-dialog-status').textContent = item.status === 'applied' ? 'Gợi ý này đã được Amy đồng ý và áp dụng rồi nha ♡' : ''
        const changes = byId('review-changes')
        changes.replaceChildren()
        if (suggestion) {
            byId('review-proposal-title').textContent = text(suggestion.title)
            byId('review-proposal-reason').textContent = text(suggestion.reason)
            for (const [field, name] of [['date', 'Ngày hẹn 🌷'], ['time', 'Thời gian ♡'], ['restaurant', 'Quán ăn 🍜'], ['activities', 'Đi chơi ✨']]) {
                const before = label(field, result.basePlan), after = label(field, suggestion.plan)
                if (before === after) continue
                const row = node('div', 'review-change')
                row.append(node('h4', '', name))
                const values = node('div', 'review-change-values')
                for (const [caption, value] of [['Amy đã chọn', before], ['Milo gợi ý', after]]) {
                    const column = node('div')
                    column.append(node('small', '', caption), node('p', '', value))
                    values.append(column)
                }
                row.append(values)
                changes.append(row)
            }
        }
        if (!dialog.open) dialog.showModal()
    }
    function dismiss() {
        const item = entry()
        if (item?.result && item.status !== 'applied') { item.status = 'dismissed'; save(); render() }
        dialog.close()
        openButton.focus({ preventScroll: true })
    }
    byId('review-close').addEventListener('click', dismiss)
    byId('review-keep').addEventListener('click', dismiss)
    dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss() })

    async function getSession(signal, refresh = false) {
        if (session && !refresh) return session
        const response = await fetch('/api/milo/session', { signal, credentials: 'same-origin', cache: 'no-store' })
        if (!response.ok) throw reviewError('Milo chưa kết nối được. Amy thử lại xíu nha ♡')
        const value = await response.json()
        if (!value.ready || typeof value.csrf !== 'string') throw reviewError('Milo nhỏ chưa kết nối được rùi. Amy vẫn giữ hoặc tải lịch hẹn bình thường nha ♡')
        return (session = value)
    }
    async function requestReview() {
        const plan = window.AmyPlanner.getPlan()
        if (!plan || pending) return
        const key = keyOf(plan), version = ++generation
        pending = true
        const requestController = new AbortController()
        controller = requestController
        const signal = requestController.signal
        const timeout = setTimeout(() => requestController.abort(), 80000)
        // Remember the attempt before sending, so reloading won't issue a second
        // paid review. A stopped/failed attempt can be retried explicitly.
        cache[key] = { status: 'interrupted', message: 'Lần góp ý trước chưa xong. Amy gọi Milo lại khi muốn nha ♡' }
        save(); render()
        try {
            let auth = await getSession(signal)
            const send = () => fetch('/api/milo/review', { method: 'POST', credentials: 'same-origin', signal,
                headers: { 'Content-Type': 'application/json', 'X-Milo-CSRF': auth.csrf }, body: JSON.stringify({ plan }) })
            let response = await send()
            if (response.status === 403) { auth = await getSession(signal, true); response = await send() }
            const result = await response.json()
            if (!response.ok) throw reviewError(result.message || 'Milo chưa góp ý kịp. Amy thử lại nha ♡')
            if (!validResult(result, key)) throw reviewError('Góp ý chưa khớp với lịch hẹn. Amy gọi Milo lại xíu nha ♡')
            if (version !== generation || currentKey !== key || !window.AmyPlanner.getPlan() || keyOf(window.AmyPlanner.getPlan()) !== key) return
            cache[key] = { status: 'ready', result }
            save(); pending = false; render(); showReview()
        } catch (error) {
            if (version !== generation) return
            cache[key] = { status: 'failed', message: signal.aborted ? 'Milo đã dừng ngó lịch hẹn. Amy muốn thì gọi anh lại nha ♡' : error.publicMessage || 'Milo chưa kết nối được rùi. Amy vẫn chọn và tải lịch hẹn bình thường, rồi thử lại nha ♡' }
            save()
        } finally {
            clearTimeout(timeout)
            if (version === generation) { pending = false; render() }
        }
    }
    openButton.addEventListener('click', () => entry()?.result ? showReview() : requestReview())
    refreshButton.addEventListener('click', requestReview)
    stopButton.addEventListener('click', () => controller?.abort())
    agreeButton.addEventListener('click', () => {
        if (agreeButton.disabled || !dialog.open) return
        const item = entry(), result = item?.result, current = window.AmyPlanner.getPlan()
        if (!result?.suggestion || item.status === 'applied') return
        agreeButton.disabled = true
        if (!current || keyOf(current) !== keyOf(result.basePlan)) {
            byId('review-dialog-status').textContent = 'Amy đã đổi lịch hẹn rồi nè. Mình nhờ Milo xem bản mới nha ♡'
            return
        }
        applying = true
        const applied = window.AmyPlanner.applySuggestion(result.basePlan, result.suggestion.plan)
        applying = false
        if (!applied) {
            byId('review-dialog-status').textContent = 'Chưa áp dụng được gợi ý này. Lịch Amy chọn vẫn được giữ nha ♡'
            return
        }
        // If Amy later reverts to the old choices, this review can be consulted
        // again; only the new snapshot should say its suggestion was applied.
        item.status = 'ready'
        currentKey = keyOf(window.AmyPlanner.getPlan())
        // Mark the new snapshot reviewed too; acceptance must not start an
        // endless chain of automatic reviews or reapply the same suggestion.
        cache[currentKey] = { status: 'applied', result: { ...result, basePlan: window.AmyPlanner.getPlan(), suggestion: null } }
        save(); dialog.close(); render()
        openButton.focus({ preventScroll: true })
    })

    function onContext() {
        if (applying) return
        const plan = window.AmyPlanner.getPlan()
        const key = plan ? keyOf(plan) : ''
        if (key === currentKey) return
        ++generation
        controller?.abort()
        pending = false
        if (dialog.open) dialog.close()
        currentKey = key
        if (!key) return
        const item = entry()
        if (item?.result && !validResult(item.result, key)) delete cache[key]
        render()
        if (!cache[key]) requestReview()
    }
    window.addEventListener('amy:planner-context', onContext)
    onContext()
})()
