import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const scope = { window: {} }
runInNewContext(readFileSync(new URL('../claw_machine_usagi/attempt-clock.js', import.meta.url), 'utf8'), scope)

function fixture() {
  let time = 0
  let nextId = 0
  let expired = 0
  const scheduled = new Map()
  const ticks = []
  const clock = new scope.window.ClawAttemptClock({
    now: () => time,
    schedule: callback => { scheduled.set(++nextId, callback); return nextId },
    cancel: id => scheduled.delete(id),
    onTick: (seconds, fraction) => ticks.push({ seconds, fraction }),
    onExpire: () => expired++,
  })
  return {
    clock, ticks, scheduled,
    get expired() { return expired },
    advance(ms) { time += ms; [...scheduled.values()].forEach(callback => callback()) },
  }
}

test('a fresh claw attempt has 20 seconds and expires exactly once', () => {
  const f = fixture()
  f.clock.reset()
  assert.equal(f.scheduled.size, 0)
  assert.deepEqual(f.ticks.at(-1), { seconds: 20, fraction: 1 })
  assert.equal(f.clock.start(), true)
  f.advance(19001)
  assert.equal(f.ticks.at(-1).seconds, 1)
  assert.equal(f.expired, 0)
  f.advance(999)
  assert.deepEqual(f.ticks.at(-1), { seconds: 0, fraction: 0 })
  assert.equal(f.expired, 1)
  assert.equal(f.scheduled.size, 0)
  f.clock.tick()
  f.advance(30000)
  assert.equal(f.expired, 1)
})

test('changing aiming direction cannot extend the shared deadline', () => {
  const f = fixture()
  f.clock.start()
  f.advance(8000)
  assert.equal(f.clock.start(), false)
  assert.equal(f.scheduled.size, 1)
  f.advance(12000)
  assert.equal(f.expired, 1)
})

test('a manual grab stops the clock; reset gives the next attempt a full 20 seconds', () => {
  const f = fixture()
  f.clock.start()
  f.advance(6000)
  f.clock.stop()
  f.advance(30000)
  assert.equal(f.expired, 0)
  assert.equal(f.ticks.at(-1).seconds, 14)
  f.clock.reset()
  assert.equal(f.ticks.at(-1).seconds, 20)
  f.clock.start()
  f.advance(19999)
  assert.equal(f.expired, 0)
  f.advance(1)
  assert.equal(f.expired, 1)
})

test('throttled ticks catch up without negative time or repeated expiry', () => {
  const f = fixture()
  f.clock.start()
  f.advance(45000)
  assert.deepEqual(f.ticks.at(-1), { seconds: 0, fraction: 0 })
  f.clock.tick()
  assert.equal(f.expired, 1)
  f.clock.reset()
  f.clock.start()
  f.advance(20000)
  assert.equal(f.expired, 2)
})
