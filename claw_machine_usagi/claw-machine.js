const elements = {
  clawMachine: document.querySelector('.claw-machine'),
  box: document.querySelector('.box'),
  collectionBox: document.querySelector('.collection-box'),
  collectionArrow: document.querySelector('.collection-arrow'),
  toys: [],
}

const settings = {
  targetToy: null,
  collectedNumber: 0,
  phase: 'booting',
  miloDodged: false,
}

const gameStatus = document.getElementById('game-status')
const claimMiloButton = document.getElementById('claim-milo')
const miloWinPanel = document.getElementById('milo-win')
const plannerLink = document.getElementById('planner-link')
const missDialog = document.getElementById('miss-dialog')
const clockCard = document.getElementById('attempt-clock')
const clockLabel = document.getElementById('attempt-clock-label')
const clockSeconds = document.getElementById('attempt-seconds')
const attemptClock = new window.ClawAttemptClock({
  onTick: (seconds, fraction) => {
    if (clockSeconds.textContent !== String(seconds)) {
      clockSeconds.textContent = seconds
      clockSeconds.parentElement.setAttribute('aria-label', `Còn ${seconds} giây để ngắm gắp`)
    }
    clockCard.style.setProperty('--clock-progress', fraction)
    clockCard.classList.toggle('clock-hurry', seconds <= 5)
  },
  onExpire: () => {
    gameStatus.textContent = 'Hết giờ rồiii, gắp tại chỗ cho Amy nha ⏰'
    beginGrab()
  },
})

for (const id of ['miss-close', 'miss-retry']) {
  document.getElementById(id).addEventListener('click', () => missDialog.close())
}
missDialog.addEventListener('close', () => {
  if (settings.phase !== 'miss') return
  activateHoriBtn()
  updateClaimPrompt()
  horiBtn.el.focus({ preventScroll: true })
})
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) attemptClock.tick()
})

function showMiloWin(toy) {
  // A saved win keeps the planner unlocked, but only a fresh pickup reveals this card.
  if (toy?.toyType !== 'milo' || !toy.collected || !miloWinPanel.hidden) return
  plannerLink.href = '../date-planner.html'
  plannerLink.removeAttribute('aria-disabled')
  miloWinPanel.hidden = false
  gameStatus.textContent = 'Amy gắp được anh rồi nè. Our date starts here 💗'
  claimMiloButton.hidden = true
  requestAnimationFrame(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    miloWinPanel.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
    plannerLink.focus({ preventScroll: true })
  })
}

function updateClaimPrompt() {
  const milo = elements.toys.find(toy => toy.toyType === 'milo' && toy.el.classList.contains('selected') && !toy.collected)
  claimMiloButton.hidden = !milo
  if (milo) gameStatus.textContent = 'Chạm để nhận Milo 💗 — anh đang ở cửa nhận quà nè!'
}

claimMiloButton.addEventListener('click', () => {
  const milo = elements.toys.find(toy => toy.toyType === 'milo' && toy.el.classList.contains('selected'))
  if (milo) milo.collectToy(milo)
})

const m = 2
const toys = {
  bear: {
    w: 20 * m,
    h: 27 * m,
  },
  bunny: {
    w: 20 * m,
    h: 29 * m,
  },
  golem: {
    w: 20 * m,
    h: 27 * m,
  },
  cucumber: {
    w: 16 * m,
    h: 28 * m,
  },
  penguin: {
    w: 24 * m,
    h: 22 * m,
  },
  robot: {
    w: 20 * m,
    h: 30 * m,
  },
  milo: { w: 24 * m, h: 30 * m },
}

const ordinaryToys = Object.keys(toys).filter(type => type !== 'milo')
const sortedToys = [...ordinaryToys, ...ordinaryToys].sort(
  () => 0.5 - Math.random(),
)

const cornerBuffer = 16

const machineBuffer = {
  x: 36,
  y: 16,
}

const radToDeg = rad => Math.round(rad * (180 / Math.PI))
const calcX = (i, n) => i % n
const calcY = (i, n) => Math.floor(i / n)

const {
  width: machineWidth,
  height: machineHeight,
  top: machineTop,
} = document.querySelector('.claw-machine').getBoundingClientRect()

const { height: machineTopHeight } = document
  .querySelector('.machine-top')
  .getBoundingClientRect()

const { height: machineBottomHeight, top: machineBottomTop } = document
  .querySelector('.machine-bottom')
  .getBoundingClientRect()

const maxArmLength = machineBottomTop - machineTop - machineBuffer.y

const adjustAngle = angle => {
  const adjustedAngle = angle % 360
  return adjustedAngle < 0 ? adjustedAngle + 360 : adjustedAngle
}

const randomN = (min, max) => {
  return Math.round(min - 0.5 + Math.random() * (max - min + 1))
}

//* classes *//

class Button {
  constructor({ className, action, isLocked, pressAction, releaseAction }) {
    Object.assign(this, {
      el: document.querySelector(`.${className}`),
      isLocked,
    })
    if (action) this.el.addEventListener('click', action)
    const keys = [' ', 'Enter', className === 'hori-btn' ? 'ArrowRight' : 'ArrowUp']
    const press = event => {
      if (this.isLocked || this.pressed || (event.type === 'pointerdown' && event.button !== 0)) return
      event.preventDefault()
      this.pressed = true
      this.el.setAttribute('aria-pressed', 'true')
      if (event.pointerId !== undefined) this.el.setPointerCapture(event.pointerId)
      pressAction?.()
    }
    const release = () => {
      if (!this.pressed) return
      this.pressed = false
      this.el.setAttribute('aria-pressed', 'false')
      releaseAction?.()
    }
    this.el.addEventListener('pointerdown', press)
    ;['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => this.el.addEventListener(type, release))
    window.addEventListener('pointerup', release)
    window.addEventListener('blur', release)
    document.addEventListener('visibilitychange', () => { if (document.hidden) release() })
    this.el.addEventListener('keydown', event => {
      if (keys.includes(event.key)) press(event)
    })
    window.addEventListener('keyup', event => {
      if (keys.includes(event.key) && this.pressed) { event.preventDefault(); release() }
    })
    this.el.setAttribute('aria-pressed', 'false')
    if (!isLocked) this.activate()
    else this.deactivate()
  }
  activate() {
    this.isLocked = false
    this.el.disabled = false
    this.el.classList.add('active')
  }
  deactivate() {
    this.isLocked = true
    this.pressed = false
    this.el.disabled = true
    this.el.setAttribute('aria-pressed', 'false')
    this.el.classList.remove('active')
  }
}

class WorldObject {
  constructor(props) {
    Object.assign(this, {
      x: 0,
      y: 0,
      z: 0,
      angle: 0,
      transformOrigin: { x: 0, y: 0 },
      interval: null,
      default: {},
      moveWith: [],
      el: props.className && document.querySelector(`.${props.className}`),
      ...props,
    })
    this.setStyles()
    if (props.className) {
      const { width, height } = this.el.getBoundingClientRect()
      this.w = width
      this.h = height
    }
    ;['x', 'y', 'w', 'h'].forEach(key => {
      this.default[key] = this[key]
    })
  }
  setStyles() {
    Object.assign(this.el.style, {
      left: `${this.x}px`,
      top: !this.bottom && `${this.y}px`,
      bottom: this.bottom,
      width: `${this.w}px`,
      height: `${this.h}px`,
      transformOrigin: this.transformOrigin,
    })
    this.el.style.zIndex = this.z
  }
  setClawPos(clawPos) {
    this.clawPos = clawPos
  }
  setTransformOrigin(transformOrigin) {
    this.transformOrigin =
      transformOrigin === 'center'
        ? 'center'
        : `${transformOrigin.x}px ${transformOrigin.y}px`
    this.setStyles()
  }
  handleNext(next) {
    clearInterval(this.interval)
    this.interval = null
    if (next) next()
  }
  resumeMove({ moveKey, target, moveTime, next }) {
    this.interval = null
    this.move({ moveKey, target, moveTime, next })
  }
  resizeShadow() {
    elements.box.style.setProperty('--scale', 0.5 + this.h / maxArmLength / 2)
  }
  move({ moveKey, target, moveTime, next, onProgress }) {
    if (this.interval) {
      this.handleNext(next)
    } else {
      const moveTarget = target ?? this.default[moveKey]
      this.interval = setInterval(() => {
        const distance =
          Math.abs(this[moveKey] - moveTarget) < 10
            ? Math.abs(this[moveKey] - moveTarget)
            : 10
        const increment = this[moveKey] > moveTarget ? -distance : distance
        if (
          increment > 0
            ? this[moveKey] < moveTarget
            : this[moveKey] > moveTarget
        ) {
          this[moveKey] += increment
          this.setStyles()
          if (moveKey === 'h') this.resizeShadow()
          if (this.moveWith.length) {
            this.moveWith.forEach(obj => {
              if (!obj) return
              obj[moveKey === 'h' ? 'y' : moveKey] += increment
              obj.setStyles()
            })
          }
          onProgress?.()
        } else {
          this.handleNext(next)
        }
      }, moveTime || 100)
    }
  }
  distanceBetween(target) {
    return Math.round(
      Math.sqrt(
        Math.pow(this.x - target.x, 2) + Math.pow(this.y - target.y, 2),
      ),
    )
  }
}

class Toy extends WorldObject {
  constructor(props) {
    const toyType = props.index === 9 ? 'milo' : sortedToys[props.index]
    const size = toys[toyType]
    super({
      el: Object.assign(document.createElement('div'), {
        className: `toy pix ${toyType}`,
      }),
      x:
        cornerBuffer +
        calcX(props.index, 4) * ((machineWidth - cornerBuffer * 3) / 4) +
        size.w / 2 +
        randomN(-6, 6),
      y:
        machineBottomTop -
        machineTop +
        cornerBuffer +
        calcY(props.index, 4) *
          ((machineBottomHeight - cornerBuffer * 2) / 3) -
        size.h / 2 +
        randomN(-2, 2),
      z: 0,
      toyType,
      ...size,
      ...props,
    })
    elements.box.append(this.el)
    const toy = this

    this.el.addEventListener('click', () => this.collectToy(toy))
    this.el.tabIndex = -1
    this.el.setAttribute('role', 'img')
    this.el.setAttribute('aria-label', toyType === 'milo' ? 'Milo với chiếc ô dâu hồng' : 'Một bé thú bông')
    this.el.addEventListener('keydown', event => {
      if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); this.collectToy(toy) }
    })
    elements.toys.push(this)
  }
  collectToy(toy) {
    if (toy.collected || !toy.el.classList.contains('selected')) return
    toy.collected = true
    toy.el.classList.remove('selected')
    toy.el.tabIndex = -1
    toy.el.setAttribute('aria-hidden', 'true')
    toy.x = machineWidth / 2 - toy.w / 2
    toy.y = machineHeight / 2 - toy.h / 2
    toy.z = 7
    toy.el.style.setProperty('--rotate-angle', '0deg')
    toy.setTransformOrigin('center')
    toy.el.classList.add('display')
    elements.clawMachine.classList.add('show-overlay')
    settings.collectedNumber++
    if (toy.toyType === 'milo') {
      window.AmyState.unlockMilo()
      window.MiloCelebration.start()
    }
    updateClaimPrompt()
    if (toy.toyType !== 'milo') gameStatus.textContent = 'Được một bé xinh rồi nè! Còn Milo đang chờ Amy ♡'
    elements.collectionBox.appendChild(
      Object.assign(document.createElement('div'), {
        className: `toy-wrapper ${
          settings.collectedNumber > 6 ? 'squeeze-in' : ''
        }`,
        innerHTML: `<div class="toy pix ${toy.toyType}"></div>`,
      }),
    )
    setTimeout(() => {
      elements.clawMachine.classList.remove('show-overlay')
      if (!document.querySelector('.selected'))
        elements.collectionArrow.classList.remove('active')
      if (toy.toyType === 'milo') showMiloWin(toy)
    }, 1000)
  }
  setRotateAngle() {
    const angle =
      radToDeg(
        Math.atan2(
          this.y + this.h / 2 - this.clawPos.y,
          this.x + this.w / 2 - this.clawPos.x,
        ),
      ) - 90
    const adjustedAngle = Math.round(adjustAngle(angle))
    this.angle =
      adjustedAngle < 180 ? adjustedAngle * -1 : 360 - adjustedAngle
    this.el.style.setProperty('--rotate-angle', `${this.angle}deg`)
  }
}

//* set up *//
elements.box.style.setProperty('--shadow-pos', `${maxArmLength}px`)

const armJoint = new WorldObject({
  className: 'arm-joint',
})

const vertRail = new WorldObject({
  className: 'vert',
  moveWith: [null, armJoint],
})

const arm = new WorldObject({
  className: 'arm',
})

armJoint.resizeShadow()

armJoint.move({
  moveKey: 'y',
  target: machineTopHeight - machineBuffer.y,
  moveTime: 50,
  next: () =>
    vertRail.resumeMove({
      moveKey: 'x',
      target: machineBuffer.x,
      moveTime: 50,
      next: () => {
        Object.assign(armJoint.default, {
          y: machineTopHeight - machineBuffer.y,
          x: machineBuffer.x,
        })
        Object.assign(vertRail.default, {
          x: machineBuffer.x,
        })
        activateHoriBtn()
      },
    }),
})

const doOverlap = (a, b) => {
  return b.x > a.x && b.x < a.x + a.w && b.y > a.y && b.y < a.y + a.h
}

function dodgeMiloOnce() {
  const milo = settings.targetToy
  if (settings.miloDodged || settings.phase !== 'grabbing' || milo?.toyType !== 'milo' || milo.collected || milo.el.classList.contains('selected')) return
  const clawTipY = armJoint.y + arm.h + machineBuffer.y + 7
  if (clawTipY < milo.y - 22) return

  // One little sidestep, inside the glass and still within the claw's reach.
  settings.miloDodged = true
  milo.x = Math.min(milo.x + 64, machineWidth - cornerBuffer - milo.w)
  milo.z = 1
  milo.el.classList.add('milo-dodging')
  milo.setStyles()
  gameStatus.textContent = 'Milo né xíu nè~ Kiki bắt anh điii 😝'
  setTimeout(() => milo.el.classList.remove('milo-dodging'), 650)
}

const getClosestToy = () => {
  settings.targetToy = null
  const claw = {
    y: armJoint.y + maxArmLength + machineBuffer.y + 7,
    x: armJoint.x + 7,
    w: 40,
    h: 32,
  }
  const overlappedToys = elements.toys.filter(t => {
    return !t.collected && !t.el.classList.contains('selected') && doOverlap(t, claw)
  })

  if (overlappedToys.length) {
    // Match the visible stacking order after Milo slides over an ordinary toy.
    const toy = overlappedToys.sort((a, b) => b.z - a.z || b.index - a.index)[0]
    toy.setTransformOrigin({
      x: claw.x - toy.x,
      y: claw.y - toy.y,
    })
    toy.setClawPos({
      x: claw.x,
      y: claw.y,
    })
    settings.targetToy = toy
  }
}

new Array(12).fill('').forEach((_, i) => {
  if (i === 8) return
  new Toy({ index: i })
})

const stopHoriBtnAndActivateVertBtn = () => {
  armJoint.interval = null
  horiBtn.deactivate()
  vertBtn.activate()
  settings.phase = 'vertical'
  clockLabel.textContent = 'Giữ ↑ rồi thả để gắp nha ♡'
}

const activateHoriBtn = () => {
  settings.phase = 'ready'
  attemptClock.reset()
  clockCard.dataset.state = 'ready'
  clockLabel.textContent = 'Giữ → là bắt đầu 20 giây nha!'
  horiBtn.activate()
  ;[vertRail, armJoint, arm].forEach(c => (c.interval = null))
}

const dropToy = () => {
  arm.el.classList.add('open')
  const toy = settings.targetToy
  if (toy) {
    toy.z = 3
    toy.move({
      moveKey: 'y',
      target: machineHeight - toy.h - 30,
      moveTime: 50,
      next: () => {
        toy.el.classList.add('selected')
        toy.el.tabIndex = 0
        toy.el.setAttribute('role', 'button')
        toy.el.setAttribute('aria-label', toy.toyType === 'milo' ? 'Nhận Milo ở cửa quà' : 'Nhận bé thú bông ở cửa quà')
        elements.collectionArrow.classList.add('active')
        gameStatus.textContent = 'Có quà ở cửa nhận rồi nè, chạm để nhận nha ✨'
        updateClaimPrompt()
      },
    })
    ;[vertRail, armJoint, arm].forEach(obj => (obj.moveWith[0] = null))
  }
  settings.targetToy = null
  setTimeout(() => {
    arm.el.classList.remove('open')
    if (toy) activateHoriBtn()
    else {
      settings.phase = 'miss'
      attemptClock.reset()
      clockCard.dataset.state = 'ready'
      clockLabel.textContent = 'Lượt mới chờ Amy nè ♡'
      gameStatus.textContent = 'xui nha bà 🥀 — thử lại với Milo nha!'
      missDialog.showModal()
    }
    updateClaimPrompt()
  }, 700)
}

const grabToy = () => {
  if (settings.targetToy) {
    ;[vertRail, armJoint, arm].forEach(
      obj => (obj.moveWith[0] = settings.targetToy),
    )
    settings.targetToy.setRotateAngle()
    settings.targetToy.el.classList.add('grabbed')
  } else {
    arm.el.classList.add('missed')
  }
}

const horiBtn = new Button({
  className: 'hori-btn',
  isLocked: true,
  pressAction: () => {
    settings.phase = 'horizontal'
    attemptClock.start()
    clockCard.dataset.state = 'aiming'
    clockLabel.textContent = 'Ngắm ngang xinh xinh với → ♡'
    arm.el.classList.remove('missed')
    vertRail.move({
      moveKey: 'x',
      target: machineWidth - armJoint.w - machineBuffer.x,
      next: stopHoriBtnAndActivateVertBtn,
    })
  },
  releaseAction: () => {
    clearInterval(vertRail.interval)
    stopHoriBtnAndActivateVertBtn()
  },
})

// Recalculate the original pixel geometry when rotating a narrow phone.
let resizeTimer
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    if (Math.abs(elements.clawMachine.getBoundingClientRect().width - machineWidth) > 1) location.reload()
  }, 250)
})

const vertBtn = new Button({
  className: 'vert-btn',
  isLocked: true,
  pressAction: () => {
    if (vertBtn.isLocked) return
    armJoint.move({
      moveKey: 'y',
      target: machineBuffer.y,
    })
  },
  releaseAction: () => beginGrab(),
})

function beginGrab() {
  // The manual release and countdown share one grab, even if both happen together.
  if (!['horizontal', 'vertical'].includes(settings.phase)) return
  settings.phase = 'grabbing'
  attemptClock.stop()
  clockCard.dataset.state = 'grabbing'
  clockLabel.textContent = 'Đang gắp… hồi hộp cùng Amy ♡'
  clearInterval(vertRail.interval)
  clearInterval(armJoint.interval)
  vertRail.interval = null
  armJoint.interval = null
  horiBtn.deactivate()
  vertBtn.deactivate()
  getClosestToy()
  setTimeout(() => {
    arm.el.classList.add('open')
    arm.move({
      moveKey: 'h',
      target: maxArmLength,
      onProgress: dodgeMiloOnce,
      next: () =>
        setTimeout(() => {
          arm.el.classList.remove('open')
          // Milo may have dodged since aiming; only catch what's here now.
          getClosestToy()
          grabToy()
          arm.resumeMove({
            moveKey: 'h',
            next: () => {
              vertRail.resumeMove({
                moveKey: 'x',
                next: () => {
                  armJoint.resumeMove({
                    moveKey: 'y',
                    next: dropToy,
                  })
                },
              })
            },
          })
        }, 500),
    })
  }, 500)
}
