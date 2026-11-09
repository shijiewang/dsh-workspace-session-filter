# 工作区会话筛选（DSH 插件）

`dsh-workspace-session-filter` · MIT License · 仓库：<https://github.com/shijiewang/dsh-workspace-session-filter>

给 DSH 侧边栏加两个入口：

1. **侧边栏底部的筛选条** —— 设置按钮上方单独一行，`运行中` / `待确认` / `未读` / `今日`
   四个 chip（各自带命中数），行尾再挂一颗 **DeepSeek 服务状态灯**。点 chip 向上弹出按工作区
   分组的会话列表，点行直接进会话，是日常主入口；
2. 侧边栏面板列表里的「会话筛选」图标（**默认不显示**）—— 在
   `设置 → 会话筛选`（同一页面也出现在 `设置 → 插件 → 会话筛选` 标签页，以及底部
   弹层的页脚）打开开关后出现，指向中间栏的完整视图，顶部是
   `全部 / 运行中 / 等待确认 / 未读 / 今日 / 更多` 筛选器，`更多` 里是 `最近一天 /
   最近三天 / 最近一周 / 最近一个月`（外加 `不限时间`）。

## 功能

- **按状态筛选**：底部只放四个 chip —— `运行中`（含子智能体仍在跑）、`待确认`（审批、
  计划审阅、待回答）、`未读`（跑完但没看，或最近有新内容你没打开过）、`今日`（本地零点之后
  有过更新），各自带当前命中数；完整面板另有 `全部` 用于浏览。
- **就在手边**：点 chip 向上弹出按工作区分组的列表，点行直接进会话，再点同一个 chip 收起；
  侧边栏收成窄条时换成带合计角标的圆形按钮，展开后同样能筛。
- **单独一行**：筛选条占满侧边栏那一行，不和成本计等其他底部条目挤在一起。
- **按时间筛选**：`更多` 下拉里的四个时间窗，基于会话的 `updatedAt`；选中后 `更多`
  按钮直接显示当前时间窗名称，再点一次可改回 `不限时间`。
- **组合筛选**：状态与时间可叠加，右侧出现 `清除筛选` 一次复位。
- **DeepSeek 服务状态灯**：筛选条行尾一颗小圆点，绿=正常、黄=部分服务异常或维护中、
  红=有进行中的故障、灰=取不到（本地中继没跑或网络不通）。鼠标悬浮显示当前结论、故障标题
  与状态更新时间、最近三次故障（标题 + 恢复状态 + 时间），点击打开
  <https://status.deepseek.com/> 看详情。数据来自该站点的 Atom feed：中继每分钟做一次
  条件 GET（带 `ETag`，未变化时上游回 304，直接复用上次解析结果），界面同样每分钟取一次；
  整条链路由插件的 Host 半边经 `127.0.0.1` 的小中继交给界面（原因见下方「实现要点」）。
- **按工作区分组**：组标题是工作区名（没有名字时退化成目录名），组内按最近活动倒序；
  不属于任何工作区的会话归到末尾的「未分组」组。
- **一眼可见的状态**：每行左侧状态点复刻内置 `StateDot`（运行中是旋转描边环，其余是
  10px 圆点并按状态着色），右侧显示状态文案与相对时间。
- **点一下就能进**：整行是按钮，点击调用 `uiWorkspace.openSession(sessionId)` 切到会话面板。
- **与内置列表同源**：跳过 `origin: 'subagent'` 的子智能体会话，默认隐藏归档会话，
  只显示当前打开的空白新会话，标题空时显示「未命名会话」。

## 安装

这是一个 DSH 插件包（bundle），两种装法：在应用里用**插件管理器**，或者用下面的 **`dsh` CLI**。

插件管理器的 `install_bundle` 指向目录的**绝对路径**即可：

```text
plugin_manager({ action: "install_bundle", target: "/绝对路径/dsh-workspace-session-filter" })
```

装完后 profile 会以 `link:` 依赖指向该目录（`~/.dsh_desktop/profiles/desktop/package.json`），
所以之后改动本目录的文件，刷新页面（⌘R）就会生效；只有改到 `package.json` 的
`dsh.client.inject`、`cordis.patch.yml` 或 `index.js` 时才需要重新安装。

### 用 `dsh` CLI 安装

同一个包也可以交给 DSH 自带的 CLI 装进某个 profile（`dsh plugin` 会把参数原样转给
profile 目录里的 pnpm，装完再读包里的 `dsh.bundle.patch` 自动登记到
`dsh.profile.bundles`，因此不用手改 profile 的 `package.json`）：

```bash
# 从 npm registry 装（1.0.1 起可用，最省事）
dsh plugin --profile desktop add dsh-workspace-session-filter

# 从 GitHub 装（pnpm 会锁定解析到的 commit）
dsh plugin --profile desktop add github:shijiewang/dsh-workspace-session-filter

# 固定到某个标签
dsh plugin --profile desktop add github:shijiewang/dsh-workspace-session-filter#v1.0.1

# 或者直接用本仓库的绝对路径（装成 link: 依赖，改文件后刷新即生效）
dsh plugin --profile desktop add /absolute/path/to/dsh-workspace-session-filter

# 卸载
dsh plugin --profile desktop remove dsh-workspace-session-filter
```

几点前提：

- 桌面应用自带这条命令：`/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh`
  （应用里也可以把它装进 PATH；`which dsh` 找不到时直接用这个绝对路径）。它自带
  pnpm，不依赖你 shell 里的 pnpm 版本。
- `desktop` profile 需要先启动过一次桌面应用（命令会检查
  `profiles/desktop/package.json`），并且建议在应用**完全退出**后再执行装包，避免和
  运行中的实例抢 profile 锁。
- `add github:...` 会把依赖锁在解析到的 commit 上；想跟进更新就再 add 一次，想回到
  本仓库改文件即时生效的开发状态，用绝对路径再 add 一次覆盖即可。

装好后：

- 侧边栏**底部**（设置按钮上方、单独一行）出现 `运行中 N` / `待确认 N` / `未读 N` 筛选条；
- 面板列表里**不会**自动多出图标；需要完整视图时，到 `设置 → 会话筛选`
  （或 `设置 → 插件 → 会话筛选`，或底部弹层的页脚）打开「在左侧导航显示」，
  图标才出现（开关状态存本地，刷新后保留）；同一页还有「打开面板」按钮，
  不装图标也能直接进完整视图。

卸载：`plugin_manager({ action: "remove_bundle", target: "dsh-workspace-session-filter" })`。

> 包名 `dsh-workspace-session-filter` 与仓库同名。截至 1.1.0，npm registry、
> GitHub、release tarball、本地目录四种来源都能装；registry 上是 `npm publish` 发出的
> 正式版本，`repository` 字段指回本仓库。

## 结构

| 文件 | 作用 |
| --- | --- |
| `client.js` | 全部界面逻辑：字典、图标、底部筛选条 / 面板 / 设置页三处注册 + 按开关动态注册的侧边栏图标、内联样式 |
| `index.js` | Host 半边（本插件不需要 Host 能力，留空） |
| `cordis.patch.yml` | 把 `session-filter` 条目插入 profile 组合 |
| `package.json` | 包元信息 + `dsh.client` / `dsh.bundle` 声明 |
| `locale/zh.json`、`locale/en.json` | 插件管理器里显示的名称与描述 |
| `icon.svg` | 插件图标 |

## 实现要点

- **面板落位**：`sidebar.panellist` 的 `id` 与 `main` 的 `key` 复用同一个字符串
  `session-filter`，侧边栏图标因此直接指向本面板；`order: 30` 排在插件、定时任务、
  上下文之后。
- **导航图标可关**：开关出现在三处 —— `设置 → 会话筛选`（独立设置页）、
  `设置 → 内置插件 → 会话筛选` 标签页、以及底部筛选条弹出的列表页脚；
  偏好存 `localStorage`（键 `dsh-workspace-session-filter:nav.v1`，默认关），
  开关变化时**注销/重建** `sidebar.panellist` 注册，因此关掉时不会留下一个空图标位。
- **筛选条落位**：注册在 `sidebar.footer.action`（设置按钮上方的一行槽位），整条占满宽度；
  弹层用 `position: fixed` 贴在 chip 上方（`bottom: innerHeight - rect.top + 8`），因为侧边栏
  容器 `overflow` 会裁掉绝对定位的浮层。宽版渲染三个 chip，窄条（`wide: false`）渲染一个
  36px 圆按钮，角标是三个数字之和。
- **数据来源**：`main` slot 提供的标准 props — `useSessions`（会话快照）、
  `useWorkspaces`（工作区快照）、`useSessionStatus`（状态 Map），全部是
  `SnapshotSelectorHook`，必须传 selector。
- **样式**：只用 `--dsw-alias-*` / `--dsw-*` 设计令牌，数值对齐内置列表页
  （960px 内容宽、`clamp(24px,4vw,48px)` 内边距、28px chip、32px 行高、菜单 4px 内衬
  + `--dsw-elevation-prominent`），类名前缀 `dwsf-`。
- **服务状态为什么要绕一圈**：`status.deepseek.com` 的响应没有任何 CORS 头，bundle 的
  Client 半边也拿不到 `host.call`（那是动态包的桥），所以 `index.js`（Host 半边，真 Node）
  在 `127.0.0.1:47100`–`47105` 里挑一个空闲端口起只读中继，缓存 60 秒；界面轮询它，取不到就
  老老实实显示灰点。系统 DNS 对 `status.deepseek.com` 会返回备案拦截页的地址，中继在直连
  失败时改用 DNS-over-HTTPS（`1.1.1.1` / `8.8.8.8` / `223.5.5.5`）拿到真实 IP 再带 SNI 请求。
- **未读的判定**：两个来源叠加 —— ① 状态 Map 里的 `completionUnread`（内置列表画完成点的
  同一个信号，覆盖"跑完没看"）；② 本插件自己记的"最后查看时间表"，存 `localStorage`
  （key `dsh-workspace-session-filter:seen.v1`），会话 `updatedAt` 比它新就算有新内容。
  维护方式：当前打开的会话每次渲染都刷新时间戳，点任意行也算读过，首次见到的会话先建基线
  （所以新装不会满屏未读）。`未读` 与 `运行中`/`待确认` 互斥计数，行右侧会多出 `未读` 文案。
- **容错**：面板与左下筛选条各包一层错误边界（`PanelBoundary` / `FooterBoundary`），
  渲染异常时分别退化成空状态 / 什么都不渲染，不会让中间栏变白或拖坏侧边栏；
  标准 hooks 缺失时先打日志再降级。

## 验证

`node --check client.js`、manifest/字典 JSON 校验通过；安装后通过 Slots 检查确认
`sidebar.footer.action`、`sidebar.panellist` 与 `main` 三个宿主都已挂上
`session-filter`（运行中的页面里生效）。
再用一个按树路径实现 hooks 的迷你 React 骨架渲染真实组件、驱动 chip 与下拉，
覆盖了底部筛选条（chip 计数、弹层开合、行点击、窄条模式）与完整面板
（计数、分组、状态/时间筛选、菜单开合、空状态）两条路径的断言。

DSH 的检查工具没有渲染/截图能力，所以像素级外观需要你在正在运行的窗口里点左侧
新图标目视确认。

## 许可证

MIT License，见 [LICENSE](LICENSE)。
