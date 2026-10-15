// The puppy is the existing chat button, with a small, interruptible edge stroll.
(() => {
    const puppy = document.getElementById('milo-chat-launcher')
    if (!puppy || !window.AmyAuth?.isAuthenticated() || !window.AmyState?.hasMilo()) return
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const phone = matchMedia('(max-width: 700px), (pointer: coarse)')
    let point, walk, timer, settleTimer, hovering = false, away = false
    const margin = 12
    const overlaps = (a, b, gap = 10) => a.x < b.right + gap && a.x + a.width > b.left - gap && a.y < b.bottom + gap && a.y + a.height > b.top - gap
    const viewport = () => ({ width: document.documentElement.clientWidth, height: window.visualViewport?.height || innerHeight })
    const paused = () => motion.matches || document.hidden || away || puppy.hidden || hovering || puppy.matches(':focus-within') || !!document.querySelector('dialog[open]')

    function stop() {
        clearTimeout(timer)
        if (!walk) return
        const rect = puppy.getBoundingClientRect()
        point = { x: rect.left, y: rect.top }
        puppy.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`
        walk.cancel()
        walk = undefined
    }
    function size() { return { width: puppy.offsetWidth, height: puppy.offsetHeight } }
    function obstacles() {
        // On phones preserve the visible checkmarks and actions. On desktop the
        // puppy also stays outside the card groups and the map itself.
        const selectors = 'button, a, input:not([type="radio"]):not([type="checkbox"]), textarea, .choice-mark, .leaflet-control, h1, h2, .milo-teaser, .step-description' + (phone.matches ? '' : ', .choices, .date-map-section, .recap-details, .planner-intro')
        const view = viewport()
        return [...document.querySelectorAll(selectors)].filter(el => el !== puppy && !puppy.contains(el) && !el.closest('#milo-chat-panel, dialog, [hidden]')).map(el => el.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < view.height)
    }
    function anchors() {
        const view = viewport(), box = size()
        const right = Math.max(margin, view.width - box.width - margin)
        const bottom = Math.max(margin, view.height - box.height - 78)
        const rows = phone.matches ? [bottom, Math.max(margin, bottom - 100), view.height * .18, view.height * .42] : [bottom, view.height * .18, view.height * .43, view.height * .65]
        return rows.flatMap(y => [right, margin].map(x => ({ x, y: Math.max(margin, Math.min(y, bottom)) })))
    }
    function clearAt(position, blocked) {
        return !blocked.some(rect => overlaps({ ...position, ...size() }, rect))
    }
    function clearPath(next, blocked) {
        const distance = Math.hypot(next.x - point.x, next.y - point.y)
        const samples = Math.ceil(distance / 18)
        for (let i = 0; i <= samples; i++) {
            if (!clearAt({ x: point.x + (next.x - point.x) * i / Math.max(1, samples), y: point.y + (next.y - point.y) * i / Math.max(1, samples) }, blocked)) return false
        }
        return true
    }
    function place(next) {
        point = next
        puppy.style.left = '0px'
        puppy.style.top = '0px'
        puppy.style.right = 'auto'
        puppy.style.bottom = 'auto'
        puppy.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`
    }
    function planWalk() {
        if (paused() || !point || !puppy.animate) return
        const blocked = obstacles()
        const candidates = anchors().filter(next => Math.hypot(next.x - point.x, next.y - point.y) > 35 && clearPath(next, blocked))
        if (!candidates.length) { timer = setTimeout(planWalk, 3000); return }
        const next = candidates[Math.floor(Math.random() * candidates.length)]
        const distance = Math.hypot(next.x - point.x, next.y - point.y)
        const duration = Math.max(1600, Math.min(phone.matches ? 8500 : 7500, distance / (phone.matches ? 22 : 34) * 1000))
        const animation = puppy.animate([{ transform: `translate3d(${point.x}px, ${point.y}px, 0)` }, { transform: `translate3d(${next.x}px, ${next.y}px, 0)` }], { duration, easing: 'ease-in-out' })
        walk = animation
        animation.finished.then(() => {
            if (walk !== animation) return
            walk = undefined
            place(next)
            timer = setTimeout(planWalk, phone.matches ? 4500 : 1700)
        }).catch(() => {})
    }
    function settle() {
        stop()
        const modal = !!document.querySelector('dialog[open]')
        puppy.style.visibility = modal ? 'hidden' : ''
        if (puppy.hidden || modal || document.hidden || away) return
        if (motion.matches) {
            puppy.style.removeProperty('left'); puppy.style.removeProperty('top')
            puppy.style.removeProperty('right'); puppy.style.removeProperty('bottom')
            puppy.style.removeProperty('transform')
            point = undefined
            return
        }
        const view = viewport(), box = size(), blocked = obstacles()
        const withinView = point && point.x >= 0 && point.y >= 0 && point.x + box.width <= view.width && point.y + box.height <= view.height
        const currentFits = withinView && clearAt(point, blocked)
        if (!withinView || (!currentFits && !hovering)) {
            const options = anchors()
            place(options.find(next => clearAt(next, blocked)) || options[0])
        }
        if (!paused()) timer = setTimeout(planWalk, phone.matches ? 4500 : 1200)
    }
    puppy.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') { hovering = true; stop() } })
    puppy.addEventListener('pointerleave', () => { hovering = false; settle() })
    puppy.addEventListener('pointerdown', stop, { passive: true })
    puppy.addEventListener('focus', stop)
    puppy.addEventListener('blur', settle)
    // Chat owns the hidden attribute. Watching it preserves the original
    // open/close/focus behavior and never sends a question by itself.
    const observer = new MutationObserver(settle)
    observer.observe(puppy, { attributes: true, attributeFilter: ['hidden'] })
    document.querySelectorAll('dialog').forEach(dialog => observer.observe(dialog, { attributes: true, attributeFilter: ['open'] }))
    const afterScroll = () => { stop(); clearTimeout(settleTimer); settleTimer = setTimeout(settle, 180) }
    window.addEventListener('scroll', afterScroll, { passive: true })
    window.addEventListener('resize', afterScroll, { passive: true })
    window.visualViewport?.addEventListener('resize', afterScroll, { passive: true })
    window.addEventListener('amy:planner-context', afterScroll)
    document.addEventListener('visibilitychange', settle)
    window.addEventListener('pagehide', () => { away = true; stop(); clearTimeout(settleTimer) })
    window.addEventListener('pageshow', () => { away = false; settle() })
    motion.addEventListener('change', settle)
    phone.addEventListener('change', settle)
    // Reserve a safe spot after the planner and the music control have laid out.
    requestAnimationFrame(settle)
})()
