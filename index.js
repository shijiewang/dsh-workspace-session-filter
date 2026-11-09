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
import * as zlib from 'node:zlib'
import {
  existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { request as httpsRequest } from 'node:https'
import { promises as dns } from 'node:dns'

const FEED_HOST = 'status.deepseek.com'
const FEED_PATH = '/feed.atom'
const FEED_URL = `https://${FEED_HOST}${FEED_PATH}`
const PORTS = [47100, 47101, 47102, 47103, 47104, 47105]
const CACHE_MS = 60_000
const TIMEOUT_MS = 8_000
const USER_AGENT = 'dsh-workspace-session-filter (+https://github.com/shijiewang/dsh-workspace-session-filter)'

const cache = { at: 0, payload: null, etag: null }
let inflight = null

/** Resolves `{ status, headers, body }` for any status the server chose to send. */
function fetchVia(options, timeout = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(options, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => resolve({
        status: res.statusCode || 0,
        headers: res.headers || {},
        body: Buffer.concat(chunks).toString('utf8'),
      }))
    })
    req.setTimeout(timeout, () => req.destroy(new Error('timeout')))
    req.on('error', reject)
    req.end()
  })
}

/** A conditional GET: the feed answers 304 while nothing changed. */
function fetchFeedDirect(etag) {
  const headers = {
    host: FEED_HOST,
    accept: 'application/atom+xml',
    'user-agent': USER_AGENT,
    'accept-encoding': 'identity',
  }
  if (etag) headers['if-none-match'] = etag
  return fetchVia({ host: FEED_HOST, path: FEED_PATH, method: 'GET', headers })
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
      const answer = await fetchVia({
        href: url,
        headers: { accept: 'application/dns-json', 'user-agent': USER_AGENT },
      })
      if (answer.status !== 200) continue
      const parsed = JSON.parse(answer.body)
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

async function fetchFeed(etag) {
  const attempts = []
  const check = (answer) => {
    if (answer.status === 304) return { notModified: true, etag }
    if (answer.status !== 200) throw new Error(`HTTP ${answer.status}`)
    return {
      notModified: false,
      body: answer.body,
      etag: answer.headers.etag || etag,
    }
  }
  try {
    return check(await fetchFeedDirect(etag))
  } catch (error) {
    attempts.push(error)
  }
  const addresses = await resolveAddresses()
  for (const address of addresses) {
    try {
      const headers = {
        host: FEED_HOST,
        accept: 'application/atom+xml',
        'user-agent': USER_AGENT,
        'accept-encoding': 'identity',
      }
      if (etag) headers['if-none-match'] = etag
      return check(await fetchVia({
        host: address,
        path: FEED_PATH,
        method: 'GET',
        servername: FEED_HOST,
        headers,
      }))
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
      const answer = await fetchFeed(cache.etag)
      if (answer.notModified && cache.payload) {
        /* Nothing changed upstream: refresh the stamp, keep the parsed reading. */
        cache.at = now
        cache.payload = { ...cache.payload, fetchedAt: now, cached: true }
        return cache.payload
      }
      cache.etag = answer.etag || null
      const entries = parseEntries(answer.body)
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


/* ------------------------------------------------------------------------- *
 * Session housekeeping: digest export and reversible removal.
 *
 * The Client half cannot touch the session store, so both live here: session
 * logs are read from `<data home>/sessions`, decoded from their zstd JSONL
 * form, folded into a Markdown digest, and "deleted" sessions are moved into
 * `sessions/.trash/<stamp>/` instead of being unlinked, so a removal can be
 * undone by moving the directory back.
 * ------------------------------------------------------------------------- */

const SESSION_LOG_NAMES = ['session.v4.jsonl.zstd', 'session.jsonl.zstd', 'session.v4.jsonl', 'session.jsonl']

function dataHome() {
  return process.env.DSH_HOME || join(homedir(), '.dsh_desktop')
}

function sessionsRoot() {
  return join(dataHome(), 'sessions')
}

function sessionDirs() {
  const root = sessionsRoot()
  const found = []
  let groups = []
  try {
    groups = readdirSync(root, { withFileTypes: true })
  } catch (error) {
    return found
  }
  for (const group of groups) {
    if (!group.isDirectory() || group.name === '.trash') continue
    const groupDir = join(root, group.name)
    let entries = []
    try {
      entries = readdirSync(groupDir, { withFileTypes: true })
    } catch (error) {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith('session')) continue
      found.push({
        id: entry.name.replace(/^session-/, ''),
        dir: join(groupDir, entry.name),
        group: group.name,
      })
    }
  }
  return found
}

function textOfContent(content) {
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''
  return content
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
    .trim()
}

function readSessionLog(dir) {
  const file = SESSION_LOG_NAMES.map((name) => join(dir, name)).find((path) => existsSync(path))
  if (!file) return null
  let text = null
  try {
    const raw = readFileSync(file)
    if (file.endsWith('.zstd')) {
      if (typeof zlib.zstdDecompressSync !== 'function') return null
      text = zlib.zstdDecompressSync(raw).toString('utf8')
    } else {
      text = raw.toString('utf8')
    }
  } catch (error) {
    return null
  }
  if (!text) return null
  let header = null
  const events = []
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue
    let value
    try {
      value = JSON.parse(line)
    } catch (error) {
      continue
    }
    if (!header && value && value.type === 'session') {
      header = value
      continue
    }
    if (value) events.push(value)
  }
  return { header, events }
}

function digestSession(info) {
  const log = readSessionLog(info.dir)
  const base = {
    id: info.id,
    workspace: info.group,
    dir: info.dir,
    title: '',
    createdAt: 0,
    updatedAt: 0,
    cwd: '',
    preset: '',
    userCount: 0,
    assistantCount: 0,
    requests: [],
    outcomes: [],
    tools: new Map(),
    files: new Set(),
    commands: [],
    readable: Boolean(log),
  }
  if (!log) return base
  const header = log.header || {}
  base.createdAt = Number(header.createdAt) || 0
  base.updatedAt = base.createdAt
  base.cwd = typeof header.cwd === 'string' ? header.cwd : ''
  base.preset = typeof header.agentPreset === 'string' ? header.agentPreset : ''
  for (const event of log.events) {
    if (typeof event.time === 'number' && event.time > base.updatedAt) base.updatedAt = event.time
    const data = event.data || {}
    if (event.type === 'user/message') {
      base.userCount += 1
      const text = textOfContent(data.content)
      if (text) base.requests.push(text)
    } else if (event.type === 'assistant/message') {
      base.assistantCount += 1
      const text = textOfContent(data.message && data.message.content)
      if (text) base.outcomes.push(text)
    } else if (event.type === 'tool/call') {
      const name = typeof data.name === 'string' ? data.name : 'tool'
      base.tools.set(name, (base.tools.get(name) || 0) + 1)
      const args = typeof data.arguments === 'string' ? data.arguments : ''
      const pathMatch = /"(?:file_path|filePath|path|target)"\s*:\s*"([^"]+)"/.exec(args)
      if (pathMatch) base.files.add(pathMatch[1])
      if (name === 'bash' || name === 'shell') {
        const commandMatch = /"command"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(args)
        if (commandMatch) base.commands.push(commandMatch[1].replace(/\\n/g, '\n').slice(0, 400))
      }
    }
  }
  return base
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function stampLabel(date = new Date()) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
}

function clockLabel(ms) {
  if (!ms) return '—'
  const date = new Date(ms)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function clip(text, limit) {
  const value = String(text || '').replace(/\r/g, '').trim()
  if (value.length <= limit) return value
  return `${value.slice(0, limit)}\n\n…（已截断，原文 ${value.length} 字）`
}

function fence(text) {
  return String(text || '').replace(/```/g, '``\u200b`')
}

function toolSummary(tools) {
  const rows = [...tools.entries()].sort((left, right) => right[1] - left[1])
  return rows.map(([name, count]) => `${name}×${count}`).join('、')
}

function digestMarkdown(digests, meta) {
  const lines = []
  lines.push(`# DSH 会话清理摘要（${meta.stamp}）`)
  lines.push('')
  lines.push(`- 导出时间：${meta.iso}`)
  lines.push(`- 会话数：${digests.length}`)
  if (meta.note) lines.push(`- 说明：${meta.note}`)
  lines.push('')
  lines.push('## 索引')
  lines.push('')
  lines.push('| # | 标题 | 工作区 | 最后活动 | 消息 | 主要工具 |')
  lines.push('| --- | --- | --- | --- | --- | --- |')
  digests.forEach((digest, index) => {
    const title = (digest.title || `会话 ${digest.id.slice(0, 8)}`).replace(/\|/g, '\\|')
    const workspace = (digest.cwd || digest.workspace).split('/').filter(Boolean).pop() || '—'
    lines.push(`| ${index + 1} | ${title} | ${workspace} | ${clockLabel(digest.updatedAt)} | ${digest.userCount + digest.assistantCount} | ${toolSummary(digest.tools) || '—'} |`)
  })
  digests.forEach((digest, index) => {
    lines.push('')
    lines.push(`## ${index + 1}. ${digest.title || `会话 ${digest.id.slice(0, 8)}`}`)
    lines.push('')
    lines.push(`- 会话：\`${digest.id}\``)
    lines.push(`- 工作区：\`${digest.cwd || digest.workspace}\``)
    if (digest.preset) lines.push(`- 预设：\`${digest.preset}\``)
    lines.push(`- 创建：${clockLabel(digest.createdAt)}　最后活动：${clockLabel(digest.updatedAt)}`)
    lines.push(`- 规模：用户消息 ${digest.userCount} 条、助手消息 ${digest.assistantCount} 条${digest.tools.size ? `、工具调用 ${[...digest.tools.values()].reduce((sum, value) => sum + value, 0)} 次` : ''}`)
    if (digest.readable === false) {
      lines.push('- ⚠️ 会话日志无法解码，仅保留元信息。')
      return
    }
    const first = digest.requests[0]
    const last = digest.outcomes[digest.outcomes.length - 1]
    if (first) {
      lines.push('')
      lines.push('**最初的请求**')
      lines.push('')
      lines.push('```text')
      lines.push(fence(clip(first, 900)))
      lines.push('```')
    }
    if (last) {
      lines.push('')
      lines.push('**最后的结论**')
      lines.push('')
      lines.push('```text')
      lines.push(fence(clip(last, 900)))
      lines.push('```')
    }
    if (digest.files.size > 0) {
      lines.push('')
      lines.push('**涉及的文件**')
      lines.push('')
      for (const file of [...digest.files].slice(0, 12)) lines.push(`- \`${file}\``)
      if (digest.files.size > 12) lines.push(`- …另有 ${digest.files.size - 12} 个`)
    }
    if (digest.commands.length > 0) {
      lines.push('')
      lines.push('**执行过的命令**')
      lines.push('')
      lines.push('```sh')
      digest.commands.slice(0, 8).forEach((command) => lines.push(fence(command)))
      lines.push('```')
    }
  })
  lines.push('')
  return lines.join('\n')
}


const DIGEST_PREFIX = 'dsh-session-digest-'

function digestFolders() {
  return [join(homedir(), 'Downloads'), join(dataHome(), 'session-digests')]
}

function listDigests() {
  const items = []
  for (const folder of digestFolders()) {
    if (!existsSync(folder)) continue
    let names = []
    try { names = readdirSync(folder) } catch (error) { continue }
    for (const name of names) {
      if (!name.startsWith(DIGEST_PREFIX) || !name.endsWith('.md')) continue
      try {
        const info = statSync(join(folder, name))
        items.push({ name, folder, size: info.size, mtime: info.mtimeMs })
      } catch (error) { /* vanished between readdir and stat */ }
    }
  }
  items.sort((left, right) => right.mtime - left.mtime)
  return items.slice(0, 40)
}

function readDigest(rawName) {
  const name = String(rawName || '').replace(/^.*[\\/]/, '')
  if (!name.startsWith(DIGEST_PREFIX) || !name.endsWith('.md')) return null
  for (const folder of digestFolders()) {
    const file = join(folder, name)
    if (!existsSync(file)) continue
    try {
      const text = readFileSync(file, 'utf8')
      return { ok: true, name, path: file, text, bytes: Buffer.byteLength(text) }
    } catch (error) { /* unreadable */ }
  }
  return null
}

/* Session ids reach the Host in more than one shape (`<uuid>`, `session-<uuid>`,
 * `session:<uuid>`). Match on the uuid, not on the prefix. */
function matchSession(known, rawId) {
  const id = String(rawId)
  const direct = known.get(id)
  if (direct) return direct
  const stripped = known.get(id.replace(/^session[-:]/, ''))
  if (stripped) return stripped
  const tail = id.slice(-36)
  if (tail.length === 36) {
    const byTail = known.get(tail)
    if (byTail) return byTail
  }
  for (const entry of known.values()) {
    if (id.endsWith(entry.id)) return entry
  }
  return undefined
}

function exportDigests(ids, titles, note) {
  const known = new Map(sessionDirs().map((entry) => [entry.id, entry]))
  const digests = []
  const missing = []
  for (const rawId of ids) {
    const id = String(rawId)
    const info = matchSession(known, id)
    if (!info) {
      missing.push(id)
      continue
    }
    const digest = digestSession(info)
    const known_title = titles && typeof titles === 'object' ? titles[id] : ''
    digest.title = String(known_title || '').trim()
    digests.push(digest)
  }
  if (digests.length === 0) {
    return { ok: false, error: 'no matching session directories', sessions: 0, missing }
  }
  const now = new Date()
  const stamp = stampLabel(now)
  const markdown = digestMarkdown(digests, { stamp, iso: now.toISOString(), note })
  const downloads = join(homedir(), 'Downloads')
  const target = existsSync(downloads) ? downloads : join(dataHome(), 'session-digests')
  mkdirSync(target, { recursive: true })
  const file = join(target, `dsh-session-digest-${stamp}.md`)
  writeFileSync(file, markdown, 'utf8')
  return { ok: true, file, name: `dsh-session-digest-${stamp}.md`, sessions: digests.length, missing, bytes: Buffer.byteLength(markdown) }
}

function trashSessions(ids) {
  const known = new Map(sessionDirs().map((entry) => [entry.id, entry]))
  const stamp = stampLabel()
  const moved = []
  const failed = []
  for (const rawId of ids) {
    const id = String(rawId)
    const info = matchSession(known, id)
    if (!info) {
      failed.push({ id, reason: 'not found' })
      continue
    }
    const destination = join(sessionsRoot(), '.trash', stamp, info.group, `session-${info.id}`)
    try {
      mkdirSync(dirname(destination), { recursive: true })
      renameSync(info.dir, destination)
      moved.push(info.id)
    } catch (error) {
      failed.push({ id, reason: error && error.message ? error.message : String(error) })
    }
  }
  return { ok: failed.length === 0, stamp, moved, failed, trash: join(sessionsRoot(), '.trash', stamp) }
}

function readBody(request, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('body too large'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      if (text.trim() === '') {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(text))
      } catch (error) {
        reject(new Error('invalid json body'))
      }
    })
    request.on('error', reject)
  })
}

function idList(body) {
  const value = body && body.ids
  if (!Array.isArray(value)) return []
  return value.filter((id) => typeof id === 'string' && id !== '').slice(0, 500)
}

function sendJson(response, statusCode, value) {
  const body = JSON.stringify(value)
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
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
    if (request.method === 'POST' && url.startsWith('/export')) {
      readBody(request).then((body) => {
        const ids = idList(body)
        if (ids.length === 0) {
          sendJson(response, 400, { ok: false, error: 'ids required' })
          return
        }
        try {
          sendJson(response, 200, exportDigests(ids, body.titles, typeof body.note === 'string' ? body.note : ''))
        } catch (error) {
          sendJson(response, 200, { ok: false, error: error && error.message ? error.message : String(error) })
        }
      }, (error) => sendJson(response, 400, { ok: false, error: error.message }))
      return
    }
    if (request.method === 'POST' && url.startsWith('/trash')) {
      readBody(request).then((body) => {
        const ids = idList(body)
        if (ids.length === 0) {
          sendJson(response, 400, { ok: false, error: 'ids required' })
          return
        }
        try {
          sendJson(response, 200, trashSessions(ids))
        } catch (error) {
          sendJson(response, 200, { ok: false, error: error && error.message ? error.message : String(error) })
        }
      }, (error) => sendJson(response, 400, { ok: false, error: error.message }))
      return
    }
    if (request.method !== 'GET') {
      sendJson(response, 405, { ok: false, error: 'method not allowed' })
      return
    }
    if (url.startsWith('/sessions')) {
      const ids = sessionDirs().map((entry) => entry.id)
      sendJson(response, 200, { ok: true, count: ids.length, ids })
      return
    }
    if (url.startsWith('/digests')) {
      sendJson(response, 200, { ok: true, items: listDigests() })
      return
    }
    if (url.startsWith('/digest')) {
      const query = url.indexOf('?')
      const params = new URLSearchParams(query === -1 ? '' : url.slice(query + 1))
      const found = readDigest(params.get('file'))
      if (!found) {
        sendJson(response, 404, { ok: false, error: 'digest not found' })
        return
      }
      sendJson(response, 200, found)
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
      sendJson(response, 200, {
        ok: true,
        feed: FEED_URL,
        sessions: sessionDirs().length,
        zstd: typeof zlib.zstdDecompressSync === 'function',
      })
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
