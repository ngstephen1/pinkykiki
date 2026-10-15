import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { buildStatic } from '../scripts/build.mjs'
import milo from '../api/milo.js'

test('public build excludes secrets, server code, samples and symlinks', async t => {
    const root = await mkdtemp(resolve(tmpdir(), 'amy-build-'))
    t.after(() => rm(root, { recursive: true, force: true }))
    const files = {
        'index.html': '<h1>Amy</h1>', 'auth.js': '// browser entrance',
        'login/song1_firstdate.mp3': 'music', 'fonts/Quicksand-OFL.txt': 'font license',
        'vendor/cursor-effects/NOTICE.txt': 'MIT notice',
        '.env': 'PRIVATE_ENV_MARKER', 'server.mjs': 'PRIVATE_SERVER_MARKER',
        'server/milo-personal.md': 'PRIVATE_NOTE_MARKER', 'api/milo.js': 'private function',
        'tests/example.js': 'test', 'scripts/example.js': 'build code',
        'output/pdf/example.pdf': 'sample', 'login/.env': 'PRIVATE_NESTED_MARKER',
        'login/readme.md': 'local instructions', 'dist/stale.html': 'stale build',
    }
    for (const [name, text] of Object.entries(files)) {
        await mkdir(resolve(root, name, '..'), { recursive: true })
        await writeFile(resolve(root, name), text)
    }
    await symlink(resolve(root, '.env'), resolve(root, 'login/pretend.js'))
    const { output, count } = await buildStatic(root)
    assert.equal(count, 5)
    for (const name of ['index.html', 'auth.js', 'login/song1_firstdate.mp3', 'fonts/Quicksand-OFL.txt', 'vendor/cursor-effects/NOTICE.txt']) {
        assert.equal(await readFile(resolve(output, name), 'utf8'), files[name])
    }
    for (const name of ['.env', 'server.mjs', 'server/milo-personal.md', 'api/milo.js', 'tests/example.js', 'scripts/example.js', 'output/pdf/example.pdf', 'login/.env', 'login/readme.md', 'login/pretend.js', 'stale.html']) {
        await assert.rejects(access(resolve(output, name)))
    }
})

test('social previews use absolute deployment URLs without changing navigation or source files', async t => {
    const root = await mkdtemp(resolve(tmpdir(), 'amy-social-'))
    t.after(() => rm(root, { recursive: true, force: true }))
    const html = '<meta property="og:image" content="/assets/amy-milo-thumbnail.jpg"><meta name="twitter:image" content="/assets/amy-milo-thumbnail.jpg"><meta property="og:url" content="/"><a href="/login/index.html">Amy</a>'
    await mkdir(resolve(root, 'login'))
    await mkdir(resolve(root, 'assets'))
    await writeFile(resolve(root, 'index.html'), html)
    await writeFile(resolve(root, 'login/index.html'), html)
    await writeFile(resolve(root, 'assets/amy-milo-thumbnail.jpg'), 'thumbnail fixture')
    await buildStatic(root, { siteURL: '' })
    assert.equal(await readFile(resolve(root, 'dist/index.html'), 'utf8'), html)
    for (const siteURL of ['amy-preview.vercel.app', 'https://amy.example/']) {
        const origin = siteURL.startsWith('https:') ? 'https://amy.example' : 'https://amy-preview.vercel.app'
        await buildStatic(root, { siteURL })
        for (const name of ['index.html', 'login/index.html']) {
            const built = await readFile(resolve(root, 'dist', name), 'utf8')
            assert.ok(built.includes(`property="og:image" content="${origin}/assets/amy-milo-thumbnail.jpg"`))
            assert.ok(built.includes(`name="twitter:image" content="${origin}/assets/amy-milo-thumbnail.jpg"`))
            assert.ok(built.includes(`property="og:url" content="${origin}/"`))
            assert.ok(built.includes('href="/login/index.html"'))
            assert.equal(await readFile(resolve(root, name), 'utf8'), html)
        }
        assert.equal(await readFile(resolve(root, 'dist/assets/amy-milo-thumbnail.jpg'), 'utf8'), 'thumbnail fixture')
    }
    await assert.rejects(buildStatic(root, { siteURL: 'file:///private' }), /HTTP\(S\)/)
    await assert.rejects(buildStatic(root, { siteURL: 'https://user:pass@amy.example' }), /HTTP\(S\)/)
})

test('Vercel API adapter supports rewritten routes, parsed bodies, chat and review', async t => {
    const actualFetch = globalThis.fetch
    const names = ['OPENAI_API_KEY', 'MILO_PERSONAL_CONTEXT', 'VERCEL']
    const previous = Object.fromEntries(names.map(name => [name, process.env[name]]))
    process.env.OPENAI_API_KEY = 'private-vercel-fixture-key'
    process.env.MILO_PERSONAL_CONTEXT = 'Deployment-only preference: jasmine tea.'
    process.env.VERCEL = '1'
    const calls = []
    globalThis.fetch = async (url, config) => {
        if (String(url).includes('open-meteo')) return Response.json({ daily: { time: [] } })
        const payload = JSON.parse(config.body)
        calls.push(payload)
        const review = payload.text?.format?.name === 'milo_date_review'
        const text = review ? JSON.stringify({ comment: 'Kiki chọn một buổi hẹn xinh nè ♡', suggestion: null, sources: [] }) : 'Gâu gâu~ Kiki chọn trà jasmine nha ♡'
        return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text, annotations: [] }] }] })
    }
    t.after(() => {
        globalThis.fetch = actualFetch
        for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name] }
    })
    const server = createServer(async (request, response) => {
        if (request.method === 'POST') {
            const chunks = []
            for await (const chunk of request) chunks.push(chunk)
            request.body = JSON.parse(Buffer.concat(chunks).toString())
        }
        await milo(request, response)
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    t.after(async () => { server.closeAllConnections(); await new Promise(done => server.close(done)) })
    const base = `http://127.0.0.1:${server.address().port}`
    const headers = { Origin: base.replace('http:', 'https:'), 'X-Forwarded-Proto': 'https', 'Content-Type': 'application/json' }
    const response = await actualFetch(base + '/api/milo?action=session', { headers })
    assert.equal(response.status, 200)
    const session = await response.json()
    assert.equal(session.ready, true)
    assert.match(response.headers.get('set-cookie'), /; Secure/)
    Object.assign(headers, { Cookie: response.headers.get('set-cookie').split(';')[0], 'X-Milo-CSRF': session.csrf })
    const plan = { date: '2026-10-17', time: 'six-afternoon', restaurant: 'texas', activities: ['shopping', 'movie'] }
    const post = (action, body) => actualFetch(base + '/api/milo?action=' + action, { method: 'POST', headers, body: JSON.stringify(body) })
    const chat = await post('chat', { messages: [{ role: 'user', content: 'Gợi ý date cho Amy nha' }], context: plan })
    assert.equal(chat.status, 200)
    assert.match((await chat.json()).parts[0].text, /jasmine/)
    assert.match(calls[0].instructions, /Deployment-only preference: jasmine tea/)
    const review = await post('review', { plan })
    assert.equal(review.status, 200)
    assert.equal((await review.json()).suggestion, null)
    assert.equal((await post('chat', { messages: [{ role: 'user', content: 'x'.repeat(70000) }] })).status, 400)
    const pdf = { name: 'calendar.pdf', type: 'application/pdf', data: 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4\n' + 'x'.repeat(70000) + '\n%%EOF').toString('base64') }
    assert.equal((await post('chat', { messages: [{ role: 'user', content: 'Kiểm tra lịch Amy' }], context: plan, attachments: [pdf] })).status, 200)
    assert.equal(calls.at(-1).input.at(-1).content[1].file_data, pdf.data)
    assert.equal(calls.at(-1).tools, undefined)
    assert.equal((await actualFetch(base + '/api/milo?action=unknown')).status, 404)
    assert.equal((await actualFetch(base + '/api/milo')).status, 404)
})
