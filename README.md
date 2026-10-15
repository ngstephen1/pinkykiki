# Một chiếc hẹn dành cho Amy 💌

A personal autumn login, Vietnamese date invitation, Milo claw game, and date planner for Virginia Tech / Blacksburg / Christiansburg.

## Run locally

```sh
cd /Users/macbook/Hack/amycute/pinkykiki
npm start
```

Open **http://localhost:8000**. Use Node **22.x** (`nvm use` if you use nvm); no dependency installation or build is needed for local development. Use **⌘⇧R** after changing files. The Node server serves the whole existing site plus Milo's chat API, including audio range requests. The old Python-only server can show static pages, but cannot answer chat requests.

The server loads `OPENAI_API_KEY` from the process environment, this project's `.env`, or the already supplied `../pinkykiki-before-restore-9lr8p6kh/.env` when no local `.env` exists. For another computer, copy `.env.example` to `.env` and fill the key privately. To use a different env file, run `OPENAI_ENV_FILE=/absolute/path/to/.env npm start`. Set `PORT` / `HOST` to change the listening address. Restart Node after changing environment variables or server code.

### If port 8000 is already in use

Python's `OSError: [Errno 48] Address already in use` means a server is already listening on that port. Check with `lsof -nP -iTCP:8000 -sTCP:LISTEN`. If it is this project's Node server, simply open **http://localhost:8000**; a second server is unnecessary. Use `npm start` for this app because Python's static server cannot run Milo's AI chat or plan review.

To run a separate instance on another port:

```sh
cd /Users/macbook/Hack/amycute/pinkykiki
PORT=8001 npm start
```

Then open **http://localhost:8001**. Browser progress belongs to each origin, so use the existing port to keep the same saved progress.

## Deploy to Vercel

1. Import **`ngstephen1/pinkykiki`** in Vercel. This repository's root is the website: leave **Root Directory** as `.` and choose **Other** for the framework.
2. `vercel.json` configures **Build Command** `npm run build`, **Output Directory** `dist`, Node **22.x** (from `package.json`), Fluid compute, and a 90-second limit for the AI function. Keep these repository settings.
3. Add **`OPENAI_API_KEY`** in Vercel's project environment variables for Production and any Preview deployments where you want AI replies. Never use a browser/public-prefixed key. Without the key, the invitation, claw game, planner, weather, map and PDF still work; AI chat/review show their unavailable state.
4. Optionally set `OPENAI_MODEL` (default `gpt-5.4-mini`), `OPENAI_WEB_SEARCH` (`true` by default), and **`MILO_PERSONAL_CONTEXT`**. The last variable can contain the multiline private notes from your local `server/milo-personal.md`; that ignored file is deliberately absent from Git and deployments. Keep those notes in Vercel's environment settings, rather than adding them to public assets or the repository. `MILO_SESSION_SECRET` optionally supplies a stable random signing secret; otherwise signing uses a server-only key derived from `OPENAI_API_KEY`.
5. Deploy. Future pushes to the connected production branch deploy automatically. Redeploy after changing environment variables.

The build copies only browser assets to `dist/`; it excludes `.env`, server source, private notes, tests and generated PDF samples. Static pages, GIFs, fonts and songs are served by Vercel's CDN, with normal media range support. The `/api/milo/session`, `/api/milo/chat` and `/api/milo/review` URLs rewrite to one Node function (`api/milo.js`), which reuses the local server's request handler without opening a listening port. The API notebook stays in the private function bundle; `date-options.js` is also included there to validate the browser's choices. Security headers include `noindex, nofollow` for this personal site.

Signed HttpOnly/SameSite sessions work across cold starts and multiple instances. HTTPS cookies and client IPs use Vercel's trusted proxy headers; local development does not trust forwarded headers. Session/CSRF checks, input validation and the 75-second upstream timeout apply in both environments. The in-memory request/concurrency limits are **per instance**; a deployment-wide limit, if needed, belongs in Vercel Firewall rules for `/api/milo/*`.

Before deploying, run:

```sh
npm test
npm run build
```

After deployment, open the root URL and check the login → invitation → claw → planner flow. `/api/milo/session` should return `ready: true` when the API key is configured. HTTPS previews have their own device-local progress, separate from localhost. [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js) and [project configuration](https://vercel.com/docs/project-configuration/vercel-json) describe the deployment settings used here.

## The journey

1. Opening the site shows `login/index.html`: the supplied glass card, falling leaves, and cycling character over the Virginia Tech autumn photo. The supplied login notes specify username **amykiki** (prefilled) and password **nganghieng**. The on-screen hint describes the song without revealing the password. The entrance stays unlocked for this browser tab's session.
2. Successful login opens `invitation.html`. The growing affirmative button and five-click unlock remain. Reactions start with guitar Usagi + Chiikawa–Hachiware, then crying Chiikawa + cute Usagi/Chiikawa after the first click, then eating Usagi after the second click. Either invitation button advances reactions, with at most two GIFs visible. Later stages continue the existing reactions; local files live in `gifs/`.
3. The unlocked affirmative button opens the claw machine. Hold the right arrow to aim horizontally, release, then hold the up arrow to aim vertically and release to grab. Mouse, touch, and keyboard (Tab + Space/Enter, or the matching arrow key) work. A cute alarm clock gives each attempt **20 seconds**, starting on the first right-arrow press and covering both aiming directions. At zero it automatically grabs at the current position. The clock stops during grabbing/returning and resets for the next attempt; idle time before the first press does not count. Empty grabs show **“xui nha bà”** with **🥀** after the claw returns. **Gắp lại nè bà ♡**, the close button, or Escape starts a fresh ready state. Ordinary prizes do not trigger the miss popup.
4. Catch the Milo photo in the bottom row. The first time an accurately aimed claw descends close to him, Milo smoothly dodges **64 px to the right, once per loaded game**. He stays inside the cabinet and remains reachable; the claw checks his new position when it closes. Later attempts leave him still. Reduced motion makes the same sidestep instant. Once he reaches the prize chute, click the prize or **Chạm để nhận Milo 💗**. A fresh Milo pickup fires pink confetti from both sides, then the success card pops into view. Other prizes and misses do not unlock the planner or trigger the celebration. Reduced motion skips the confetti and entrance animation.
5. **Chọn date với Milo 💌** opens the four-step planner only after Milo is caught, dropped into the chute, and collected. Milo is the sender; Amy chooses their date, Virginia-local time window, restaurant, and one or more activities, then copies the itinerary.

The planner's scrapbook header uses the supplied couple sticker (`assets/amy_and_milo.png`) with the kitty and bunny GIFs (`gifs/planner-kitty.gif` and `gifs/planner-bunny.gif`). The original files remain untouched. Reduced motion keeps the couple photo static and hides the animated GIF decorations.

The completed plan also has two little Peach & Goma cat stickers around the **Made by Milo** credit. A heart-blowing kitten rides inside the existing login bicycle's basket and travels with it. Both GIFs are local files; source links are in the planner credits and `gifs/SOURCES.md`. The signoff uses still PNG frames with reduced motion, while the bicycle follows its existing reduced-motion behavior.

The invitation alone has a four-sided heart frame in `heart-frame.js`, adapted from `../heart_background` with the original curved heart shape and soft trails. Raspberry, plum, and warm rose hearts with pale outlines stay inside the viewport edges and outside the invitation content and controls. It uses a local Canvas 2D effect, pauses in hidden tabs, and becomes a static frame with reduced motion.

## A little mouse and scroll magic

`love-magic.js` / `love-magic.css` add rose-and-champagne fairy dust behind the mouse, small heart/sparkle blooms on clicks, and petals at the viewport edges while scrolling. The login uses warmer autumn colors. Planner cards and the final signoff settle gently into view, and the floral corners shift slightly with scroll progress. Scrolling remains native; the ordinary mouse cursor stays visible.

The fairy-dust trail is adapted locally from [Tim Holman's cursor-effects](https://github.com/tholman/cursor-effects), with its MIT notice in `vendor/cursor-effects/NOTICE.txt`. There is no new CDN, dependency installation or API request. Particles are capped, sprites are cached, and rendering stops when they fade or the page is hidden. Mouse trails skip touch input, typing, text selection, the claw cabinet, map gestures and chat/dialog surfaces. Touch taps get a smaller bloom, and scrolling gets fewer edge particles. Reduced motion disables the added particles, reveals and floral movement. Decorations never receive pointer events or move controls.

Reloading remembers a successful catch and shows a small **Tiếp tục chọn date với Milo 💌** link. The large success card and confetti wait for a new Milo pickup rather than replaying on page load.

## Music and entrance

`heart-music.js` rotates these local tracks in **one-minute turns**:

1. `login/song1_firstdate.mp3`
2. `login/chochut_song2.mp3`
3. `login/login_to_your_heart_song3.mp3`

After the first minute of each song, it returns to song 1 at 1:00, then song 2 at 1:00, and so on. Short final portions play to the end, and finished songs are skipped until every song is complete. The whole rotation repeats **once more** (two complete passes, roughly 24 minutes total), then stops. Clicking **nghe lại từ đầu ♡** explicitly restarts it. Song lengths come from the audio metadata; replacing a file does not require updating durations in code.

The opening song streams immediately with audible autoplay enabled, while the three-song rotation preloads in the background; startup does not wait for all three downloads. Saved progress includes the active track, so later pages can also resume immediately. Opening the login entrance tries to play again even if an earlier visit was paused. Within the story, Amy's pause choice follows navigation and reloads, and an explicit pause is respected while the page stays open. Pausing and buffering do not count toward the minute.

Browsers can block audible autoplay on a new site. If that happens, Amy's first tap anywhere, touch release, or keypress retries playback directly inside the interaction handler; she does not need to click **nhạc cho Amy**. The button remains available to pause/resume. Browser autoplay permissions still apply; the site cannot override a browser-level block. See [MDN's autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay).

`auth.js` contains the entrance credentials from `login/readme.md` and redirects direct visits to later pages back to the login. This is a personal static-page puzzle; credentials are included in the JavaScript. The original files under `../login` remain untouched, and the self-contained site uses the copied assets under `pinkykiki/login`.

## Customize the options

Edit **`date-options.js`**. It contains:

- The eight dates, **October 16–23, 2026**, as `YYYY-MM-DD` calendar dates.
- Six time windows: 12–3 PM, 3–6 PM, 6–9 PM, 9–11 PM, **12–6 PM**, and **3–9 PM**.
- Eight restaurants: Yeah Siam, Baan Thai, Avellinos, Kuma Moon, Hefun, Texas Roadhouse, Olive Garden, and Sakura. The first supplied `share.google` link resolves to Hefun; the second resolves to Kung Fu Tea.
- Seven activities, which Amy may combine: Drillfield walk/photos, Hahn Horticulture Garden, Kung Fu Tea, piano at Squires, bowling at BreakZONE, Uptown shopping, and a Regal movie. Christiansburg cards appear before Blacksburg cards. Hahn has an official garden photo, Milo's supplied Maps / TripAdvisor links and a separate map pin; it is an outdoor, daylight option.
- A `places` dictionary with addresses, `[latitude, longitude]` coordinates, original Maps links, official venue links, and local photo paths/source credits. Option entries reference it through `placeId`. Two Squires activities share the same location.
- Blacksburg weather coordinates and the `America/New_York` timezone.
- The map tile URL and attribution, so a different provider can be configured in one place.

Keep option IDs unique and stable so saved selections continue to match. If an option is removed, its saved selection is discarded.

## Photos and the finished map

Restaurant and activity cards have locally saved internet photos, with separate **Maps**, **Menu / details**, and photo-source links. These links do not select a card. Credits also appear in an expandable list at the bottom of the planner. Chain food photos and menu illustrations are labeled; they do not claim to show the local restaurant interior. The supplied couple sticker and GIF decorations remain.

After all four choices, `date-map.js` creates a Leaflet map with numbered rose pins for only the selected places. Matching stop buttons open a pin's photo/address popup, and **Xem hết các điểm** fits all pins again. Piano and bowling at Squires share one pin, listing both activities. The map does not calculate routes or travel times. Each stop's original Maps link opens directions/details externally. Copied itineraries include the selected addresses and Maps links.

Leaflet 1.9.4 and its license are vendored under `vendor/leaflet/`. The visible map uses [OpenStreetMap tiles](https://operations.osmfoundation.org/policies/tiles/) with attribution and normal browser caching; it loads only on the recap. The map needs internet, while card photos are local. Failed tiles show a retry message and retain the pin/stop list and Maps links. If Leaflet cannot load, the stop list still works. No map key, location permission, backend, or build step is required.

## Weather and progress

The planner requests live daily forecasts from [Open-Meteo](https://open-meteo.com/en/docs): conditions, low/high temperatures in °C and °F, and rain probability. Forecasts cover up to 16 days; dates without a forecast display an unavailable state. Weather failure does not prevent choosing a date, and a retry control is provided.

Picking a date opens a little weather note: **“cảnh báo có mưa rơi tí tách”** with a rain-cloud GIF for a rain/thunderstorm forecast or a maximum precipitation probability of at least 30%; otherwise a known dry condition gets **“nắng chiếu lung linh”** and a smiling sun. The popup includes the actual forecast, so clouds/fog remain labeled honestly. Snow, unknown and missing forecasts never get a sunny popup. The same rain threshold controls the indoor-activity hint. Closing the note or pressing Escape keeps Amy's choice; selecting it again reopens the note. It never opens just from restoring saved progress. A choice made while weather loads is shown only if Amy is still on that date step; a failed request can be retried. Both local GIFs have static reduced-motion versions and [source credits](gifs/SOURCES.md).

Milo wins and planner selections are stored on the same device/browser under `amy-date.v1`, with session storage as a fallback. Earlier wins saved under the character's previous name are migrated automatically. After login, the planner redirects to the game until Milo is collected. There is no shared inbox, booking, or automatic sending to Milo; Amy explicitly copies and sends her itinerary herself. The server is used for AI chat, not for storing planner choices.

For a fresh local walkthrough, clear this origin's local and session storage in browser developer tools and reload. Browser storage is a playful flow gate, not account authentication.

The local app remains usable if weather is unavailable. Remote Tenor GIFs and the legacy `yes.html` celebration page are retained. Added flowers are local SVG/CSS, and motion respects reduced-motion preferences. The shared soundtrack replaces the previous page-specific audio.

## AI Milo on the calendar

The calendar introduces **Milo nhỏ**, an explicitly labeled AI date buddy with a cute Vietnamese voice, a little "gâu gâu~", and optional English touches. Its launcher and welcome card only appear on the unlocked planner. Amy can open/close chat, use quick questions, stop an answer, retry a failed reply, or start a new conversation. Chat never selects date cards, changes the itinerary, books anything, or messages the real Milo.

The chat launcher is a little fluffy puppy, using a locally saved [walking puppy sticker from Tenor](https://tenor.com/view/cute-dog-sticker-gif-11712081657308383037). `milo-puppy.js` gives it short strolls along clear screen edges; desktop routes avoid the option groups, map and buttons, while phones use shorter, slower trips. It stops on hover, pointer press or keyboard focus so Amy can catch it, and opens the same chat on click/tap/Enter. The stationary **Hỏi Milo ♡** button remains available. Movement pauses during scrolling, chat, review popups and hidden tabs; reduced motion docks a still puppy. The avatar also appears in the welcome card and chat header. Sources are in the planner credits and `gifs/SOURCES.md`.

`server.mjs` calls the [OpenAI Responses API with web search](https://developers.openai.com/api/docs/guides/tools-web-search), using `gpt-5.4-mini` by default. Set `OPENAI_MODEL` in `.env` to use another Responses model supporting the configured tools/reasoning; `OPENAI_WEB_SEARCH=false` disables search. API keys stay on the server; dotfiles, server code, private notes, tests and secret symlinks are excluded from static responses. Chat requests use same-origin session/CSRF checks, bounded input/output, a request limit, and a timeout. This is an AI endpoint for the personal site; the existing static login and claw unlock remain the browser's story flow, not a new account system.

Every question includes validated current date/time/restaurant/activity IDs, the full venue catalog and official links, Virginia-local current time, date-plan ideas, and a cached live Open-Meteo forecast. Missing forecasts remain missing. The model can search current hours, menus, prices, movies/showtimes, art events and BT schedules, with clickable inline citations and source links. Regular weekly hours must be distinguished from special-date confirmation. Source failures must be disclosed rather than guessed.

Edit Milo's background and planning references in **`server/milo-context.md`**. Personal preferences supplied by Milo live in **`server/milo-personal.md`**, which is server-only and ignored by Git; a blank example is included. These notes cover Kiki's food/tea/movie/shopping/art/dance/piano interests, evening comfort, and unknown preferences. The notebook also links Cafe Mekong, Perspective Gallery, the Center for the Arts, CID / East AJ and transit sources. These extra ideas are conversation references, not new picker selections. Both notebooks are read on each question, so text edits do not require a restart.

The browser sends chat messages and the current choice IDs when Amy asks a question. Completing a new plan also sends its choice IDs for the final review described below. OpenAI receives those plus the server's contextual notes to answer. The app keeps recent chat in this tab's session storage (`amy-milo-chat.v1`), sends `store: false` to the API, and has no conversation database or chat-text logging. **Chat mới** clears the tab's conversation without resetting planner choices. The playful bark button runs locally without an API request. Closing chat does not cancel a reply; **Dừng** does.

Run `npm test` for backend validation, weather caching/nulls, context, credential isolation, private-file protection, CSRF/origin checks, rate limits, citations and media seeking. The UI is also checked at desktop and 320/390 px widths with reduced motion, saved history, retries and cancellation. Live OpenAI replies and a real web lookup were verified with the supplied key.

## Milo's final-plan review

After Amy completes all four choices, AI Milo reviews the finished plan using OpenAI, the personal/context notebooks, the server forecast and targeted web searches. The cute popup contains a comment, source links and, when useful, one small proposed adjustment. Changed fields show **Amy đã chọn** and **Milo gợi ý** before Amy decides. A plan that already works can receive a comment without a forced change.

**Agree with this suggestion ♡** is the only action that applies the proposed choices. It updates the selected cards, saved draft, recap and map pins together; copying and the next PDF download use those new choices. **Giữ lịch Amy chọn ♡**, closing the popup or Escape preserve the original plan. **Xem lời nhắn của Milo ♡** reopens the review, and **Nhờ Milo xem lại ↻** explicitly requests a fresh one. Amy can still edit choices normally.

The browser remembers attempted reviews and their results in this tab's session storage (`amy-milo-review.v1`, at most eight snapshots). Reloads, weather updates, dismissals and accepting a suggestion do not automatically start another review. Changing choices and finishing a different plan starts a new review. Failed/stopped requests show a gentle retry state; they never block the itinerary, map, copy or PDF. Leaving the recap cancels an in-progress review, and late responses cannot change a newer plan.

`POST /api/milo/review` shares the chat endpoint's server-only key, same-origin session/CSRF checks, timeouts, concurrency and request limits. [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) constrain its response to a comment and optional complete set of known option IDs. The server validates both current and proposed plans, discards no-op changes and rejects unknown/incomplete choices. The browser rechecks the original snapshot on acceptance and prevents duplicate application. No choice changes, booking or messages happen on the server.

Verified with a live OpenAI review and acceptance in the browser, plus desktop and 320/390 px touch layouts, keyboard/Escape, reduced motion, dismiss/reload, stale/canceled requests, retry, comment-only reviews and duplicate clicks. Accepted choices were checked against selected inputs, map stops, copied text and the next PDF's data. `npm test` includes the review API, schema/ID validation, no-op/invalid outputs and shared session/request controls (17 tests total).

## Download the final plan as a PDF

After the four choices, **Tải PDF xinh ♡** downloads `Amy-va-Milo-date-YYYY-MM-DD.pdf` directly. The A4 keepsake has the couple sticker, date and Virginia-local time, weather, chosen restaurant and all selected activities. Photo cards list the selected places, addresses, clickable Maps / menu links and photo credits; shared Squires activities use one location card. Most plans use two pages, with extra pages for more than four locations.

The PDF uses embedded Quicksand and Noto Sans fonts for Vietnamese text, selectable vector text, rose/cream styling and page numbers. It waits for the current weather request and labels an unavailable forecast without inventing one. Missing photos get a decorative fallback. It captures the choices at the moment Amy clicks, so editing while it builds does not change that download. Its loading/error status prevents duplicate clicks and permits retries.

`date-pdf.js` generates the file locally in the browser using vendored PDF-Lib 1.17.1 and @pdf-lib/fontkit 1.1.1. PDF libraries load only on download, and font/photo assets come from the local project. This feature requires no OpenAI request, server PDF service or print dialog. The existing `npm start` command is unchanged.

`npm test` also validates PDF page counts, exact selected Maps links, shared locations, missing weather/photos, Vietnamese document metadata and link bounds. Exports were downloaded and visually checked on desktop and 320/390 px phones, including WebP photos, all activities, retry after a blocked library, and duplicate-click prevention. Test exports / previews under `tmp/pdfs/` and `output/pdf/` are ignored by Git.

## Credits

- Invitation: [SahilGogna/v-day](https://github.com/SahilGogna/v-day).
- Original pixel claw machine: Masahito / [ma5a.com](http://www.ma5a.com/), with attribution retained in the game.
- Quicksand font: license in `fonts/Quicksand-OFL.txt`.
- Map: [Leaflet](https://leafletjs.com/) (license in `vendor/leaflet/LICENSE`) and © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
- Venue photos: original websites/menus, Virginia Tech, WDBJ7, WSLS / CJ 4DPLEX, and The Takeout. Per-image credits and source pages are stored in `date-options.js` and displayed in the planner.
- AI chat: OpenAI Responses API; official documentation linked above. Campus / food planning references are linked in Milo's notebook; web-search answers carry their own sources.
- PDF: [PDF-Lib](https://pdf-lib.js.org/) and [@pdf-lib/fontkit](https://github.com/Hopding/fontkit) (MIT). Quicksand and Noto Sans font licenses are under `fonts/`.
