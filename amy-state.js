// Shared, device-local progress for the game and planner. No server is involved.
window.AmyState = (() => {
    const key = 'amy-date.v1'
    let state = { version: 1, miloWon: false, draft: null }
    for (const name of ['localStorage', 'sessionStorage']) {
        try {
            const saved = JSON.parse(window[name].getItem(key))
            if (saved?.version === 1) {
                state = { ...state, ...saved }
                // Migrate wins from before the character was renamed.
                state.miloWon = saved.miloWon === true || saved.berryWon === true
                delete state.berryWon
                break
            }
        } catch (_) { /* Storage can be unavailable in private browser settings. */ }
    }
    // If both storage APIs are blocked, the completed win can still follow this tab.
    if (window.name === 'amy-milo-won-v1' || window.name === 'amy-berry-won-v1' || window.AmyAuth?.tabFlag('miloWon')) state.miloWon = true
    function persist() {
        let saved = false
        for (const name of ['localStorage', 'sessionStorage']) {
            try { window[name].setItem(key, JSON.stringify(state)); saved = true } catch (_) {}
        }
        return saved
    }
    return {
        hasMilo: () => state.miloWon === true,
        unlockMilo() {
            state.miloWon = true
            const saved = persist()
            if (!saved) {
                if (window.AmyAuth) window.AmyAuth.setTabFlag('miloWon', true)
                else window.name = 'amy-milo-won-v1'
            }
            return saved
        },
        getDraft: () => state.draft,
        saveDraft(draft) { state.draft = draft; return persist() },
    }
})()
