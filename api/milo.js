import { createMiloHandler } from '../server.mjs'

let handlerPromise

export default async function milo(request, response) {
    const url = new URL(request.url, 'http://localhost')
    const action = url.searchParams.get('action')
    if (!['session', 'chat', 'review'].includes(action)) {
        response.writeHead(404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        response.end(JSON.stringify({ error: 'not_found' }))
        return
    }
    request.url = `/api/milo/${action}`
    if (!handlerPromise) {
        handlerPromise = createMiloHandler({
            apiKey: process.env.OPENAI_API_KEY || '',
            model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
            webSearch: process.env.OPENAI_WEB_SEARCH !== 'false',
            sessionSecret: process.env.MILO_SESSION_SECRET,
            personalContext: process.env.MILO_PERSONAL_CONTEXT,
            trustProxy: process.env.VERCEL === '1',
            serveStatic: false,
        }).catch(error => { handlerPromise = undefined; throw error })
    }
    return (await handlerPromise)(request, response)
}
