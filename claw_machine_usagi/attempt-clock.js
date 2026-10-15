(() => {
  // A deadline keeps the 20-second limit accurate when a tab or timer is throttled.
  class ClawAttemptClock {
    constructor({
      onTick, onExpire,
      now = () => performance.now(),
      schedule = (callback, delay) => setInterval(callback, delay),
      cancel = timer => clearInterval(timer),
    }) {
      Object.assign(this, { onTick, onExpire, now, schedule, cancel })
      this.duration = 20000
      this.deadline = null
      this.timer = null
    }
    start() {
      if (this.deadline !== null) return false
      this.deadline = this.now() + this.duration
      this.tick()
      this.timer = this.schedule(() => this.tick(), 100)
      return true
    }
    tick() {
      if (this.deadline === null) return
      const remaining = Math.max(0, this.deadline - this.now())
      this.onTick(Math.ceil(remaining / 1000), remaining / this.duration)
      if (remaining === 0) {
        this.stop()
        this.onExpire()
      }
    }
    stop() {
      if (this.timer !== null) this.cancel(this.timer)
      this.timer = null
      this.deadline = null
    }
    reset() {
      this.stop()
      this.onTick(this.duration / 1000, 1)
    }
  }
  window.ClawAttemptClock = ClawAttemptClock
})()
