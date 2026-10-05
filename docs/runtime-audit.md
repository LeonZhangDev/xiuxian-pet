# 桌面小仙运行稳定性扫描

日期：2026-10-04（Asia/Shanghai）。范围：源码、当前部署目录、现有启动日志、构建、静态检查、独立数据 Electron 验证及同类产品官方资料。

本文保留改造前的扫描证据。随后已完成窗口、状态和加载策略修复，当前实现与验证结果见 [实现说明](features/desktop-stability.md) 和 [项目进度](progress.md)。

## 结论和证据边界

当前实现适合原型验证，尚不能认为已满足稳定常驻桌面的要求。最明确的问题是桌宠的原生拖动区域与点击/悬停/右键设计冲突，透明空白缺少明确的原生穿透策略；另有可复现的存档异常白屏与状态原地修改。

当前运行的是根目录 xian-app/桌面小仙.exe；所见五个进程属于同一主进程树，不能据此认定为五个重复实例。部署目录与源码 electron/main.cjs 的 SHA256 相同，这只证明该文件一致，不代表所有部署资源完全一致。

现有日志记录 11:15 和 12:46 的页面加载完成、pet 模式初始化和音乐通知；读取的日志中未见渲染崩溃或无响应。页面加载完成不代表人物已绘制，也不证明桌面合成器显示正常。

独立 Electron 测试在相同 Electron 44.5.1 下绘出约 3.4 万个非透明 Canvas 像素，窗口 visible=true、crashed=false，托盘喂食和洞府显示成功。截图证明页面内绘制正常；本轮没有对用户正在运行的窗口做桌面合成截图或原生输入投递，不能宣称其显示问题已经定位或解决。

## 问题清单

| 优先级 | 问题和证据 | 影响及建议 |
| --- | --- | --- |
| P1 | App.tsx:511 根容器默认 WebkitAppRegion=drag；Canvas 未设 no-drag，鼠标处理绑定在同一区域 | Electron 原生拖动区忽略指针事件。宠物悬停、戳、双击及自定义右键菜单存在设计冲突。根容器改为 no-drag，使用明确拖动把手或受控拖动，不把整个透明舞台作为拖动区。 |
| P1 | App.tsx:414 的像素读取只调用 setHover；setIgnoreMouseEvents 仅响应手动 ghost 开关 | 透明窗口没有与命中结果绑定的原生输入策略。空白区域可能吞掉桌面点击；采用统一原生命中策略，使空白穿透、人物和可见控件接收事件，手动完全穿透单独作为用户设置。 |
| P1 | 独立数据将 todos/backpack 设成对象后重载，再通过托盘打开洞府，报 d.filter is not a function，rootChildren=0、bodyLength=0 | loadPet 只合并 JSON，不验证类型；无 React ErrorBoundary。界面消失时渲染进程未退出，render-process-gone 自愈无效。校验/迁移存档、保留损坏存档副本、显示恢复界面。不能默认删除用户存档。 |
| P1 | data.ts:244 仅浅复制，addTodo 修改 prev.todos，startFocus 修改 prev.focus；独立执行验证两者均发生 | reducer 不纯。StrictMode 的重复执行可能导致待办重复、奖励或专注状态不一致；App 的 updater 内还调用 setMessages。改为不可变更新，并将消息作为明确的状态更新结果处理。 |
| P1 | main.cjs:69 立即显示透明置顶窗口，没有“UI/关键资源已就绪”确认；页面失败只写日志；无响应处理只靠重载，异常退出无次数上限 | 加载/React 渲染/图片绘制/OS 合成是不同阶段，当前日志混淆这些状态。增加明确就绪信号和有界恢复；超时用可见的普通恢复窗和重试入口，失败时释放输入，避免不可见窗口挡操作。GPU 兼容模式是诊断选项，当前证据不能证明 GPU 是根因。 |
| P2 | preload 的 onOpenHome/onTrayAction/onDistraction/onMusic/onVerbose 都注册 listener，却不返回注销函数；App:220 随 mode 再注册 onVerbose | 切换模式积累监听；开发 StrictMode 也会放大问题，可能重复动作或消息。所有订阅返回取消函数，effects 对称清理。 |
| P1 | mode:game 不清除 setIgnoreMouseEvents，而 ghost 状态仍可保持 true | 桌宠开启完全穿透后，从托盘打开洞府可能让整个洞府也无法点击。实际输入策略应由窗口模式、命中和用户设置共同计算，普通窗口必须接收输入。 |
| P2 | main.cjs:52 直接使用历史坐标；game 模式 center 后 moved 会覆盖同一 win-state；回 pet 模式只缩小 | 显示器变更后可能出屏，模式切换后桌宠位置漂移。独立保存桌宠位置，按 display.workArea 校验并恢复，支持多屏和 DPI。 |
| P2 | main.cjs:276 将 transparent=true 的同一窗口改成 resizable=true 来显示游戏 | Electron 官方列出透明窗不支持可靠 resize 的限制。建议透明桌宠小窗与普通洞府/战斗窗口分离，共用一个状态来源，关闭重窗口时释放其资源。 |
| P2 | chat.ts 的 fetch 无超时；App 天气请求同样无超时/中止 | 请求长期悬挂时 chatBusy 可能长期锁住，离线回退不会触发。设置超时、响应校验和中止；天气为非关键后台服务。 |
| P2 | PetCanvas 预加载男女及外观共 15 张 512×512 PNG；未安装图片 onerror；Canvas ctx 用非空断言 | 当前图像解码量并非巨大，但缺少失败反馈；当前性别 idle 优先，动作/外观按需缓存，图片/Canvas 失败能进入恢复状态。 |
| P2 | main 的 glideTo 每 16ms 移动窗口，moved 同步 writeFileSync；logger 每条日志 appendFileSync | 移动可能产生频繁同步磁盘写入。位置保存节流，在移动结束/退出落盘；日志采用有界批量写入。 |
| P2 | logger.cjs 仅 curFile 为空时检查大小，选定文件后全天缓存 | 声称 8MB 切卷但后续增长不会重新检查，日志可超过上限。写入前维护大小并切卷；限制消息长度和队列。 |
| P2 | guardProc 退出回调直接清空全局 guardProc；重启时旧进程可能稍后退出；guard stderr 未记录，且严格白名单不自动豁免自身 | 重启存在旧回调清空新进程引用的竞态风险，自身窗口可能被严格模式最小化。按进程身份清理，记录 stderr，定义自身窗口和恢复入口豁免。 |
| P3 | music.ps1 只检查播放器进程存在 | 暂停播放或空闲播放器也会触发跳舞。产品描述应诚实，实际播放检测作为独立增强。 |
| P2 | smoke-test.cjs 主要 console.log 布尔值，无对应失败断言；浏览器路径不覆盖原生拖动区 | 输出 false 也可能 exit 0；现有截图不能证明原生鼠标可用。添加真实失败断言，以及 Windows 原生交互验收。 |

## 验证结果

- npm run build：退出码 0；TypeScript 编译和 Vite 打包通过。JS 主包 358.16 KB，gzip 114.63 KB。
- 构建提示 Node 20.0.0 不满足 Vite 所要求的 20.19+ 或 22.12+。这是构建环境问题，不能据此解释已打包 Electron 的启动症状。
- npm run lint：退出码 1，16 errors / 1 warning，主要为 React render purity、refs 和 hooks 依赖；lint 报错不等于运行时已崩溃。
- output/diagnostics/audit-electron.cjs：使用专属 audit-profile，不读取实际用户存档。正常启动/绘制/托盘 feed/home 通过，故障注入复现非法数组类型导致空白界面。
- output/diagnostics/reducer-evidence.json：previousTodosMutated=true、previousFocusMutated=true。
- 正常绘制截图：output/diagnostics/electron-pet.png 和 electron-home.png；Electron 证据：electron-evidence.json。

## 文件结构和加载策略

App.tsx 1504 行，dungeon.ts 1608 行。长文件使职责、effect 生命周期和状态副作用难以审查；文件长度本身不决定运行速度。当前约 358 KB 主包不足以证明启动卡死由 JS 体积引起。

DungeonView/TribulationGame 是静态导入，进入功能时才实例化对应组件；不能说所有副本贴图在启动时都解码。真正明确的启动预加载发生在 PetCanvas：男女动作、外观和天气图全部 new Image。建议当前 idle 首先绘制，其他图片按需缓存；洞府/副本/渡劫通过 lazy import 和明确 loading/error UI 延后加载。

建议先按职责拆出 DesktopBridge 类型、存档读写、桌宠命中/拖动、桌宠视图、洞府视图及后台服务 hooks，保留统一状态来源。先修复行为再提取文件，避免把原有 bug 原样搬进多个文件。

## 同类产品参考与产品建议

以下产品功能来自官方仓库/商店；建议为本项目的设计推导，未实测它们的内部实现或稳定性。

- [VPet 虚拟桌宠模拟器](https://github.com/LorisYounger/VPet)：开源 WPF 桌宠，仓库区分 UI、游戏核心和资源相关模块。适合参考桌宠本体、状态和扩展之间的边界，不需要因此重写为 WPF。
- [Desktop Mate](https://store.steampowered.com/app/3301060/Desktop_Mate/)：强调角色坐在窗口上、鼠标互动、大小调整、边缘收起和闹钟。启示是“不干扰日常操作”应成为验收指标；先保证透明空白点击桌面、可恢复可退出，再增加自主移动。
- [Spirit City: Lofi Sessions](https://store.steampowered.com/app/2113850/Spirit_City_Lofi_Sessions/)：将待办、专注计时、习惯与手账的活动转换成经验、收藏和外观奖励。项目已有类似方向；建议让专注时安静陪伴/缓慢修炼，战斗由用户主动开启，减少专注中必须照顾的打断。

基础产品建议：托盘始终提供恢复到屏幕中央、打开普通控制窗、暂停自主行为和退出；提供尺寸/帧率/静音选项、勿扰时段及全屏应用避让。先把常驻桌宠打磨可靠，再扩展战斗内容。

## 修复顺序与验收

1. 原生命中与拖动：人物可点击/右键/拖动，空白处可左右键操作桌面，菜单/聊天打开时可操作，手动穿透可从托盘恢复。
2. 可观察启动和恢复：资源未就绪、文件缺失、React 异常和 GPU 显示异常应出现可见恢复入口；任何失败都不能留下吞鼠标的不可见窗口。
3. 存档校验、不可变 reducer、订阅清理：老版本/字段损坏存档保留并可恢复；StrictMode 无重复任务/奖励；连续切换模式不增加 listener。
4. 桌宠位置、多屏/DPI、普通游戏窗口及退出时计时器/进程清理。
5. lazy loading、资源按需加载、写盘节流及产品体验增强。

## 技术依据

- [Electron Custom Window Interactions](https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions)：拖动区忽略指针事件，自定义菜单不应放在拖动区；setIgnoreMouseEvents 可控制穿透，Windows 支持 forward 鼠标移动消息。
- [Electron Custom Window Styles](https://www.electronjs.org/docs/latest/tutorial/custom-window-styles)：透明窗口限制，包括透明区域与穿透、resize 的平台限制。
- [Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window)：窗口 show/ready-to-show、加载完成与窗口呈现的区别。
