// Alternate the songs in 60-second turns, preserving every song's remaining audio.
(() => {
    const base = new URL('.', document.currentScript.src)
    const key = 'amy-heart-music.v1'
    const turnLength = 60
    const passes = 2
    const files = ['song1_firstdate.mp3', 'chochut_song2.mp3', 'login_to_your_heart_song3.mp3']
    let saved = {}
    try { saved = JSON.parse(sessionStorage.getItem(key)) || {} } catch (_) {}
    const entrance = location.pathname === new URL('login/index.html', base).pathname
    // Opening the entrance starts the music again; a pause still holds within the story.
    let manuallyPaused = !entrance && saved.paused === true
    let segmentIndex = saved.version === 2 && Number.isInteger(saved.segmentIndex) && saved.segmentIndex >= 0 ? saved.segmentIndex : 0
    let schedule
    let schedulePromise
    let boundaryTimer
    let lastSaved = 0
    let switching = false
    let resumeTime = 0
    let autoplayBlocked = false
    const startupTrack = saved.version === 2 && Number.isInteger(saved.track) && saved.track >= 0 && saved.track < files.length
        ? saved.track : segmentIndex === 0 ? 0 : null

    // Preload sources separately, but keep one playback element across all turns.
    // This also preserves browsers' permission to play consecutive songs.
    const sources = files.map(file => {
        const audio = document.createElement('audio')
        audio.dataset.song = file
        audio.preload = 'auto'
        return audio
    })
    const music = document.createElement('audio')
    music.id = 'heart-song'
    music.preload = 'auto'
    music.volume = .35
    music.setAttribute('playsinline', '')
    music.setAttribute('aria-hidden', 'true')
    const finished = () => schedule ? segmentIndex >= schedule.length : saved.version === 2 && saved.finished === true
    const segment = () => schedule?.[segmentIndex]

    const button = document.createElement('button')
    button.id = 'music-toggle'
    button.className = 'heart-music'
    button.type = 'button'
    button.innerHTML = '<span class="music-symbol" aria-hidden="true">♫</span><span class="music-label">nhạc cho Amy</span>'
    const label = button.querySelector('.music-label')

    function checkpoint() {
        if (!schedule && !music.getAttribute('src')) return
        const current = segment()
        const position = music.readyState >= 1 ? music.currentTime : resumeTime
        const time = current ? Math.max(current.start, current.endsSong ? position : Math.min(position, current.end)) : position
        const track = current?.track ?? files.indexOf(music.dataset.song)
        try {
            sessionStorage.setItem(key, JSON.stringify({ version: 2, segmentIndex, track, time, paused: manuallyPaused, finished: finished() }))
        } catch (_) {}
    }

    function sync(blocked) {
        if (typeof blocked === 'boolean') autoplayBlocked = blocked
        const playing = !!music.getAttribute('src') && !finished() && !music.paused && !music.ended
        if (playing || manuallyPaused) autoplayBlocked = false
        const current = segment()
        button.setAttribute('aria-pressed', String(playing))
        button.setAttribute('aria-label', finished() ? 'Phát lại ba bài từ đầu' : playing ? 'Tạm dừng nhạc cho Amy' : 'Phát nhạc cho Amy')
        button.title = current ? `Bài ${current.track + 1}/3 · lượt ${current.pass + 1}/${passes}` : finished() ? 'Đã nghe hết cả ba bài hai lượt ♡' : 'Ba bài hát dành cho Amy'
        label.textContent = finished() ? 'nghe lại từ đầu ♡' : playing ? 'nhạc cho Amy' : autoplayBlocked ? 'chạm đâu cũng có nhạc ♡' : 'bật chút nhạc'
    }

    async function metadata(audio) {
        // Blob URLs keep minute offsets seekable even on a basic static server
        // without HTTP Range support. Each page reuses the browser's file cache.
        if (!audio.getAttribute('src')) {
            const response = await fetch(new URL(`login/${audio.dataset.song}`, base))
            if (!response.ok) throw new Error('Song unavailable')
            audio.src = URL.createObjectURL(await response.blob())
        }
        if (Number.isFinite(audio.duration) && audio.duration > 0) return Promise.resolve(audio.duration)
        return new Promise((resolve, reject) => {
            const cleanup = () => {
                clearTimeout(timeout)
                audio.removeEventListener('loadedmetadata', loaded)
                audio.removeEventListener('error', failed)
            }
            const failed = () => { cleanup(); reject(new Error('Song unavailable')) }
            const loaded = () => {
                if (!Number.isFinite(audio.duration) || audio.duration <= 0) { failed(); return }
                cleanup()
                resolve(audio.duration)
            }
            const timeout = setTimeout(failed, 15000)
            audio.addEventListener('loadedmetadata', loaded)
            audio.addEventListener('error', failed)
            if (audio.error || audio.networkState === HTMLMediaElement.NETWORK_EMPTY) audio.load()
        })
    }

    function selectSegment(time = segment().start) {
        const source = sources[segment().track]
        const sameTrack = music.dataset.song === source.dataset.song && !!music.getAttribute('src')
        resumeTime = time
        music.dataset.song = source.dataset.song
        // Keep the opening stream playing while the remaining songs finish loading.
        if (!sameTrack) music.src = source.src
        if (music.readyState >= 1 && Math.abs(music.currentTime - time) > .1) music.currentTime = time
        sync()
    }

    function prepare() {
        if (schedule) return Promise.resolve()
        if (!schedulePromise) {
            schedulePromise = Promise.all(sources.map(metadata)).then(durations => {
                schedule = []
                for (let pass = 0; pass < passes; pass++) {
                    const positions = durations.map(() => 0)
                    while (positions.some((position, index) => position < durations[index])) {
                        durations.forEach((duration, track) => {
                            if (positions[track] >= duration) return
                            const start = positions[track]
                            const end = Math.min(start + turnLength, duration)
                            schedule.push({ track, start, end, pass, endsSong: end === duration })
                            positions[track] = end
                        })
                    }
                }
                if (saved.version === 2 && saved.finished === true) segmentIndex = schedule.length
                segmentIndex = Math.min(segmentIndex, schedule.length)
                if (!finished()) {
                    const end = segment().endsSong ? sources[segment().track].duration : segment().end
                    const streamed = music.dataset.song === files[segment().track] && !!music.getAttribute('src')
                    const position = streamed ? (music.readyState >= 1 ? music.currentTime : resumeTime) : saved.version === 2 ? saved.time : undefined
                    let time = Number.isFinite(position) ? Math.max(segment().start, Math.min(position, end)) : segment().start
                    if (!segment().endsSong && time >= end) {
                        segmentIndex++
                        time = segment()?.start
                    }
                    if (!finished()) selectSegment(time)
                }
                sync()
                checkpoint()
            }).catch(error => {
                schedulePromise = null
                throw error
            })
        }
        return schedulePromise
    }

    function tryPlay() {
        if (manuallyPaused || finished()) return Promise.resolve()
        if (!music.getAttribute('src')) {
            return prepare().then(tryPlay).catch(() => sync(true))
        }
        // Call play synchronously inside a tap/key handler, before any fetch/await.
        // This preserves the user activation required by Safari and mobile browsers.
        try {
            const playing = music.play()
            prepare().catch(() => { if (music.paused) sync(true) })
            return Promise.resolve(playing).then(() => sync(false), error => {
                if (error.name !== 'AbortError' && music.paused && !manuallyPaused) sync(true)
            })
        } catch (_) { sync(true); return Promise.resolve() }
    }

    function nextSegment() {
        if (!schedule || finished() || switching) return
        switching = true
        clearTimeout(boundaryTimer)
        music.pause()
        segmentIndex++
        if (!finished()) selectSegment()
        switching = false
        checkpoint()
        sync()
        if (!finished()) tryPlay()
    }

    // Use media playback time, so pausing or buffering doesn't consume a turn.
    function checkBoundary(event) {
        clearTimeout(boundaryTimer)
        if (!segment() || switching) return
        // Some MP3s refine their duration while decoding. Let final portions
        // reach the real ended event instead of cutting at an early estimate.
        if (event?.type === 'ended' || (!segment().endsSong && music.currentTime >= segment().end - .01)) { nextSegment(); return }
        if (music.paused || music.seeking || music.readyState < 3) return
        const end = segment().endsSong ? music.duration : segment().end
        boundaryTimer = setTimeout(checkBoundary, Math.max(10, (end - music.currentTime) / music.playbackRate * 1000))
    }

    music.addEventListener('loadedmetadata', () => { music.currentTime = resumeTime; checkpoint(); checkBoundary() })
    music.addEventListener('playing', () => { sync(); checkpoint(); checkBoundary() })
    music.addEventListener('pause', () => { if (!switching) { clearTimeout(boundaryTimer); sync(); checkpoint() } })
    music.addEventListener('waiting', () => clearTimeout(boundaryTimer))
    music.addEventListener('timeupdate', () => {
        if (switching) return
        checkBoundary()
        if (Date.now() - lastSaved > 2000) { checkpoint(); lastSaved = Date.now() }
    })
    ;['ended', 'seeked', 'ratechange', 'durationchange'].forEach(event => music.addEventListener(event, checkBoundary))
    music.addEventListener('error', () => { clearTimeout(boundaryTimer); sync(true) })

    button.addEventListener('click', () => {
        if (finished()) {
            saved = {}
            segmentIndex = 0
            manuallyPaused = false
            music.autoplay = true
            if (schedule) selectSegment()
            else {
                resumeTime = 0
                music.dataset.song = files[0]
                music.src = new URL(`login/${files[0]}`, base).href
            }
            checkpoint()
            tryPlay()
        } else if (!music.paused) {
            manuallyPaused = true
            music.autoplay = false
            music.pause()
            checkpoint()
        } else {
            manuallyPaused = false
            music.autoplay = true
            checkpoint()
            tryPlay()
        }
    })
    const resumeAfterGesture = event => {
        if (event.isTrusted && !event.target.closest?.('#music-toggle') && music.paused && !manuallyPaused && !finished()) tryPlay()
    }
    document.addEventListener('pointerdown', resumeAfterGesture, true)
    document.addEventListener('touchend', resumeAfterGesture, true)
    document.addEventListener('click', resumeAfterGesture, true)
    document.addEventListener('keydown', resumeAfterGesture, true)
    window.addEventListener('pagehide', () => { clearTimeout(boundaryTimer); checkpoint() })
    if (!finished() && startupTrack !== null) {
        music.dataset.song = files[startupTrack]
        resumeTime = saved.version === 2 && Number.isFinite(saved.time) ? Math.max(0, saved.time) : 0
        music.src = new URL(`login/${files[startupTrack]}`, base).href
    }
    music.autoplay = !manuallyPaused && !finished()
    document.body.append(music, button)
    window.HeartMusic = { tryPlay }
    sync()
    tryPlay()
    // Warm the playlist even when paused or finished, without starting playback.
    prepare().catch(() => { if (music.paused && !manuallyPaused) sync(true) })
})()
