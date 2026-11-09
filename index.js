/**
 * Host half of the workspace session filter bundle.
 *
 * The filtering itself lives entirely in the Web Client module (`client.js`).
 * This half exists for one reason: status.deepseek.com answers without any
 * CORS header, so a browser fetch cannot read it. A plugin's Client half also
 * cannot reach its own Host half outside the dynamic-package bridge, so the
 * Host publishes the parsed feed on a loopback-only HTTP port that the Client
 * polls.
 *
 * The relay keeps a 60s cache (the feed itself is cached for 60s upstream),
 * binds 127.0.0.1 only, answers `GET /status` and `GET /health`, and falls back
 * to DNS-over-HTTPS when the system resolver returns a poisoned answer — the
 * mainland resolver for this domain points at an Aliyun block page.
 */
import { createServer } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { promises as dns } from 'node:dns'

const FEED_HOST = 'status.deepseek.com'
const FEED_PATH = '/feed.atom'
const FEED_URL = `https://${FEED_HOST}${FEED_PATH}`
const PORTS = [47100, 47101, 47102, 47103, 47104, 47105]
const CACHE_MS = 60_000
const TIMEOUT_MS = 8_000
const USER_AGENT = 'dsh-workspace-session-filter (+https://github.com/shijiewang/dsh-workspace-session-filter)'

const cache = { at: 0, payload: null }
let inflight = null

function fetchVia(options, timeout = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(options, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8')
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        resolve(body)
      })
    })
    req.setTimeout(timeout, () => req.destroy(new Error('timeout')))
    req.on('error', reject)
    req.end()
  })
}

function fetchFeedDirect() {
  return fetchVia({
    host: FEED_HOST,
    path: FEED_PATH,
    method: 'GET',
    headers: { host: FEED_HOST, accept: 'application/atom+xml', 'user-agent': USER_AGENT },
  })
}

/** Cloudflare / Google DNS-over-HTTPS JSON endpoints, addressed by IP so no lookup is needed. */
async function dohAnswers(name) {
  const endpoints = [
    `https://1.1.1.1/dns-query?name=${encodeURIComponent(name)}&type=A`,
    `https://8.8.8.8/dns-query?name=${encodeURIComponent(name)}&type=A`,
    `https://223.5.5.5/resolve?name=${encodeURIComponent(name)}&type=A`,
  ]
  for (const url of endpoints) {
    try {
      const body = await fetchVia({
        href: url,
        headers: { accept: 'application/dns-json', 'user-agent': USER_AGENT },
      })
      const parsed = JSON.parse(body)
      const answers = (parsed && parsed.Answer) || []
      const values = answers
        .filter((answer) => answer && (answer.type === 1 || answer.type === 5))
        .map((answer) => String(answer.data || '').trim())
        .filter((value) => /^\d+\.\d+\.\d+\.\d+$/.test(value))
      if (values.length > 0) return values
    } catch (error) {
      /* try the next resolver */
    }
  }
  return []
}

async function resolveAddresses() {
  try {
    const own = await dns.resolve4(FEED_HOST)
    if (own && own.length > 0) return own
  } catch (error) {
    /* poisoned or blocked: fall through to DoH */
  }
  return dohAnswers(FEED_HOST)
}

async function fetchFeed() {
  const attempts = []
  try {
    return await fetchFeedDirect()
  } catch (error) {
    attempts.push(error)
  }
  const addresses = await resolveAddresses()
  for (const address of addresses) {
    try {
      return await fetchVia({
        host: address,
        path: FEED_PATH,
        method: 'GET',
        servername: FEED_HOST,
        headers: { host: FEED_HOST, accept: 'application/atom+xml', 'user-agent': USER_AGENT },
      })
    } catch (error) {
      attempts.push(error)
    }
  }
  const reason = attempts.length > 0 ? attempts[attempts.length - 1].message : 'no address'
  throw new Error(`feed unreachable: ${reason}`)
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

function stripTags(html) {
  /* The feed escapes its HTML inside <summary>, so decode before stripping and again after. */
  const decoded = decodeEntities(html)
  return decodeEntities(decoded.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function tagOf(block, tag) {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(block)
  return match ? match[1] : ''
}

function parseEntries(xml) {
  const entries = []
  const blocks = String(xml || '').match(/<entry\b[\s\S]*?<\/entry>/gi) || []
  for (const block of blocks) {
    const summaryHtml = tagOf(block, 'summary') || tagOf(block, 'content')
    const statusMatch = /Status:\s*<\/strong>?\s*([a-zA-Z-]+)/i.exec(stripTags(summaryHtml)) ||
      /Status:\s*([a-zA-Z-]+)/i.exec(stripTags(summaryHtml))
    const plainSummary = stripTags(summaryHtml)
    const componentsMatch = /Affected components:\s*(.+?)(?:\s*$)/i.exec(plainSummary)
    const linkMatch = /<link[^>]*href="([^"]+)"/i.exec(block)
    entries.push({
      title: stripTags(tagOf(block, 'title')).replace(/\s*\([^)]*\)\s*$/, '') || stripTags(tagOf(block, 'title')),
      fullTitle: stripTags(tagOf(block, 'title')),
      status: statusMatch ? statusMatch[1].toLowerCase() : 'unknown',
      components: componentsMatch ? componentsMatch[1].trim() : '',
      updated: stripTags(tagOf(block, 'updated')),
      link: linkMatch ? decodeEntities(linkMatch[1]) : 'https://status.deepseek.com/',
      summary: stripTags(summaryHtml),
    })
  }
  entries.sort((left, right) => Date.parse(right.updated || 0) - Date.parse(left.updated || 0))
  return entries
}

const OPEN_STATUS = new Set(['investigating', 'identified'])
const WATCH_STATUS = new Set(['monitoring', 'verifying', 'in_progress', 'scheduled', 'maintenance'])

/**
 * Map the newest incident onto one of four tones.
 * Green: nothing open. Yellow: an incident is being watched/scheduled.
 * Red: an incident is open. Grey: the feed itself could not be read.
 */
function summarize(entries, fetchedAt) {
  const open = entries.filter((entry) => OPEN_STATUS.has(entry.status))
  const watch = entries.filter((entry) => WATCH_STATUS.has(entry.status))
  const newest = entries[0]
  if (open.length > 0) {
    return {
      state: 'down',
      tone: 'error',
      headline: open[0].fullTitle || open[0].title,
      detail: open[0].components || open[0].summary,
      entry: open[0],
      updated: Date.parse(open[0].updated) || fetchedAt,
    }
  }
  if (watch.length > 0) {
    return {
      state: 'degraded',
      tone: 'warn',
      headline: watch[0].fullTitle || watch[0].title,
      detail: watch[0].components || watch[0].summary,
      entry: watch[0],
      updated: Date.parse(watch[0].updated) || fetchedAt,
    }
  }
  return {
    state: 'ok',
    tone: 'success',
    headline: 'All systems operational',
    detail: newest ? `Latest: ${newest.fullTitle || newest.title} (${newest.status})` : 'No incidents reported',
    entry: newest || null,
    updated: newest ? Date.parse(newest.updated) || fetchedAt : fetchedAt,
  }
}

async function readStatus(force = false) {
  const now = Date.now()
  if (!force && cache.payload && now - cache.at < CACHE_MS) return cache.payload
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const body = await fetchFeed()
      const entries = parseEntries(body)
      const summary = summarize(entries, now)
      const payload = {
        ok: true,
        fetchedAt: now,
        state: summary.state,
        tone: summary.tone,
        headline: summary.headline,
        detail: summary.detail,
        updated: summary.updated,
        entry: summary.entry,
        incidents: entries.slice(0, 5),
      }
      cache.at = now
      cache.payload = payload
      return payload
    } catch (error) {
      const payload = {
        ok: false,
        fetchedAt: now,
        state: 'unknown',
        tone: 'idle',
        headline: 'Status feed unavailable',
        detail: error && error.message ? error.message : String(error),
        updated: 0,
        entry: null,
        incidents: [],
      }
      /* Keep a stale answer warm so a transient network blip does not grey the dot. */
      if (cache.payload) return { ...cache.payload, stale: true, error: payload.detail }
      cache.at = now
      cache.payload = payload
      return payload
    } finally {
      inflight = null
    }
  })()
  return inflight
}

function sendJson(response, statusCode, value) {
  const body = JSON.stringify(value)
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
  })
  response.end(body)
}

function createRelay() {
  return createServer((request, response) => {
    const url = request.url || '/'
    if (request.method === 'OPTIONS') {
      sendJson(response, 204, {})
      return
    }
    if (request.method !== 'GET') {
      sendJson(response, 405, { ok: false, error: 'method not allowed' })
      return
    }
    if (url.startsWith('/status')) {
      const force = /[?&]refresh=1/.test(url)
      readStatus(force).then(
        (payload) => sendJson(response, 200, payload),
        (error) => sendJson(response, 200, {
          ok: false,
          state: 'unknown',
          tone: 'idle',
          headline: 'Status feed unavailable',
          detail: error && error.message ? error.message : String(error),
          updated: 0,
          incidents: [],
        }),
      )
      return
    }
    if (url.startsWith('/health')) {
      sendJson(response, 200, { ok: true, feed: FEED_URL })
      return
    }
    sendJson(response, 404, { ok: false, error: 'not found' })
  })
}

function listenOn(server, port) {
  return new Promise((resolve) => {
    const onError = (error) => {
      server.removeListener('listening', onListening)
      resolve({ ok: false, error })
    }
    const onListening = () => {
      server.removeListener('error', onError)
      resolve({ ok: true, port })
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, '127.0.0.1')
  })
}

async function startRelay() {
  for (const port of PORTS) {
    const server = createRelay()
    const result = await listenOn(server, port)
    if (result.ok) {
      /* Warm the cache so the first Client poll is instant. */
      readStatus().catch(() => {})
      return server
    }
    try { server.close() } catch (error) { /* already closed */ }
  }
  return null
}

export function apply(ctx) {
  let server = null
  let closed = false

  const boot = startRelay().then((started) => {
    if (closed) {
      try { if (started) started.close() } catch (error) { /* ignore */ }
      return
    }
    server = started
    if (!started) {
      console.warn('[workspace-session-filter] no loopback port available for the status relay')
    }
  })

  const dispose = () => {
    closed = true
    boot.then(() => {
      if (server) {
        try { server.close() } catch (error) { /* ignore */ }
        server = null
      }
    }, () => {})
  }

  if (ctx && typeof ctx.effect === 'function') ctx.effect(() => dispose)
  else return dispose
  return undefined
}
