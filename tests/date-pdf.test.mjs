import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import vm from 'node:vm'

const ROOT = resolve(import.meta.dirname, '..')
globalThis.window = globalThis
for (const name of ['vendor/pdf/pdf-lib.min.js', 'vendor/pdf/fontkit.umd.min.js', 'date-options.js', 'date-pdf.js']) vm.runInThisContext(await readFile(resolve(ROOT, name), 'utf8'), { filename: name })
globalThis.fetch = async path => {
    try { return new Response(await readFile(resolve(ROOT, String(path)))) } catch (_) { return new Response('', { status: 404 }) }
}
const options = DATE_OPTIONS
function plan(restaurantId, activityIds) {
    const restaurant = options.restaurants.find(item => item.id === restaurantId)
    const activities = options.activities.filter(item => activityIds.includes(item.id))
    const stops = new Map()
    for (const item of [restaurant, ...activities]) {
        if (!stops.has(item.placeId)) stops.set(item.placeId, { id: item.placeId, place: options.places[item.placeId], labels: [] })
        stops.get(item.placeId).labels.push(item.name)
    }
    return JSON.parse(JSON.stringify({ date: '2026-10-17', dateLabel: 'Thứ Bảy, 17 tháng 10, 2026', time: options.timeWindows.find(item => item.id === 'six-afternoon'), restaurant: { ...restaurant, place: options.places[restaurant.placeId] }, activities, stops: [...stops.values()], weather: { day: { code: 63, low: 8, high: 15, rain: 90 }, condition: 'Có mưa' }, savedAt: '2026-10-16T01:05:00Z' }))
}
function links(doc) {
    const urls = []
    for (const page of doc.getPages()) {
        const annotations = page.node.lookup(PDFLib.PDFName.of('Annots'), PDFLib.PDFArray)
        for (let index = 0; index < annotations.size(); index++) {
            const annotation = annotations.lookup(index, PDFLib.PDFDict)
            const rect = annotation.lookup(PDFLib.PDFName.of('Rect'), PDFLib.PDFArray).asArray().map(value => value.asNumber())
            assert.ok(rect[0] >= 0 && rect[1] >= 0 && rect[2] <= page.getWidth() && rect[3] <= page.getHeight(), 'link remains inside the page')
            const action = annotation.lookup(PDFLib.PDFName.of('A'), PDFLib.PDFDict)
            urls.push(action.lookup(PDFLib.PDFName.of('URI')).decodeText())
        }
    }
    return urls
}

test('downloads a readable A4 document with selected links and one shared Squires card', async () => {
    const selected = plan('baan', ['cafe', 'piano', 'bowling'])
    const result = await AmyDatePDF.create(selected)
    const doc = await PDFLib.PDFDocument.load(result.bytes)
    assert.equal(result.filename, 'Amy-va-Milo-date-2026-10-17.pdf')
    assert.equal(doc.getPageCount(), 2)
    assert.match(doc.getTitle(), /2026-10-17/)
    assert.equal(doc.catalog.lookup(PDFLib.PDFName.of('Lang')).decodeText(), 'vi-VN')
    assert.ok(Math.abs(doc.getPages()[0].getWidth() - 595.28) < .01)
    const urls = links(doc)
    assert.ok(urls.includes('https://open-meteo.com/'))
    for (const stop of selected.stops) assert.ok(urls.includes(stop.place.maps), stop.place.name)
    assert.equal(urls.filter(url => url === options.places.squires.maps).length, 1)
    assert.ok(!urls.includes(options.places.regal.maps), 'unselected locations are not exported')
})

test('all seven activities including Hahn Garden paginate cleanly across three pages', async () => {
    const selected = plan('avellinos', options.activities.map(item => item.id))
    const doc = await PDFLib.PDFDocument.load((await AmyDatePDF.create(selected)).bytes)
    assert.equal(selected.stops.length, 7)
    assert.equal(doc.getPageCount(), 3)
    const urls = links(doc)
    assert.equal(urls.filter(url => url === options.places.squires.maps).length, 1)
    for (const stop of selected.stops) assert.ok(urls.includes(stop.place.maps), stop.place.name)
})

test('unavailable weather and a failed photo still produce a complete document', async () => {
    const selected = plan('sakura', ['movie'])
    selected.weather = { day: null, condition: null }
    selected.stops[0].place.photo.src = 'assets/not-a-real-photo.jpg'
    const doc = await PDFLib.PDFDocument.load((await AmyDatePDF.create(selected)).bytes)
    assert.equal(doc.getPageCount(), 2)
    assert.ok(links(doc).includes(options.places.sakura.maps))
    await assert.rejects(AmyDatePDF.create({ ...selected, activities: [] }), /incomplete_plan/)
})
