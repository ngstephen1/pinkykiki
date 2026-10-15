// Adapted from ../heart_background/script.js: the same curved hearts, sway,
// and soft trails, drawn locally with Canvas 2D and confined to four edges.
(() => {
    const canvas = document.getElementById('invitation-hearts')
    const content = document.querySelector('.invite-page .container')
    if (!canvas || !content) return
    const context = canvas.getContext('2d')
    if (!context) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const colors = ['#b73570', '#9d3e81', '#cc4574', '#cf637b']
    let width, height, sideBand, endBand, padding
    let hearts = []
    let frame
    let previousTime
    const random = (min, max) => min + Math.random() * (max - min)
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

    function resize() {
        width = document.documentElement.clientWidth || window.innerWidth
        height = window.innerHeight
        const ratio = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = Math.round(width * ratio)
        canvas.height = Math.round(height * ratio)
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
        context.setTransform(ratio, 0, 0, ratio, 0, 0)
        const compact = width <= 600
        sideBand = compact ? 17 : clamp(width * .075, 36, 170)
        endBand = compact ? 28 : clamp(height * .085, 38, 105)
        const style = getComputedStyle(content)
        padding = { x: parseFloat(style.paddingLeft), top: parseFloat(style.paddingTop), bottom: parseFloat(style.paddingBottom) }
        const count = clamp(Math.round((width + height) / 180) * 4, 28, 72)
        hearts = Array.from({ length: count }, (_, index) => ({
            side: index % 4,
            progress: (Math.floor(index / 4) + Math.random()) / (count / 4),
            lane: random(.2, .8),
            phase: random(0, Math.PI * 2),
            speed: random(12, 27),
            size: compact ? (index % 2 ? random(9, 13) : random(12, 18)) : random(16, 32),
            angle: random(-.25, .25),
            alpha: random(.55, .8),
            color: colors[index % colors.length],
            history: [],
            sampledAt: 0,
        }))
        previousTime = undefined
        render(0, 0)
    }

    function position(heart) {
        const lateral = clamp(heart.lane + Math.cos(heart.phase + heart.progress * Math.PI * 3) * .12, .1, .9)
        const band = heart.side % 2 ? sideBand : endBand
        const radius = heart.size * .56
        const inset = radius + lateral * Math.max(0, band - radius * 2)
        const along = heart.progress
        if (heart.side === 0) return { x: along * width, y: inset }
        if (heart.side === 1) return { x: width - inset, y: (1 - along) * height }
        if (heart.side === 2) return { x: (1 - along) * width, y: height - inset }
        return { x: inset, y: (1 - along) * height }
    }

    function drawHeart(heart, point, alpha, outlined) {
        context.save()
        context.translate(point.x, point.y)
        context.rotate(point.angle)
        const scale = heart.size / 32
        context.scale(scale, scale)
        context.translate(0, 4)
        context.globalAlpha = alpha
        context.fillStyle = heart.color
        context.beginPath()
        context.moveTo(0, -12)
        context.quadraticCurveTo(1, -20, 8, -20)
        context.quadraticCurveTo(16, -20, 16, -10)
        context.quadraticCurveTo(16, 0, 0, 12)
        context.quadraticCurveTo(-16, 0, -16, -10)
        context.quadraticCurveTo(-16, -20, -8, -20)
        context.quadraticCurveTo(-1, -20, 0, -12)
        context.closePath()
        context.fill()
        if (outlined) {
            context.strokeStyle = '#fff3f6'
            context.lineWidth = .9 / scale
            context.stroke()
        }
        context.restore()
    }

    function exclude(rect, margin = 5) {
        context.beginPath()
        context.rect(0, 0, width, height)
        context.rect(rect.left - margin, rect.top - margin, rect.width + margin * 2, rect.height + margin * 2)
        context.clip('evenodd')
    }

    function render(time, delta) {
        context.clearRect(0, 0, width, height)
        context.save()
        // A transparent center makes the effect a frame, even while scrolling.
        context.beginPath()
        context.rect(0, 0, width, height)
        context.rect(sideBand, endBand, width - sideBand * 2, height - endBand * 2)
        context.clip('evenodd')
        const bounds = content.getBoundingClientRect()
        exclude({ left: bounds.left + padding.x, top: bounds.top + padding.top, width: bounds.width - padding.x * 2, height: bounds.height - padding.top - padding.bottom }, 3)
        // Also keep clear of the moving No button and the music control.
        for (const selector of ['#yes-btn', '#no-btn', '#music-toggle']) {
            const element = document.querySelector(selector)
            if (element) exclude(element.getBoundingClientRect())
        }
        for (const heart of hearts) {
            const length = heart.side % 2 ? height : width
            heart.progress += heart.speed * delta / length
            if (heart.progress > 1) { heart.progress %= 1; heart.history = [] }
            const point = { ...position(heart), angle: heart.angle + Math.sin(heart.phase + heart.progress * 6) * .2 }
            if (!motion.matches && time - heart.sampledAt > 90) {
                heart.history.push(point)
                if (heart.history.length > 5) heart.history.shift()
                heart.sampledAt = time
            }
            heart.history.forEach((sample, index) => drawHeart(heart, sample, heart.alpha * .07 * (index + 1) / heart.history.length, false))
            drawHeart(heart, point, heart.alpha, true)
        }
        context.restore()
    }

    function tick(time) {
        if (previousTime === undefined) previousTime = time
        const elapsed = time - previousTime
        if (elapsed >= 1000 / 30) {
            render(time, Math.min(elapsed / 1000, .06))
            previousTime = time
        }
        frame = requestAnimationFrame(tick)
    }

    function resume() {
        cancelAnimationFrame(frame)
        previousTime = undefined
        if (document.hidden) return
        if (motion.matches) {
            hearts.forEach(heart => { heart.history = [] })
            render(0, 0)
        } else frame = requestAnimationFrame(tick)
    }
    window.addEventListener('resize', () => { resize(); resume() })
    window.addEventListener('pagehide', () => cancelAnimationFrame(frame))
    window.addEventListener('pageshow', resume)
    document.addEventListener('visibilitychange', resume)
    document.addEventListener('scroll', () => { if (motion.matches && !document.hidden) render(0, 0) }, { passive: true, capture: true })
    motion.addEventListener('change', resume)
    resize()
    resume()
})()
