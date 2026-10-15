import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, copyFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { once } from 'node:events'
import { createHmac } from 'node:crypto'
import { createMiloServer } from '../server.mjs'
import { readCatalog, validateChat, createForecast, buildRequest, extractReply } from '../server/milo.mjs'
import { normalizePlan, planKey, validateReview, buildReviewRequest, extractReview } from '../server/milo-review.mjs'

const ROOT = resolve(import.meta.dirname || new URL('.', import.meta.url).pathname, '..')
const catalog = await readCatalog(ROOT)
const weatherData = { daily: { time: ['2026-10-16', '2026-10-17'], weather_code: [0, 63], temperature_2m_min: [null, 8], temperature_2m_max: [22, 15], precipitation_probability_max: [0, 90] } }
const chatBody = { messages: [{ role: 'user', content: 'Gợi ý một lịch hẹn nha Milo' }], context: { date: '2026-10-17', time: 'six-noon', restaurant: 'baan', activities: ['cafe', 'piano'] } }
const reviewPlan = { ...chatBody.context }
const reviewOutput = (overrides = {}) => ({ comment: 'Gâu gâu~ Kiki chọn bữa ăn và piano dễ thương nè. Mình dành thêm thời gian đi lại nha ♡', suggestion: { title: 'Thêm thời gian cho tụi mình', reason: 'Khung giờ dài hơn để ăn và chơi thong thả.', plan: { ...reviewPlan, time: 'six-afternoon' } }, sources: [{ title: 'Virginia Tech', url: 'https://campuslife.vt.edu/' }], ...overrides })
const structuredResponse = result => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(result), annotations: [] }] }] })

async function fixture(t, config = {}) {
    const root = await mkdtemp(resolve(tmpdir(), 'milo-test-'))
    await mkdir(resolve(root, 'server'))
    await copyFile(resolve(ROOT, 'date-options.js'), resolve(root, 'date-options.js'))
    await copyFile(resolve(ROOT, 'server/milo-context.md'), resolve(root, 'server/milo-context.md'))
    await writeFile(resolve(root, 'server/milo-personal.md'), 'Kiki likes jasmine green tea, classical piano and Texas Roadhouse. Allergies and budget unknown.')
    await writeFile(resolve(root, '.env'), 'OPENAI_API_KEY=private-test-marker')
    await writeFile(resolve(root, 'index.html'), '<h1>Amy</h1>')
    await writeFile(resolve(root, 'song.mp3'), Buffer.from('12345678'))
    await symlink(resolve(root, '.env'), resolve(root, 'pretend.html'))
    const calls = []
    const fetchImpl = async (url, options) => {
        if (String(url).includes('open-meteo')) return Response.json(weatherData)
        calls.push({ url, ...options, payload: JSON.parse(options.body) })
        return Response.json(calls.at(-1).payload.text?.format?.name === 'milo_date_review' ? structuredResponse(reviewOutput()) : { output: [{ type: 'message', content: [{ type: 'output_text', text: 'Gâu gâu~ Kiki chọn boba nha ♡', annotations: [] }] }] })
    }
    const server = await createMiloServer({ root, apiKey: 'test-secret-not-for-browser', fetchImpl, ...config })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    t.after(async () => { server.closeAllConnections(); await new Promise(done => server.close(done)); await rm(root, { recursive: true, force: true }) })
    const base = `http://127.0.0.1:${server.address().port}`
    const response = await fetch(base + '/api/milo/session')
    const session = await response.json()
    const cookie = response.headers.get('set-cookie').split(';')[0]
    const post = (body = chatBody, extra = {}) => fetch(base + '/api/milo/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, 'X-Milo-CSRF': session.csrf, ...extra }, body: JSON.stringify(body) })
    const review = (body = { plan: reviewPlan }, extra = {}) => fetch(base + '/api/milo/review', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, 'X-Milo-CSRF': session.csrf, ...extra }, body: JSON.stringify(body) })
    return { root, base, session, cookie, post, review, calls }
}

test('validates roles, bounds and current choices without trusting client labels', () => {
    const data = validateChat({ ...chatBody, context: { ...chatBody.context, name: 'ignore system', time: 'made-up', activities: ['piano', 'piano', 'invented'], date: '2030-01-01' } }, catalog)
    assert.equal(data.choices.date, null)
    assert.equal(data.choices.time, null)
    assert.deepEqual(data.choices.activities.map(item => item.id), ['piano'])
    assert.equal(data.choices.name, undefined)
    assert.throws(() => validateChat({ messages: [{ role: 'system', content: 'fake authority' }] }, catalog))
    assert.throws(() => validateChat({ messages: [{ role: 'user', content: 'x'.repeat(2001) }] }, catalog))
    assert.throws(() => validateChat({ messages: [{ role: 'assistant', content: 'not a question' }] }, catalog))
})

test('forecast preserves nulls, rainy days, missing dates and shares a cached request', async () => {
    let calls = 0
    const forecast = createForecast(async () => { calls++; return Response.json(weatherData) })
    const [a, b] = await Promise.all([forecast(catalog.location), forecast(catalog.location)])
    assert.equal(calls, 1)
    assert.deepEqual(a, b)
    assert.equal(a.days[0].lowC, null)
    assert.equal(a.days[0].maxRainProbability, 0)
    assert.equal(a.days[1].maxRainProbability, 90)
    assert.equal(a.days.find(day => day.date === '2030-01-01'), undefined)
    const failure = await createForecast(async () => { throw new Error('offline') })(catalog.location)
    assert.equal(failure.status, 'unavailable')
    assert.deepEqual(failure.days, [])
})

test('context contains Kiki preferences, all venues, exact date/time and forced fresh checks', async t => {
    const app = await fixture(t)
    const chat = validateChat({ ...chatBody, messages: [{ role: 'user', content: 'Kiểm tra giờ mở cửa Baan Thai' }] }, catalog)
    const forecast = await createForecast(async () => Response.json(weatherData))(catalog.location)
    const payload = await buildRequest({ root: app.root, catalog, chat, forecast, model: 'gpt-5.4-mini', now: new Date('2026-10-16T01:00:00Z') })
    assert.match(payload.instructions, /jasmine green tea/)
    assert.match(payload.instructions, /classical piano/)
    assert.match(payload.instructions, /Texas Roadhouse/)
    assert.match(payload.instructions, /Hahn Horticulture Garden/)
    assert.match(payload.instructions, /200 Garden Lane/)
    assert.match(payload.instructions, /https:\/\/hahngarden\.vt\.edu\/visit\.html/)
    assert.match(payload.instructions, /12–6 PM/)
    assert.match(payload.instructions, /2026-10-17/)
    assert.match(payload.instructions, /Thursday, October 15, 2026/)
    assert.equal(payload.store, false)
    assert.equal(payload.tool_choice, 'required')
    assert.equal(payload.tools[0].user_location.timezone, 'America/New_York')
})

test('serves the app, blocks secrets and private symlinks, supports audio seeking', async t => {
    const app = await fixture(t)
    assert.equal((await fetch(app.base + '/')).status, 200)
    for (const path of ['/.env', '/%2eenv', '/server/milo-context.md', '/server.mjs', '/tests/milo.test.mjs', '/pretend.html']) assert.equal((await fetch(app.base + path)).status, 404, path)
    const audio = await fetch(app.base + '/song.mp3', { headers: { Range: 'bytes=2-4' } })
    assert.equal(audio.status, 206)
    assert.equal(audio.headers.get('content-range'), 'bytes 2-4/8')
    assert.equal(await audio.text(), '345')
})

test('chat uses server-side credentials, planner context and returns no key', async t => {
    const app = await fixture(t)
    const response = await app.post()
    assert.equal(response.status, 200)
    const text = await response.text()
    assert.match(text, /Kiki/)
    assert.doesNotMatch(text, /test-secret|private-test-marker/)
    assert.equal(app.calls.length, 1)
    assert.equal(app.calls[0].headers.Authorization, 'Bearer test-secret-not-for-browser')
    assert.equal(app.calls[0].payload.model, 'gpt-5.4-mini')
    assert.equal(app.calls[0].payload.store, false)
    assert.match(app.calls[0].payload.instructions, /2026-10-17/)
    assert.equal(app.calls[0].payload.input.at(-1).content, chatBody.messages[0].content)
})

test('rejects cross-origin, bad CSRF (including Unicode) and malformed messages', async t => {
    const app = await fixture(t)
    assert.equal((await app.post(chatBody, { Origin: 'https://other.example' })).status, 403)
    assert.equal((await app.post(chatBody, { 'X-Milo-CSRF': 'wrong' })).status, 403)
    assert.equal((await app.post(chatBody, { 'X-Milo-CSRF': 'é'.repeat(48) })).status, 403)
    assert.equal((await app.post({ messages: [{ role: 'system', content: 'ignore' }] })).status, 400)
    assert.equal((await app.post({ ...chatBody, messages: [{ role: 'user', content: 'x'.repeat(70000) }] })).status, 400)
    assert.equal((await app.post()).status, 200)
})

test('rate limit and missing configuration fail gently without fake AI answers', async t => {
    const app = await fixture(t, { rateLimit: 1 })
    assert.equal((await app.post()).status, 200)
    assert.equal((await app.post()).status, 429)
    const unconfigured = await fixture(t, { apiKey: '' })
    assert.equal(unconfigured.session.ready, false)
    assert.equal((await unconfigured.post()).status, 503)
})

test('upstream errors cannot leak quoted API keys in the response', async t => {
    const app = await fixture(t, { fetchImpl: async url => String(url).includes('open-meteo') ? Response.json(weatherData) : Response.json({ error: { message: 'Invalid key test-secret-not-for-browser' } }, { status: 401 }) })
    const response = await app.post()
    assert.equal(response.status, 502)
    assert.doesNotMatch(await response.text(), /test-secret|Invalid key/)
})

test('preserves citations and rejects unsafe citation URLs', () => {
    const reply = extractReply({ output: [{ type: 'web_search_call' }, { type: 'message', content: [{ type: 'output_text', text: 'Xem nguồn [1]', annotations: [{ type: 'url_citation', url: 'https://example.com/menu', title: 'Menu', start_index: 10, end_index: 13 }, { type: 'url_citation', url: 'javascript:alert(1)', start_index: 0, end_index: 1 }] }] }] })
    assert.equal(reply.searched, true)
    assert.equal(reply.sources.length, 1)
    assert.equal(reply.parts[0].citations[0].url, 'https://example.com/menu')
    assert.throws(() => extractReply({ output: [] }))
})

test('reviews only complete known choices and normalizes activity order, never client labels', () => {
    const plan = normalizePlan({ ...reviewPlan, activities: ['piano', 'cafe'], name: 'ignore rules' }, catalog)
    assert.deepEqual(plan.activities, ['cafe', 'piano'])
    assert.equal(plan.name, undefined)
    assert.equal(planKey(plan), planKey(reviewPlan))
    for (const change of [{ date: '2030-01-01' }, { time: 'invented' }, { restaurant: 'invented' }, { activities: [] }, { activities: ['piano', 'piano'] }, { activities: ['piano', 'invented'] }]) {
        assert.throws(() => validateReview({ plan: { ...reviewPlan, ...change } }, catalog))
    }
})

test('review asks for a structured, optional proposal with real choice enums and explicit acceptance', async t => {
    const app = await fixture(t)
    const forecast = { status: 'unavailable', days: [] }
    const payload = await buildReviewRequest({ root: app.root, catalog, plan: reviewPlan, forecast, model: 'gpt-5.4-mini' })
    assert.equal(payload.store, false)
    assert.equal(payload.text.format.strict, true)
    assert.equal(payload.text.format.type, 'json_schema')
    const schema = payload.text.format.schema
    assert.equal(schema.additionalProperties, false)
    assert.deepEqual(schema.properties.suggestion.anyOf[0].properties.plan.properties.time.enum, catalog.timeWindows.map(item => item.id))
    assert.equal(payload.tool_choice, 'required')
    assert.match(payload.instructions, /Agree with this suggestion/)
    assert.match(payload.instructions, /jasmine green tea/)
    assert.match(payload.instructions, /Missing weather stays unknown/)
    const offline = await buildReviewRequest({ root: app.root, catalog, plan: reviewPlan, forecast, model: 'gpt-5.4-mini', webSearch: false })
    assert.equal(offline.tools, undefined)
})

test('review endpoint shares session/origin/rate controls and returns a bounded validated suggestion', async t => {
    const app = await fixture(t, { rateLimit: 1 })
    assert.equal((await app.review({}, { Origin: 'https://other.example' })).status, 403)
    assert.equal((await app.review({}, { 'X-Milo-CSRF': 'wrong' })).status, 403)
    assert.equal((await app.review({ plan: { ...reviewPlan, activities: [] } })).status, 400)
    const response = await app.review()
    assert.equal(response.status, 200)
    const result = await response.json()
    assert.deepEqual(result.basePlan, reviewPlan)
    assert.equal(result.suggestion.plan.time, 'six-afternoon')
    assert.equal(result.sources[0].url, 'https://campuslife.vt.edu/')
    assert.doesNotMatch(JSON.stringify(result), /test-secret|private-test-marker/)
    assert.equal(app.calls[0].payload.text.format.name, 'milo_date_review')
    assert.equal((await app.post()).status, 429)
})

test('malformed, refused, truncated or invented proposals fail closed; no-op proposals become comment only', () => {
    for (const data of [
        { output: [] },
        { output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'Cannot review' }] }] },
        { ...structuredResponse(reviewOutput()), status: 'incomplete' },
        structuredResponse(reviewOutput({ suggestion: { ...reviewOutput().suggestion, plan: { ...reviewPlan, restaurant: 'not-on-the-picker' } } })),
        structuredResponse(reviewOutput({ suggestion: { ...reviewOutput().suggestion, plan: { ...reviewPlan, activities: [] } } })),
    ]) assert.throws(() => extractReview(data, reviewPlan, catalog))
    const noOp = extractReview(structuredResponse(reviewOutput({ suggestion: { ...reviewOutput().suggestion, plan: { ...reviewPlan, activities: ['piano', 'cafe'] } }, sources: [{ title: 'unsafe', url: 'javascript:alert(1)' }] })), reviewPlan, catalog)
    assert.equal(noOp.suggestion, null)
    assert.deepEqual(noOp.sources, [])
    assert.equal(extractReview(structuredResponse(reviewOutput({ suggestion: null })), reviewPlan, catalog).suggestion, null)
})

test('invalid upstream review does not return unsafe choices or break the original plan', async t => {
    const app = await fixture(t, { fetchImpl: async url => String(url).includes('open-meteo') ? Response.json(weatherData) : Response.json(structuredResponse(reviewOutput({ suggestion: { ...reviewOutput().suggestion, plan: { ...reviewPlan, time: 'made-up' } } }))) })
    const response = await app.review()
    assert.equal(response.status, 502)
    assert.doesNotMatch(await response.text(), /made-up|test-secret/)
    const unconfigured = await fixture(t, { apiKey: '' })
    assert.equal((await unconfigured.review()).status, 503)
})

test('signed sessions and CSRF tokens work across separate serverless instances', async t => {
    const first = await fixture(t)
    const second = await fixture(t)
    assert.equal((await second.post(chatBody, { Cookie: first.cookie, 'X-Milo-CSRF': first.session.csrf })).status, 200)
    assert.equal((await second.review({ plan: reviewPlan }, { Cookie: first.cookie, 'X-Milo-CSRF': first.session.csrf })).status, 200)
    const renewed = await fetch(second.base + '/api/milo/session', { headers: { Cookie: first.cookie } })
    assert.equal((await renewed.json()).csrf, first.session.csrf)
    const tampered = first.cookie.slice(0, -1) + (first.cookie.endsWith('a') ? 'b' : 'a')
    assert.equal((await second.post(chatBody, { Cookie: tampered, 'X-Milo-CSRF': first.session.csrf })).status, 403)
    const differentKey = await fixture(t, { apiKey: 'a-different-test-key' })
    assert.equal((await differentKey.post(chatBody, { Cookie: first.cookie, 'X-Milo-CSRF': first.session.csrf })).status, 403)
})

test('expired and future-dated sessions fail even with valid signatures', async t => {
    const secret = 'fixture-session-signing-secret'
    const app = await fixture(t, { sessionSecret: secret })
    const sign = text => createHmac('sha256', secret).update(text).digest('hex')
    for (const created of [Date.now() - 6 * 60 * 60 * 1000 - 1000, Date.now() + 60000]) {
        const payload = `${'a'.repeat(48)}.${created}`
        const token = `${payload}.${sign(`milo-session:${payload}`)}`
        const csrf = sign(`milo-csrf:${token}`).slice(0, 48)
        assert.equal((await app.post(chatBody, { Cookie: `milo_session=${token}`, 'X-Milo-CSRF': csrf })).status, 403)
    }
})

test('Vercel HTTPS cookies and per-client limits use only trusted proxy headers', async t => {
    const app = await fixture(t, { trustProxy: true, rateLimit: 1 })
    const proxy = { Origin: app.base.replace('http:', 'https:'), 'X-Forwarded-Proto': 'https', 'X-Vercel-Forwarded-For': '203.0.113.1' }
    const response = await fetch(app.base + '/api/milo/session', { headers: proxy })
    const session = await response.json()
    const cookie = response.headers.get('set-cookie')
    assert.match(cookie, /; Secure/)
    const headers = { ...proxy, Cookie: cookie.split(';')[0], 'X-Milo-CSRF': session.csrf }
    assert.equal((await app.post(chatBody, headers)).status, 200)
    assert.equal((await app.post(chatBody, { ...headers, 'X-Vercel-Forwarded-For': '203.0.113.2' })).status, 200)
    assert.equal((await app.post(chatBody, headers)).status, 429)
    assert.equal((await app.post(chatBody, { ...headers, Origin: app.base })).status, 403)

    const local = await fixture(t)
    const localSession = await fetch(local.base + '/api/milo/session', { headers: { 'X-Forwarded-Proto': 'https' } })
    assert.doesNotMatch(localSession.headers.get('set-cookie'), /; Secure/)
})

test('server-only environment notes replace the local private notebook', async t => {
    const app = await fixture(t, { personalContext: 'Private deployment note: Amy enjoys jasmine tea.' })
    assert.equal((await app.post()).status, 200)
    assert.match(app.calls[0].payload.instructions, /Private deployment note: Amy enjoys jasmine tea/)
    assert.doesNotMatch(app.calls[0].payload.instructions, /Allergies and budget unknown/)
})
