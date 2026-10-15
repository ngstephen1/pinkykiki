import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { readFile, stat, realpath } from 'node:fs/promises'
import { resolve, dirname, extname, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto'
import { readCatalog, validateChat, createForecast, buildRequest, extractReply } from './server/milo.mjs'
import { validateReview, buildReviewRequest, extractReview } from './server/milo-review.mjs'
import { MAX_CHAT_BODY_BYTES } from './server/milo-calendar.mjs'

const ROOT = dirname(fileURLToPath(import.meta.url))
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' }
const privateDirectories = new Set(['server', 'tests', 'scripts', 'api', 'dist', 'node_modules'])
const json = (response, status, body, headers = {}) => {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers })
    response.end(JSON.stringify(body))
}
const errorMessage = {
    unavailable: 'Milo nhỏ chưa kết nối được rùi 🥺 Amy vẫn chọn date bình thường nha, rồi thử gọi anh lại xíu ♡',
    busy: 'Milo đang trả lời hơi nhiều rùi 🐾 Amy chờ một xíu rồi gọi anh lại nha ♡',
    invalid: 'Tin nhắn hơi dài hoặc chưa đúng định dạng rùi. Amy thử viết ngắn hơn xíu nha ♡',
    cancelled: 'Milo chưa trả lời kịp. Amy thử gọi anh lần nữa nha ♡',
}

async function bodyJSON(request, maxBytes = 64 * 1024) {
    if (!request.headers['content-type']?.startsWith('application/json')) throw new Error('invalid_body')
    // Vercel may have already consumed the stream and populated its body helper.
    if (request.body !== undefined) {
        const raw = typeof request.body === 'string' || Buffer.isBuffer(request.body) ? request.body : JSON.stringify(request.body)
        if (!raw || Buffer.byteLength(raw) > maxBytes) throw new Error('invalid_body')
        try { return JSON.parse(String(raw)) } catch (_) { throw new Error('invalid_body') }
    }
    let size = 0, chunks = []
    for await (const chunk of request) {
        size += chunk.length
        if (size > maxBytes) throw new Error('invalid_body')
        chunks.push(chunk)
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch (_) { throw new Error('invalid_body') }
}

export async function createMiloHandler({ root = ROOT, apiKey = '', model = 'gpt-5.4-mini', webSearch = true, fetchImpl = fetch, rateLimit = 12, sessionSecret = '', personalContext, trustProxy = false, serveStatic = true } = {}) {
    const catalog = await readCatalog(root)
    const forecast = createForecast(fetchImpl)
    // Signed sessions survive cold starts and requests handled by another instance.
    const signingKey = sessionSecret || (apiKey ? createHmac('sha256', apiKey).update('milo-session-key-v1').digest() : randomBytes(32))
    const sign = value => createHmac('sha256', signingKey).update(value).digest('hex')
    const csrfFor = token => sign(`milo-csrf:${token}`).slice(0, 48)
    const readSession = request => {
        const token = request.headers.cookie?.match(/(?:^|;\s*)milo_session=([a-f0-9]{48}\.\d{13}\.[a-f0-9]{64})(?:;|$)/)?.[1]
        if (!token) return null
        const [id, created, signature] = token.split('.')
        const age = Date.now() - Number(created)
        if (age < 0 || age > 6 * 60 * 60 * 1000 || !timingSafeEqual(Buffer.from(signature), Buffer.from(sign(`milo-session:${id}.${created}`)))) return null
        return { token, csrf: csrfFor(token) }
    }
    const limits = new Map()
    let active = 0
    return async (request, response) => {
        response.setHeader('X-Content-Type-Options', 'nosniff')
        response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
        response.setHeader('X-Frame-Options', 'SAMEORIGIN')
        let url
        const secure = !!request.socket.encrypted || (trustProxy && request.headers['x-forwarded-proto'] === 'https')
        try { url = new URL(request.url, `${secure ? 'https' : 'http'}://${request.headers.host}`) } catch (_) { json(response, 400, { error: 'bad_request' }); return }
        if (url.pathname.startsWith('/api/')) {
            // Browsers must use this site's origin; no permissive CORS or exposed key.
            if (request.headers['sec-fetch-site'] === 'cross-site' || (request.headers.origin && request.headers.origin !== url.origin)) {
                json(response, 403, { error: 'origin_not_allowed' }); return
            }
            if (url.pathname === '/api/milo/session' && request.method === 'GET') {
                let session = readSession(request)
                if (!session) {
                    const payload = `${randomBytes(24).toString('hex')}.${Date.now()}`
                    const token = `${payload}.${sign(`milo-session:${payload}`)}`
                    session = { token, csrf: csrfFor(token) }
                }
                json(response, 200, { ready: !!apiKey, csrf: session.csrf }, { 'Set-Cookie': `milo_session=${session.token}; HttpOnly; SameSite=Strict; Path=/api/milo; Max-Age=21600${secure ? '; Secure' : ''}` })
                return
            }
            const isReview = url.pathname === '/api/milo/review'
            if (!isReview && url.pathname !== '/api/milo/chat') { json(response, 404, { error: 'not_found' }); return }
            if (request.method !== 'POST') { json(response, 405, { error: 'method_not_allowed' }, { Allow: 'POST' }); return }
            const session = readSession(request)
            const csrf = request.headers['x-milo-csrf']
            if (!session || typeof csrf !== 'string' || !/^[a-f0-9]{48}$/.test(csrf) || !timingSafeEqual(Buffer.from(csrf), Buffer.from(session.csrf))) {
                json(response, 403, { error: 'session_expired', message: 'Amy mở lại khung chat rồi gọi Milo lần nữa nha ♡' }); return
            }
            if (!apiKey) { json(response, 503, { error: 'not_configured', message: errorMessage.unavailable }); return }
            let input
            try { input = (isReview ? validateReview : validateChat)(await bodyJSON(request, isReview ? 64 * 1024 : MAX_CHAT_BODY_BYTES), catalog) } catch (_) {
                json(response, 400, { error: isReview ? 'invalid_review' : 'invalid_chat', message: isReview ? 'Amy chọn đủ ngày, giờ, quán ăn và ít nhất một hoạt động rồi gọi Milo nha ♡' : errorMessage.invalid }); return
            }
            const now = Date.now(), ip = (trustProxy && request.headers['x-vercel-forwarded-for']?.split(',')[0].trim()) || request.socket.remoteAddress
            for (const [key, limit] of limits) if (now - limit.start > 60000) limits.delete(key)
            let limit = limits.get(ip)
            if (!limit) { limit = { start: now, count: 0 }; limits.set(ip, limit) }
            if (limit.count >= rateLimit || active >= 3) { json(response, 429, { error: 'busy', message: errorMessage.busy }, { 'Retry-After': '30' }); return }
            limit.count++; active++
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 75000)
            const disconnected = () => { if (!response.writableEnded) controller.abort() }
            response.on('close', disconnected)
            try {
                const weather = await forecast(catalog.location)
                if (controller.signal.aborted) throw new Error('aborted')
                const config = { root, catalog, forecast: weather, model, webSearch, personalContext }
                const payload = isReview ? await buildReviewRequest({ ...config, plan: input.plan }) : await buildRequest({ ...config, chat: input })
                const upstream = await fetchImpl('https://api.openai.com/v1/responses', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                    body: JSON.stringify(payload), signal: controller.signal,
                })
                if (!upstream.ok) {
                    // Never return/log upstream bodies: authentication errors can quote keys.
                    console.error(`Milo upstream request failed (HTTP ${upstream.status}).`)
                    await upstream.body?.cancel()
                    json(response, upstream.status === 429 ? 429 : 502, { error: 'upstream_unavailable', message: upstream.status === 429 ? errorMessage.busy : errorMessage.unavailable })
                    return
                }
                const data = await upstream.json()
                const reply = isReview ? extractReview(data, input.plan, catalog) : extractReply(data)
                json(response, 200, reply)
            } catch (_) {
                if (!response.destroyed && !response.writableEnded) json(response, 502, { error: 'reply_unavailable', message: errorMessage.cancelled })
            } finally {
                active--; clearTimeout(timeout); response.removeListener('close', disconnected)
            }
            return
        }
        if (!serveStatic) { json(response, 404, { error: 'not_found' }); return }
        if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return }
        try {
            const pathname = decodeURIComponent(url.pathname)
            const segments = pathname.split(/[\\/]/).filter(Boolean)
            if (segments.some(part => part.startsWith('.') || privateDirectories.has(part)) || pathname.includes('\0')) throw new Error('private')
            let file = resolve(root, '.' + pathname)
            if (pathname.endsWith('/')) file = resolve(file, 'index.html')
            if (!mime[extname(file).toLowerCase()]) throw new Error('private')
            const actualRoot = await realpath(root), actualFile = await realpath(file)
            if (!actualFile.startsWith(actualRoot + sep)) throw new Error('outside_root')
            if (actualFile.slice(actualRoot.length + 1).split(sep).some(part => part.startsWith('.') || privateDirectories.has(part))) throw new Error('private')
            const info = await stat(actualFile)
            if (!info.isFile()) throw new Error('not_file')
            const headers = { 'Content-Type': mime[extname(file).toLowerCase()], 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache', 'Last-Modified': info.mtime.toUTCString() }
            let start = 0, end = info.size - 1, status = 200
            if (request.headers.range) {
                const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range)
                if (!range || (!range[1] && !range[2])) { response.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); response.end(); return }
                start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]))
                end = range[1] && range[2] ? Math.min(Number(range[2]), end) : end
                if (!Number.isSafeInteger(start) || start >= info.size || end < start) { response.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); response.end(); return }
                status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`
            }
            headers['Content-Length'] = Math.max(0, end - start + 1)
            response.writeHead(status, headers)
            if (request.method === 'HEAD' || info.size === 0) response.end()
            else createReadStream(actualFile, { start, end }).on('error', () => response.destroy()).pipe(response)
        } catch (_) { response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Not found') }
    }
}

export async function createMiloServer(options) {
    const server = createServer(await createMiloHandler(options))
    server.requestTimeout = 90000
    return server
}

async function main() {
    // Reuse the .env the user already supplied without copying it into public assets.
    const candidates = process.env.OPENAI_ENV_FILE ? [resolve(process.env.OPENAI_ENV_FILE)] : [resolve(ROOT, '.env'), resolve(ROOT, '../pinkykiki-before-restore-9lr8p6kh/.env')]
    for (const path of candidates) {
        try { process.loadEnvFile(path); break } catch (error) { if (error.code !== 'ENOENT') throw new Error('Could not load the environment file.') }
    }
    const apiKey = process.env.OPENAI_API_KEY || ''
    const port = Number(process.env.PORT || 8000), host = process.env.HOST || '127.0.0.1'
    const server = await createMiloServer({ apiKey, model: process.env.OPENAI_MODEL || 'gpt-5.4-mini', webSearch: process.env.OPENAI_WEB_SEARCH !== 'false', sessionSecret: process.env.MILO_SESSION_SECRET, personalContext: process.env.MILO_PERSONAL_CONTEXT })
    server.on('error', error => { console.error(`Milo server could not start (${error.code || 'server_error'}). Try another PORT.`); process.exitCode = 1 })
    server.listen(port, host, () => {
        console.log(`Amy & Milo: http://${host}:${port}`)
        console.log(`Milo chat: ${apiKey ? 'API key loaded server-side' : 'add OPENAI_API_KEY to .env to enable replies'}`)
    })
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(() => { console.error('Milo server could not start. Check the local .env configuration.'); process.exitCode = 1 })
