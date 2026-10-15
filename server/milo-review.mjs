import { buildRequest, validateChat, extractReply, safeURL } from './milo.mjs'

// Only complete catalog selections can be reviewed or proposed. Browser labels
// and model-provided operations never become instructions or executable changes.
export function normalizePlan(value, catalog) {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        !catalog.dates.includes(value.date) ||
        !catalog.timeWindows.some(item => item.id === value.time) ||
        !catalog.restaurants.some(item => item.id === value.restaurant) ||
        !Array.isArray(value.activities) || !value.activities.length ||
        value.activities.length > catalog.activities.length ||
        new Set(value.activities).size !== value.activities.length ||
        value.activities.some(id => !catalog.activities.some(item => item.id === id))) throw new Error('invalid_plan')
    return {
        date: value.date, time: value.time, restaurant: value.restaurant,
        activities: catalog.activities.filter(item => value.activities.includes(item.id)).map(item => item.id),
    }
}

export const planKey = plan => JSON.stringify([plan.date, plan.time, plan.restaurant, [...plan.activities].sort()])

export function validateReview(body, catalog) {
    return { plan: normalizePlan(body?.plan, catalog) }
}

export async function buildReviewRequest({ plan, ...config }) {
    const chat = validateChat({ context: { ...plan, step: 4 }, messages: [{ role: 'user', content: 'Review the completed date plan. Kiểm tra giờ mở cửa của các điểm đã chọn nếu có thể, rồi góp ý một điều hữu ích cho Kiki.' }] }, config.catalog)
    const payload = await buildRequest({ ...config, chat })
    const id = items => ({ type: 'string', enum: items.map(item => item.id) })
    const suggestion = {
        type: 'object', additionalProperties: false,
        properties: {
            title: { type: 'string' }, reason: { type: 'string' },
            plan: {
                type: 'object', additionalProperties: false,
                properties: {
                    date: { type: 'string', enum: config.catalog.dates },
                    time: id(config.catalog.timeWindows), restaurant: id(config.catalog.restaurants),
                    activities: { type: 'array', minItems: 1, maxItems: config.catalog.activities.length, items: id(config.catalog.activities) },
                },
                required: ['date', 'time', 'restaurant', 'activities'],
            },
        },
        required: ['title', 'reason', 'plan'],
    }
    payload.max_output_tokens = 3200
    payload.reasoning = { effort: 'low' }
    payload.text = { format: {
        type: 'json_schema', name: 'milo_date_review', strict: true,
        schema: {
            type: 'object', additionalProperties: false,
            properties: {
                comment: { type: 'string' },
                suggestion: { anyOf: [suggestion, { type: 'null' }] },
                sources: { type: 'array', maxItems: 8, items: {
                    type: 'object', additionalProperties: false,
                    properties: { title: { type: 'string' }, url: { type: 'string' } }, required: ['title', 'url'],
                } },
            }, required: ['comment', 'suggestion', 'sources'],
        },
    } }
    payload.instructions += `\n\nFINAL-PLAN REVIEW TASK (takes precedence over the chat-only interaction rules):
Review this completed plan, do not ask Amy to choose a vibe again. Write a warm, useful Vietnamese comment of about 80–140 words, a little cute bark optional. Consider her stated interests, the actual selected time window, weather, venue clusters, and travel. Briefly say what works and any realistic concern. The UI labels you AI Milo.
First check feasibility against the FULL set of selected activities: night is ONLY 2 hours (9–11 PM), noon/afternoon/evening are 3 hours, and six-noon/six-afternoon are 6 hours. Dinner plus a full cinema visit plus shopping plus a separate-town stop cannot reasonably fit a two-hour window. Do not call an overloaded plan feasible just because one restaurant is open during part of it. A cinema's opening hours are not proof of a fitting showtime or runtime; movie times/films may be unpublished. Check shopping hours when shopping is selected. Clearly flag a time/capacity conflict in comment and offer a minimal useful adjustment rather than simply praising the plan.
You may PROPOSE one small coherent adjustment using ONLY catalog IDs, but you cannot apply it. Amy must click the popup's "Agree with this suggestion" first. Return the ENTIRE proposed plan, preserving every selection you do not explicitly need to change. Prefer changing just one field or one activity. Do not replace Amy's favorite restaurant merely to optimize distance, add a long list of activities, or force a six-hour date. Keep the selected date; change time only to address a clear capacity or verified opening-hours issue, and explain that Amy should confirm availability. Give a short suggestion title (under 90 characters) and specific reason (under 450 characters). A proposal must differ from the current plan.
If the current plan already works, use suggestion:null and give a helpful practical tip in comment instead of manufacturing changes. Jacket, transport, tickets, budget, menu, art leads outside the picker, and questions are comment-only tips, not invented editable fields. Never imply a reservation or exact schedule has been confirmed. Don't promise the human Milo's availability or actions.
Use the server forecast only. Missing weather stays unknown. When using weather, include https://open-meteo.com/ in sources; a restaurant page is NEVER evidence of weather. Target web searches to SELECTED venues' official opening hours or relevant constraints, not broad tourism research or unselected venues. Cite only pages actually supplied or found, list their full safe URLs with readable source titles in sources. For any weekly opening hours, explicitly write "giờ thường lệ"; never present those as confirmed for October 2026 or as a verified showtime. A page lacking showtimes for the selected date means "chưa xác nhận được suất chiếu", NEVER that there are no screenings in that window. If unavailable, say so. Avoid uncited claims about current prices/showtimes, and don't invent walking routes or transport. Sources are displayed beside your comment. Plain text, no HTML, no raw citation control tokens or Markdown formatting inside the JSON strings.
CURRENT PLAN IDS: ${JSON.stringify(plan)}`
    return payload
}

export function extractReview(data, basePlan, catalog) {
    if (data.status === 'incomplete' || data.error) throw new Error('incomplete_review')
    const reply = extractReply(data)
    const text = reply.parts.map(part => part.text).join('')
    let result
    try { result = JSON.parse(text) } catch (_) { throw new Error('invalid_review') }
    const bounded = (value, max) => {
        if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('invalid_review')
        return value.trim()
    }
    const comment = bounded(result.comment, 4000)
    let suggestion = null
    if (result.suggestion !== null) {
        const value = result.suggestion
        if (!value || typeof value !== 'object') throw new Error('invalid_review')
        const plan = normalizePlan(value.plan, catalog)
        if (planKey(plan) !== planKey(basePlan)) suggestion = { title: bounded(value.title, 160), reason: bounded(value.reason, 1000), plan }
    }
    if (!Array.isArray(result.sources) || result.sources.length > 8) throw new Error('invalid_review')
    const sources = new Map()
    for (const item of [...result.sources, ...reply.sources]) {
        const url = safeURL(item?.url)
        if (url) sources.set(url, { url, title: String(item.title || new URL(url).hostname).slice(0, 200) })
    }
    return { basePlan, comment, suggestion, sources: [...sources.values()].slice(0, 8), searched: reply.searched, reviewedAt: new Date().toISOString() }
}
