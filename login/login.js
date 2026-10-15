const form = document.getElementById('heart-login')
const username = document.getElementById('username')
const password = document.getElementById('password')
const error = document.getElementById('login-error')
const peek = document.getElementById('show-password')
const hint = document.getElementById('hint-toggle')
peek.addEventListener('click', () => {
    const show = password.type === 'password'
    password.type = show ? 'text' : 'password'
    peek.textContent = show ? 'Ẩn' : 'Hiện'
    peek.setAttribute('aria-label', show ? 'Ẩn mật mã' : 'Hiện mật mã')
    peek.setAttribute('aria-pressed', String(show))
})
hint.addEventListener('click', () => {
    const expanded = hint.getAttribute('aria-expanded') !== 'true'
    hint.setAttribute('aria-expanded', String(expanded))
    document.getElementById('password-hint').hidden = !expanded
})
form.addEventListener('submit', event => {
    event.preventDefault()
    window.HeartMusic?.tryPlay()
    if (!window.AmyAuth.login(username.value, password.value)) {
        error.textContent = 'Milo hong nhận ra mật mã này rùi 🥺 Amy thử lại xíu nha.'
        if (username.value.trim().toLowerCase() !== 'amykiki') username.focus()
        else password.focus()
        password.setAttribute('aria-invalid', 'true')
        return
    }
    password.removeAttribute('aria-invalid')
    error.textContent = 'Đúng cô gái Milo đang chờ rồiii 💗'
    window.location.assign(window.AmyAuth.invitationURL)
})
form.addEventListener('input', () => { error.textContent = ''; password.removeAttribute('aria-invalid') })
