const gifStages = [
    // First view, first click, then second click. Never show more than two.
    [
        { src: 'gifs/guitar_usagi.gif', alt: 'Usagi chơi guitar tặng Amy' },
        { src: 'gifs/chiikawa-hachiware.gif', alt: 'Chiikawa và Hachiware bên nhau' },
    ],
    [
        { src: 'gifs/chiikawacutiepie-cry.gif', alt: 'Chiikawa mít ướt năn nỉ Amy' },
        { src: 'gifs/usagi_chi_cute.gif', alt: 'Usagi và Chiikawa dễ thương' },
    ],
    [{ src: 'gifs/eat_usagi.gif', alt: 'Usagi ăn ngon, chờ Amy chốt kèo' }],
    [
        { src: 'https://media.tenor.com/EBV7OT7ACfwAAAAj/u-u-qua-qua-u-quaa.gif', alt: 'Một bé xinh đang chờ Amy' },
        { src: 'gifs/usagi-scuba.gif', alt: 'Usagi ngại ngùng' },
    ],
    [
        { src: 'https://media.tenor.com/f_rkpJbH1s8AAAAj/somsom1012.gif', alt: 'Năn nỉ Amy thêm một xíu' },
        { src: 'gifs/usagi-usagi-chiikawa.gif', alt: 'Usagi uống trà cùng Chiikawa' },
    ],
    [
        { src: 'https://media.tenor.com/OGY9zdREsVAAAAAj/somsom1012.gif', alt: 'Một bé buồn xíu, vẫn đợi Amy' },
        { src: 'gifs/saba.gif', alt: 'Hai bé xinh bên nhau' },
    ],
    [
        { src: 'https://media1.tenor.com/m/WGfra-Y_Ke0AAAAd/chiikawa-sad.gif', alt: 'Chiikawa buồn xíu' },
        { src: 'https://media.tenor.com/CivArbX7NzQAAAAj/somsom1012.gif', alt: 'Pretty please, Amy ơi' },
    ],
    [
        { src: 'https://media.tenor.com/5_tv1HquZlcAAAAj/chiikawa.gif', alt: 'Chờ một cái gật đầu của Amy' },
        { src: 'milo.png', alt: 'Milo với chiếc ô dâu hồng' },
    ],
]

const noMessages = [
    "Để Amy nghĩ xíu 🥺",
    "Amy chắc chưaaa? 🫣",
    "Ngại xíu thui hả? 🥺",
    "Pookie ơiii 💗",
    "Trà sữa hong nè? 🧋",
    "Anh đợi Amy nè 🫶",
    "Đi chơi xíu thuii 🌷",
    "Chốt kèo hong? 💌",
    "Pretty please? 🥹",
    "Một chiếc date thuii 💕",
    "Bắt được anh hông? 😝"
]

const yesTeasePokes = [
    "Khoan nèee, thử nút bên cạnh xem có gì cute hong 👀",
    "Bấm thử một xíu thui, có bất ngờ cho Amy đó 🫣",
    "A little surprise, just for Amy 💌",
    "Thêm xíu nữa rùi mình chốt kèo nhaaa 💗"
]

let yesTeasedCount = 0

let noClickCount = 0
let runawayEnabled = false
let reactionClickCount = 0
let gifSwapTimer

const catGif = document.getElementById('cat-gif')
const companionGif = document.getElementById('companion-gif')
const reactionGifs = [catGif, companionGif]
const yesBtn = document.getElementById('yes-btn')
const noBtn = document.getElementById('no-btn')

function handleYesClick() {
    if (!runawayEnabled) {
        advanceGif()
        // Tease her to try No first
        const msg = yesTeasePokes[Math.min(yesTeasedCount, yesTeasePokes.length - 1)]
        yesTeasedCount++
        showTeaseMessage(msg)
        return
    }
    window.location.href = 'claw_machine_usagi/claw-machine.html'
}

function showTeaseMessage(msg) {
    let toast = document.getElementById('tease-toast')
    toast.textContent = msg
    toast.classList.add('show')
    clearTimeout(toast._timer)
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2500)
}

function handleNoClick() {
    noClickCount++

    // The original button progression stays tied to No clicks.
    const msgIndex = Math.min(noClickCount, noMessages.length - 1)
    noBtn.textContent = noMessages[msgIndex]

    // Grow the Yes button bigger each time
    const currentSize = parseFloat(window.getComputedStyle(yesBtn).fontSize)
    const compact = window.matchMedia('(max-width: 600px)').matches
    yesBtn.style.fontSize = `${Math.min(currentSize * 1.35, compact ? 46 : 96)}px`
    const padY = Math.min(18 + noClickCount * 5, compact ? 36 : 60)
    const padX = Math.min(45 + noClickCount * 10, compact ? 45 : 120)
    yesBtn.style.padding = `${padY}px ${padX}px`

    // Shrink No button to contrast
    if (noClickCount >= 2) {
        const noSize = parseFloat(window.getComputedStyle(noBtn).fontSize)
        noBtn.style.fontSize = `${Math.max(noSize * 0.85, 10)}px`
    }

    advanceGif()

    if (noClickCount >= 5) yesBtn.textContent = 'Chốt 💗'

    // Runaway starts at click 5
    if (noClickCount >= 5 && !runawayEnabled) {
        enableRunaway()
        runawayEnabled = true
    }
}

function advanceGif() {
    reactionClickCount++
    const stage = gifStages[Math.min(reactionClickCount, gifStages.length - 1)]
    clearTimeout(gifSwapTimer)
    reactionGifs.forEach(img => { img.style.opacity = '0' })
    gifSwapTimer = setTimeout(() => {
        reactionGifs.forEach((img, index) => {
            const reaction = stage[index]
            img.hidden = !reaction
            img.classList.remove('milo-animated')
            if (!reaction) { img.removeAttribute('src'); return }
            img.src = reaction.src
            img.alt = reaction.alt
            img.classList.toggle('milo-animated', reaction.src === 'milo.png')
            img.style.opacity = '1'
        })
        catGif.parentElement.classList.toggle('milo-stage', stage.some(reaction => reaction.src === 'milo.png'))
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160)
}

// Preserve the animated photo fallback if a remote reaction ever stops loading.
reactionGifs.forEach(img => img.addEventListener('error', () => {
    if (img.hidden || img.getAttribute('src') === 'milo.png') return
    img.src = 'milo.png'
    img.alt = 'Milo với chiếc ô dâu hồng'
    img.classList.add('milo-animated')
    catGif.parentElement.classList.add('milo-stage')
}))

function enableRunaway() {
    noBtn.addEventListener('mouseover', runAway)
    noBtn.addEventListener('touchstart', runAway, { passive: true })
}

function runAway() {
    const margin = 20
    const btnW = noBtn.offsetWidth
    const btnH = noBtn.offsetHeight
    const maxX = window.innerWidth - btnW - margin
    const maxY = window.innerHeight - btnH - margin

    const randomX = Math.random() * maxX + margin / 2
    const randomY = Math.random() * maxY + margin / 2

    noBtn.style.position = 'fixed'
    noBtn.style.left = `${randomX}px`
    noBtn.style.top = `${randomY}px`
    noBtn.style.zIndex = '50'
}
