import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createMiloServer } from '../server.mjs'
import { readCatalog, validateChat, buildRequest } from '../server/milo.mjs'
import { validateAttachments, calendarContext, calendarWindow, MAX_ATTACHMENT_BYTES } from '../server/milo-calendar.mjs'

const root = new URL('..', import.meta.url).pathname
const catalog = await readCatalog(root)
const choices = { date: '2026-10-24', time: 'afternoon' }
const makeICS = (...events) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events.join('\r\n')}\r\nEND:VCALENDAR`
const event = (id, lines) => `BEGIN:VEVENT\r\nUID:${id}\r\n${lines}\r\nEND:VEVENT`
const file = data => ({ name: 'amy.ics', type: 'text/calendar', data })
const png = { name: 'calendar.png', type: 'image/png', data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=' }
const pdf = { name: 'calendar.pdf', type: 'application/pdf', data: 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4\nfixture\n%%EOF').toString('base64') }

test('attachments reject URL injection, disguised files, invalid base64, names and size/count limits', () => {
    assert.equal(validateAttachments([png, pdf, file(makeICS())]).length, 3)
    for (const bad of [
        { ...png, data: 'https://example.com/private-calendar' },
        { ...png, data: 'data:image/png;base64,' + Buffer.from('<script>bad</script>').toString('base64') },
        { ...png, data: png.data + '!' }, { ...png, type: 'image/svg+xml' },
        { ...png, name: '../calendar.png' }, { ...png, name: 'calendar.html' },
        file('not a calendar'), { ...pdf, data: 'data:application/pdf;base64,' + 'A'.repeat(Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4 + 4) },
    ]) assert.throws(() => validateAttachments([bad]), /invalid_attachments/)
    assert.throws(() => validateAttachments([png, png, png, png]), /invalid_attachments/)
})

test('Virginia windows use real DST offsets and half-open conflict boundaries', async () => {
    const window = catalog.timeWindows.find(window => window.id === 'afternoon')
    assert.equal(calendarWindow('2026-10-24', window, catalog.location.timezone).start, '2026-10-24T19:00:00Z')
    assert.equal(calendarWindow('2026-11-07', window, catalog.location.timezone).start, '2026-11-07T20:00:00Z')
    const context = await calendarContext([file(makeICS(
        event('boundary', 'DTSTART:20261024T180000Z\r\nDTEND:20261024T190000Z\r\nSUMMARY:Ends at date start'),
        event('class', 'DTSTART;TZID=America/New_York:20261024T153000\r\nDTEND;TZID=America/New_York:20261024T163000\r\nSUMMARY:Art class'),
        event('free', 'DTSTART:20261024T200000Z\r\nDTEND:20261024T210000Z\r\nTRANSP:TRANSPARENT\r\nSUMMARY:Free note'),
        event('cancelled', 'DTSTART:20261024T200000Z\r\nDTEND:20261024T210000Z\r\nSTATUS:CANCELLED'),
        event('unrelated', 'DTSTART:20261025T200000Z\r\nDTEND:20261025T210000Z\r\nSUMMARY:Private unrelated event')
    ))], catalog, choices)
    assert.equal(context.incomplete, false)
    assert.deepEqual(context.conflicts.map(event => event.title), ['Art class'])
    assert.ok(!context.events.some(event => event.title.includes('unrelated')))
    assert.ok(!context.candidateWindows.some(window => window.date === choices.date && window.time === choices.time))
    assert.ok(context.candidateWindows.some(window => window.date === choices.date && window.time === 'evening'))
})

test('recurring classes honor exclusions, moved instances and cancellation overrides', async () => {
    const calendar = makeICS(
        event('weekly', 'DTSTART;TZID=America/New_York:20261016T160000\r\nDTEND;TZID=America/New_York:20261016T170000\r\nRRULE:FREQ=DAILY;COUNT=9\r\nEXDATE;TZID=America/New_York:20261023T160000\r\nSUMMARY:Class'),
        event('weekly', 'RECURRENCE-ID;TZID=America/New_York:20261024T160000\r\nDTSTART;TZID=America/New_York:20261024T190000\r\nDTEND;TZID=America/New_York:20261024T200000\r\nSUMMARY:Moved class'),
        event('weekly', 'RECURRENCE-ID;TZID=America/New_York:20261022T160000\r\nDTSTART;TZID=America/New_York:20261022T160000\r\nDTEND;TZID=America/New_York:20261022T170000\r\nSTATUS:CANCELLED')
    )
    const context = await calendarContext([file(calendar)], catalog, choices)
    assert.equal(context.incomplete, false)
    assert.equal(context.conflicts.length, 0)
    assert.equal(context.events.filter(event => event.start.startsWith('2026-10-23')).length, 0)
    assert.equal(context.events.filter(event => event.start.startsWith('2026-10-22')).length, 0)
    assert.equal(context.events.find(event => event.title === 'Moved class').start, '2026-10-24T23:00:00.000Z')
})

test('floating times default to Virginia and all-day DTEND remains exclusive', async () => {
    const context = await calendarContext([file(makeICS(
        event('floating', 'DTSTART:20261024T160000\r\nDTEND:20261024T170000\r\nSUMMARY:Piano'),
        event('all-day', 'DTSTART;VALUE=DATE:20261023\r\nDTEND;VALUE=DATE:20261024\r\nSUMMARY:All day Friday')
    ))], catalog, choices)
    assert.equal(context.incomplete, false)
    assert.deepEqual(context.conflicts.map(event => event.title), ['Piano'])
    assert.ok(context.assumptions.some(value => value.includes('America/New_York')))
    const friday = await calendarContext([file(makeICS(event('all-day', 'DTSTART;VALUE=DATE:20261023\r\nDTEND;VALUE=DATE:20261024\r\nSUMMARY:All day Friday')))], catalog, { ...choices, date: '2026-10-23' })
    assert.equal(friday.conflicts[0].allDay, true)
})

test('partial or unreadable calendars never claim a slot is free; visual files require inspection', async () => {
    const bad = await calendarContext([file(makeICS(event('bad', 'DTSTART:broken\r\nDTEND:broken')))], catalog, choices)
    assert.equal(bad.incomplete, true)
    assert.deepEqual(bad.candidateWindows, [])
    const frequent = await calendarContext([file(makeICS(event('dense', 'DTSTART:20261024T160000Z\r\nDTEND:20261024T170000Z\r\nRRULE:FREQ=SECONDLY')))], catalog, choices)
    assert.equal(frequent.incomplete, true)
    const visual = await calendarContext([png, pdf], catalog, choices)
    assert.equal(visual.hasVisualFiles, true)
    assert.deepEqual(visual.candidateWindows, [])
})

test('embedded timezone definitions stay intact and calendar timezone headers govern floating events', async () => {
    const zone = 'BEGIN:VTIMEZONE\r\nTZID:America/New_York\r\nBEGIN:STANDARD\r\nDTSTART:20261101T020000\r\nTZOFFSETFROM:-0400\r\nTZOFFSETTO:-0500\r\nEND:STANDARD\r\nBEGIN:DAYLIGHT\r\nDTSTART:20260308T020000\r\nTZOFFSETFROM:-0500\r\nTZOFFSETTO:-0400\r\nEND:DAYLIGHT\r\nEND:VTIMEZONE'
    const withZone = await calendarContext([file(makeICS(zone, event('zoned', 'DTSTART;TZID=America/New_York:20261024T160000\r\nDTEND;TZID=America/New_York:20261024T170000\r\nSUMMARY:Class')))], catalog, choices)
    assert.equal(withZone.incomplete, false)
    assert.equal(withZone.conflicts.length, 1)
    assert.deepEqual(withZone.assumptions, [], 'VTIMEZONE observance dates are not rewritten as floating events')
    const west = makeICS(event('west', 'DTSTART:20261024T100000\r\nDTEND:20261024T110000\r\nSUMMARY:West-coast meeting')).replace('VERSION:2.0', 'VERSION:2.0\r\nX-WR-TIMEZONE:America/Los_Angeles')
    const result = await calendarContext([file(west)], catalog, { ...choices, time: 'noon' })
    assert.equal(result.conflicts[0].start, '2026-10-24T17:00:00.000Z')
    assert.ok(result.assumptions[0].includes('America/Los_Angeles'))
})

test('Responses receives native image/PDF inputs and derived ICS context, with consent instructions and no web search', async () => {
    const data = makeICS(event('art', 'DTSTART;TZID=America/New_York:20261024T160000\r\nDTEND;TZID=America/New_York:20261024T170000\r\nSUMMARY:Art class\r\nDESCRIPTION:PRIVATE_DESCRIPTION_MARKER'))
    const chat = validateChat({ messages: [{ role: 'user', content: 'Ngó lịch này giúp Amy nha' }], context: choices, attachments: [png, pdf, file(data)] }, catalog)
    const request = await buildRequest({ root, catalog, chat, forecast: { days: [] }, model: 'gpt-5.4-mini', personalContext: '' })
    assert.equal(request.input.at(-1).content[1].type, 'input_image')
    assert.equal(request.input.at(-1).content[2].type, 'input_file')
    assert.equal(request.input.at(-1).content[2].file_data, pdf.data)
    assert.match(request.instructions, /Art class/)
    const context = JSON.parse(request.instructions.split('CURRENT PLANNER CONTEXT (JSON DATA):\n')[1])
    assert.equal(context.calendar.selectedWindow.time, 'afternoon')
    assert.deepEqual(context.calendar.conflicts.map(event => event.title), ['Art class'])
    assert.match(request.instructions, /Wait for Amy's yes/)
    assert.doesNotMatch(request.instructions, /PRIVATE_DESCRIPTION_MARKER/)
    assert.equal(request.tools, undefined)
    assert.equal(request.store, false)
    const followup = validateChat({ messages: [...chat.messages, { role: 'assistant', content: 'Amy muốn gợi ý giờ khác không?' }, { role: 'user', content: 'Có nha' }], context: choices, attachments: [file(data)] }, catalog)
    const next = await buildRequest({ root, catalog, chat: followup, forecast: { days: [] }, model: 'gpt-5.4-mini', personalContext: '' })
    assert.match(next.instructions, /candidateWindows/)
    assert.equal(next.input.at(-1).content, 'Có nha')
})

test('chat accepts large calendar attachments behind the existing session/CSRF controls', async t => {
    const calls = []
    const server = await createMiloServer({ root, apiKey: 'calendar-test-key', personalContext: '', fetchImpl: async (url, config) => {
        if (String(url).includes('open-meteo')) return Response.json({ daily: { time: [] } })
        calls.push(JSON.parse(config.body))
        return Response.json({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'Lịch có trùng, Amy muốn anh gợi ý giờ khác hông? ♡', annotations: [] }] }] })
    } })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) })
    const base = `http://127.0.0.1:${server.address().port}`
    const response = await fetch(base + '/api/milo/session')
    const session = await response.json()
    const headers = { Cookie: response.headers.get('set-cookie').split(';')[0], 'X-Milo-CSRF': session.csrf, 'Content-Type': 'application/json' }
    const largePDF = { ...pdf, data: 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4\n' + 'x'.repeat(100000) + '\n%%EOF').toString('base64') }
    const body = { messages: [{ role: 'user', content: 'Ngó giúp lịch Amy' }], context: choices, attachments: [largePDF] }
    assert.equal((await fetch(base + '/api/milo/chat', { method: 'POST', headers, body: JSON.stringify(body) })).status, 200)
    assert.equal(calls[0].input.at(-1).content[1].file_data, largePDF.data)
    assert.equal(calls[0].tools, undefined)
    assert.equal((await fetch(base + '/api/milo/chat', { method: 'POST', headers: { ...headers, 'X-Milo-CSRF': 'wrong' }, body: JSON.stringify(body) })).status, 403)
    assert.equal((await fetch(base + '/api/milo/chat', { method: 'POST', headers: { ...headers, Origin: 'https://other.example' }, body: JSON.stringify(body) })).status, 403)
    assert.equal((await fetch(base + '/api/milo/chat', { method: 'POST', headers, body: JSON.stringify({ ...body, attachments: [{ ...pdf, data: 'https://example.com/calendar.pdf' }] }) })).status, 400)
    assert.equal(calls.length, 1)
})
