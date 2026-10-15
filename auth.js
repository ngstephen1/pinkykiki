// A personal, static-page entrance; credentials come from the supplied login notes.
window.AmyAuth = (() => {
    const base = new URL('.', document.currentScript.src)
    const key = 'amy-login.v1'
    const prefix = 'amy-love-tab:'
    function tabState() {
        try { return window.name.startsWith(prefix) ? JSON.parse(window.name.slice(prefix.length)) : {} } catch (_) { return {} }
    }
    function setTabFlag(name, value) { window.name = prefix + JSON.stringify({ ...tabState(), [name]: value }) }
    function isAuthenticated() {
        try { if (sessionStorage.getItem(key) === 'yes') return true } catch (_) {}
        return tabState().authenticated === true
    }
    return {
        isAuthenticated,
        login(username, password) {
            if (username.trim().toLowerCase() !== 'amykiki' || password.trim().toLowerCase() !== 'nganghieng') return false
            try { sessionStorage.setItem(key, 'yes') } catch (_) { setTabFlag('authenticated', true) }
            return true
        },
        require() {
            if (isAuthenticated()) return true
            document.documentElement.style.visibility = 'hidden'
            window.location.replace(new URL('login/index.html', base).href)
            return false
        },
        tabFlag: name => tabState()[name] === true,
        setTabFlag,
        invitationURL: new URL('invitation.html', base).href,
    }
})()
