/* Fairy-dust particle trail adapted from Tim Holman's cursor-effects (MIT).
 * https://github.com/tholman/cursor-effects/blob/master/src/fairyDustCursor.js
 * Attribution/license: vendor/cursor-effects/NOTICE.txt.
 * Local changes: vector sprites, rose/gold palette, click hearts, edge petals,
 * bounded particles, delta timing, idle suspension and pointer/motion guards.
 */
(() => {
    if (document.querySelector('[data-love-magic]')) return
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const finePointer = matchMedia('(any-hover: hover) and (any-pointer: fine)')
    const root = document.documentElement
    const autumn = document.body.classList.contains('login-page')
    const colors = autumn ? ['#ed9eb1', '#f4cc91', '#fff0ca'] : ['#c95385', '#d6a75e', '#e68eaf']
    // These surfaces need clear text selection, precise aiming, or map gestures.
    const quietSurfaces = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), .leaflet-container, .claw-machine, .collection-box, #milo-chat-panel, dialog'
    const sprites = new Map()
    const seen = new WeakSet()
    const reveals = new Set()
    let canvas, context, particles = [], frame = 0, previousTime = 0
    let scrollFrame = 0, lastScroll = window.scrollY, lastScrollDust = 0
    let width = 0, height = 0, lastPointer, lastDust = 0, revealObserver, pageAway = false
    const random = (min, max) => min + Math.random() * (max - min)
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
    const active = () => !motion.matches && !document.hidden && !pageAway
    const quiet = target => target instanceof Element && !!target.closest(quietSurfaces)

    function resize() {
        width = root.clientWidth || innerWidth
        height = innerHeight
        if (canvas) {
            const ratio = Math.min(devicePixelRatio || 1, 2)
            canvas.width = Math.round(width * ratio)
            canvas.height = Math.round(height * ratio)
            context.setTransform(ratio, 0, 0, ratio, 0, 0)
        }
    }
    function ensureCanvas() {
        if (canvas) return true
        const element = document.createElement('canvas')
        const drawing = element.getContext('2d')
        if (!drawing) return false
        canvas = element
        context = drawing
        canvas.className = 'love-magic-canvas'
        canvas.dataset.loveMagic = ''
        canvas.setAttribute('aria-hidden', 'true')
        // Preserve click-through positioning even if the optional CSS fails.
        canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:25;'
        document.body.append(canvas)
        resize()
        return true
    }
    // Pre-render each shape/color once, as in the original fairy-dust effect.
    function sprite(type, color) {
        const key = `${type}:${color}`
        if (sprites.has(key)) return sprites.get(key)
        const image = document.createElement('canvas')
        image.width = image.height = 64
        const draw = image.getContext('2d')
        draw.scale(2, 2)
        draw.translate(16, 16)
        draw.fillStyle = color
        draw.strokeStyle = '#fff7f0'
        draw.lineWidth = .75
        draw.shadowColor = color
        draw.shadowBlur = 3
        draw.beginPath()
        if (type === 'heart') {
            draw.moveTo(0, -3)
            draw.bezierCurveTo(-7, -11, -13, 0, 0, 9)
            draw.bezierCurveTo(13, 0, 7, -11, 0, -3)
        } else if (type === 'petal') {
            draw.moveTo(0, -9)
            draw.quadraticCurveTo(11, 0, 0, 9)
            draw.quadraticCurveTo(-5, 0, 0, -9)
        } else {
            draw.moveTo(0, -10)
            for (const [x, y] of [[2.4, -2.4], [10, 0], [2.4, 2.4], [0, 10], [-2.4, 2.4], [-10, 0], [-2.4, -2.4]]) draw.lineTo(x, y)
        }
        draw.closePath()
        draw.fill()
        draw.stroke()
        sprites.set(key, image)
        return image
    }
    function add(x, y, type = 'spark', options = {}) {
        if (!active() || !ensureCanvas()) return
        const limit = finePointer.matches ? 64 : 28
        if (particles.length >= limit) particles.shift()
        const life = options.life || random(.55, .9)
        particles.push({
            x, y, type, life, remaining: life, angle: random(-.6, .6), spin: random(-1.2, 1.2),
            vx: options.vx ?? random(-12, 12), vy: options.vy ?? random(6, 22),
            size: options.size || random(11, 18), image: sprite(type, colors[Math.floor(Math.random() * colors.length)]),
        })
        if (!frame) { previousTime = performance.now(); frame = requestAnimationFrame(tick) }
    }
    function tick(time) {
        frame = 0
        if (!active()) { clear(); return }
        const delta = Math.min((time - previousTime) / 1000, .04)
        previousTime = time
        context.clearRect(0, 0, width, height)
        particles = particles.filter(particle => {
            particle.remaining -= delta
            if (particle.remaining <= 0) return false
            particle.x += particle.vx * delta
            particle.y += particle.vy * delta
            particle.vy += 18 * delta
            particle.angle += particle.spin * delta
            const fade = particle.remaining / particle.life
            const size = particle.size * (.5 + .5 * fade)
            context.save()
            context.globalAlpha = Math.min(1, fade * 2) * .85
            context.translate(particle.x, particle.y)
            context.rotate(particle.angle)
            context.drawImage(particle.image, -size / 2, -size / 2, size, size)
            context.restore()
            return true
        })
        if (particles.length) frame = requestAnimationFrame(tick)
        // With no particles the canvas is already cleared and the loop stops.
    }
    function clear() {
        cancelAnimationFrame(frame)
        frame = 0
        particles = []
        lastPointer = undefined
        context?.clearRect(0, 0, width, height)
    }
    function pointerMove(event) {
        if (!active() || !finePointer.matches || event.pointerType !== 'mouse' || event.buttons || quiet(event.target) || !window.getSelection()?.isCollapsed) { lastPointer = undefined; return }
        const now = performance.now()
        if (now - lastDust < 28) return
        if (lastPointer && Math.hypot(event.clientX - lastPointer.x, event.clientY - lastPointer.y) < 8) return
        lastDust = now
        lastPointer = { x: event.clientX, y: event.clientY }
        add(event.clientX + random(-3, 3), event.clientY + 7, 'spark')
    }
    function click(event) {
        if (!active() || !event.isTrusted || quiet(event.target) || window.getSelection()?.isCollapsed === false) return
        if (event.target instanceof Element && event.target.closest(':disabled, [aria-disabled="true"]')) return
        const target = event.target instanceof Element ? event.target.closest('button, a, label') : null
        // Keyboard activation blooms around its control; it never changes focus.
        const bounds = !event.detail && target?.getBoundingClientRect()
        const x = bounds ? bounds.left + bounds.width / 2 : event.clientX
        const y = bounds ? bounds.top + bounds.height / 2 : event.clientY
        if (!(x > 0 && y > 0)) return
        const count = finePointer.matches ? 11 : 7
        for (let index = 0; index < count; index++) {
            const angle = index / count * Math.PI * 2
            const speed = random(35, 75)
            add(x + Math.cos(angle) * 7, y + Math.sin(angle) * 7, index % 3 === 0 ? 'heart' : 'spark', { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 18, size: index % 3 === 0 ? 24 : 17 })
        }
    }
    function updateScroll() {
        scrollFrame = 0
        const current = window.scrollY
        const distance = current - lastScroll
        lastScroll = current
        const maximum = Math.max(0, document.documentElement.scrollHeight - innerHeight)
        root.style.setProperty('--love-scroll-progress', String(maximum ? clamp(current / maximum, 0, 1) : 0))
        const now = performance.now()
        if (!active() || Math.abs(distance) < 3 || now - lastScrollDust < 100 || document.querySelector('dialog[open]')) return
        lastScrollDust = now
        // Scroll petals stay at the edges, away from the date, map and controls.
        const band = finePointer.matches ? Math.min(34, width * .035) : 12
        for (const side of [-1, 1]) {
            const x = side < 0 ? random(3, band) : width - random(3, band)
            add(x, random(height * .2, height * .85), Math.random() > .5 ? 'petal' : 'spark', {
                vx: side * random(-5, 3), vy: distance > 0 ? random(-55, -25) : random(20, 45), size: random(16, 23), life: .85,
            })
        }
    }
    function scheduleScroll() { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll) }
    function revealSections() {
        revealObserver?.disconnect()
        if (!active() || !('IntersectionObserver' in window)) return
        revealObserver = new IntersectionObserver(entries => {
            for (const entry of entries) {
                if (!entry.isIntersecting || seen.has(entry.target)) continue
                seen.add(entry.target)
                revealObserver.unobserve(entry.target)
                if (!active() || !entry.target.animate) continue
                // Content is always present/readable, even without JS or observers.
                const from = entry.target.matches('.venue-card, .date-map-section, .recap-signoff') ? '0 0' : '0 8px'
                const animation = entry.target.animate([{ opacity: .7, translate: from }, { opacity: 1, translate: '0 0' }], { duration: 480, easing: 'cubic-bezier(.2,.7,.2,1)' })
                reveals.add(animation)
                animation.finished.catch(() => {}).finally(() => reveals.delete(animation))
            }
        }, { threshold: .08, rootMargin: '0px 0px -24px 0px' })
        document.querySelectorAll('.venue-card, .planner-keepsake, .planner-step .step-description, .recap-details, .date-map-section, .recap-signoff').forEach(element => {
            element.dataset.loveReveal = ''
            if (!seen.has(element)) revealObserver.observe(element)
        })
    }
    function sync() {
        clear()
        document.body.classList.toggle('love-magic-ready', active())
        for (const animation of reveals) animation.cancel()
        reveals.clear()
        revealObserver?.disconnect()
        if (active()) { resize(); revealSections() }
        else { canvas?.remove(); canvas = context = undefined }
        scheduleScroll()
    }
    document.addEventListener('pointermove', pointerMove, { passive: true })
    document.addEventListener('click', click, { passive: true })
    document.addEventListener('pointerleave', () => { lastPointer = undefined }, { passive: true })
    window.addEventListener('scroll', scheduleScroll, { passive: true })
    window.addEventListener('resize', () => { resize(); scheduleScroll() }, { passive: true })
    window.addEventListener('blur', clear)
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('pagehide', () => { pageAway = true; sync() })
    window.addEventListener('pageshow', () => { pageAway = false; sync() })
    motion.addEventListener('change', sync)
    finePointer.addEventListener('change', () => { lastPointer = undefined; clear() })
    // Defer observation until the planner has built its option cards.
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync, { once: true })
    else sync()
})()
