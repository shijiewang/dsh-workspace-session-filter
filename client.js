window.__ModuleLoader__.load({
  id: 'dsh-workspace-session-filter',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useRef, useState } = React

    const PANEL_ID = 'session-filter'
    const NS = 'workspace-session-filter'
    const MINUTE = 60 * 1000
    const HOUR = 60 * MINUTE
    const DAY = 24 * HOUR
    const RANGES = [
      { key: 'day', ms: DAY },
      { key: '3days', ms: 3 * DAY },
      { key: 'week', ms: 7 * DAY },
      { key: 'month', ms: 30 * DAY },
    ]
    const RANGE_MS = { day: DAY, '3days': 3 * DAY, week: 7 * DAY, month: 30 * DAY }

    /** Local midnight for `now`, so "today" matches the clock the user reads. */
    function startOfDay(now) {
      const date = new Date(now)
      date.setHours(0, 0, 0, 0)
      return date.getTime()
    }

    /* ------------------------------------------------------------------ *
     * Dictionaries
     * ------------------------------------------------------------------ */

    const zh = {
      'panel.label': '会话筛选',
      'panel.title': '工作区会话',
      'panel.summary': '{n} 个会话 · {w} 个工作区',
      'filter.all': '全部',
      'filter.running': '运行中',
      'filter.awaiting': '等待确认',
      'filter.awaitingShort': '待确认',
      'filter.unread': '未读',
      'filter.today': '今日',
      'status.service': 'DeepSeek 服务状态',
      'status.serviceOk': '服务正常',
      'status.serviceDegraded': '部分服务异常',
      'status.serviceDown': '服务异常',
      'status.serviceUnknown': '状态未知',
      'status.updated': '状态更新于 {t}',
      'status.stale': '显示的是缓存状态',
      'status.openSite': '点击打开 status.deepseek.com',
      'status.recent': '最近三次故障',
      'manage.open': '选择并删除',
      'manage.close': '完成',
      'manage.search': '搜索标题或路径',
      'manage.picked': '已选 {n} 个',
      'manage.selectAll': '全选',
      'manage.clear': '清空',
      'manage.export': '导出 Markdown',
      'manage.trash': '移入回收站',
      'manage.empty': '没有匹配的会话',
      'manage.confirmTitle': '移入回收站？',
      'manage.confirmBody': '会先写出一份 Markdown 摘要（{n} 个会话，保存到「下载」），再把会话目录移到 ~/.dsh_desktop/sessions/.trash/。需要恢复时把目录移回原位即可。',
      'manage.confirmCancel': '取消',
      'manage.confirmOk': '确认移入',
      'manage.busy': '处理中…',
      'manage.exported': '已导出 {n} 个会话：{path}',
      'manage.trashed': '已把 {n} 个会话移入回收站（刷新窗口后列表更新）',
      'manage.failed': '执行失败：{error}',
      'manage.offline': '本地中继未运行，重启应用后再试',
      'manage.locked': '当前打开的会话不能移入回收站',
      'manage.hint': '勾选后可导出摘要或移入回收站',
      'manage.digests': '摘要文件',
      'manage.digestsTitle': '导出的摘要文件',
      'manage.digestsHint': '每次导出或删除会话前都会写一份 Markdown 摘要，保存在「下载」目录。',
      'manage.digestsEmpty': '还没有导出过摘要',
      'manage.digestsLoading': '读取中…',
      'manage.digestsRefresh': '刷新',
      'manage.digestsClose': '关闭摘要栏',
      'manage.digestsBack': '返回列表',
      'manage.digestMeta': '{size} · {time}',
      'manage.missing': ' ({n} session directories were not found and were skipped)',
      'manage.missing': '（{n} 个会话找不到目录，已跳过）',
      'status.pollNote': '每分钟订阅一次 feed（上游缓存 60 秒）',
      'status.recentNone': '近期没有故障记录',
      'incident.resolved': '已恢复',
      'incident.monitoring': '观察中',
      'incident.identified': '已定位',
      'incident.investigating': '排查中',
      'incident.maintenance': '维护中',
      'incident.unknown': '未知状态',
      'status.offline': '本地状态中继未运行，读不到 status.deepseek.com',
      'settings.nav': '在左侧导航显示',
      'settings.on': '已开启',
      'settings.off': '已关闭',
      'settings.openLink': '打开会话筛选',
      'settings.navHint': '打开后左侧导航多一个「会话筛选」入口，可打开完整筛选面板；关闭时侧边栏底部的筛选条照常可用。',
      'settings.panel': '完整筛选面板',
      'settings.panelHint': '在中间栏打开完整视图：全部 / 运行中 / 等待确认 / 未读，外加按时间窗筛选。',
      'settings.openPanel': '打开面板',
      'filter.more': '更多',
      'filter.reset': '清除筛选',
      'filter.aria': '会话筛选条件',
      'range.any': '不限时间',
      'range.day': '最近一天',
      'range.3days': '最近三天',
      'range.week': '最近一周',
      'range.month': '最近一个月',
      'group.ungrouped': '未分组',
      'group.count': '{n} 个',
      'session.new': '新会话',
      'session.untitled': '未命名会话',
      'session.open': '打开会话“{name}”',
      'status.running': '进行中',
      'status.waitingApproval': '等待审批',
      'status.planReview': '计划待审',
      'status.waitingAnswer': '等待回答',
      'status.subagentsRunning': '{n} 个子智能体运行中',
      'time.now': '刚刚',
      'time.minutes': '{n}分钟',
      'time.hours': '{n}小时',
      'time.days': '{n}天',
      'time.months': '{n}个月',
      'time.years': '{n}年',
      'time.ago': '{t}前',
      'empty.title': '没有符合条件的会话',
      'empty.hint': '换个筛选条件，或切换到「全部」。',
      'empty.loading': '正在载入会话…',
    }

    const en = {
      'panel.label': 'Session filter',
      'panel.title': 'Workspace sessions',
      'panel.summary': '{n} sessions · {w} workspaces',
      'filter.all': 'All',
      'filter.running': 'Running',
      'filter.awaiting': 'Awaiting confirmation',
      'filter.awaitingShort': 'Awaiting',
      'filter.unread': 'Unread',
      'filter.today': 'Today',
      'status.service': 'DeepSeek status',
      'status.serviceOk': 'Operational',
      'status.serviceDegraded': 'Partial degradation',
      'status.serviceDown': 'Incident open',
      'status.serviceUnknown': 'Unknown',
      'status.updated': 'Updated {t}',
      'status.stale': 'Showing a cached reading',
      'status.openSite': 'Click to open status.deepseek.com',
      'status.recent': 'Last three incidents',
      'manage.open': 'Select & delete',
      'manage.close': 'Done',
      'manage.search': 'Search titles or paths',
      'manage.picked': '{n} selected',
      'manage.selectAll': 'Select all',
      'manage.clear': 'Clear',
      'manage.export': 'Export Markdown',
      'manage.trash': 'Move to trash',
      'manage.empty': 'No session matches',
      'manage.confirmTitle': 'Move to the trash?',
      'manage.confirmBody': 'A Markdown digest of the {n} selected sessions is written to Downloads first, then their directories move to ~/.dsh_desktop/sessions/.trash/. Move a directory back to restore it.',
      'manage.confirmCancel': 'Cancel',
      'manage.confirmOk': 'Move them',
      'manage.busy': 'Working…',
      'manage.exported': 'Exported {n} sessions: {path}',
      'manage.trashed': 'Moved {n} sessions to the trash (reload to refresh the list)',
      'manage.failed': 'Failed: {error}',
      'manage.offline': 'The local relay is not running; restart the app and retry',
      'manage.locked': 'The open session cannot be moved to the trash',
      'manage.hint': 'Tick sessions to export a digest or move them to the trash',
      'manage.digests': 'Digests',
      'manage.digestsTitle': 'Exported digests',
      'manage.digestsHint': 'Every export or trash run writes a Markdown digest into your Downloads folder.',
      'manage.digestsEmpty': 'No digest has been written yet',
      'manage.digestsLoading': 'Loading…',
      'manage.digestsRefresh': 'Refresh',
      'manage.digestsClose': 'Close the digest column',
      'manage.digestsBack': 'Back to list',
      'manage.digestMeta': '{size} · {time}',
      'status.pollNote': 'Polls the feed once a minute (upstream caches 60s)',
      'status.recentNone': 'No incidents on record',
      'incident.resolved': 'Resolved',
      'incident.monitoring': 'Monitoring',
      'incident.identified': 'Identified',
      'incident.investigating': 'Investigating',
      'incident.maintenance': 'Maintenance',
      'incident.unknown': 'Unknown',
      'status.offline': 'The local status relay is not running, so status.deepseek.com cannot be read',
      'settings.nav': 'Show in the left navigation',
      'settings.on': 'On',
      'settings.off': 'Off',
      'settings.openLink': 'Open the filter',
      'settings.navHint': 'Adds a Session filter entry to the left navigation that opens the full panel. The filter bar at the foot of the sidebar keeps working either way.',
      'settings.panel': 'Full filter panel',
      'settings.panelHint': 'Open the wide view in the centre column: all / running / awaiting / unread, plus the time-window menu.',
      'settings.openPanel': 'Open panel',
      'filter.more': 'More',
      'filter.reset': 'Clear filters',
      'filter.aria': 'Session filters',
      'range.any': 'Any time',
      'range.day': 'Last 24 hours',
      'range.3days': 'Last 3 days',
      'range.week': 'Last 7 days',
      'range.month': 'Last 30 days',
      'group.ungrouped': 'Ungrouped',
      'group.count': '{n}',
      'session.new': 'New session',
      'session.untitled': 'Untitled session',
      'session.open': 'Open session “{name}”',
      'status.running': 'Running',
      'status.waitingApproval': 'Waiting for approval',
      'status.planReview': 'Plan to review',
      'status.waitingAnswer': 'Waiting for answer',
      'status.subagentsRunning': '{n} subagents running',
      'time.now': 'now',
      'time.minutes': '{n}min',
      'time.hours': '{n}h',
      'time.days': '{n}d',
      'time.months': '{n}mo',
      'time.years': '{n}y',
      'time.ago': '{t} ago',
      'empty.title': 'No sessions match',
      'empty.hint': 'Adjust the filters, or switch back to All.',
      'empty.loading': 'Loading sessions…',
    }

    /* ------------------------------------------------------------------ *
     * Icons
     * ------------------------------------------------------------------ */

    function PanelGlyph(props) {
      const size = props.size || 20
      return h('svg', {
        viewBox: '0 0 24 24',
        width: size,
        height: size,
        'aria-hidden': 'true',
        focusable: 'false',
        style: { display: 'block', flex: 'none' },
      },
        h('path', { d: 'M4 6.75h16', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }),
        h('path', { d: 'M7 12h10', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }),
        h('path', { d: 'M10 17.25h4', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' })
      )
    }

    function ChevronGlyph() {
      return h('svg', {
        viewBox: '0 0 16 16', width: 12, height: 12, 'aria-hidden': 'true', style: { display: 'block' },
      }, h('path', {
        d: 'M4.25 6.25 8 10l3.75-3.75', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5,
        strokeLinecap: 'round', strokeLinejoin: 'round',
      }))
    }

    function DocGlyph(props) {
      const size = props && props.size ? props.size : 14
      return h('svg', {
        width: size, height: size, viewBox: '0 0 16 16', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': 'true', focusable: 'false',
      },
        h('path', { d: 'M3.5 2.2h5.1l3.4 3.3v8.3H3.5z' }),
        h('path', { d: 'M8.5 2.4v3.3h3.4' }),
        h('path', { d: 'M5.7 8.6h4.6M5.7 10.8h4.6' })
      )
    }

    function TrashGlyph(props) {
      const size = props && props.size ? props.size : 14
      return h('svg', {
        width: size, height: size, viewBox: '0 0 16 16', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round',
        'aria-hidden': 'true', focusable: 'false',
      },
        h('path', { d: 'M2.8 4.4h10.4' }),
        h('path', { d: 'M6.4 4.4V3.1h3.2v1.3' }),
        h('path', { d: 'M4.2 4.4l.6 8.1h6.4l.6-8.1' }),
        h('path', { d: 'M6.7 6.7v3.6M9.3 6.7v3.6' })
      )
    }

    function CheckGlyph() {
      return h('svg', {
        viewBox: '0 0 16 16', width: 14, height: 14, 'aria-hidden': 'true', style: { display: 'block' },
      }, h('path', {
        d: 'M3.5 8.5 6.4 11.3 12.5 4.9', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
        strokeLinecap: 'round', strokeLinejoin: 'round',
      }))
    }

    /** Mirrors the shipped StateDot: spinner while ongoing, tinted dot otherwise. */
    function StatusDot(props) {
      if (props.state === 'ongoing') {
        return h('svg', {
          className: 'dwsf-dot dwsf-spinner', viewBox: '0 0 24 24', width: 14, height: 14, 'aria-hidden': 'true',
        }, h('g', { className: 'dwsf-spinnerMotion' },
          h('circle', { className: 'dwsf-spinnerTrack', cx: '12', cy: '12', r: '9.5' }),
          h('circle', { className: 'dwsf-spinnerArc', cx: '12', cy: '12', r: '9.5' })
        ))
      }
      return h('span', {
        className: 'dwsf-dot', 'data-state': props.state, 'aria-hidden': 'true',
        style: { width: 10, height: 10 },
      })
    }

    /* ------------------------------------------------------------------ *
     * Derivation
     * ------------------------------------------------------------------ */

    function pendingKindOf(status) {
      const kind = status && status.pendingInteraction ? status.pendingInteraction.kind : undefined
      if (kind === 'approval' || kind === 'plan-review' || kind === 'question') return kind
      return undefined
    }

    function runningSubagents(list, sessionId, statuses) {
      const projection = list.projectionsBySession ? list.projectionsBySession[sessionId] : undefined
      const catalog = projection && projection.values ? projection.values.subagentCatalog : undefined
      if (!catalog) return 0
      const children = catalog.values ? catalog.values() : []
      let count = 0
      for (const child of children) {
        const childId = child && (child.id || child.sessionId)
        if (!childId) continue
        const childStatus = statuses.get(childId)
        const summary = list.byId[childId]
        const running = childStatus && childStatus.running !== undefined
          ? childStatus.running === true
          : Boolean(summary && summary.running)
        if (running) count += 1
      }
      return count
    }

    function titleOf(summary, t) {
      if (summary.blank) return t('session.new')
      const title = (summary.title || '').trim() || summary.displayTitle || ''
      return title !== '' ? title : t('session.untitled')
    }

    function timeLabel(updatedAt, now, t) {
      if (!updatedAt) return ''
      const delta = Math.max(0, now - updatedAt)
      if (delta < MINUTE) return t('time.now')
      const minutes = Math.floor(delta / MINUTE)
      if (minutes < 60) return t('time.minutes', { n: minutes })
      const hours = Math.floor(delta / HOUR)
      if (hours < 24) return t('time.hours', { n: hours })
      const days = Math.floor(delta / DAY)
      if (days < 30) return t('time.days', { n: days })
      const months = Math.floor(days / 30)
      if (months < 12) return t('time.months', { n: months })
      return t('time.years', { n: Math.floor(months / 12) })
    }

    function basename(path) {
      if (!path) return ''
      const parts = String(path).split(/[\\/]/).filter(Boolean)
      return parts.length > 0 ? parts[parts.length - 1] : ''
    }

    /* ------------------------------------------------------------------ *
     * Last-seen stamps
     *
     * The shipped status map only flags a turn that finished while the session
     * was not on screen (`completionUnread`). Everything else that bumps a
     * session — queued work, a subagent settling, an edit made elsewhere —
     * leaves `updatedAt` moving without any flag, so the "unread" dimension
     * remembers when this panel last saw a session and counts newer activity.
     * The map lives in localStorage so it survives reloads; an unknown session
     * is baselined on first sight, which keeps a fresh install quiet.
     * ------------------------------------------------------------------ */
    const SEEN_KEY = 'dsh-workspace-session-filter:seen.v1'
    const seenCache = { loaded: false, map: {}, timer: null }

    function seenStorage() {
      try {
        return typeof localStorage === 'undefined' ? null : localStorage
      } catch (error) {
        return null
      }
    }

    /* ---------------------------- navigation toggle --------------------------- *
     * The left-nav icon is opt-in: the sidebar already carries four panel cells and
     * most visits start at the sidebar-foot bar. The preference shares the same
     * localStorage store as the seen stamps, and the registration follows it, so a
     * hidden entry leaves no empty cell behind the panel list.
     * ------------------------------------------------------------------ */
    const NAV_KEY = 'dsh-workspace-session-filter:nav.v1'
    const navState = { value: null, listeners: new Set() }

    function navStorage() {
      try {
        return typeof localStorage === 'undefined' ? null : localStorage
      } catch (error) {
        return null
      }
    }

    function navVisible() {
      if (navState.value !== null) return navState.value
      const store = navStorage()
      let value = false
      if (store) {
        try { value = store.getItem(NAV_KEY) === '1' } catch (error) { value = false }
      }
      navState.value = value
      return value
    }

    function setNavVisible(next) {
      const value = next === true
      if (navVisible() === value) return
      navState.value = value
      const store = navStorage()
      if (store) {
        try {
          if (value) store.setItem(NAV_KEY, '1')
          else store.removeItem(NAV_KEY)
        } catch (error) { /* storage may be full or blocked */ }
      }
      for (const listener of Array.from(navState.listeners)) {
        try { listener(value) } catch (error) { console.error('[workspace-session-filter] nav listener failed', error) }
      }
    }

    function subscribeNav(listener) {
      navState.listeners.add(listener)
      return () => { navState.listeners.delete(listener) }
    }

    function loadSeen() {
      if (seenCache.loaded) return seenCache.map
      seenCache.loaded = true
      const store = seenStorage()
      if (!store) return seenCache.map
      try {
        const parsed = JSON.parse(store.getItem(SEEN_KEY) || 'null')
        if (parsed && typeof parsed === 'object') seenCache.map = parsed
      } catch (error) {
        seenCache.map = {}
      }
      return seenCache.map
    }

    function flushSeen() {
      const store = seenStorage()
      if (!store) return
      try {
        const ids = Object.keys(seenCache.map)
        if (ids.length > 400) {
          ids.sort((left, right) => (seenCache.map[right] || 0) - (seenCache.map[left] || 0))
          for (const id of ids.slice(400)) delete seenCache.map[id]
        }
        store.setItem(SEEN_KEY, JSON.stringify(seenCache.map))
      } catch (error) {
        /* quota or private mode: the bookkeeping is best effort */
      }
    }

    function markSeen(sessionId, stamp) {
      if (!(stamp > 0)) return
      const map = loadSeen()
      const previous = map[sessionId]
      if (previous !== undefined && previous >= stamp) return
      map[sessionId] = stamp
      if (seenCache.timer === null && typeof setTimeout === 'function') {
        seenCache.timer = setTimeout(() => { seenCache.timer = null; flushSeen() }, 400)
      }
    }

    /** One flat row model, mirroring the shipped sidebar's status precedence. */
    function buildRow(summary, status, subagents, t, lastSeen) {
      const kind = pendingKindOf(status)
      const running = status && status.running !== undefined ? status.running === true : Boolean(summary.running)
      const completed = Boolean(status && status.completionUnread === true)
      const activityNew = completed !== true
        && kind === undefined
        && running !== true
        && subagents === 0
        && lastSeen !== undefined
        && (Number(summary.updatedAt) || 0) > lastSeen
      let dot = 'idle'
      let label = ''
      if (kind !== undefined) {
        dot = 'warning'
        label = kind === 'approval'
          ? t('status.waitingApproval')
          : kind === 'plan-review' ? t('status.planReview') : t('status.waitingAnswer')
      } else if (running) {
        dot = 'ongoing'
        label = t('status.running')
      } else if (subagents > 0) {
        dot = 'ongoing'
        label = t('status.subagentsRunning', { n: subagents })
      } else if (completed) {
        dot = 'done'
        label = t('filter.unread')
      } else if (activityNew) {
        label = t('filter.unread')
      }
      return {
        id: summary.id,
        title: titleOf(summary, t),
        blank: summary.blank === true,
        updatedAt: summary.updatedAt,
        dot,
        label,
        awaiting: kind !== undefined,
        running: running || subagents > 0,
        unread: completed || activityNew,
      }
    }

    /* Sessions this window moved to the trash, and the ids the relay still finds
     * on disk. Both shrink the list without waiting for the Host catalog to reload. */
    const trashedIds = new Set()
    let diskIds = null

    function deriveView(props, statusFilter, range, now) {
      const list = props.useSessions((state) => state)
      const workspaces = props.useWorkspaces((state) => state)
      const statuses = props.useSessionStatus((state) => state)
      const t = props.t

      const byId = list.byId || {}
      let currentId
      for (const id of list.ids || []) {
        const summary = byId[id]
        if (summary && summary.retainedBy && (summary.retainedBy.mainView || 0) > 0) { currentId = id; break }
      }

      const archived = new Set(workspaces.archivedSessionIds || [])
      const cutoff = range ? now - (RANGE_MS[range] || 0) : 0
      const rows = new Map()
      const base = []
      for (const id of list.ids || []) {
        const summary = byId[id]
        if (!summary) continue
        if (summary.origin === 'subagent') continue
        if (summary.blank && summary.id !== currentId) continue
        if (archived.has(summary.id)) continue
        if (trashedIds.has(summary.id)) continue
        if (diskIds && diskIds.size > 0 && !summary.blank && !diskIds.has(bareSessionId(summary.id))) continue
        if (cutoff && !(summary.updatedAt >= cutoff)) continue
        const status = statuses ? statuses.get(summary.id) : undefined
        const stamp = Number(summary.updatedAt) || 0
        const seen = loadSeen()
        let lastSeen = seen[summary.id]
        if (summary.id === currentId || lastSeen === undefined) {
          markSeen(summary.id, stamp)
          if (lastSeen === undefined) lastSeen = stamp
        }
        const row = buildRow(summary, status, runningSubagents(list, summary.id, statuses || new Map()), t, lastSeen)
        row.today = stamp >= startOfDay(now)
        rows.set(summary.id, row)
        base.push(row)
      }

      const matches = (row) => statusFilter === 'all'
        || (statusFilter === 'running' ? row.running
          : statusFilter === 'awaiting' ? row.awaiting
            : statusFilter === 'today' ? row.today
              : row.unread)
      const counts = {
        all: base.length,
        running: base.filter((row) => row.running).length,
        awaiting: base.filter((row) => row.awaiting).length,
        unread: base.filter((row) => row.unread).length,
        today: base.filter((row) => row.today).length,
      }

      const groups = []
      const accounted = new Set()
      for (const workspace of workspaces.items || []) {
        const members = []
        for (const id of workspace.sessionIds || []) {
          accounted.add(id)
          const row = rows.get(id)
          if (row && matches(row)) members.push(row)
        }
        if (members.length === 0) continue
        members.sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0))
        const title = (workspace.title || '').trim() || basename(workspace.path) || t('group.ungrouped')
        groups.push({ key: workspace.workspaceId, title, rows: members })
      }

      const stray = []
      for (const id of list.ids || []) {
        if (accounted.has(id)) continue
        const row = rows.get(id)
        if (row && matches(row)) stray.push(row)
      }
      if (stray.length > 0) {
        stray.sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0))
        groups.push({ key: '__ungrouped__', title: '', rows: stray })
      }

      return {
        t,
        groups,
        counts,
        currentId,
        total: groups.reduce((sum, group) => sum + group.rows.length, 0),
        loading: list.phase !== undefined && list.phase !== 'ready' && base.length === 0,
      }
    }

    /* ------------------------------------------------------------------ *
     * Components
     * ------------------------------------------------------------------ */

    function FilterTab(props) {
      return h('button', {
        type: 'button',
        className: 'dwsf-filter',
        'data-active': props.active ? 'true' : 'false',
        'aria-pressed': props.active ? 'true' : 'false',
        onClick: props.onClick,
      },
        h('span', null, props.label),
        props.count === undefined ? null : h('span', { className: 'dwsf-filterCount' }, String(props.count))
      )
    }

    function RangeMenu(props) {
      const [open, setOpen] = useState(false)
      const wrapRef = useRef(null)
      const refocusRef = useRef(false)
      const t = props.t
      const value = props.value === undefined ? null : props.value
      const activeRange = value ? RANGES.find((entry) => entry.key === value) : undefined
      const label = activeRange ? t('range.' + activeRange.key) : t('filter.more')

      useEffect(() => {
        if (!open) return undefined
        function onPointerDown(event) {
          const node = wrapRef.current
          if (node && event.target instanceof Node && node.contains(event.target)) return
          setOpen(false)
        }
        function onKeyDown(event) {
          if (event.key !== 'Escape') return
          event.preventDefault()
          event.stopPropagation()
          setOpen(false)
        }
        document.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown, true)
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('keydown', onKeyDown, true)
        }
      }, [open])

      const item = (key, text, checked) => h('button', {
        type: 'button',
        role: 'menuitemradio',
        className: 'dwsf-menuItem',
        'aria-checked': checked ? 'true' : 'false',
        onClick: () => { props.onChange(key); setOpen(false) },
      },
        h('span', { className: 'dwsf-menuItemLabel' }, text),
        h('span', { className: 'dwsf-check' }, checked ? h(CheckGlyph) : null)
      )

      return h('div', { className: 'dwsf-moreWrap', ref: wrapRef },
        h('button', {
          type: 'button',
          className: 'dwsf-filter',
          'data-active': activeRange ? 'true' : 'false',
          'aria-haspopup': 'menu',
          'aria-expanded': open ? 'true' : 'false',
          onClick: () => setOpen(!open),
        },
          h('span', null, label),
          h('span', { className: 'dwsf-caret', 'data-open': open ? 'true' : 'false' }, h(ChevronGlyph))
        ),
        open
          ? h('div', { className: 'dwsf-menu', role: 'menu', 'aria-label': t('filter.more') },
              item(null, t('range.any'), activeRange === undefined),
              h('div', { className: 'dwsf-menuSep', role: 'separator' }),
              RANGES.map((entry) => item(entry.key, t('range.' + entry.key), value === entry.key))
            )
          : null
      )
    }

    /**
     * Renders a localized message instead of letting a failure inside the panel
     * blank the main column (a `main` occupant is replaced, so nothing wraps it).
     */
    class PanelBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { failed: false }
      }

      static getDerivedStateFromError() {
        return { failed: true }
      }

      componentDidCatch(error) {
        console.error('[workspace-session-filter] panel render failed', error)
      }

      render() {
        if (!this.state.failed) return this.props.children
        const t = this.props.t
        return h('div', { className: 'dwsf-page' },
          h('div', { className: 'dwsf-scroll' },
            h('div', { className: 'dwsf-content' },
              h('div', { className: 'dwsf-empty' },
                h('div', { className: 'dwsf-emptyTitle' }, t('empty.title')),
                h('div', { className: 'dwsf-emptyHint' }, t('empty.hint'))
              )
            )
          )
        )
      }
    }

    function SessionRow(props) {
      const row = props.row
      const t = props.t
      const managing = props.managing === true
      const locked = managing && props.locked === true
      const picked = props.picked === true
      const meta = []
      if (row.label !== '') {
        meta.push(h('span', { key: 'state', className: 'dwsf-state', 'data-state': row.dot }, row.label))
      }
      const time = row.blank ? '' : timeLabel(row.updatedAt, props.now, t)
      if (time !== '') {
        meta.push(h('span', {
          key: 'time', className: 'dwsf-time', title: t('time.ago', { t: time }),
        }, time))
      }

      return h('button', {
        type: 'button',
        className: 'dwsf-row',
        'data-state': row.dot,
        'data-blank': row.blank ? 'true' : 'false',
        'data-current': row.id === props.currentId ? 'true' : 'false',
        'data-managing': managing ? 'true' : 'false',
        'data-picked': picked ? 'true' : 'false',
        'data-locked': locked ? 'true' : 'false',
        title: locked ? t('manage.locked') : row.title,
        'aria-pressed': managing ? (picked ? 'true' : 'false') : undefined,
        'aria-label': managing
          ? `${picked ? '✓ ' : ''}${row.title}`
          : t('session.open', { name: row.title }),
        onClick: () => {
          if (managing) {
            if (!locked) props.onToggle(row.id)
            return
          }
          props.onOpen(row.id)
        },
      },
        managing
          ? h('span', { className: 'dwsf-check', 'data-on': picked ? 'true' : 'false', 'aria-hidden': 'true' },
              picked ? h(CheckGlyph, null) : null)
          : h(StatusDot, { state: row.dot }),
        h('span', { className: 'dwsf-title' }, row.title),
        meta.length > 0 ? h('span', { className: 'dwsf-meta' }, meta) : null
      )
    }

    /** Workspace-grouped session rows, shared by the panel and the sidebar popover. */
    function Groups(props) {
      const { view, t, now, onOpen, managing, picked, onToggle } = props
      if (view.groups.length === 0) {
        return h('div', { className: 'dwsf-empty' },
          h('div', { className: 'dwsf-emptyTitle' }, t('empty.title')),
          h('div', { className: 'dwsf-emptyHint' }, t('empty.hint'))
        )
      }
      return h('div', { className: 'dwsf-groups' }, view.groups.map((group) => h('section', {
        key: group.key,
        className: 'dwsf-group',
      },
        group.title !== ''
          ? h('div', { className: 'dwsf-groupHead' },
              h('span', { className: 'dwsf-groupTitle', title: group.title }, group.title),
              h('span', { className: 'dwsf-groupCount' }, t('group.count', { n: group.rows.length }))
            )
          : null,
        h('div', { className: 'dwsf-rows' }, group.rows.map((row) => h(SessionRow, {
          key: row.id,
          row,
          t,
          now,
          currentId: view.currentId,
          onOpen,
          managing,
          locked: managing === true && row.id === view.currentId,
          picked: Boolean(picked && picked.has(row.id)),
          onToggle,
        })))
      )))
    }

    /** Keyword narrow: keeps rows whose title or workspace path matches. */
    function narrowView(view, needle) {
      const groups = []
      for (const group of view.groups) {
        const rows = group.rows.filter((row) => {
          const haystack = `${row.title}\n${row.cwd || ''}\n${group.title}`.toLowerCase()
          return haystack.indexOf(needle) !== -1
        })
        if (rows.length > 0) groups.push({ key: group.key, title: group.title, rows })
      }
      const total = groups.reduce((sum, group) => sum + group.rows.length, 0)
      return { groups, total, currentId: view.currentId, loading: view.loading }
    }

    function SessionFilterPage(props) {
      const t = props.t
      const [statusFilter, setStatusFilter] = useState('all')
      const [range, setRange] = useState(null)
      const [managing, setManaging] = useState(false)
      const [query, setQuery] = useState('')
      const [picked, setPicked] = useState(() => new Set())
      const [busy, setBusy] = useState(false)
      const [notice, setNotice] = useState('')
      const [confirming, setConfirming] = useState(false)
      const [understood, setUnderstood] = useState(false)
      const [digest, setDigest] = useState(null)
      const [digests, setDigests] = useState(null)
      const [, setTick] = useState(0)

      useEffect(() => {
        const timer = setInterval(() => setTick((value) => value + 1), 60000)
        return () => clearInterval(timer)
      }, [])

      /* Drop sessions that no longer exist on disk, so a trashed row leaves the
       * list even though the Host catalog still remembers it. */
      useEffect(() => {
        let alive = true
        loadDiskIds().then(() => { if (alive) setTick((value) => value + 1) }, () => {})
        return () => { alive = false }
      }, [])

      const now = Date.now()
      const base = deriveView(props, statusFilter, range, now)
      const needle = query.trim().toLowerCase()
      const view = needle === '' ? base : narrowView(base, needle)
      const rows = view.groups.reduce((all, group) => all.concat(group.rows), [])
      const ids = rows.filter((row) => row.id !== base.currentId).map((row) => row.id)
      const allPicked = ids.length > 0 && ids.every((id) => picked.has(id))
      const onOpen = (sessionId) => {
        markSeen(sessionId, Date.now())
        props.onOpen(sessionId)
      }
      const toggle = (sessionId) => setPicked((current) => {
        const next = new Set(current)
        if (next.has(sessionId)) next.delete(sessionId)
        else next.add(sessionId)
        return next
      })
      const toggleAll = () => setPicked(allPicked ? new Set() : new Set(ids))
      const leaveManaging = () => {
        setManaging(false)
        setConfirming(false)
        setUnderstood(false)
        setPicked(new Set())
        setNotice('')
      }
      const titles = () => {
        const map = {}
        for (const row of rows) map[row.id] = row.title
        return map
      }
      const openDigest = async (name) => {
        if (!name) return
        setDigest({ name, loading: true })
        try {
          const data = await relayGet(`/digest?file=${encodeURIComponent(name)}`)
          setDigest({ name, text: data.text || '', path: data.path || '' })
        } catch (error) {
          setDigest({ name, error: (error && error.message) || String(error) })
        }
      }
      const closeDigests = () => { setDigests(null); setDigest(null) }
      const openDigests = async () => {
        setDigests({ loading: true })
        try {
          const data = await relayGet('/digests')
          setDigests({ items: Array.isArray(data.items) ? data.items : [] })
        } catch (error) {
          setDigests({ error: (error && error.message) || String(error) })
        }
      }
      const exportNow = async () => {
        const payload = { ids: [...picked], titles: titles(), note: '' }
        const result = await relayCall('/export', payload)
        if (!result || result.ok === false) throw new Error((result && result.error) || 'export failed')
        return result
      }
      const runExport = async () => {
        if (picked.size === 0 || busy) return
        setBusy(true)
        setNotice('')
        try {
          const result = await exportNow()
          const skipped = Array.isArray(result.missing) && result.missing.length > 0
            ? t('manage.missing', { n: String(result.missing.length) })
            : ''
          setNotice(t('manage.exported', { n: String(result.sessions || picked.size), path: result.file || '' }) + skipped)
          setDigest({ name: result.name || String(result.file || '').split('/').pop() })
        } catch (error) {
          setNotice(t('manage.failed', { error: (error && error.message) || String(error) }))
        } finally {
          setBusy(false)
        }
      }
      const runTrash = async () => {
        if (picked.size === 0 || busy) return
        setBusy(true)
        setConfirming(false)
        setUnderstood(false)
        let exported = null
        try {
          exported = await exportNow()
        } catch (error) {
          /* A digest that matches nothing must not block the cleanup itself. */
          console.error('[workspace-session-filter] digest export failed', error)
        }
        try {
          const targets = [...picked].filter((id) => id !== base.currentId)
          const result = await relayCall('/trash', { ids: targets })
          if (!result || result.ok === false) {
            throw new Error(result && result.failed && result.failed[0] ? result.failed[0].reason : 'trash failed')
          }
          for (const id of (result.moved || [])) trashedIds.add(id)
          setNotice(t('manage.trashed', { n: String((result.moved || []).length) }))
          if (exported) setDigest({ name: exported.name || String(exported.file || '').split('/').pop() })
          setPicked(new Set())
          loadDiskIds().then(() => setTick((value) => value + 1), () => {})
        } catch (error) {
          setNotice(t('manage.failed', { error: (error && error.message) || String(error) }))
        } finally {
          setBusy(false)
        }
      }
      const filtered = statusFilter !== 'all' || range !== null

      const toolbar = managing
        ? h('div', { className: 'dwsf-manageBar' },
            h('input', {
              className: 'dwsf-search',
              type: 'search',
              value: query,
              placeholder: t('manage.search'),
              'aria-label': t('manage.search'),
              onChange: (event) => setQuery(event.target.value),
            }),
            h('span', { className: 'dwsf-manageCount' }, t('manage.picked', { n: String(picked.size) })),
            h('button', {
              type: 'button', className: 'dwsf-btn dwsf-btnGhost',
              onClick: toggleAll,
            }, allPicked ? t('manage.clear') : t('manage.selectAll')),
            h('span', { className: 'dwsf-spacer' }),
            h('button', {
              type: 'button', className: 'dwsf-btn dwsf-btnGhost', disabled: picked.size === 0 || busy,
              onClick: runExport,
            }, t('manage.export')),
            h('button', {
              type: 'button', className: 'dwsf-btn dwsf-btnDanger', disabled: picked.size === 0 || busy,
              onClick: () => setConfirming(true),
            }, t('manage.trash'))
          )
        : null

      const dialog = confirming
        ? h('div', { className: 'dwsf-modalBackdrop', role: 'presentation' },
            h('div', { className: 'dwsf-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('manage.confirmTitle') },
              h('div', { className: 'dwsf-modalTitle' }, t('manage.confirmTitle')),
              h('div', { className: 'dwsf-modalBody' }, t('manage.confirmBody', { n: String(picked.size) })),
              h('label', { className: 'dwsf-confirmAsk' },
                h('input', {
                  type: 'checkbox',
                  checked: understood,
                  onChange: (event) => setUnderstood(event.target.checked),
                }),
                h('span', null, t('manage.confirmCheck'))
              ),
              h('div', { className: 'dwsf-modalActions' },
                h('button', {
                  type: 'button', className: 'dwsf-btn dwsf-btnGhost',
                  onClick: () => { setConfirming(false); setUnderstood(false) },
                }, t('manage.confirmCancel')),
                h('button', {
                  type: 'button', className: 'dwsf-btn dwsf-btnDanger',
                  disabled: !understood,
                  onClick: runTrash,
                }, t('manage.confirmOk'))
              )
            )
          )
        : null

      return h('div', { className: 'dwsf-page' },
        h('div', { className: 'dwsf-scroll' },
          h('div', { className: 'dwsf-content' },
            h('header', { className: 'dwsf-heading' },
              h('h1', { tabIndex: -1 }, t('panel.title')),
              h('span', { className: 'dwsf-headingMeta' },
                t('panel.summary', { n: view.total, w: view.groups.length })),
              h('span', { className: 'dwsf-headingHint' }, t('manage.hint'))
            ),
            toolbar,
            h('div', { className: 'dwsf-filters', role: 'group', 'aria-label': t('filter.aria') },
              h('button', {
                type: 'button',
                className: 'dwsf-selectBtn',
                'data-active': managing ? 'true' : 'false',
                'aria-pressed': managing ? 'true' : 'false',
                onClick: () => (managing ? leaveManaging() : setManaging(true)),
              },
                h(TrashGlyph, { size: 14 }),
                h('span', null, managing ? t('manage.close') : t('manage.open'))
              ),
              h('button', {
                type: 'button',
                className: 'dwsf-selectBtn',
                'data-active': digests ? 'true' : 'false',
                'aria-pressed': digests ? 'true' : 'false',
                onClick: () => (digests ? closeDigests() : openDigests()),
              },
                h(DocGlyph, { size: 14 }),
                h('span', null, t('manage.digests'))
              ),
              h(FilterTab, {
                label: t('filter.all'), count: base.counts.all, active: statusFilter === 'all',
                onClick: () => setStatusFilter('all'),
              }),
              h(FilterTab, {
                label: t('filter.running'), count: base.counts.running, active: statusFilter === 'running',
                onClick: () => setStatusFilter(statusFilter === 'running' ? 'all' : 'running'),
              }),
              h(FilterTab, {
                label: t('filter.awaiting'), count: base.counts.awaiting, active: statusFilter === 'awaiting',
                onClick: () => setStatusFilter(statusFilter === 'awaiting' ? 'all' : 'awaiting'),
              }),
              h(FilterTab, {
                label: t('filter.unread'), count: base.counts.unread, active: statusFilter === 'unread',
                onClick: () => setStatusFilter(statusFilter === 'unread' ? 'all' : 'unread'),
              }),
              h(FilterTab, {
                label: t('filter.today'), count: base.counts.today, active: statusFilter === 'today',
                onClick: () => setStatusFilter(statusFilter === 'today' ? 'all' : 'today'),
              }),
              filtered
                ? h('button', {
                    type: 'button',
                    className: 'dwsf-reset',
                    onClick: () => { setStatusFilter('all'); setRange(null) },
                  }, t('filter.reset'))
                : null,
              h('span', { className: 'dwsf-spacer' }),
              h(RangeMenu, { t, value: range, onChange: setRange })
            ),
            notice !== ''
              ? h('div', { className: 'dwsf-notice', role: 'status' },
                  h('span', { className: 'dwsf-noticeText' }, notice),
                  digest && digest.name
                    ? h('button', {
                        type: 'button',
                        className: 'dwsf-link',
                        onClick: () => { if (!digests) openDigests(); openDigest(digest.name) },
                      }, t('manage.preview'))
                    : null
                )
              : null,
            view.loading
              ? h('div', { className: 'dwsf-empty' }, h('div', null, t('empty.loading')))
              : view.total === 0 && needle !== ''
                ? h('div', { className: 'dwsf-empty' }, h('div', null, t('manage.empty')))
                : h(Groups, { view, t, now, onOpen, managing, picked, onToggle: toggle }),
            dialog,
            digests
          ? h(DigestSidePanel, {
              t,
              digests,
              digest,
              onOpen: openDigest,
              onClear: () => setDigest(null),
              onRefresh: openDigests,
              onClose: closeDigests,
            })
          : null
          )
        )
      )
    }

    /** Markdown → a small, readable tree. Only what the digest writer emits. */
    function renderDigest(text) {
      const source = String(text || '')
      const lines = source.split('\n')
      const inline = (value) => {
        const parts = []
        const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g
        let last = 0
        let match = pattern.exec(value)
        let key = 0
        while (match) {
          if (match.index > last) parts.push(value.slice(last, match.index))
          const token = match[0]
          if (token.startsWith('**')) parts.push(h('strong', { key: `b${key++}` }, token.slice(2, -2)))
          else parts.push(h('code', { key: `c${key++}` }, token.slice(1, -1)))
          last = match.index + token.length
          match = pattern.exec(value)
        }
        if (last < value.length) parts.push(value.slice(last))
        return parts
      }
      const cells = (line) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
      const out = []
      let index = 0
      let key = 0
      while (index < lines.length) {
        const line = lines[index]
        if (/^```/.test(line)) {
          const body = []
          index += 1
          while (index < lines.length && !/^```/.test(lines[index])) { body.push(lines[index]); index += 1 }
          index += 1
          out.push(h('pre', { key: `pre${key++}`, className: 'dwsf-pre' }, body.join('\n')))
          continue
        }
        if (/^#{1,3}\s/.test(line)) {
          const level = /^#/.test(line) ? line.match(/^#{1,3}/)[0].length : 1
          const tag = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3'
          out.push(h(tag, { key: `h${key++}`, className: `dwsf-mdh dwsf-mdh${level}` }, inline(line.replace(/^#{1,3}\s/, ''))))
          index += 1
          continue
        }
        if (/^\|/.test(line)) {
          const tableRows = []
          while (index < lines.length && /^\|/.test(lines[index])) { tableRows.push(lines[index]); index += 1 }
          const head = cells(tableRows[0])
          const bodyRows = tableRows.slice(1).filter((row) => !/^\|[\s:|-]+\|?$/.test(row)).map(cells)
          out.push(h('table', { key: `t${key++}`, className: 'dwsf-table' },
            h('thead', null, h('tr', null, head.map((cell, cellIndex) => h('th', { key: `th${cellIndex}` }, inline(cell))))),
            h('tbody', null, bodyRows.map((row, rowIndex) => h('tr', { key: `tr${rowIndex}` },
              row.map((cell, cellIndex) => h('td', { key: `td${cellIndex}` }, inline(cell))))))
          ))
          continue
        }
        if (/^[-*]\s/.test(line)) {
          const items = []
          while (index < lines.length && /^[-*]\s/.test(lines[index])) {
            items.push(h('li', { key: `li${key++}` }, inline(lines[index].replace(/^[-*]\s/, ''))))
            index += 1
          }
          out.push(h('ul', { key: `ul${key++}`, className: 'dwsf-ul' }, items))
          continue
        }
        if (line.trim() === '') { index += 1; continue }
        const paragraph = []
        while (index < lines.length && lines[index].trim() !== '' && !/^(#{1,3}\s|\||[-*]\s|```)/.test(lines[index])) {
          paragraph.push(lines[index])
          index += 1
        }
        out.push(h('p', { key: `p${key++}`, className: 'dwsf-mdp' }, inline(paragraph.join(' '))))
      }
      return out
    }

    /* The Markdown digests already written to Downloads, docked as a column so the
     * session list stays visible beside them. */
    function DigestSidePanel(props) {
      const t = props.t
      const state = props.digests || {}
      const selected = props.digest
      const items = state.items || []
      const list = state.error
        ? h('div', { className: 'dwsf-sideEmpty' }, t('manage.failed', { error: state.error }))
        : state.loading === true
          ? h('div', { className: 'dwsf-sideEmpty' }, t('manage.digestsLoading'))
          : items.length === 0
            ? h('div', { className: 'dwsf-sideEmpty' }, t('manage.digestsEmpty'))
            : h('div', { className: 'dwsf-digestList' }, items.map((item) => h('button', {
                key: item.name,
                type: 'button',
                className: 'dwsf-digestRow',
                'data-active': selected && selected.name === item.name ? 'true' : 'false',
                onClick: () => props.onOpen(item.name),
              },
                h(DocGlyph, { size: 15 }),
                h('span', { className: 'dwsf-digestName' }, item.name),
                h('span', { className: 'dwsf-digestMeta' }, t('manage.digestMeta', {
                  size: `${Math.max(1, Math.round((item.size || 0) / 1024))} KB`,
                  time: clockOf(item.mtime),
                }))
              )))
      const body = selected
        ? h('div', { className: 'dwsf-sideBody' },
            h('div', { className: 'dwsf-previewPath' }, selected.name),
            selected.error
              ? h('div', { className: 'dwsf-sideEmpty' }, t('manage.previewFailed', { error: selected.error }))
              : selected.text === undefined
                ? h('div', { className: 'dwsf-sideEmpty' }, t('manage.previewLoading'))
                : h('div', { className: 'dwsf-previewBody' }, renderDigest(selected.text))
          )
        : h('div', { className: 'dwsf-sideBody' },
            h('div', { className: 'dwsf-sideHint' }, t('manage.digestsHint')),
            list
          )
      return h('aside', { className: 'dwsf-side', 'aria-label': t('manage.digestsTitle') },
        h('div', { className: 'dwsf-sideHead' },
          h('div', { className: 'dwsf-sideTitle' }, selected ? t('manage.previewTitle') : t('manage.digestsTitle')),
          h('span', { className: 'dwsf-spacer' }),
          selected
            ? h('button', { type: 'button', className: 'dwsf-link', onClick: props.onClear }, t('manage.digestsBack'))
            : null,
          h('button', { type: 'button', className: 'dwsf-link', onClick: props.onRefresh }, t('manage.digestsRefresh')),
          h('button', {
            type: 'button', className: 'dwsf-link', onClick: props.onClose, 'aria-label': t('manage.digestsClose'), title: t('manage.digestsClose'),
          }, '×')
        ),
        body
      )
    }

    /**
     * Entry point for the `main` slot: verifies the standard snapshot props are
     * present before the child calls them as hooks, and keeps any render failure
     * inside a boundary so the main column never goes blank.
     */
    function PanelRoot(props) {
      const t = props.t
      const ready = typeof props.useSessions === 'function'
        && typeof props.useWorkspaces === 'function'
        && typeof props.useSessionStatus === 'function'
      if (!ready) {
        console.error('[workspace-session-filter] snapshot hooks are unavailable on the main slot', props)
        return h(PanelBoundary, { t },
          h('div', { className: 'dwsf-page' },
            h('div', { className: 'dwsf-scroll' },
              h('div', { className: 'dwsf-content' },
                h('div', { className: 'dwsf-empty' },
                  h('div', { className: 'dwsf-emptyTitle' }, t('empty.title')),
                  h('div', { className: 'dwsf-emptyHint' }, t('empty.hint'))
                )
              )
            )
          )
        )
      }
      return h(PanelBoundary, { t }, h(SessionFilterPage, props))
    }

    /* ------------------------------------------------------------------ *
     * DeepSeek service status
     *
     * status.deepseek.com answers without CORS headers, and a bundle's Client
     * half cannot call its own Host half, so index.js publishes the parsed
     * feed on a loopback port and this dot polls it. When the relay is absent
     * the dot stays grey instead of claiming "operational".
     * ------------------------------------------------------------------ */
    const STATUS_PORTS = [47100, 47101, 47102, 47103, 47104, 47105]
    const STATUS_POLL_MS = 60_000
    let statusPort = null

    async function relayGet(path) {
      if (typeof fetch !== 'function') throw new Error('fetch unavailable')
      const ports = statusPort === null ? STATUS_PORTS : [statusPort, ...STATUS_PORTS.filter((port) => port !== statusPort)]
      let lastError = null
      for (const port of ports) {
        try {
          const response = await fetch(`http://127.0.0.1:${port}${path}`, { cache: 'no-store' })
          if (!response || !response.ok) {
            lastError = new Error(`relay ${response ? response.status : 'unreachable'}`)
            continue
          }
          const data = await response.json()
          if (data && typeof data === 'object') {
            statusPort = port
            return data
          }
        } catch (error) {
          lastError = error
        }
      }
      throw lastError || new Error('relay unavailable')
    }

    /* The Host catalog keeps a trashed session until it rescans; ask the relay
     * which ids still exist on disk so the list stops showing them at once. */
    /* Host ids carry the `session-` prefix; directory names do not. Compare bare uuids. */
    function bareSessionId(id) {
      return String(id).replace(/^session-/, '')
    }

    async function loadDiskIds() {
      try {
        const data = await relayGet('/sessions')
        if (data && data.ok !== false && Array.isArray(data.ids)) {
          const ids = data.ids.map(bareSessionId).filter((id) => id !== '')
          diskIds = new Set(ids)
          return diskIds
        }
      } catch (error) { /* relay not up yet: leave the list as the Host reports it */ }
      return null
    }

    async function relayCall(path, payload) {
      if (typeof fetch !== 'function') throw new Error('fetch unavailable')
      const ports = statusPort === null ? STATUS_PORTS : [statusPort, ...STATUS_PORTS.filter((port) => port !== statusPort)]
      let lastError = null
      for (const port of ports) {
        try {
          const response = await fetch(`http://127.0.0.1:${port}${path}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload || {}),
            cache: 'no-store',
          })
          if (!response || !response.ok) {
            lastError = new Error(`relay ${response ? response.status : 'unreachable'}`)
            continue
          }
          const data = await response.json()
          if (data && typeof data === 'object') {
            statusPort = port
            return data
          }
        } catch (error) {
          lastError = error
        }
      }
      throw lastError || new Error('relay unavailable')
    }

    async function readServiceStatus() {
      if (typeof fetch !== 'function') return null
      const ports = statusPort === null ? STATUS_PORTS : [statusPort]
      for (const port of ports) {
        const controller = typeof AbortController === 'function' ? new AbortController() : null
        const timer = controller ? setTimeout(() => controller.abort(), 2500) : null
        try {
          const response = await fetch(`http://127.0.0.1:${port}/status`, controller
            ? { signal: controller.signal, cache: 'no-store' }
            : { cache: 'no-store' })
          if (timer) clearTimeout(timer)
          if (!response || !response.ok) continue
          const data = await response.json()
          if (data && typeof data === 'object') {
            statusPort = port
            return data
          }
        } catch (error) {
          if (timer) clearTimeout(timer)
        }
      }
      return null
    }

    function useServiceStatus() {
      const [info, setInfo] = useState(null)
      const [gone, setGone] = useState(false)
      useEffect(() => {
        let alive = true
        let timer = null
        const tick = () => {
          readServiceStatus().then((next) => {
            if (!alive) return
            if (next === null) setGone(true)
            else {
              setGone(false)
              setInfo(next)
            }
          }, () => { if (alive) setGone(true) })
        }
        tick()
        timer = setInterval(tick, STATUS_POLL_MS)
        return () => { alive = false; if (timer) clearInterval(timer) }
      }, [])
      return { info, gone }
    }

    function clockOf(stamp) {
      const date = new Date(stamp)
      if (Number.isNaN(date.getTime())) return ''
      const pad = (value) => (value < 10 ? `0${value}` : String(value))
      return `${pad(date.getHours())}:${pad(date.getMinutes())}`
    }

    function dateOf(stamp) {
      const date = new Date(stamp)
      if (Number.isNaN(date.getTime())) return ''
      const pad = (value) => (value < 10 ? `0${value}` : String(value))
      return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }

    function incidentTone(status) {
      if (status === 'resolved' || status === 'postmortem') return 'ok'
      if (status === 'monitoring' || status === 'verifying' || status === 'scheduled' || status === 'maintenance') return 'degraded'
      if (status === 'investigating' || status === 'identified') return 'down'
      return 'unknown'
    }

    function incidentLabel(status, t) {
      return status === 'resolved' || status === 'postmortem' ? t('incident.resolved')
        : status === 'monitoring' || status === 'verifying' ? t('incident.monitoring')
          : status === 'identified' ? t('incident.identified')
            : status === 'investigating' ? t('incident.investigating')
              : status === 'scheduled' || status === 'maintenance' ? t('incident.maintenance')
                : status ? status : t('incident.unknown')
    }

    /** The three newest feed entries, resolved or not, as a compact list. */
    function recentIncidents(info, t) {
      const entries = info && Array.isArray(info.incidents) ? info.incidents.slice(0, 3) : []
      return h('div', { className: 'dwsf-statusRecent' },
        h('div', { className: 'dwsf-statusRecentHead' }, t('status.recent')),
        entries.length === 0
          ? h('div', { className: 'dwsf-statusMeta' }, t('status.recentNone'))
          : entries.map((entry, index) => {
            const updated = Date.parse(entry.updated || 0)
            return h('div', { key: index, className: 'dwsf-statusRecentRow' },
              h('span', {
                className: 'dwsf-statusRecentDot',
                'data-state': incidentTone(entry.status),
                'aria-hidden': 'true',
              }),
              h('span', { className: 'dwsf-statusRecentText' }, entry.title || entry.fullTitle || ''),
              h('span', { className: 'dwsf-statusRecentWhen' },
                `${incidentLabel(entry.status, t)}${Number.isFinite(updated) && updated > 0 ? ` · ${dateOf(updated)}` : ''}`)
            )
          })
      )
    }

    function shorten(text, limit) {
      const value = String(text || '').trim()
      return value.length > limit ? `${value.slice(0, limit - 1)}…` : value
    }

    function ServiceStatus(props) {
      const t = props.t
      const { info, gone } = useServiceStatus()
      const [hover, setHover] = useState(false)
      const [spot, setSpot] = useState(null)
      const state = gone || !info ? 'unknown' : (info.state || 'unknown')
      const stateLabel = state === 'ok' ? t('status.serviceOk')
        : state === 'degraded' ? t('status.serviceDegraded')
          : state === 'down' ? t('status.serviceDown')
            : t('status.serviceUnknown')
      const name = `${t('status.service')} · ${stateLabel}`
      const open = () => {
        try { window.open('https://status.deepseek.com/', '_blank', 'noopener,noreferrer') } catch (error) { /* popup blocked */ }
      }
      /**
       * The status button sits at the far right of a narrow sidebar, so an
       * absolutely positioned card would grow past the window edge and get
       * clipped. Anchor it to the button in viewport coordinates and clamp it
       * inside the window instead.
       */
      const place = (node) => {
        if (!node || typeof window === 'undefined') return
        const rect = node.getBoundingClientRect()
        const width = Math.max(200, Math.min(320, window.innerWidth - 16))
        const left = Math.min(Math.max(rect.right - width, 8), window.innerWidth - width - 8)
        const bottom = Math.min(window.innerHeight - rect.top + 8, window.innerHeight - 16)
        setSpot({ left: Math.round(left), bottom: Math.round(bottom), width: Math.round(width) })
      }
      const card = hover && spot
        ? h('div', {
            className: 'dwsf-statusCard',
            role: 'tooltip',
            style: { left: `${spot.left}px`, bottom: `${spot.bottom}px`, width: `${spot.width}px` },
          },
            h('div', { className: 'dwsf-statusHead' },
              h('span', { className: 'dwsf-statusDot', 'data-state': state, 'aria-hidden': 'true' }),
              h('span', { className: 'dwsf-statusName' }, name)
            ),
            info ? (info.headline ? h('div', { className: 'dwsf-statusLine' }, info.headline) : null) : null,
            info && info.state !== 'ok' && info.detail
              ? h('div', { className: 'dwsf-statusLine' }, info.detail)
              : null,
            info ? null : h('div', { className: 'dwsf-statusLine' }, t('status.offline')),
            info ? recentIncidents(info, t) : null,
            info && info.updated
              ? h('div', { className: 'dwsf-statusMeta' }, info.stale ? t('status.stale') : t('status.updated', { t: clockOf(info.updated) }))
              : null,
            h('div', { className: 'dwsf-statusMeta' }, t('status.pollNote')),
            h('div', { className: 'dwsf-statusMeta' }, t('status.openSite'))
          )
        : null
      return h('div', { className: 'dwsf-status' },
        h('button', {
          type: 'button',
          className: 'dwsf-statusButton',
          'data-state': state,
          'aria-label': name,
          'aria-describedby': undefined,
          title: name,
          onClick: open,
          onMouseEnter: (event) => { place(event.currentTarget); setHover(true) },
          onMouseLeave: () => setHover(false),
          onFocus: (event) => { place(event.currentTarget); setHover(true) },
          onBlur: () => setHover(false),
        },
          h('span', { className: 'dwsf-statusDot', 'data-state': state, 'aria-hidden': 'true' })
        ),
        card
      )
    }

    /**
     * The sidebar-foot filter bar. Two chips cover the states worth interrupting a
     * human for and expand a workspace-grouped popover upwards; a collapsed
     * sidebar gets one icon button with a combined badge instead.
     */
    function FooterBar(props) {
      const t = props.t
      const wide = props.wide !== false
      const [mode, setMode] = useState('running')
      const [open, setOpen] = useState(false)
      const [anchor, setAnchor] = useState(undefined)
      const rootRef = useRef(null)
      const [, setTick] = useState(0)

      useEffect(() => {
        const timer = setInterval(() => setTick((value) => value + 1), 60000)
        return () => clearInterval(timer)
      }, [])

      const place = () => {
        const node = rootRef.current
        if (!node || typeof node.getBoundingClientRect !== 'function' || typeof window === 'undefined') {
          setAnchor({ left: 24, bottom: 120 })
          return
        }
        const rect = node.getBoundingClientRect()
        setAnchor(wide
          ? { left: Math.round(rect.left), bottom: Math.round(window.innerHeight - rect.top + 8) }
          : { left: Math.round(rect.right + 8), bottom: Math.round(window.innerHeight - rect.bottom) })
      }

      useEffect(() => {
        if (!open) return undefined
        const onResize = () => place()
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
      }, [open, wide])

      useEffect(() => {
        if (!open) return undefined
        const onPointerDown = (event) => {
          const node = rootRef.current
          const target = event.target
          if (node && target && typeof node.contains === 'function' && node.contains(target)) return
          setOpen(false)
        }
        const onKeyDown = (event) => {
          if (event.key !== 'Escape' || event.defaultPrevented) return
          event.preventDefault()
          setOpen(false)
        }
        document.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown, true)
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('keydown', onKeyDown, true)
        }
      }, [open])

      const openWith = (nextMode) => {
        if (open && mode === nextMode) {
          setOpen(false)
          return
        }
        setMode(nextMode)
        place()
        setOpen(true)
      }

      const toggle = () => {
        if (open) {
          setOpen(false)
          return
        }
        place()
        setOpen(true)
      }

      const now = Date.now()
      const view = deriveView(props, mode, null, now)
      const onOpen = (sessionId) => {
        markSeen(sessionId, Date.now())
        setOpen(false)
        props.onOpen(sessionId)
      }

      const chip = (key, label, count) => h('button', {
        key,
        type: 'button',
        className: 'dwsf-footChip',
        'data-active': mode === key ? 'true' : 'false',
        'aria-pressed': mode === key ? 'true' : 'false',
        'aria-label': count > 0 ? `${label} \u00b7 ${count}` : label,
        onClick: () => openWith(key),
      },
        h('span', { className: 'dwsf-footChipLabel' }, label),
        count > 0 ? h('span', { className: 'dwsf-footChipCount' }, String(count)) : null
      )

      const filters = h('div', { className: 'dwsf-footChips', role: 'group', 'aria-label': t('filter.aria') },
        chip('running', t('filter.running'), view.counts.running),
        chip('awaiting', t('filter.awaitingShort'), view.counts.awaiting),
        chip('unread', t('filter.unread'), view.counts.unread),
        chip('today', t('filter.today'), view.counts.today)
      )

      const popover = open && anchor !== undefined
        ? h('section', {
            className: 'dwsf-pop',
            style: anchor,
            role: 'dialog',
            'aria-label': t('panel.label'),
          },
            h('header', { className: 'dwsf-popHead' },
              h('span', { className: 'dwsf-popTitle' }, t('panel.label')),
              h('span', { className: 'dwsf-popCount' },
                t('panel.summary', { n: view.total, w: view.groups.length }))
            ),
            wide ? null : h('div', { className: 'dwsf-popFilters' }, filters),
            h('div', { className: 'dwsf-popBody' },
              view.loading
                ? h('div', { className: 'dwsf-empty' }, h('div', null, t('empty.loading')))
                : h(Groups, { view, t, now, onOpen })
            ),
            h('div', { className: 'dwsf-popFoot' },
              h('span', { className: 'dwsf-popFootLabel' }, t('settings.nav')),
              h('div', { className: 'dwsf-popFootActions' },
                h('button', {
                  type: 'button',
                  className: 'dwsf-link',
                  title: t('settings.openLink'),
                  onClick: () => {
                    setOpen(false)
                    if (typeof props.onOpenPanel === 'function') props.onOpenPanel()
                  },
                }, t('settings.openLink')),
                h(NavSwitch, { t })
              )
            )
          )
        : null

      if (!wide) {
        const waiting = view.counts.running + view.counts.awaiting + view.counts.unread
        return h('div', { ref: rootRef, className: 'dwsf-footRail' },
          popover,
          h('button', {
            type: 'button',
            className: 'dwsf-footRailButton',
            'data-active': open ? 'true' : 'false',
            'aria-expanded': open ? 'true' : 'false',
            'aria-label': t('panel.label'),
            title: t('panel.label'),
            onClick: toggle,
          },
            h(PanelGlyph, { size: 18, active: open }),
            waiting > 0 ? h('span', { className: 'dwsf-footBadge', 'aria-hidden': 'true' }, String(waiting)) : null
          )
        )
      }

      return h('div', { ref: rootRef, className: 'dwsf-foot' }, popover, filters, h(ServiceStatus, { t }))
    }

    /**
     * The plugin's own page inside Settings → Plugins. One switch owns the
     * optional left-nav entry; the sidebar-foot filter bar is unaffected.
     */
    function NavSwitch(props) {
      const [on, setOn] = useState(navVisible)

      useEffect(() => subscribeNav((value) => setOn(value)), [])

      return h('div', { className: 'dwsf-switchWrap' },
        h('span', {
          className: 'dwsf-switchState',
          'data-on': on ? 'true' : 'false',
          'aria-hidden': 'true',
        }, props.t(on ? 'settings.on' : 'settings.off')),
        h('button', {
          type: 'button',
          role: 'switch',
          className: 'dwsf-switch',
          'aria-checked': on ? 'true' : 'false',
          'aria-label': props.t('settings.nav'),
          'data-on': on ? 'true' : 'false',
          onClick: () => setNavVisible(!on),
        },
          h('span', { className: 'dwsf-switchTrack', 'data-on': on ? 'true' : 'false', 'aria-hidden': 'true' },
            h('span', { className: 'dwsf-switchThumb' })
          )
        )
      )
    }

    function SettingsPage(props) {
      const t = props.t

      return h('div', { className: 'dwsf-settings' },
        h('div', { className: 'dwsf-settingRow' },
          h('div', { className: 'dwsf-settingCopy' },
            h('span', { className: 'dwsf-settingLabel' }, t('settings.nav')),
            h('span', { className: 'dwsf-settingHint' }, t('settings.navHint'))
          ),
          h('div', { className: 'dwsf-settingActions' },
            h(NavSwitch, { t }),
            h('button', {
              type: 'button',
              className: 'dwsf-link',
              onClick: () => { if (typeof props.onOpenPanel === 'function') props.onOpenPanel() },
            }, t('settings.openLink'))
          )
        ),
        h('div', { className: 'dwsf-settingRow' },
          h('div', { className: 'dwsf-settingCopy' },
            h('span', { className: 'dwsf-settingLabel' }, t('settings.panel')),
            h('span', { className: 'dwsf-settingHint' }, t('settings.panelHint'))
          ),
          h('button', {
            type: 'button',
            className: 'dwsf-btn',
            onClick: () => { if (typeof props.onOpenPanel === 'function') props.onOpenPanel() },
          }, t('settings.openPanel'))
        )
      )
    }

    /** Sidebar entry: guards the standard hooks and keeps a crash out of the sidebar. */
    function FooterEntry(props) {
      const ready = typeof props.useSessions === 'function'
        && typeof props.useWorkspaces === 'function'
        && typeof props.useSessionStatus === 'function'
      if (!ready) {
        console.error('[workspace-session-filter] snapshot hooks are unavailable on sidebar.footer.action', props)
        return null
      }
      return h(FooterBoundary, null, h(FooterBar, props))
    }

    class FooterBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { failed: false }
      }

      static getDerivedStateFromError() {
        return { failed: true }
      }

      componentDidCatch(error) {
        console.error('[workspace-session-filter] sidebar filter bar failed', error)
      }

      render() {
        return this.state.failed ? null : this.props.children
      }
    }

    /* ------------------------------------------------------------------ *
     * Styles
     * ------------------------------------------------------------------ */

    const css = `
.dwsf-page{width:100%;min-width:0;height:100%;min-height:0;display:flex;overflow:hidden;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:14px;line-height:1.6}
.dwsf-scroll{flex:1;min-height:0;overflow:auto;scrollbar-gutter:stable;--dsh-scrollbar-width:9px;--dsh-scrollbar-thumb-border:2px}
.dwsf-content{max-width:960px;margin:0 auto;padding:0 clamp(24px,4vw,48px) 48px}
[data-platform=darwin] .dwsf-heading{padding-top:calc(28px + var(--dsh-frame-top-clearance,0px))}
.dwsf-filters{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:0 0 14px}
.dwsf-selectBtn{display:inline-flex;flex:none;align-items:center;gap:5px;height:28px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:20px;cursor:pointer}
.dwsf-selectBtn:hover{border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dwsf-selectBtn[data-active="true"]{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-inverted)}
.dwsf-selectBtn[data-active="true"]:hover{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-inverted)}
.dwsf-selectBtn:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.dwsf-headingHint{margin-left:auto;color:var(--dsw-alias-label-caption);font-size:12px;line-height:18px}
.dwsf-filter{height:28px;display:inline-flex;align-items:center;gap:5px;flex:none;padding:0 10px;border:0;border-radius:14px;background:0 0;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:14px;line-height:22px;white-space:nowrap;cursor:pointer}
.dwsf-filter:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dwsf-filter[data-active="true"]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dwsf-filter:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.dwsf-filterCount{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:16px;font-variant-numeric:tabular-nums}
.dwsf-filter[data-active="true"] .dwsf-filterCount{color:var(--dsw-alias-label-secondary)}
.dwsf-caret{display:inline-flex;color:currentColor;opacity:.8;transition:transform .16s ease}
.dwsf-caret[data-open="true"]{transform:rotate(180deg)}
.dwsf-spacer{flex:1 1 auto}
.dwsf-reset{height:28px;flex:none;padding:0 10px;border:0;border-radius:14px;background:0 0;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:13px;line-height:20px;cursor:pointer}
.dwsf-reset:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dwsf-reset:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.dwsf-moreWrap{position:relative;flex:none;display:inline-flex}
.dwsf-menu{box-sizing:border-box;position:absolute;top:calc(100% + 4px);right:0;z-index:100;display:flex;flex-direction:column;min-width:168px;max-width:320px;padding:4px;border:0;border-radius:var(--dsw-radius-lg);background:var(--dsw-specific-menu);backdrop-filter:var(--dsw-menu-backdrop-filter);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent)}
.dwsf-menuItem{display:flex;align-items:center;gap:6px;width:100%;min-height:34px;padding:6px 8px;border:0;border-radius:var(--dsw-radius-md);background:0 0;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;text-align:left;cursor:pointer}
.dwsf-menuItem:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dwsf-menuItem:focus-visible{background:var(--dsw-alias-interactive-bg-hover);outline:none}
.dwsf-menuItemLabel{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dwsf-menuSep{height:.5px;margin:3px 2px;background:var(--dsw-alias-border-l2)}
.dwsf-check{display:inline-flex;flex:none;width:14px;height:14px;align-items:center;justify-content:center;color:var(--dsw-alias-state-business-primary)}
.dwsf-groups{display:flex;flex-direction:column;gap:2px}
.dwsf-groupHead{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 10px 6px}
.dwsf-groupTitle{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:16px;font-weight:500}
.dwsf-groupCount{flex:none;color:var(--dsw-alias-label-caption);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}
.dwsf-rows{display:flex;flex-direction:column;gap:2px}
.dwsf-row{display:flex;align-items:center;gap:8px;width:100%;height:36px;padding:0 10px;border:0;border-radius:var(--dsw-radius-md);background:0 0;color:inherit;font:inherit;font-size:14px;line-height:20px;text-align:left;cursor:pointer}
.dwsf-row:hover,.dwsf-row[data-current="true"]{background:var(--dsw-alias-interactive-bg-hover)}
.dwsf-row:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
.dwsf-dot{position:relative;display:inline-block;flex:none;color:var(--dsw-alias-state-idle-primary)}
.dwsf-dot::after{content:"";position:absolute;inset:20%;border-radius:50%;background:currentColor}
.dwsf-dot[data-state="done"]{color:var(--dsw-alias-state-success-primary)}
.dwsf-dot[data-state="warning"]{color:var(--dsw-alias-state-warn-primary)}
.dwsf-dot[data-state="error"]{color:var(--dsw-alias-state-error-primary)}
.dwsf-spinner{color:var(--dsw-alias-label-tertiary)}
.dwsf-spinner::after{content:none}
.dwsf-spinnerMotion{transform-origin:center;animation:dwsf-dot-spin 1.5s linear infinite}
.dwsf-spinnerTrack,.dwsf-spinnerArc{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}
.dwsf-spinnerTrack{opacity:.25}
.dwsf-spinnerArc{stroke-dasharray:12 150;animation:dwsf-dot-dash 1.5s ease-in-out infinite}
@keyframes dwsf-dot-spin{to{transform:rotate(360deg)}}
@keyframes dwsf-dot-dash{0%{stroke-dasharray:12 150;stroke-dashoffset:0}50%{stroke-dasharray:24 150;stroke-dashoffset:-6}to{stroke-dasharray:12 150;stroke-dashoffset:0}}
.dwsf-title{flex:1;min-width:0;margin:0 6px 0 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dwsf-row[data-blank="true"] .dwsf-title{color:var(--dsw-alias-label-tertiary)}
.dwsf-meta{flex:none;display:flex;align-items:center;gap:10px}
.dwsf-state{white-space:nowrap;font-size:12px;line-height:16px}
.dwsf-state[data-state="ongoing"]{color:var(--dsw-alias-state-success-primary)}
.dwsf-state[data-state="warning"]{color:var(--dsw-alias-state-warn-primary)}
.dwsf-state[data-state="done"]{color:var(--dsw-alias-label-tertiary)}
.dwsf-time{min-width:48px;text-align:right;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:16px;font-variant-numeric:tabular-nums}
.dwsf-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:48px 20px;color:var(--dsw-alias-label-tertiary);font-size:14px;line-height:1.6;text-align:center}
.dwsf-emptyTitle{color:var(--dsw-alias-label-tertiary);font-size:14px;font-weight:400;line-height:1.6}
.dwsf-emptyHint{color:var(--dsw-alias-label-caption);font-size:13px;line-height:20px}
[data-slot="sidebar.footer.action"]{display:flex !important;flex-wrap:wrap;width:100%;min-width:0;align-items:flex-start;column-gap:0;row-gap:0}
.dwsf-foot{flex:1 0 100%;display:flex;align-items:center;min-width:0;max-width:100%;margin:8px 0 2px;padding:0 2px}
.dwsf-footChips{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-start;gap:4px 2px;min-width:0;flex:1 1 auto}
.dwsf-footChip{flex:0 1 auto;min-width:0;max-width:100%;height:28px;display:inline-flex;align-items:center;justify-content:center;gap:3px;padding:0 7px;border:0;border-radius:999px;background:0 0;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:12px;line-height:18px;white-space:nowrap;cursor:pointer;overflow:hidden}
.dwsf-footChip:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dwsf-footChip[data-active="true"]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dwsf-footChip:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
.dwsf-footChipLabel{flex:0 0 auto;white-space:nowrap}
.dwsf-footChipCount{flex:none;color:var(--dsw-alias-label-caption);font-size:10px;line-height:14px;font-variant-numeric:tabular-nums}
.dwsf-footChip[data-active="true"] .dwsf-footChipCount{color:var(--dsw-alias-label-secondary)}
.dwsf-status{position:relative;flex:0 0 auto;display:flex;align-items:center;padding-left:4px}
.dwsf-statusButton{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:0;border-radius:999px;background:0 0;cursor:pointer}
.dwsf-statusButton:hover,.dwsf-statusButton:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}
.dwsf-statusButton:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
.dwsf-statusDot{flex:0 0 auto;width:8px;height:8px;border-radius:999px;background:var(--dsw-alias-label-caption)}
.dwsf-statusDot[data-state="ok"]{background:var(--dsw-alias-state-success-primary)}
.dwsf-statusDot[data-state="degraded"]{background:var(--dsw-alias-state-warn-primary)}
.dwsf-statusDot[data-state="down"]{background:var(--dsw-alias-state-error-primary)}
.dwsf-statusCard{position:fixed;z-index:80;display:flex;flex-direction:column;gap:3px;max-height:min(72vh,460px);overflow-y:auto;overscroll-behavior:contain;padding:9px 11px;border-radius:10px;background:var(--dsw-specific-menu);backdrop-filter:var(--dsw-menu-backdrop-filter);box-shadow:var(--dsw-elevation-prominent);text-align:left}
.dwsf-statusHead{display:flex;align-items:center;gap:6px}
.dwsf-statusName{font-size:12px;line-height:18px;font-weight:500;color:var(--dsw-alias-label-primary)}
.dwsf-statusLine{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.dwsf-statusMeta{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.dwsf-statusRecent{display:flex;flex-direction:column;gap:3px;margin-top:5px;padding-top:6px;border-top:.5px solid var(--dsw-alias-border-l2)}
.dwsf-statusRecentHead{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.dwsf-statusRecentRow{display:flex;align-items:flex-start;gap:6px}
.dwsf-statusRecentDot{flex:0 0 auto;width:6px;height:6px;margin-top:5px;border-radius:999px;background:var(--dsw-alias-label-caption)}
.dwsf-statusRecentDot[data-state="ok"]{background:var(--dsw-alias-state-success-primary)}
.dwsf-statusRecentDot[data-state="degraded"]{background:var(--dsw-alias-state-warn-primary)}
.dwsf-statusRecentDot[data-state="down"]{background:var(--dsw-alias-state-error-primary)}
.dwsf-statusRecentText{flex:1 1 auto;min-width:0;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);white-space:normal;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.dwsf-statusRecentWhen{flex:0 0 auto;margin-left:auto;padding-left:6px;font-size:10px;line-height:16px;color:var(--dsw-alias-label-caption);font-variant-numeric:tabular-nums}
.dwsf-footRail{flex:0 0 auto;display:flex;justify-content:center;width:100%}
.dwsf-footRailButton{position:relative;display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;padding:0;border:0;border-radius:50%;background:0 0;color:var(--dsw-alias-label-primary);cursor:pointer}
.dwsf-footRailButton:hover,.dwsf-footRailButton[data-active="true"]{background:var(--dsw-alias-interactive-bg-hover)}
.dwsf-footRailButton:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
.dwsf-footBadge{position:absolute;top:4px;right:2px;min-width:15px;height:15px;padding:0 3px;border-radius:999px;background:var(--dsw-alias-state-warn-primary);color:var(--dsw-alias-label-primary-inverted);font-size:9px;line-height:15px;text-align:center;font-variant-numeric:tabular-nums}
.dwsf-settings{display:flex;flex-direction:column;gap:8px;color:var(--dsw-alias-label-primary)}
.dwsf-settingRow{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:12px 14px;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1)}
.dwsf-settingCopy{display:flex;flex-direction:column;gap:2px;min-width:0}
.dwsf-settingLabel{font-size:13px;line-height:20px}
.dwsf-settingHint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.dwsf-settingActions{display:flex;flex:none;align-items:center;gap:12px;padding-top:1px}
.dwsf-link{padding:0;border:0;background:0 0;color:var(--dsw-alias-brand-primary);font:inherit;font-size:12px;line-height:18px;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.dwsf-link:hover{color:var(--dsw-alias-label-primary)}
.dwsf-btn{flex:none;height:28px;padding:0 12px;border:0;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px;cursor:pointer}
.dwsf-btn:hover{background:var(--dsw-alias-interactive-bg-active)}
.dwsf-switch{flex:none;margin-top:1px;padding:0;border:0;background:0 0;cursor:pointer;border-radius:999px;line-height:0}
.dwsf-switch:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}
.dwsf-switchWrap{display:inline-flex;flex:none;align-items:center;gap:8px}
.dwsf-switchState{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.dwsf-switchState[data-on="true"]{color:var(--dsw-alias-brand-primary)}
.dwsf-switchTrack{display:inline-flex;align-items:center;width:36px;height:20px;padding:2px;border-radius:999px;background:var(--dsw-alias-border-l1);box-shadow:inset 0 0 0 .5px var(--dsw-alias-border-l2);transition:background .16s ease,box-shadow .16s ease}
.dwsf-switchTrack[data-on="true"]{background:var(--dsw-alias-brand-primary);box-shadow:none}
.dwsf-switchThumb{width:16px;height:16px;border-radius:999px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35);transition:transform .16s ease}
.dwsf-switchTrack[data-on="true"] .dwsf-switchThumb{transform:translateX(14px)}
.dwsf-pop{position:fixed;z-index:60;display:flex;flex-direction:column;width:min(340px,calc(100vw - 24px));max-height:60vh;border-radius:12px;background:var(--dsw-specific-menu);backdrop-filter:var(--dsw-menu-backdrop-filter);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent);overflow:hidden}
.dwsf-popFoot{flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px;border-top:.5px solid var(--dsw-alias-border-l2);font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.dwsf-popFootLabel{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dwsf-popFootActions{flex:none;display:flex;align-items:center;gap:10px}
.dwsf-popHead{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;padding:10px 12px 4px}
.dwsf-popTitle{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:20px}
.dwsf-popCount{flex:none;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:16px;font-variant-numeric:tabular-nums}
.dwsf-popFilters{flex:none;display:flex;padding:0 10px 4px}
.dwsf-popBody{flex:1;min-height:0;padding:0 8px 10px;overflow:auto;--dsh-scrollbar-width:9px}
.dwsf-pop .dwsf-groupHead{padding:10px 8px 4px}
.dwsf-pop .dwsf-empty{padding:28px 16px}
.dwsf-manageBar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 12px}
.dwsf-search{flex:1 1 200px;min-width:140px;height:30px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px}
.dwsf-search::placeholder{color:var(--dsw-alias-label-caption)}
.dwsf-search:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-1px}
.dwsf-manageCount{flex:none;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}
.dwsf-btn{display:inline-flex;align-items:center;justify-content:center;height:28px;padding:0 12px;border:0;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:18px;cursor:pointer}
.dwsf-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dwsf-btn[disabled]{opacity:.45;cursor:default}
.dwsf-btnGhost{background:0 0;color:var(--dsw-alias-label-secondary)}
.dwsf-btnGhost:hover,.dwsf-btnGhost[data-active="true"]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dwsf-btnDanger{background:0 0;color:var(--dsw-alias-state-error-primary)}
.dwsf-btnDanger:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dwsf-headingMeta{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}
.dwsf-check{flex:none;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border:1px solid var(--dsw-alias-border-l1);border-radius:5px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary-inverted)}
.dwsf-check[data-on="true"]{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-brand-primary)}
.dwsf-row[data-managing="true"][data-picked="true"]{background:var(--dsw-alias-interactive-bg-hover)}
.dwsf-row[data-locked="true"]{opacity:.5;cursor:default}
.dwsf-notice{margin:0 0 12px;padding:8px 10px;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;word-break:break-word}
.dwsf-modalBackdrop{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--dsw-alias-bg-overlay)}
.dwsf-modal{width:min(420px,100%);padding:18px 18px 14px;border-radius:var(--dsw-radius-lg);background:var(--dsw-specific-menu);box-shadow:var(--dsw-elevation-prominent)}
.dwsf-modalTitle{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:500;line-height:22px}
.dwsf-modalBody{margin-top:6px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}
.dwsf-modalActions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
.dwsf-confirmAsk{display:flex;align-items:flex-start;gap:8px;margin-top:12px;padding:8px 10px;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;cursor:pointer}
.dwsf-confirmAsk input{margin:2px 0 0;accent-color:var(--dsw-alias-brand-primary)}
.dwsf-previewModal{display:flex;flex-direction:column;width:min(760px,100%);max-height:min(80vh,720px)}
.dwsf-previewPath{margin-top:4px;color:var(--dsw-alias-label-caption);font-size:11px;line-height:16px;word-break:break-all}
.dwsf-previewBody{margin-top:12px;padding-right:4px;overflow:auto;color:var(--dsw-alias-label-primary);font-size:13px;line-height:21px}
.dwsf-previewBody h1{margin:0 0 8px;font-size:17px;font-weight:600;line-height:24px}
.dwsf-previewBody h2{margin:16px 0 6px;padding-top:10px;border-top:.5px solid var(--dsw-alias-border-l1);font-size:14px;font-weight:600;line-height:22px}
.dwsf-previewBody h3{margin:12px 0 4px;font-size:13px;font-weight:600;line-height:20px}
.dwsf-previewBody p{margin:0 0 8px}
.dwsf-previewBody ul{margin:0 0 8px;padding-left:18px}
.dwsf-previewBody li{margin:2px 0}
.dwsf-previewBody table{width:100%;margin:6px 0 10px;border-collapse:collapse;font-size:12px;line-height:18px}
.dwsf-previewBody th,.dwsf-previewBody td{padding:4px 6px;border:.5px solid var(--dsw-alias-border-l1);text-align:left;vertical-align:top}
.dwsf-previewBody th{background:var(--dsw-alias-interactive-bg-hover);font-weight:600}
.dwsf-previewBody code{padding:1px 4px;border-radius:4px;background:var(--dsw-alias-interactive-bg-hover);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
.dwsf-previewBody pre{margin:6px 0 10px;padding:8px 10px;overflow:auto;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-interactive-bg-hover);font-size:12px;line-height:18px}
.dwsf-previewBody pre code{padding:0;background:0 0}
.dwsf-previewBody strong{font-weight:600}

.dwsf-digestList{display:flex;flex-direction:column;gap:2px}
.dwsf-digestRow{display:grid;grid-template-columns:16px minmax(0,1fr) auto;align-items:center;gap:8px;width:100%;padding:7px 8px;border:0;border-radius:var(--dsw-radius-md);background:0 0;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:18px;text-align:left;cursor:pointer}
.dwsf-digestRow:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dwsf-digestRow:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-1px}
.dwsf-digestName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dwsf-digestMeta{flex:none;color:var(--dsw-alias-label-tertiary);font-size:11px;font-variant-numeric:tabular-nums}

.dwsf-side{flex:0 0 clamp(280px,34%,400px);display:flex;flex-direction:column;min-width:0;min-height:0;border-left:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.dwsf-sideHead{flex:none;display:flex;align-items:center;gap:10px;padding:14px 14px 10px;border-bottom:.5px solid var(--dsw-alias-border-l1)}
.dwsf-sideTitle{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;line-height:20px}
.dwsf-sideBody{flex:1;min-height:0;overflow:auto;padding:12px 14px 18px;scrollbar-gutter:stable}
.dwsf-sideHint{margin:0 0 10px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.dwsf-sideEmpty{padding:18px 2px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.dwsf-side .dwsf-previewBody{margin-top:8px;padding-right:0;overflow:visible}
.dwsf-side .dwsf-digestName{font-size:12px}
.dwsf-digestRow[data-active="true"]{background:var(--dsw-alias-interactive-bg-active)}

`

    /* ------------------------------------------------------------------ *
     * Plugin
     * ------------------------------------------------------------------ */

    return {
      inject: ['slots'],
      apply(ctx) {
        const locale = ctx.get('locale')
        const fallback = (key, params) => {
          let text = zh[key] !== undefined ? zh[key] : (en[key] !== undefined ? en[key] : key)
          if (params) for (const name of Object.keys(params)) text = text.split('{' + name + '}').join(String(params[name]))
          return text
        }
        const t = locale ? locale.bind(NS) : fallback

        ctx.effect(() => {
          if (!locale) return undefined
          const dispose = locale.register(NS, { zh, en })
          return () => { if (typeof dispose === 'function') dispose() }
        }, 'workspace-session-filter: dictionaries')

        ctx.effect(() => {
          const styles = ctx.get('styles')
          if (styles && typeof styles.insert === 'function') {
            const dispose = styles.insert(css)
            return () => { if (typeof dispose === 'function') dispose() }
          }
          const tag = document.createElement('style')
          tag.dataset.plugin = PANEL_ID
          tag.textContent = css
          document.head.appendChild(tag)
          return () => { tag.remove() }
        }, 'workspace-session-filter: styles')

        const openPanel = () => {
        const layout = ctx.get('layout')
        if (!layout || typeof layout.selectPanel !== 'function') {
          console.error('[workspace-session-filter] layout service is unavailable')
          return
        }
        layout.selectPanel(PANEL_ID)
      }

      const openSession = (sessionId) => {
          const uiWorkspace = ctx.get('uiWorkspace')
          if (!uiWorkspace) {
            console.error('[workspace-session-filter] uiWorkspace service is unavailable')
            return
          }
          uiWorkspace.openSession(sessionId)
        }

        ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          inject: () => ({ t, onOpen: openSession }),
        }, PanelRoot)), 'workspace-session-filter: panel')

        ctx.effect(() => ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action',
          id: PANEL_ID,
          order: 10,
          label: () => t('panel.label'),
          inject: () => ({ t, onOpen: openSession, onOpenPanel: openPanel }),
        }, FooterEntry)), 'workspace-session-filter: sidebar footer')

        ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: PANEL_ID,
          order: 25,
          label: () => t('panel.label'),
          inject: () => ({ t, onOpenPanel: openPanel }),
        }, SettingsPage)), 'workspace-session-filter: settings section')

        ctx.effect(() => ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
          name: 'settings.section.icon',
          id: PANEL_ID,
          order: 25,
          label: () => t('panel.label'),
        }, PanelGlyph)), 'workspace-session-filter: settings section icon')

        ctx.effect(() => ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
          name: 'settings.plugins.tab',
          id: PANEL_ID,
          order: 30,
          label: () => t('panel.label'),
          inject: () => ({ t }),
        }, SettingsPage)), 'workspace-session-filter: settings page')

        /* The nav entry is opt-in, so its registration is created and dropped while
         * the page runs instead of being decided once at apply time. */
        ctx.effect(() => {
          let dispose = null
          const sync = () => {
            if (navVisible() && !dispose) {
              dispose = ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
                name: 'sidebar.panellist',
                id: PANEL_ID,
                order: 30,
                label: () => t('panel.label'),
              }, PanelGlyph))
              return
            }
            if (!navVisible() && dispose) {
              dispose()
              dispose = null
            }
          }
          const off = subscribeNav(sync)
          sync()
          return () => {
            off()
            if (dispose) {
              dispose()
              dispose = null
            }
          }
        }, 'workspace-session-filter: nav icon')
      },
    }
  },
})
