/* Logic smoke test: renders the real components against fixture snapshots.
 * Run with `node test/smoke.cjs` (no dependencies; React is a small local stub).
 *
 * A hand-written mini React (hooks keyed by tree path) renders the real
 * component functions against fixture snapshots, then drives chips + 更多. */
const fs = require('node:fs')
const vm = require('node:vm')
const assert = require('node:assert')

const path = require('node:path')
const FILE = path.resolve(__dirname, '..', 'client.js')

/* ------------------------------ mini react ------------------------------ */
const hookStore = new Map()
const classStore = new Map()
let currentInst = null

function createElement(type, props, ...children) {
  const merged = Object.assign({}, props || {})
  if (children.length > 0) merged.children = children.length === 1 ? children[0] : children
  return { type, props: merged }
}
const useState = (init) => {
  const inst = currentInst
  const i = inst.cursor++
  if (!(i in inst.hooks)) inst.hooks[i] = typeof init === 'function' ? init() : init
  return [inst.hooks[i], (next) => {
    inst.hooks[i] = typeof next === 'function' ? next(inst.hooks[i]) : next
  }]
}
const useEffect = () => { currentInst.cursor++ }
const useRef = (init) => {
  const inst = currentInst
  const i = inst.cursor++
  if (!(i in inst.hooks)) inst.hooks[i] = { current: init }
  return inst.hooks[i]
}
class Component {
  constructor(props) { this.props = props; this.state = {} }
  setState(next) { Object.assign(this.state, typeof next === 'function' ? next(this.state) : next) }
}
const React = { createElement, useState, useEffect, useRef, Component, Fragment: Symbol('fragment') }

/* ------------------------------- renderer ------------------------------- */
function flatten(node, out) {
  if (node === null || node === undefined || node === false || node === true) return out
  if (Array.isArray(node)) { for (const child of node) flatten(child, out); return out }
  out.push(node)
  return out
}

function renderElement(node, path) {
  if (node === null || node === undefined || node === false || node === true) return null
  if (typeof node === 'string' || typeof node === 'number') return { text: String(node) }
  if (Array.isArray(node)) return node.map((child, i) => renderElement(child, path + '/' + i)).filter((n) => n !== null)
  const type = node.type
  const props = node.props || {}
  if (typeof type === 'string') {
    const children = []
    for (const child of flatten(props.children, [])) {
      const rendered = renderElement(child, path + '/' + children.length)
      if (rendered === null) continue
      children.push(rendered)
    }
    return { tag: type, props, children }
  }
  if (type === React.Fragment) return renderElement(props.children, path + '/f')
  if (typeof type === 'function') {
    const inst = hookStore.get(path) || { hooks: [], cursor: 0 }
    hookStore.set(path, inst)
    inst.cursor = 0
    const previous = currentInst
    currentInst = inst
    let output
    try {
      if (type.prototype && typeof type.prototype.render === 'function') {
        let instance = classStore.get(path)
        if (instance === undefined) { instance = new type(props); classStore.set(path, instance) } else { instance.props = props }
        output = instance.render()
      } else {
        output = type(props)
      }
    } finally {
      currentInst = previous
    }
    return renderElement(output, path + '/o')
  }
  throw new Error('unknown element type: ' + String(type))
}

function walk(node, visit) {
  if (node === null || node === undefined) return
  if (Array.isArray(node)) { for (const child of node) walk(child, visit); return }
  visit(node)
  for (const child of node.children || []) walk(child, visit)
}
function textOf(node) {
  let out = ''
  walk(node, (item) => { if (typeof item.text === 'string') out += item.text })
  return out
}
function findAll(root, predicate) {
  const hits = []
  walk(root, (node) => { if (node.tag && predicate(node)) hits.push(node) })
  return hits
}
const buttonsWithClass = (root, cls) => findAll(root, (n) => n.tag === 'button' && n.props.className === cls)
const buttonByText = (root, text) => buttonsWithClass(root, 'dwsf-filter').concat(buttonsWithClass(root, 'dwsf-reset'))
  .find((node) => textOf(node).trim().startsWith(text))

/* --------------------------------- module -------------------------------- */
const source = fs.readFileSync(FILE, 'utf8')
let spec = null
const sandbox = {
  window: { __ModuleLoader__: { load(value) { spec = value } } },
  document: {
    createElement: () => ({ dataset: {}, remove() {}, textContent: '' }),
    head: { appendChild() {} },
    addEventListener() {}, removeEventListener() {},
  },
  Node: class Node {},
  console: { log() {}, error() {} },
  setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
  Date,
}
vm.runInNewContext(source, sandbox, { filename: FILE })
assert.ok(spec, 'module did not call window.__ModuleLoader__.load')
assert.strictEqual(spec.id, 'dsh-workspace-session-filter')

const plugin = spec.factory((name) => {
  if (name === 'react') return React
  throw new Error('unexpected require: ' + name)
})
assert.strictEqual(Array.from(plugin.inject).join(','), 'slots')
assert.strictEqual(typeof plugin.apply, 'function')

/* ------------------------------ fake services ---------------------------- */
const registered = { dicts: new Map(), styles: [], entries: [], opened: [] }
const translate = (key, params) => {
  const dict = registered.dicts.get('zh') || {}
  let text = dict[key] !== undefined ? dict[key] : key
  if (params) for (const name of Object.keys(params)) text = text.split('{' + name + '}').join(String(params[name]))
  return text
}
const locale = {
  bind: () => (key, params) => translate(key, params),
  register: (ns, dicts) => {
    for (const [id, dict] of Object.entries(dicts)) registered.dicts.set(id, dict)
    return () => {}
  },
  getLocale: () => ({ active: 'zh', locales: [{ id: 'zh' }, { id: 'en' }], revision: 1 }),
}
let currentSlot = null
const ctx = {
  get(name) {
    if (name === 'locale') return locale
    if (name === 'styles') return { insert: (css) => { registered.styles.push(css); return () => {} } }
    if (name === 'uiWorkspace') return { openSession: (id) => registered.opened.push(id) }
    return undefined
  },
  effect(callback) { const dispose = callback(); return dispose || (() => {}) },
  slots: {
    inject(slot, callback) { currentSlot = slot; callback(); return () => {} },
    register(options, component) { registered.entries.push([currentSlot, options, component]); return () => {} },
  },
}
plugin.apply(ctx)

const panelEntry = registered.entries.find(([slot]) => slot === 'main')
const iconEntry = registered.entries.find(([slot]) => slot === 'sidebar.panellist')
assert.ok(panelEntry, 'main registration missing')
assert.ok(iconEntry, 'sidebar.panellist registration missing')
assert.strictEqual(panelEntry[1].key, 'session-filter')
assert.strictEqual(iconEntry[1].id, 'session-filter')
assert.strictEqual(typeof iconEntry[1].label, 'function')
assert.strictEqual(iconEntry[1].order, 30)
assert.strictEqual(registered.dicts.get('zh')['panel.title'], '工作区会话')
assert.ok(registered.styles[0].includes('.dwsf-page'), 'stylesheet missing page rule')

/* --------------------------------- fixtures ------------------------------ */
const now = Date.now()
const summary = (id, title, extra) => Object.assign({
  id, displayTitle: title, title, running: false, retainedBy: {}, blank: false, updatedAt: now - 5 * 60000,
}, extra)
const byId = {
  s1: summary('s1', 'Alpha API', { running: true, updatedAt: now - 5 * 60000 }),
  s2: summary('s2', 'Beta docs', { updatedAt: now - 2 * 3600000 }),
  s3: summary('s3', '', { blank: true, retainedBy: { mainView: 1 }, updatedAt: now - 60000 }),
  s4: summary('s4', 'Archived one', { running: true, updatedAt: now - 60000 }),
  s5: summary('s5', 'Subagent run', { running: true, origin: 'subagent', updatedAt: now - 60000 }),
  s6: summary('s6', 'Stray session', { updatedAt: now - 3 * 3600000 }),
  s7: summary('s7', 'Ancient session', { updatedAt: now - 10 * 86400000 }),
}
const listState = { ids: ['s1', 's2', 's3', 's4', 's5', 's6', 's7'], byId, phase: 'ready' }
const workspaceState = {
  items: [
    { workspaceId: 'w1', path: '/Users/x/alpha', title: 'Alpha', sessionIds: ['s1', 's2', 's3', 's4', 's5'] },
    { workspaceId: 'w2', path: '/Users/x/beta', title: '', sessionIds: ['s7'] },
  ],
  archivedSessionIds: ['s4'],
  pinnedSessionIds: [],
  phase: 'ready',
}
const statusMap = new Map([
  ['s1', { running: true }],
  ['s2', { pendingInteraction: { kind: 'approval' } }],
])
const props = {
  t: locale.bind('workspace-session-filter'),
  onOpen: (id) => registered.opened.push(id),
  useSessions: (sel) => sel(listState),
  useWorkspaces: (sel) => sel(workspaceState),
  useSessionStatus: (sel) => sel(statusMap),
  size: 20,
  active: false,
}

/* ------------------------------- assertions ------------------------------ */
function renderInto(component, extraProps) {
  return renderElement(createElement(component, Object.assign({}, props, extraProps)), 'root')
}

let tree = renderInto(panelEntry[2])
let chips = buttonsWithClass(tree, 'dwsf-filter')
assert.deepStrictEqual(chips.map((n) => textOf(n).trim()), ['全部5', '运行中1', '等待确认1', '更多'])
let rows = buttonsWithClass(tree, 'dwsf-row')
assert.strictEqual(rows.length, 5, 'archived / subagent / non-current blank excluded')
let groups = findAll(tree, (n) => n.props.className === 'dwsf-group')
assert.strictEqual(groups.length, 3, 'Alpha + Beta + ungrouped')
assert.ok(textOf(groups[0]).includes('Alpha'))
assert.ok(textOf(groups[1]).includes('beta'), 'basename fallback for untitled workspace')
assert.ok(textOf(tree).includes('5 个会话 · 3 个工作区'))
assert.ok(textOf(tree).includes('新会话'), 'blank current session labelled')
assert.ok(textOf(tree).includes('等待审批'), 'awaiting label rendered')

buttonByText(tree, '运行中').props.onClick()
tree = renderInto(panelEntry[2])
assert.strictEqual(buttonsWithClass(tree, 'dwsf-row').length, 1)
assert.strictEqual(buttonByText(tree, '运行中').props['aria-pressed'], 'true')
assert.ok(buttonByText(tree, '清除筛选'), 'reset appears while filtered')
assert.ok(textOf(buttonsWithClass(tree, 'dwsf-row')[0]).includes('Alpha API'))

buttonByText(tree, '全部').props.onClick()
tree = renderInto(panelEntry[2])
assert.strictEqual(buttonsWithClass(tree, 'dwsf-row').length, 5)
assert.strictEqual(buttonByText(tree, '清除筛选'), undefined, 'reset hidden when unfiltered')

buttonByText(tree, '等待确认').props.onClick()
tree = renderInto(panelEntry[2])
assert.strictEqual(buttonsWithClass(tree, 'dwsf-row').length, 1)
assert.ok(textOf(buttonsWithClass(tree, 'dwsf-row')[0]).includes('Beta docs'))

buttonByText(tree, '清除筛选').props.onClick()
tree = renderInto(panelEntry[2])
assert.strictEqual(buttonsWithClass(tree, 'dwsf-row').length, 5)

const moreButton = () => buttonsWithClass(tree, 'dwsf-filter').find((n) => n.props['aria-haspopup'] === 'menu')
moreButton().props.onClick()
tree = renderInto(panelEntry[2])
assert.strictEqual(findAll(tree, (n) => n.props.className === 'dwsf-menu').length, 1, 'menu opens')
let items = findAll(tree, (n) => n.tag === 'button' && n.props.role === 'menuitemradio')
assert.deepStrictEqual(items.map((n) => textOf(n).trim()), ['不限时间', '最近一天', '最近三天', '最近一周', '最近一个月'])
assert.strictEqual(items[0].props['aria-checked'], 'true')

items[2].props.onClick()
tree = renderInto(panelEntry[2])
assert.strictEqual(findAll(tree, (n) => n.props.className === 'dwsf-menu').length, 0, 'menu closes after pick')
assert.strictEqual(buttonsWithClass(tree, 'dwsf-row').length, 4, '10-day-old session dropped by 最近三天')
assert.strictEqual(findAll(tree, (n) => n.props.className === 'dwsf-group').length, 2)
assert.strictEqual(textOf(moreButton()).trim(), '最近三天')

moreButton().props.onClick()
tree = renderInto(panelEntry[2])
items = findAll(tree, (n) => n.tag === 'button' && n.props.role === 'menuitemradio')
items[0].props.onClick()
tree = renderInto(panelEntry[2])
assert.strictEqual(buttonsWithClass(tree, 'dwsf-row').length, 5)

buttonsWithClass(tree, 'dwsf-row')[0].props.onClick()
assert.strictEqual(registered.opened.length, 1, 'row click opens a session')
assert.strictEqual(typeof registered.opened[0], 'string')

const icon = renderElement(createElement(iconEntry[2], { size: 22, active: true }), 'icon')
assert.strictEqual(icon.tag, 'svg')
assert.strictEqual(icon.props.width, 22)
assert.strictEqual(icon.children.length, 3)

/* ------------------------------ footer bar ------------------------------ */
const footEntry = registered.entries.find(([slot]) => slot === 'sidebar.footer.action')
assert.ok(footEntry, 'sidebar.footer.action registration missing')
assert.strictEqual(footEntry[1].id, 'session-filter')
assert.strictEqual(footEntry[1].order, 10)
assert.strictEqual(typeof footEntry[1].label, 'function')

const renderFoot = (wide) => renderElement(
  createElement(footEntry[2], Object.assign({}, props, { wide })), 'foot')
let foot = renderFoot(true)
let footChips = buttonsWithClass(foot, 'dwsf-footChip')
assert.deepStrictEqual(footChips.map((n) => textOf(n).trim()), ['运行中1', '待确认1'], 'footer keeps only running + awaiting')
assert.strictEqual(findAll(foot, (n) => n.props.className === 'dwsf-pop').length, 0, 'popover closed by default')

footChips[0].props.onClick()
foot = renderFoot(true)
assert.strictEqual(findAll(foot, (n) => n.props.className === 'dwsf-pop').length, 1, 'popover opens')
assert.strictEqual(buttonsWithClass(foot, 'dwsf-footChip')[0].props['data-active'], 'true')
const before = registered.opened.length
let footRows = buttonsWithClass(foot, 'dwsf-row')
assert.strictEqual(footRows.length, 1, 'running filter applied inside the footer list')
assert.ok(textOf(footRows[0]).includes('Alpha API'))
assert.ok(textOf(foot).includes('会话筛选'))
footRows[0].props.onClick()
assert.strictEqual(registered.opened.length, before + 1, 'footer row opens the session')
foot = renderFoot(true)
assert.strictEqual(findAll(foot, (n) => n.props.className === 'dwsf-pop').length, 0, 'popover closes after opening')

buttonsWithClass(foot, 'dwsf-footChip')[1].props.onClick()
foot = renderFoot(true)
footRows = buttonsWithClass(foot, 'dwsf-row')
assert.strictEqual(footRows.length, 1)
assert.ok(textOf(footRows[0]).includes('Beta docs'), 'awaiting filter inside the footer list')
assert.strictEqual(findAll(foot, (n) => n.props.className === 'dwsf-pop').length, 1)

buttonsWithClass(foot, 'dwsf-footChip')[1].props.onClick()
foot = renderFoot(true)
assert.strictEqual(findAll(foot, (n) => n.props.className === 'dwsf-pop').length, 0, 'clicking the active chip closes')

let rail = renderFoot(false)
assert.strictEqual(buttonsWithClass(rail, 'dwsf-footRailButton').length, 1, 'collapsed rail shows one icon button')
assert.strictEqual(buttonsWithClass(rail, 'dwsf-footChip').length, 0, 'rail hides the text chips')
buttonsWithClass(rail, 'dwsf-footRailButton')[0].props.onClick()
rail = renderFoot(false)
assert.deepStrictEqual(buttonsWithClass(rail, 'dwsf-footChip').map((n) => textOf(n).trim()), ['运行中1', '待确认1'])
assert.strictEqual(buttonsWithClass(rail, 'dwsf-row').length, 1, 'rail popover lists the filtered sessions')


statusMap.clear()
hookStore.clear()
tree = renderInto(panelEntry[2])
buttonByText(tree, '等待确认').props.onClick()
tree = renderInto(panelEntry[2])
assert.ok(textOf(tree).includes('没有符合条件的会话'))
assert.strictEqual(buttonsWithClass(tree, 'dwsf-row').length, 0)

console.log('smoke: ok')
