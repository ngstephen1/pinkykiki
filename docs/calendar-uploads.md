# Amy's calendar ♡

In Milo's chat, tap **📎** or drop calendar files onto the open chat. Preview or
remove them, then press **Gửi**. PNG, JPG, WebP, PDF and `.ics` are supported:
up to three files and 2.5 MiB total; `.ics` exports are capped at 512 KiB.

Milo compares the selected date and full Virginia-local time window with the
uploaded calendar. He asks about missing dates/timezones or unclear screenshots,
and asks Amy before suggesting another time. Chat does not edit her choices.
Availability means only what is shown in the files, not live calendar access.

Files stay in tab memory while attached and accompany subsequent chat messages.
Only filenames and conversation text are saved in session history. **Chat mới**,
removing the files, or reloading clears the attachment bytes. After a reload, Amy
reattaches files for another calendar check. The application writes no uploaded
files to disk or a database. Requests pass through the server to the AI provider
using the existing server-only key and Responses `store: false`.

The backend validates file signatures, sizes and names, handles calendar repeats,
exceptions, all-day events and timezones with `node-ical` and Temporal, and includes
only event titles/times in the planner's date range. Unsupported/partial calendars
remain uncertain. Web search is disabled on requests with calendar attachments.
The existing session, same-origin, CSRF and rate limits also protect attachments.
The chat endpoint accepts JSON up to 4 MiB; text-message limits stay unchanged.

Run `npm install`, then `npm start` with Node 22. Vercel installs the locked server
dependencies automatically; attachments use the existing `/api/milo/chat` route.
No upload directory or storage service is needed.

References: [OpenAI image inputs](https://developers.openai.com/api/docs/guides/images-vision),
[OpenAI PDF inputs](https://developers.openai.com/api/docs/guides/file-inputs),
[node-ical](https://github.com/jens-maus/node-ical).
