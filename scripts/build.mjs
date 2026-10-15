import { readdir, mkdir, copyFile, rm, readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname, extname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publicDirectories = new Set(['assets', 'claw_machine_usagi', 'fonts', 'gifs', 'login', 'music', 'vendor'])
const extensions = new Set(['.html', '.js', '.css', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.ttf', '.woff', '.woff2', '.mp3'])
const isPublic = name => !name.startsWith('.') && (extensions.has(extname(name).toLowerCase()) || /^(?:LICENSE(?:\.txt)?|NOTICE\.txt|.+-OFL\.txt)$/i.test(name))

export async function buildStatic(root = ROOT, { siteURL = process.env.SITE_URL || process.env.VERCEL_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || '' } = {}) {
    let origin = ''
    if (siteURL) {
        const url = new URL(siteURL.includes('://') ? siteURL : `https://${siteURL}`)
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('SITE_URL must be a public HTTP(S) site URL.')
        origin = url.origin
    }
    const output = resolve(root, 'dist')
    await rm(output, { recursive: true, force: true })
    await mkdir(output, { recursive: true })
    let count = 0
    async function copyDirectory(source, destination, topLevel = false) {
        for (const entry of await readdir(source, { withFileTypes: true })) {
            if (entry.name.startsWith('.')) continue
            const src = resolve(source, entry.name), dest = resolve(destination, entry.name)
            // Never follow a public-looking symlink into private files.
            if (entry.isSymbolicLink()) continue
            if (entry.isDirectory() && (!topLevel || publicDirectories.has(entry.name))) {
                await mkdir(dest, { recursive: true })
                await copyDirectory(src, dest)
            } else if (entry.isFile() && isPublic(entry.name)) {
                if (origin && extname(entry.name).toLowerCase() === '.html') {
                    // Social crawlers need absolute URLs in the initial HTML, before redirects or scripts.
                    const html = (await readFile(src, 'utf8')).replace(
                        /((?:property|name)="(?:og:image|twitter:image|og:url)" content=")(\/[^"\s]*)(")/g,
                        (_, start, path, end) => start + new URL(path, origin).href.replaceAll('&', '&amp;').replaceAll('"', '&quot;') + end,
                    )
                    await writeFile(dest, html)
                } else await copyFile(src, dest)
                count++
            }
        }
    }
    await copyDirectory(root, output, true)
    return { output, count }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { count } = await buildStatic()
    console.log(`Built ${count} public files in dist/. Private server files and environment files are excluded.`)
}
