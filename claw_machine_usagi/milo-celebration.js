// Local confetti cannons: no network dependency and no effect on game controls.
window.MiloCelebration = (() => {
  let canvas
  let frame
  let removeMotionListener
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')

  function stop() {
    cancelAnimationFrame(frame)
    canvas?.remove()
    canvas = null
    removeMotionListener?.()
    removeMotionListener = null
  }

  function start() {
    if (motion.matches || canvas) return
    const surface = document.createElement('canvas')
    const context = surface.getContext('2d')
    if (!context) return
    canvas = surface
    surface.id = 'milo-confetti'
    surface.setAttribute('aria-hidden', 'true')
    document.body.append(surface)
    const width = window.innerWidth
    const height = window.innerHeight
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    surface.width = width * ratio
    surface.height = height * ratio
    context.scale(ratio, ratio)
    const colors = ['#da4d87', '#f49bc0', '#ffd5e5', '#e7b550', '#fff4dc', '#bb5794']
    const particles = []
    let lastBurst = -1
    let previousTime
    let startedAt

    function burst() {
      for (const side of [-1, 1]) {
        for (let i = 0; i < 28; i++) {
          const angle = (.24 + Math.random() * .26) * Math.PI
          const speed = Math.min(width * .7, 650) * (.65 + Math.random() * .5)
          particles.push({
            x: side < 0 ? -8 : width + 8,
            y: height * .73 + Math.random() * 28,
            vx: -side * Math.cos(angle) * speed,
            vy: -Math.sin(angle) * (500 + Math.random() * 270),
            angle: Math.random() * Math.PI,
            spin: (Math.random() - .5) * 10,
            size: 5 + Math.random() * 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            heart: Math.random() < .18,
          })
        }
      }
    }

    function draw(time) {
      if (canvas !== surface) return
      if (startedAt === undefined) startedAt = time
      const elapsed = time - startedAt
      const delta = Math.min((time - (previousTime ?? time)) / 1000, .035)
      previousTime = time
      const burstIndex = Math.min(2, Math.floor(elapsed / 180))
      if (burstIndex > lastBurst) { burst(); lastBurst = burstIndex }
      context.clearRect(0, 0, width, height)
      context.globalAlpha = Math.min(1, Math.max(0, (3100 - elapsed) / 650))
      for (const particle of particles) {
        particle.vx *= Math.exp(-.5 * delta)
        particle.vy += 500 * delta
        particle.x += particle.vx * delta
        particle.y += particle.vy * delta
        particle.angle += particle.spin * delta
        context.save()
        context.translate(particle.x, particle.y)
        context.rotate(particle.angle)
        context.fillStyle = particle.color
        if (particle.heart) {
          context.font = `${particle.size * 2}px sans-serif`
          context.fillText('♥', -particle.size, particle.size / 2)
        } else {
          context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * .65)
        }
        context.restore()
      }
      if (elapsed < 3100) frame = requestAnimationFrame(draw)
      else stop()
    }

    const reduce = () => { if (motion.matches) stop() }
    motion.addEventListener('change', reduce)
    removeMotionListener = () => motion.removeEventListener('change', reduce)
    frame = requestAnimationFrame(draw)
  }

  window.addEventListener('pagehide', stop)
  return { start }
})()
