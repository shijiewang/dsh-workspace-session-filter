# 工作区会话筛选（DSH 插件）

`@local/dsh-workspace-session-filter` · MIT License · 仓库：<https://github.com/shijiewang/dsh-workspace-session-filter>

给 DSH 侧边栏加两个入口：

1. **侧边栏左下角**的常驻筛选条 —— `运行中 N` / `待确认 N` 两个 chip，点一下就在上方
   弹层里列出命中的会话，是日常主入口；
2. 侧边栏面板列表里的「会话筛选」图标 —— 打开中间栏的完整视图，顶部是
   `全部 / 运行中 / 等待确认 / 更多` 筛选器，`更多` 里是 `最近一天 / 最近三天 /
   最近一周 / 最近一个月`（外加 `不限时间`）。

## 功能

- **按状态筛选**：左下角只保留 `运行中`（含子智能体仍在跑）与 `待确认`（审批、计划
  审阅、待回答）两个 chip，各自带当前命中数；完整面板另有 `全部` 用于浏览。
- **左下角直接可用**：点 chip 在上方弹出按工作区分组的列表，点行直接进会话，再点同一个
  chip 收起；侧边栏收成窄条时退化为一个带角标（运行中 + 待确认 总数）的图标。
- **按时间筛选**：`更多` 下拉里的四个时间窗，基于会话的 `updatedAt`；选中后 `更多`
  按钮直接显示当前时间窗名称，再点一次可改回 `不限时间`。
- **组合筛选**：状态与时间可叠加，右侧出现 `清除筛选` 一次复位。
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
# 从 GitHub 装（pnpm 会锁定解析到的 commit）
dsh plugin --profile desktop add github:shijiewang/dsh-workspace-session-filter

# 固定到某个标签
dsh plugin --profile desktop add github:shijiewang/dsh-workspace-session-filter#v1.0.0

# 或者直接用本仓库的绝对路径（装成 link: 依赖，改文件后刷新即生效）
dsh plugin --profile desktop add /absolute/path/to/dsh-workspace-session-filter

# 卸载
dsh plugin --profile desktop remove @local/dsh-workspace-session-filter
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

- 侧边栏**左下角**（设置按钮上方）出现 `运行中 N` / `待确认 N` 筛选条；
- 侧边栏面板列表里出现「会话筛选」图标，指向中间栏的完整视图。

卸载：`plugin_manager({ action: "remove_bundle", target: "@local/dsh-workspace-session-filter" })`。

> 包名带 `@local/` 作用域，因为它只通过本地目录安装、不发布到 npm；如要改成公开包名，
> 同步修改 `package.json` 的 `name` 与已安装 profile 里的依赖名即可。

## 结构

| 文件 | 作用 |
| --- | --- |
| `client.js` | 全部界面逻辑：字典、图标、左下筛选条 + 面板 + 侧边栏图标三个 slot 注册、内联样式 |
| `index.js` | Host 半边（本插件不需要 Host 能力，留空） |
| `cordis.patch.yml` | 把 `session-filter` 条目插入 profile 组合 |
| `package.json` | 包元信息 + `dsh.client` / `dsh.bundle` 声明 |
| `locale/zh.json`、`locale/en.json` | 插件管理器里显示的名称与描述 |
| `icon.svg` | 插件图标 |

## 实现要点

- **面板落位**：`sidebar.panellist` 的 `id` 与 `main` 的 `key` 复用同一个字符串
  `session-filter`，侧边栏图标因此直接指向本面板；`order: 30` 排在插件、定时任务、
  上下文之后。
- **左下筛选条落位**：注册到 `sidebar.footer.action`（设置按钮上方一格，
  `order: 10`），只拿到 ownerProps `{ wide }`；弹层用 `position: fixed` + 元素
  包围盒算锚点，避开侧边栏自身的 `overflow` 裁切。
- **数据来源**：`main` slot 提供的标准 props — `useSessions`（会话快照）、
  `useWorkspaces`（工作区快照）、`useSessionStatus`（状态 Map），全部是
  `SnapshotSelectorHook`，必须传 selector。
- **样式**：只用 `--dsw-alias-*` / `--dsw-*` 设计令牌，数值对齐内置列表页
  （960px 内容宽、`clamp(24px,4vw,48px)` 内边距、28px chip、32px 行高、菜单 4px 内衬
  + `--dsw-elevation-prominent`），类名前缀 `dwsf-`。
- **容错**：面板与左下筛选条各包一层错误边界（`PanelBoundary` / `FooterBoundary`），
  渲染异常时分别退化成空状态 / 什么都不渲染，不会让中间栏变白或拖坏侧边栏；
  标准 hooks 缺失时先打日志再降级。

## 验证

`node --check client.js`、manifest/字典 JSON 校验通过；安装后通过 Slots 检查确认
`sidebar.footer.action`、`sidebar.panellist` 与 `main` 三个宿主都已挂上
`session-filter`（运行中的页面里生效）。
再用一个按树路径实现 hooks 的迷你 React 骨架渲染真实组件、驱动 chip 与下拉，
覆盖了左下筛选条（chip 计数、弹层开合、行点击、窄条模式）与完整面板
（计数、分组、状态/时间筛选、菜单开合、空状态）两条路径的断言。

DSH 的检查工具没有渲染/截图能力，所以像素级外观需要你在正在运行的窗口里点左侧
新图标目视确认。

## 许可证

MIT License，见 [LICENSE](LICENSE)。
