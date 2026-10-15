// A vector/text PDF made on Amy's device. Fonts and photos are local assets.
window.AmyDatePDF = (() => {
    let libraries
    const assets = new Map()
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script')
            script.src = src
            script.onload = resolve
            script.onerror = () => { script.remove(); reject(new Error('pdf_library_unavailable')) }
            document.head.append(script)
        })
    }
    async function dependencies() {
        if (!libraries) libraries = Promise.all([
            window.PDFLib ? Promise.resolve() : loadScript('vendor/pdf/pdf-lib.min.js'),
            window.fontkit ? Promise.resolve() : loadScript('vendor/pdf/fontkit.umd.min.js'),
        ]).catch(error => { libraries = null; throw error })
        return libraries
    }
    async function bytes(path) {
        if (!assets.has(path)) assets.set(path, fetch(path).then(response => {
            if (!response.ok) throw new Error('pdf_asset_unavailable')
            return response.arrayBuffer()
        }).catch(error => { assets.delete(path); throw error }))
        return assets.get(path)
    }
    const clean = value => String(value ?? '').normalize('NFC').replace(/[\u2010-\u2015\u2212]/gu, '-').replace(/[\u00a0\u202f]/gu, ' ')
    const safeURL = value => {
        try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null } catch (_) { return null }
    }
    async function embedPhoto(doc, path, preserveTransparency = false) {
        try {
            const data = new Uint8Array(await bytes(path))
            if (data[0] === 0xff && data[1] === 0xd8) return await doc.embedJpg(data)
            if (preserveTransparency && data[0] === 0x89 && data[1] === 0x50) return await doc.embedPng(data)
            // Keep venue photos sharp at postcard size without embedding huge PNGs.
            // Decode WebP too; all original assets remain untouched.
            const url = URL.createObjectURL(new Blob([data]))
            try {
                const image = new Image()
                image.src = url
                await image.decode()
                const canvas = document.createElement('canvas')
                const scale = Math.min(1, 1000 / Math.max(image.naturalWidth, image.naturalHeight))
                canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
                canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
                const context = canvas.getContext('2d')
                context.fillStyle = '#ffffff'
                context.fillRect(0, 0, canvas.width, canvas.height)
                context.drawImage(image, 0, 0, canvas.width, canvas.height)
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .88))
                if (!blob) return null
                return await doc.embedJpg(await blob.arrayBuffer())
            } finally { URL.revokeObjectURL(url) }
        } catch (_) { return null }
    }

    async function create(plan) {
        if (!plan.date || !plan.time?.range || !plan.restaurant || !plan.activities?.length || !plan.stops?.length) throw new Error('incomplete_plan')
        await dependencies()
        const { PDFDocument, rgb, PDFName, PDFString, pushGraphicsState, popGraphicsState, rectangle, clip, endPath } = window.PDFLib
        const doc = await PDFDocument.create()
        doc.registerFontkit(window.fontkit)
        const [regular, bold] = await Promise.all([
            bytes('fonts/NotoSans-Regular.ttf').then(data => doc.embedFont(data, { subset: true })),
            bytes('fonts/Quicksand-Bold.ttf').then(data => doc.embedFont(data, { subset: true })),
        ])
        const [couple, ...photos] = await Promise.all([embedPhoto(doc, 'assets/amy_and_milo.png', true), ...plan.stops.map(stop => embedPhoto(doc, stop.place.photo.src))])
        const W = 595.28, H = 841.89, M = 44, CW = W - M * 2
        const hex = value => rgb(...value.match(/\w\w/g).map(part => parseInt(part, 16) / 255))
        const colors = { ink: hex('704357'), rose: hex('B43F72'), pink: hex('D6769C'), muted: hex('9B7585'), line: hex('EBCFD9'), blush: hex('FFF0F4'), cream: hex('FFF7E8'), paper: hex('FFFDFC'), white: rgb(1, 1, 1), gold: hex('D9AE65') }
        const fontSets = new Map([[regular, new Set(regular.getCharacterSet())], [bold, new Set(bold.getCharacterSet())]])
        function text(page, value, x, top, size = 10, font = regular, color = colors.ink) {
            const content = clean(value)
            if (!Array.from(content).every(char => fontSets.get(font).has(char.codePointAt(0)))) throw new Error('unsupported_pdf_character')
            page.drawText(content, { x, y: H - top - size, size, font, color })
        }
        function wrap(value, width, size = 10, font = regular) {
            const lines = []
            for (const paragraph of clean(value).split('\n')) {
                let line = ''
                for (const word of paragraph.split(/\s+/u).filter(Boolean)) {
                    if (line && font.widthOfTextAtSize(line + ' ' + word, size) > width) { lines.push(line); line = '' }
                    // Long edited words are wrapped too, rather than falling outside the card.
                    for (const char of word) {
                        // Whole-word placement below handles ordinary words; this branch only splits oversized ones.
                        if (font.widthOfTextAtSize(word, size) <= width) break
                        if (font.widthOfTextAtSize(line + char, size) > width && line) { lines.push(line); line = '' }
                        line += char
                    }
                    if (font.widthOfTextAtSize(word, size) <= width) line = line ? line + ' ' + word : word
                }
                lines.push(line)
            }
            return lines
        }
        function paragraph(page, value, x, top, width, size = 10, font = regular, color = colors.ink, leading = size * 1.45) {
            const lines = wrap(value, width, size, font)
            lines.forEach((line, index) => text(page, line, x, top + index * leading, size, font, color))
            return top + lines.length * leading
        }
        function box(page, x, top, width, height, fill, border = colors.line, radius = 12) {
            const r = Math.min(radius, width / 2, height / 2)
            const path = `M${r} 0 H${width - r} Q${width} 0 ${width} ${r} V${height - r} Q${width} ${height} ${width - r} ${height} H${r} Q0 ${height} 0 ${height - r} V${r} Q0 0 ${r} 0 Z`
            page.drawSvgPath(path, { x, y: H - top, color: fill, borderColor: border, borderWidth: .6 })
        }
        function heart(page, x, top, size, color = colors.pink) {
            page.drawSvgPath('M12 21 C10 19 0 12 0 6 C0 -1 9 -2 12 4 C15 -2 24 -1 24 6 C24 12 14 19 12 21 Z', { x, y: H - top, scale: size / 24, color })
        }
        function flower(page, x, top, size) {
            for (let i = 0; i < 5; i++) {
                const angle = i * Math.PI * 2 / 5
                page.drawCircle({ x: x + Math.cos(angle) * size * .52, y: H - top + Math.sin(angle) * size * .52, size: size * .43, color: colors.blush, borderColor: colors.line, borderWidth: .5 })
            }
            page.drawCircle({ x, y: H - top, size: size * .22, color: colors.gold })
        }
        function line(page, x, top, width, color = colors.line) { page.drawLine({ start: { x, y: H - top }, end: { x: x + width, y: H - top }, color, thickness: .6 }) }
        function link(page, value, label, x, top, size = 8, color = colors.rose) {
            const url = safeURL(value)
            if (!url) return
            text(page, label, x, top, size, bold, color)
            const width = bold.widthOfTextAtSize(clean(label), size)
            line(page, x, top + size + 3, width, color)
            const annotation = doc.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [x, H - top - size - 5, x + width, H - top + 4], Border: [0, 0, 0], A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) } })
            page.node.addAnnot(doc.context.register(annotation))
        }
        function centered(page, value, top, size, font = regular, color = colors.ink) { text(page, value, (W - font.widthOfTextAtSize(clean(value), size)) / 2, top, size, font, color) }
        function newPage() {
            const page = doc.addPage([W, H])
            page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: colors.paper })
            box(page, 24, 24, W - 48, H - 48, colors.paper, colors.line, 18)
            text(page, 'AMY  &  MILO', M, 44, 10, bold, colors.rose)
            heart(page, W - M - 13, 43, 13)
            flower(page, 28, 93, 11)
            return page
        }
        function cropPhoto(page, image, x, top, width, height) {
            if (!image) { box(page, x, top, width, height, colors.blush, colors.blush, 0); heart(page, x + width / 2 - 14, top + height / 2 - 12, 28); return }
            const scale = Math.max(width / image.width, height / image.height)
            const drawWidth = image.width * scale, drawHeight = image.height * scale
            page.pushOperators(pushGraphicsState(), rectangle(x, H - top - height, width, height), clip(), endPath())
            page.drawImage(image, { x: x + (width - drawWidth) / 2, y: H - top - height + (height - drawHeight) / 2, width: drawWidth, height: drawHeight })
            page.pushOperators(popGraphicsState())
        }

        const cover = newPage()
        box(cover, M, 81, CW, 174, colors.blush, colors.line, 20)
        text(cover, 'OUR LITTLE FIRST DATE', 65, 102, 8.5, bold, colors.rose)
        text(cover, 'Mình có một', 64, 127, 29, bold, colors.rose)
        text(cover, 'chiếc hẹn xinh.', 64, 162, 29, bold, colors.rose)
        text(cover, 'Ngày này, giờ này, có Amy và Milo.', 66, 214, 9.1, regular, colors.muted)
        cover.drawEllipse({ x: 465, y: H - 167, xScale: 64, yScale: 72, color: colors.white, borderColor: colors.line, borderWidth: .6 })
        if (couple) {
            const scale = Math.min(140 / couple.width, 140 / couple.height)
            cover.drawImage(couple, { x: 465 - couple.width * scale / 2, y: H - 169 - couple.height * scale / 2, width: couple.width * scale, height: couple.height * scale })
        } else heart(cover, 440, 140, 50)
        heart(cover, 516, 112, 14)
        flower(cover, 407, 224, 10)

        const half = (CW - 14) / 2
        box(cover, M, 274, half, 85, colors.white)
        box(cover, M + half + 14, 274, half, 85, colors.white)
        text(cover, 'NGÀY CỦA TỤI MÌNH', M + 16, 288, 8, bold, colors.muted)
        text(cover, plan.date.split('-').reverse().join('.'), M + 16, 306, 22, bold, colors.rose)
        text(cover, plan.dateLabel.split(',')[0], M + 16, 339, 9, regular, colors.muted)
        text(cover, 'DÀNH THỜI GIAN CHO NHAU', M + half + 30, 288, 8, bold, colors.muted)
        text(cover, plan.time.range, M + half + 30, 306, 23, bold, colors.rose)
        text(cover, 'Giờ Virginia (America/New_York)', M + half + 30, 339, 8.2, regular, colors.muted)

        box(cover, M, 375, CW, 77, colors.cream, colors.line, 13)
        text(cover, 'THỜI TIẾT Ở BLACKSBURG', M + 17, 386, 7.5, bold, colors.muted)
        if (plan.weather.day) {
            const day = plan.weather.day
            text(cover, plan.weather.condition, M + 17, 401, 12, bold)
            const finite = Number.isFinite
            const temperatures = finite(day.low) && finite(day.high) ? `${Math.round(day.low)}-${Math.round(day.high)}°C (${Math.round(day.low * 9 / 5 + 32)}-${Math.round(day.high * 9 / 5 + 32)}°F)` : 'Chưa có nhiệt độ'
            const rain = finite(day.rain) ? `Khả năng mưa: ${Math.round(day.rain)}%` : 'Chưa có xác suất mưa'
            text(cover, `${temperatures}  |  ${rain}`, M + 17, 422, 9)
        } else {
            text(cover, 'Dự báo chưa có cho ngày này', M + 17, 402, 11, bold)
            text(cover, 'Mình ngó lại trời gần ngày hẹn nha.', M + 17, 423, 9, regular, colors.muted)
        }
        link(cover, 'https://open-meteo.com/', 'Open-Meteo', W - M - 84, 386, 7.3)
        text(cover, 'Dự báo lúc lưu, có thể thay đổi. Amy mang thêm áo khoác nếu đi tối nha.', M + 4, 459, 7.6, regular, colors.muted)

        text(cover, 'MÌNH ĂN NGON', M, 492, 8, bold, colors.rose)
        const foodBottom = paragraph(cover, plan.restaurant.name, M, 510, CW, 15, bold, colors.ink, 20)
        text(cover, plan.restaurant.place.city, M, foodBottom + 4, 9, regular, colors.muted)
        line(cover, M, 561, CW)
        text(cover, 'RỒI MÌNH CÙNG...', M, 578, 8, bold, colors.rose)
        let activityTop = 600
        for (let i = 0; i < plan.activities.length; i += 2) {
            let rowHeight = 0
            for (let j = 0; j < 2 && i + j < plan.activities.length; j++) {
                const item = plan.activities[i + j], x = M + j * (half + 14)
                heart(cover, x, activityTop + 2, 9, colors.pink)
                const bottom = paragraph(cover, item.name, x + 16, activityTop, half - 16, 10.2, bold, colors.ink, 14)
                rowHeight = Math.max(rowHeight, bottom - activityTop)
            }
            activityTop += rowHeight + 13
        }
        box(cover, M, 712, CW, 60, colors.blush, colors.blush, 14)
        centered(cover, 'Một chút hồi hộp, thật nhiều mong chờ.', 724, 11.4, bold, colors.rose)
        centered(cover, 'See you on our first date, Kiki.', 746, 9, regular, colors.muted)

        for (let start = 0; start < plan.stops.length; start += 4) {
            const page = newPage()
            text(page, 'Những điểm hẹn', M, 84, 27, bold, colors.rose)
            text(page, 'cho tụi mình.', M, 116, 27, bold, colors.rose)
            text(page, 'Chạm Maps để xem đường đi, chạm Menu để ngó thêm nha.', M, 154, 9, regular, colors.muted)
            for (let local = 0; local < 4 && start + local < plan.stops.length; local++) {
                const index = start + local, stop = plan.stops[index]
                const x = M + (local % 2) * (half + 14), top = 187 + Math.floor(local / 2) * 260, cardHeight = 244
                box(page, x, top, half, cardHeight, colors.white)
                cropPhoto(page, photos[index], x + 8, top + 8, half - 16, 83)
                box(page, x + 16, top + 17, 24, 24, colors.rose, colors.white, 12)
                text(page, String(index + 1).padStart(2, '0'), x + 22, top + 23, 9, bold, colors.white)
                let bottom = paragraph(page, stop.place.name, x + 13, top + 101, half - 26, 11.2, bold, colors.ink, 14)
                const labels = stop.labels.filter(label => clean(label) !== clean(stop.place.name))
                if (labels.length) bottom = paragraph(page, labels.join(' / '), x + 13, bottom + 4, half - 26, 7.7, regular, colors.rose, 10)
                paragraph(page, stop.place.address, x + 13, bottom + 7, half - 26, 8.1, regular, colors.muted, 11)
                link(page, stop.place.maps, 'Maps', x + 13, top + 201, 9)
                link(page, stop.place.website, 'Menu / chi tiết', x + 69, top + 201, 9)
                link(page, stop.place.photo.source, `${photos[index] ? 'Ảnh' : 'Xem ảnh gốc'}: ${stop.place.photo.credit}`, x + 13, top + 224, 6.6, colors.muted)
            }
            text(page, 'Ghim trên bản đồ và số trên thẻ là cùng một địa điểm.', M, 726, 8.4, regular, colors.muted)
            text(page, 'Mình kiểm tra giờ mở cửa, suất chiếu và đường đi trước khi hẹn nha.', M, 742, 8.4, regular, colors.muted)
            heart(page, W - M - 18, 742, 18)
        }
        const pageCount = doc.getPageCount()
        doc.getPages().forEach((page, index) => {
            line(page, M, 792, CW)
            text(page, 'from Milo, with love.', M, 802, 8, bold, colors.rose)
            const saved = new Intl.DateTimeFormat('vi-VN', { timeZone: 'America/New_York', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(plan.savedAt))
            text(page, `Lưu ${saved} (Virginia)`, 214, 803, 6.8, regular, colors.muted)
            text(page, `${String(index + 1).padStart(2, '0')} / ${String(pageCount).padStart(2, '0')}`, W - M - 33, 802, 8, bold, colors.rose)
        })
        doc.setTitle(`Amy & Milo - Lịch hẹn ${plan.date}`)
        doc.setAuthor('Amy & Milo')
        doc.setSubject('A little first date, chosen by Amy')
        doc.setCreator('Amy & Milo date planner')
        doc.setLanguage('vi-VN')
        return { bytes: await doc.save(), filename: `Amy-va-Milo-date-${plan.date}.pdf` }
    }

    async function download(plan) {
        const result = await create(plan)
        const url = URL.createObjectURL(new Blob([result.bytes], { type: 'application/pdf' }))
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = result.filename
        anchor.hidden = true
        document.body.append(anchor)
        anchor.click()
        anchor.remove()
        setTimeout(() => URL.revokeObjectURL(url), 60000)
        return result.filename
    }
    return { create, download }
})()
