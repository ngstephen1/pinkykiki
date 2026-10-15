(() => {
    if (!window.AmyAuth.isAuthenticated() || !window.AmyState.hasMilo()) return
    const options = window.DATE_OPTIONS
    const form = document.getElementById('date-form')
    const nextButton = document.getElementById('next-step')
    const backButton = document.getElementById('back-step')
    const recap = document.getElementById('recap')
    const retryButton = document.getElementById('weather-retry')
    const weatherStatus = document.getElementById('weather-status')
    const weatherDialog = document.getElementById('weather-dialog')
    const stepper = document.querySelector('.stepper')
    const validId = (items, value) => items.some(item => item.id === value) ? value : ''
    const saved = window.AmyState.getDraft() || {}
    const state = {
        date: options.dates.includes(saved.date) ? saved.date : '',
        time: validId(options.timeWindows, saved.time),
        restaurant: validId(options.restaurants, saved.restaurant),
        activities: Array.isArray(saved.activities) ? [...new Set(saved.activities)].filter(id => validId(options.activities, id)) : [],
        step: Number.isInteger(saved.step) ? Math.max(0, Math.min(4, saved.step)) : 0,
    }
    const complete = () => [!!state.date, !!state.time, !!state.restaurant, state.activities.length > 0]
    const firstMissing = complete().findIndex(value => !value)
    if (firstMissing !== -1) state.step = Math.min(state.step, firstMissing)
    let weather = new Map()
    let weatherLoading = true
    let weatherFailed = false
    let weatherTask = Promise.resolve()
    let pendingWeatherDate = ''
    let weatherPopupTimer

    function node(tag, className, text) {
        const element = document.createElement(tag)
        if (className) element.className = className
        if (text !== undefined) element.textContent = text
        return element
    }

    // ISO calendar dates are formatted as calendar dates, never shifted by UTC offsets.
    function dateObject(iso) {
        const [year, month, day] = iso.split('-').map(Number)
        return new Date(Date.UTC(year, month - 1, day))
    }
    function formatDate(iso, style = 'long') {
        return new Intl.DateTimeFormat('vi-VN', {
            timeZone: 'UTC', weekday: 'long',
            ...(style === 'long' ? { day: 'numeric', month: 'long', year: 'numeric' } : {}),
        }).format(dateObject(iso))
    }

    function choice(name, value, multiple = false) {
        const label = node('label', 'choice-card')
        label.dataset.id = value
        const input = document.createElement('input')
        input.type = multiple ? 'checkbox' : 'radio'
        input.name = name
        input.value = value
        input.checked = multiple ? state.activities.includes(value) : state[name] === value
        const mark = node('span', 'choice-mark', '✓')
        mark.setAttribute('aria-hidden', 'true')
        label.append(input, mark)
        return label
    }

    function externalLink(url, text, className = '') {
        const link = node('a', className, text)
        link.href = url
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        return link
    }

    function venueChoice(name, item) {
        const place = options.places[item.placeId]
        const card = node('article', 'venue-card')
        const label = choice(name, item.id, name === 'activities')
        label.classList.add('photo-choice')
        label.querySelector('input').setAttribute('aria-label', item.name)
        const picture = node('span', 'venue-picture')
        const image = node('img')
        image.src = place.photo.src
        image.alt = place.photo.alt
        image.loading = 'lazy'
        image.decoding = 'async'
        image.width = 600
        image.height = 380
        image.addEventListener('error', () => {
            image.hidden = true
            picture.append(node('span', 'photo-fallback', `${item.emoji} ${place.name}`))
        }, { once: true })
        picture.append(image, node('span', 'venue-city', place.city))
        const content = node('span', 'venue-content')
        content.append(node('span', 'venue-kicker', item.tag), node('span', 'option-name', item.name), node('span', 'option-detail', item.detail), node('span', 'option-area', `📍 ${place.cluster}`))
        label.append(picture, content)
        const links = node('div', 'venue-links')
        links.append(externalLink(place.maps, 'Maps ↗'), externalLink(item.website || place.website, name === 'restaurant' ? 'Menu & chi tiết ↗' : 'Chi tiết ↗'))
        const credit = externalLink(place.photo.source, `${place.photo.kind} ↗`, 'venue-photo-credit')
        credit.setAttribute('aria-label', `Nguồn ảnh ${item.name}: ${place.photo.credit}`)
        card.append(label, links, credit)
        return card
    }

    for (const date of options.dates) {
        const label = choice('date', date)
        label.classList.add('date-card')
        const [, month, day] = date.split('-').map(Number)
        label.append(node('span', 'weekday', formatDate(date, 'weekday')), node('strong', 'day-number', day), node('span', 'month', `tháng ${month}`))
        const forecast = node('span', 'date-weather')
        forecast.dataset.weatherDate = date
        label.append(forecast)
        document.getElementById('date-choices').append(label)
    }

    // Group Christiansburg cards first while preserving each city's original order.
    const christiansburgFirst = items => [...items].sort((left, right) =>
        Number(options.places[right.placeId]?.city === 'Christiansburg') -
        Number(options.places[left.placeId]?.city === 'Christiansburg'))
    const groups = [
        ['time', options.timeWindows, 'time-choices'],
        ['restaurant', christiansburgFirst(options.restaurants), 'restaurant-choices'],
        ['activities', christiansburgFirst(options.activities), 'activity-choices'],
    ]
    for (const [name, items, container] of groups) {
        for (const item of items) {
            if (item.placeId && options.places[item.placeId]) {
                document.getElementById(container).append(venueChoice(name, item))
                continue
            }
            const label = choice(name, item.id, name === 'activities')
            const emoji = node('span', 'option-emoji', item.emoji)
            emoji.setAttribute('aria-hidden', 'true')
            label.append(emoji, node('span', 'option-name', item.name))
            if (item.range) label.append(node('strong', 'option-range', item.range))
            label.append(node('span', 'option-detail', item.detail))
            if (item.area) label.append(node('span', 'option-area', item.area))
            if (item.placeholder) label.append(node('span', 'placeholder-note', 'Chưa chốt tên quán'))
            document.getElementById(container).append(label)
        }
    }
    document.getElementById('location-label').textContent = options.location.name

    function persist() {
        window.AmyState.saveDraft({ ...state, activities: [...state.activities] })
        window.dispatchEvent(new CustomEvent('amy:planner-context'))
    }
    function updateNavigation() {
        const completed = complete()
        const firstIncomplete = completed.findIndex(value => !value)
        const availableStep = firstIncomplete === -1 ? 3 : firstIncomplete
        stepper.querySelectorAll('li').forEach(item => {
            const step = Number(item.dataset.step)
            const button = item.querySelector('.step-button')
            item.classList.toggle('done', completed[step])
            item.classList.toggle('is-current', step === state.step)
            button.disabled = step > availableStep
            if (step === state.step) button.setAttribute('aria-current', 'step')
            else button.removeAttribute('aria-current')
        })
        nextButton.disabled = !completed[state.step]
        nextButton.textContent = state.step === 3 ? 'Xem lịch hẹn 💗' : 'Tiếp nè ♡ →'
        backButton.hidden = state.step === 0
        document.getElementById('step-count').textContent = `${Math.min(state.step + 1, 4)} / 4`
    }
    function showStep(focus = false) {
        if (state.step !== 0) {
            pendingWeatherDate = ''
            clearTimeout(weatherPopupTimer)
            if (weatherDialog.open) weatherDialog.close()
        }
        const isRecap = state.step === 4
        form.hidden = isRecap
        recap.hidden = !isRecap
        document.querySelectorAll('[data-panel]').forEach(panel => { panel.hidden = Number(panel.dataset.panel) !== state.step })
        updateNavigation()
        if (isRecap) {
            renderRecap()
            window.AmyDateMap.render(selectedStops())
        }
        if (focus) {
            const heading = isRecap ? document.getElementById('recap-title') : document.querySelector(`[data-panel="${state.step}"] h2`)
            heading.focus({ preventScroll: true })
            heading.scrollIntoView({ block: 'start', behavior: 'auto' })
        }
        persist()
    }
    form.addEventListener('submit', event => event.preventDefault())
    form.addEventListener('change', event => {
        const input = event.target
        if (input.name === 'activities') state.activities = [...form.querySelectorAll('input[name="activities"]:checked')].map(item => item.value)
        else if (['date', 'time', 'restaurant'].includes(input.name)) state[input.name] = input.value
        updateNavigation()
        updateRainHint()
        persist()
        if (input.name === 'date') requestWeatherPopup(input.value)
    })
    // A checked radio does not fire change again; let Amy revisit its weather too.
    document.getElementById('date-choices').addEventListener('click', event => {
        if (event.target.matches('input[name="date"]')) requestWeatherPopup(event.target.value)
    })
    nextButton.addEventListener('click', () => {
        if (complete()[state.step]) { state.step++; showStep(true) }
    })
    backButton.addEventListener('click', () => { state.step = Math.max(0, state.step - 1); showStep(true) })
    function clearRecapFeedback() {
        document.getElementById('copy-status').textContent = ''
        document.getElementById('manual-copy').hidden = true
        document.getElementById('manual-copy').value = ''
        document.getElementById('manual-copy-label').hidden = true
        document.getElementById('pdf-status').hidden = true
    }
    stepper.addEventListener('click', event => {
        const button = event.target.closest('.step-button')
        if (!button || button.disabled) return
        const step = Number(button.closest('li').dataset.step)
        if (step === state.step) return
        state.step = step
        clearRecapFeedback()
        showStep(true)
    })
    document.getElementById('edit-choices').addEventListener('click', () => {
        state.step = 0
        clearRecapFeedback()
        showStep(true)
    })

    function weatherCondition(code) {
        if (code === 0) return ['☀️', 'Trời nắng']
        if (code === 1) return ['🌤️', 'Nắng nhẹ']
        if (code === 2) return ['⛅', 'Nắng xen mây']
        if (code === 3) return ['☁️', 'Nhiều mây']
        if ([45, 48].includes(code)) return ['🌫️', 'Sương mù']
        if ([51, 53, 55, 56, 57].includes(code)) return ['🌦️', 'Mưa phùn']
        if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return ['🌧️', 'Có mưa']
        if ([71, 73, 75, 77, 85, 86].includes(code)) return ['❄️', 'Có tuyết']
        if ([95, 96, 99].includes(code)) return ['⛈️', 'Mưa giông']
        return ['☁️', 'Chưa rõ thời tiết']
    }
    const fahrenheit = value => Math.round(value * 9 / 5 + 32)
    function forecastText(date) {
        const day = weather.get(date)
        if (!day) return weatherLoading ? 'Đang ngó trời nè…' : weatherFailed ? 'Chưa tải được dự báo' : 'Dự báo chưa có cho ngày này'
        const [icon, condition] = weatherCondition(day.code)
        const temperatures = Number.isFinite(day.low) && Number.isFinite(day.high)
            ? `${Math.round(day.low)}–${Math.round(day.high)}°C (${fahrenheit(day.low)}–${fahrenheit(day.high)}°F)` : 'Chưa có nhiệt độ'
        const rain = Number.isFinite(day.rain) ? `Khả năng mưa ${Math.round(day.rain)}%` : 'Chưa có xác suất mưa'
        return `${icon} ${condition} · ${temperatures} · ${rain}`
    }
    function weatherMood(day) {
        if (!day) return null
        // Snow and unknown forecasts must never be presented as sunny weather.
        if ([71, 73, 75, 77, 85, 86].includes(day.code)) return null
        const wetCodes = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]
        if (wetCodes.includes(day.code) || (Number.isFinite(day.rain) && day.rain >= 30)) return 'rain'
        if ([0, 1, 2, 3, 45, 48].includes(day.code)) return 'sun'
        return null
    }
    function requestWeatherPopup(date) {
        pendingWeatherDate = date
        clearTimeout(weatherPopupTimer)
        // Wait for the radio's click/change sequence to finish saving the choice.
        weatherPopupTimer = setTimeout(showWeatherPopup, 0)
    }
    function showWeatherPopup() {
        if (!pendingWeatherDate || weatherLoading) return
        if (state.step !== 0 || state.date !== pendingWeatherDate) {
            pendingWeatherDate = ''
            return
        }
        const mood = weatherMood(weather.get(pendingWeatherDate))
        if (!mood) {
            // A failed request may be retried, but a missing forecast is not a sunny day.
            if (!weatherFailed) pendingWeatherDate = ''
            return
        }
        if (document.querySelector('dialog[open]')) return
        pendingWeatherDate = ''
        const rainy = mood === 'rain'
        weatherDialog.dataset.mood = mood
        document.getElementById('weather-popup-title').textContent = rainy ? 'cảnh báo có mưa rơi tí tách' : 'nắng chiếu lung linh'
        document.getElementById('weather-popup-date').textContent = formatDate(state.date)
        document.getElementById('weather-popup-forecast').textContent = forecastText(state.date)
        document.getElementById('weather-popup-note').textContent = rainy
            ? 'Kiki mang áo ấm nha, Milo lo chiếc ô ♡ Café, phim hay shopping trong nhà vẫn cute lắm nè.'
            : 'Một chút sunshine cho chiếc hẹn của tụi mình ♡ Ngó dự báo bên trên nha: trời vẫn có thể có mây hoặc đổi ý đó.'
        document.getElementById('weather-popup-still').srcset = `gifs/weather-${mood}-still.png`
        document.getElementById('weather-popup-gif').src = `gifs/weather-${mood}.gif`
        weatherDialog.showModal()
    }
    for (const id of ['weather-popup-close', 'weather-popup-keep']) {
        document.getElementById(id).addEventListener('click', () => weatherDialog.close())
    }
    function updateRainHint() {
        document.getElementById('rain-hint').hidden = weatherMood(weather.get(state.date)) !== 'rain'
    }
    function renderWeather() {
        document.querySelectorAll('[data-weather-date]').forEach(container => {
            const day = weather.get(container.dataset.weatherDate)
            container.replaceChildren()
            if (!day) {
                container.append(node('span', 'weather-condition', weatherLoading ? '☁️ Đang xem trời…' : weatherFailed ? '☁️ Chưa tải được' : '☁️ Chưa có dự báo'))
                return
            }
            const [icon, condition] = weatherCondition(day.code)
            container.append(node('span', 'weather-condition', `${icon} ${condition}`))
            if (Number.isFinite(day.low) && Number.isFinite(day.high)) {
                container.append(node('span', 'weather-temperatures', `${Math.round(day.low)}–${Math.round(day.high)}°C`), node('span', 'weather-imperial', `${fahrenheit(day.low)}–${fahrenheit(day.high)}°F`))
            } else container.append(node('span', 'weather-temperatures', 'Chưa có nhiệt độ'))
            if (Number.isFinite(day.rain)) container.append(node('span', 'weather-rain', `Mưa ${Math.round(day.rain)}%`))
        })
        updateRainHint()
        if (state.step === 4) renderRecap()
    }
    async function loadWeather() {
        weatherLoading = true
        weatherFailed = false
        retryButton.hidden = true
        retryButton.disabled = true
        weatherStatus.textContent = 'Đang ngó trời giúp Amy nè… ☁️'
        renderWeather()
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000)
        try {
            const params = new URLSearchParams({
                latitude: options.location.latitude, longitude: options.location.longitude,
                daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
                forecast_days: '16', timezone: options.location.timezone, temperature_unit: 'celsius',
            })
            const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal })
            if (!response.ok) throw new Error('Weather unavailable')
            const data = await response.json()
            if (!Array.isArray(data.daily?.time)) throw new Error('Invalid forecast')
            weather = new Map(data.daily.time.map((date, index) => [date, {
                code: data.daily.weather_code?.[index], low: data.daily.temperature_2m_min?.[index],
                high: data.daily.temperature_2m_max?.[index], rain: data.daily.precipitation_probability_max?.[index],
            }]))
            weatherStatus.textContent = 'Dự báo ở Blacksburg · trời có thể đổi, thương Amy thì hong ♡'
        } catch (_) {
            weatherFailed = true
            weather = new Map()
            weatherStatus.textContent = 'Chưa xem được trời hôm ấy. Amy cứ chọn ngày nha ♡'
            retryButton.hidden = false
        } finally {
            clearTimeout(timeout)
            weatherLoading = false
            retryButton.disabled = false
            renderWeather()
            showWeatherPopup()
        }
    }
    retryButton.addEventListener('click', () => { weatherTask = loadWeather() })

    function chosen() {
        return {
            time: options.timeWindows.find(item => item.id === state.time),
            restaurant: options.restaurants.find(item => item.id === state.restaurant),
            activities: options.activities.filter(item => state.activities.includes(item.id)),
        }
    }
    // Two activities in Squires share one pin and retain both activity labels.
    function selectedStops() {
        const selected = chosen()
        const stops = new Map()
        for (const item of [selected.restaurant, ...selected.activities]) {
            const place = options.places[item?.placeId]
            if (!place) continue
            if (!stops.has(item.placeId)) stops.set(item.placeId, { id: item.placeId, place, labels: [] })
            stops.get(item.placeId).labels.push(item.name)
        }
        return [...stops.values()]
    }
    function renderRecap() {
        const selected = chosen()
        if (!complete().every(Boolean)) return
        const details = document.getElementById('recap-details')
        details.replaceChildren()
        const rows = [
            ['Ngày hẹn 🌷', formatDate(state.date)],
            ['Thời gian ♡', `${selected.time.range}`, 'Giờ Virginia · ' + selected.time.name],
            ['Món ngon 🍜', selected.restaurant.name, options.places[selected.restaurant.placeId]?.address],
            ['Rồi mình… ✨', selected.activities.map(item => `${item.emoji} ${item.name}`).join(' → ')],
        ]
        for (const [title, value, note] of rows) {
            const row = node('div')
            const content = node('dd', '', value)
            if (note) content.append(node('small', '', note))
            row.append(node('dt', '', title), content)
            details.append(row)
        }
        document.getElementById('recap-weather').textContent = `Dự báo ở Blacksburg: ${forecastText(state.date)}`
    }
    function itineraryText() {
        const selected = chosen()
        return [
            'Một chiếc hẹn của Amy & Milo 💗',
            `🌷 ${formatDate(state.date)}`,
            `🕰 ${selected.time.range} · giờ Virginia (America/New_York)`,
            `📍 ${options.location.name}`,
            `🍜 ${selected.restaurant.name}`,
            `✨ ${selected.activities.map(item => item.name).join(' → ')}`,
            '', 'Các điểm hẹn 📍',
            ...selectedStops().map((stop, index) => `${index + 1}. ${stop.place.name}\n${stop.place.address}\n${stop.place.maps}`),
            '',
            `Dự báo ở Blacksburg: ${forecastText(state.date)}`,
            '', 'See you on our first date, Amy. 💌',
        ].join('\n')
    }
    document.getElementById('download-pdf').addEventListener('click', async () => {
        if (state.step !== 4 || !complete().every(Boolean)) return
        const button = document.getElementById('download-pdf')
        const status = document.getElementById('pdf-status')
        if (button.disabled) return
        // Capture exactly what Amy clicked to save, even if she edits while it builds.
        const selected = chosen()
        const date = state.date
        const plan = JSON.parse(JSON.stringify({
            date, dateLabel: formatDate(date), time: selected.time,
            restaurant: { ...selected.restaurant, place: options.places[selected.restaurant.placeId] },
            activities: selected.activities, stops: selectedStops(), savedAt: new Date().toISOString(),
        }))
        button.disabled = true
        button.setAttribute('aria-busy', 'true')
        button.textContent = 'Đang gói chiếc hẹn…'
        status.textContent = 'Đợi anh xíu, Milo đang gói lịch hẹn thành PDF cho Amy ♡'
        status.hidden = false
        try {
            await weatherTask
            const day = weather.get(date)
            plan.weather = { day: day || null, condition: day ? weatherCondition(day.code)[1] : null }
            await window.AmyDatePDF.download(plan)
            status.textContent = 'PDF xinh sẵn rồiii! Amy giữ lại làm kỷ niệm nha ♡'
        } catch (_) {
            status.textContent = 'Chưa gói được PDF rùi 🥺 Amy thử bấm tải lại xíu nha.'
        } finally {
            button.disabled = false
            button.removeAttribute('aria-busy')
            button.textContent = 'Tải PDF xinh ♡'
        }
    })
    document.getElementById('copy-itinerary').addEventListener('click', async () => {
        const text = itineraryText()
        const status = document.getElementById('copy-status')
        try {
            if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
            await navigator.clipboard.writeText(text)
            status.textContent = 'Copy rồiii! Amy gửi chiếc lịch hẹn này cho anh nha 💌'
            document.getElementById('manual-copy').hidden = true
            document.getElementById('manual-copy-label').hidden = true
        } catch (_) {
            const field = document.getElementById('manual-copy')
            field.value = text
            field.hidden = false
            document.getElementById('manual-copy-label').hidden = false
            status.textContent = 'Amy chọn đoạn bên dưới rồi copy thủ công nha ♡'
            field.focus()
            field.select()
        }
    })
    // The review can propose catalog choices, but only Amy's explicit acceptance
    // calls this bridge. Check the original snapshot again before committing.
    function reviewPlan(value) {
        if (!value || !options.dates.includes(value.date) || !validId(options.timeWindows, value.time) ||
            !validId(options.restaurants, value.restaurant) || !Array.isArray(value.activities) ||
            !value.activities.length || value.activities.length > options.activities.length ||
            new Set(value.activities).size !== value.activities.length ||
            value.activities.some(id => !validId(options.activities, id))) return null
        return { date: value.date, time: value.time, restaurant: value.restaurant,
            activities: options.activities.filter(item => value.activities.includes(item.id)).map(item => item.id) }
    }
    const reviewKey = plan => JSON.stringify([plan.date, plan.time, plan.restaurant, [...plan.activities].sort()])
    window.AmyPlanner = Object.freeze({
        getPlan: () => state.step === 4 && complete().every(Boolean) ? reviewPlan(state) : null,
        applySuggestion(expected, proposed) {
            const before = reviewPlan(expected), after = reviewPlan(proposed)
            if (state.step !== 4 || !before || !after || reviewKey(before) !== reviewKey(state) || reviewKey(before) === reviewKey(after)) return false
            Object.assign(state, after)
            for (const input of form.querySelectorAll('input')) {
                input.checked = input.name === 'activities' ? state.activities.includes(input.value) : state[input.name] === input.value
            }
            document.getElementById('copy-status').textContent = ''
            document.getElementById('manual-copy').hidden = true
            document.getElementById('manual-copy').value = ''
            document.getElementById('manual-copy-label').hidden = true
            document.getElementById('pdf-status').hidden = true
            updateRainHint()
            showStep()
            return true
        },
    })
    document.getElementById('planner').hidden = false
    renderWeather()
    showStep()
    weatherTask = loadWeather()
})()
