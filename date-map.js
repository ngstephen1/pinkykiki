// The map is only created after Amy finishes picking. No location permission needed.
window.AmyDateMap = (() => {
    let map, tiles, pins, stops = [], signature = '', tileFailed = false
    const markers = new Map()
    const element = () => document.getElementById('date-map')
    const status = () => document.getElementById('map-status')
    const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches
    function node(tag, className, text) {
        const result = document.createElement(tag)
        if (className) result.className = className
        if (text !== undefined) result.textContent = text
        return result
    }
    function link(url, text) {
        const result = node('a', '', text)
        result.href = url
        result.target = '_blank'
        result.rel = 'noopener noreferrer'
        return result
    }
    function message(text) {
        status().textContent = text
        status().hidden = !text
    }
    function validCoordinates(place) {
        return Array.isArray(place.coordinates) && place.coordinates.length === 2 &&
            place.coordinates.every(Number.isFinite) && Math.abs(place.coordinates[0]) <= 90 && Math.abs(place.coordinates[1]) <= 180
    }
    function fit() {
        if (!map) return
        const coordinates = stops.filter(stop => validCoordinates(stop.place)).map(stop => stop.place.coordinates)
        map.closePopup()
        map.invalidateSize({ pan: false })
        if (coordinates.length) map.fitBounds(coordinates, { padding: [45, 48], maxZoom: 16, animate: false })
    }
    function focusPin(id) {
        const marker = markers.get(id)
        if (!marker || !map) return
        element().scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' })
        map.setView(marker.getLatLng(), Math.max(map.getZoom(), 17), { animate: !reducedMotion() })
        marker.openPopup()
        marker.getElement()?.focus({ preventScroll: true })
    }
    function popup(stop) {
        const content = node('div', 'date-popup')
        const photo = node('img')
        photo.src = stop.place.photo.src
        photo.alt = stop.place.photo.alt
        photo.width = 250
        photo.height = 120
        photo.addEventListener('error', () => { photo.hidden = true }, { once: true })
        content.append(photo, node('strong', '', stop.place.name), node('p', '', stop.labels.join(' · ')), node('p', '', stop.place.address), link(stop.place.maps, 'Mở trong Google Maps ↗'))
        return content
    }
    function popupOptions() {
        const width = Math.max(120, Math.min(260, element().clientWidth - 85))
        return { maxWidth: width, minWidth: Math.min(150, width), maxHeight: Math.max(130, element().clientHeight - 100), autoPan: false }
    }
    function keepPopupVisible() {
        const popupElement = element().querySelector('.leaflet-popup')
        if (!popupElement) return
        const bounds = element().getBoundingClientRect()
        const box = popupElement.getBoundingClientRect()
        const dx = box.right > bounds.right - 15 ? box.right - bounds.right + 15 : box.left < bounds.left + 15 ? box.left - bounds.left - 15 : 0
        const dy = box.bottom > bounds.bottom - 15 ? box.bottom - bounds.bottom + 15 : box.top < bounds.top + 15 ? box.top - bounds.top - 15 : 0
        // Native popup auto-pan animates even with reduced motion; keep this instant.
        if (dx || dy) map.panBy([dx, dy], { animate: false })
    }
    function createMap() {
        if (map) return true
        if (!window.L) {
            element().hidden = true
            document.getElementById('map-fit').hidden = true
            message('Bản đồ chưa tải được. Amy vẫn mở từng địa điểm bằng link Maps bên dưới nha ♡')
            return false
        }
        map = L.map(element(), { scrollWheelZoom: false, zoomAnimation: !reducedMotion(), fadeAnimation: !reducedMotion(), markerZoomAnimation: !reducedMotion() })
        map.on('popupopen', () => requestAnimationFrame(keepPopupVisible))
        map.setView([DATE_OPTIONS.location.latitude, DATE_OPTIONS.location.longitude], 13)
        tiles = L.tileLayer(DATE_OPTIONS.map.tileUrl, { maxZoom: DATE_OPTIONS.map.maxZoom, attribution: DATE_OPTIONS.map.attribution })
        tiles.on('loading', () => { tileFailed = false })
        tiles.on('tileerror', () => {
            tileFailed = true
            message('Nền bản đồ chưa tải đủ. Ghim và link Maps bên dưới vẫn dành cho Amy nha ♡')
            document.getElementById('map-retry').hidden = false
        })
        tiles.on('load', () => {
            document.getElementById('map-retry').disabled = false
            if (!tileFailed) {
                message('')
                document.getElementById('map-retry').hidden = true
            }
        })
        tiles.addTo(map)
        pins = L.layerGroup().addTo(map)
        document.getElementById('map-fit').addEventListener('click', fit)
        document.getElementById('map-retry').addEventListener('click', () => {
            document.getElementById('map-retry').disabled = true
            message('Đang mở lại bản đồ cho tụi mình…')
            tiles.redraw()
        })
        if (window.ResizeObserver) new ResizeObserver(() => {
            if (!document.getElementById('recap').hidden) {
                map.invalidateSize({ pan: false })
                markers.forEach(marker => {
                    Object.assign(marker.getPopup().options, popupOptions())
                    if (marker.isPopupOpen()) marker.getPopup().update()
                })
                keepPopupVisible()
            }
        }).observe(element())
        return true
    }
    function render(selected) {
        stops = selected
        const nextSignature = JSON.stringify(stops.map(stop => [stop.id, stop.labels]))
        if (signature === nextSignature) { requestAnimationFrame(fit); return }
        signature = nextSignature
        const ready = createMap()
        pins?.clearLayers()
        markers.clear()
        const list = document.getElementById('map-stops')
        list.replaceChildren()
        stops.forEach((stop, index) => {
            const row = node('li', 'map-stop')
            row.dataset.placeId = stop.id
            const content = node('div', 'stop-content')
            const heading = node('button', 'stop-name', stop.place.name)
            heading.type = 'button'
            heading.disabled = !ready || !validCoordinates(stop.place)
            heading.setAttribute('aria-label', `Xem ghim ${index + 1}: ${stop.place.name}`)
            heading.addEventListener('click', () => focusPin(stop.id))
            content.append(heading, node('p', 'stop-labels', stop.labels.join(' · ')), node('p', 'stop-address', stop.place.address))
            row.append(node('span', 'stop-number', index + 1), content, link(stop.place.maps, 'Maps ↗'))
            list.append(row)
            if (ready && validCoordinates(stop.place)) {
                const icon = L.divIcon({ className: 'date-marker', html: `<span class="date-pin"><span>${index + 1}</span></span>`, iconSize: [44, 52], iconAnchor: [22, 44], popupAnchor: [0, -43] })
                const marker = L.marker(stop.place.coordinates, { icon, title: `${index + 1}. ${stop.place.name}`, alt: `Ghim ${index + 1}: ${stop.place.name}`, riseOnHover: true })
                    .bindPopup(popup(stop), popupOptions()).addTo(pins)
                marker.getElement()?.setAttribute('aria-label', `Ghim ${index + 1}: ${stop.place.name}`)
                markers.set(stop.id, marker)
            }
        })
        requestAnimationFrame(fit)
    }
    return { render }
})()
