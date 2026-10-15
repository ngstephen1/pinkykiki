// Run in the head so the curtain is closed before the invitation's first paint.
(() => {
    if (!window.AmyAuth?.isAuthenticated() || !window.AmyAuth.tabFlag('curtainReveal')) return
    window.AmyAuth.setTabFlag('curtainReveal', false)
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    if (motion.matches) return

    const root = document.documentElement
    let finished = false
    let resourceTimer, animationTimer
    root.classList.add('curtain-pending')
    // A cancelled animation or slow resource must never leave Amy behind a curtain.
    const safetyTimer = setTimeout(() => finish(), 4500)

    function finish(focus = false) {
        if (finished) return
        finished = true
        clearTimeout(safetyTimer)
        clearTimeout(resourceTimer)
        clearTimeout(animationTimer)
        root.classList.remove('curtain-pending', 'curtain-opening')
        document.getElementById('welcome-curtain')?.remove()
        if (document.body) {
            document.body.inert = false
            document.body.removeAttribute('aria-busy')
        }
        motion.removeEventListener('change', motionChanged)
        window.removeEventListener('pagehide', pageHidden)
        if (focus) {
            const question = document.querySelector('.date-question')
            question?.setAttribute('tabindex', '-1')
            question?.focus({ preventScroll: true })
        }
    }
    function motionChanged(event) { if (event.matches) finish() }
    function pageHidden() { finish() }
    motion.addEventListener('change', motionChanged)
    window.addEventListener('pagehide', pageHidden)

    document.addEventListener('DOMContentLoaded', async () => {
        if (finished) return
        document.body.inert = true
        document.body.setAttribute('aria-busy', 'true')
        const curtain = document.getElementById('welcome-curtain')
        if (!curtain) { finish(); return }
        curtain.addEventListener('animationend', event => {
            if (event.animationName === 'amy-curtain-left') finish(true)
        })
        // Give the opening GIF pair a moment to arrive without waiting indefinitely.
        await Promise.race([
            Promise.allSettled([...document.querySelectorAll('.reaction-gif')].map(image => image.decode())),
            new Promise(resolve => { resourceTimer = setTimeout(resolve, 650) }),
        ])
        clearTimeout(resourceTimer)
        if (finished) return
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (finished) return
            root.classList.add('curtain-opening')
            animationTimer = setTimeout(() => finish(true), 2100)
        }))
    }, { once: true })
})()
