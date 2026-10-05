# 桌面运行稳定性

## overview

修复透明桌宠舞台拦截鼠标、拖动区丢失交互、异常存档导致空白界面等问题，并将洞府/秘境从透明窗口中分离。继续采用 TypeScript、React 和 Electron；没有证据支持为本轮问题改写成 C++。

## design decisions

- 桌宠是固定尺寸透明窗口；普通可缩放窗口负责洞府、秘境与渡劫，按需创建。
- 桌宠 renderer 是状态、计时及存档唯一写入者。普通窗口通过主进程缓存快照订阅，操作经 IPC 转发到桌宠。主进程不运行第二个 reducer。
- 桌宠根容器使用 no-drag。Canvas 可见像素和可见控件接收鼠标，空白透传；拖动由 pointer capture 与受限的位置 IPC 处理。用户手动完全穿透与自动命中分开。
- 存档按字段校验并归一化。异常原文先备份，备份失败时禁用覆盖保存。数据更新不可修改上一份状态。
- 当前形象待机图先显示；动作、外观和天气图按需缓存。桌宠、洞府、秘境和渡劫代码分包，非关键网络请求带超时。
- 普通窗口在可见界面挂载后报告 ready；桌宠在实际画出待机图后报告 ready。关键素材、画布或 React 错误交给可见恢复入口，可选图像失败继续待机。
- ErrorBoundary 重试整页重载，避免 React.lazy 缓存的失败 Promise 导致伪重试。返回桌宠不删除存档。
- Electron 事件订阅返回取消函数；隐藏或退出流程清理对应动画、订阅、计时器和子进程。

## implementation notes

- `src/App.tsx` 负责视图协调，`src/views/` 分离桌宠、洞府及养成面板。
- `src/hooks/use-pet-store.ts` 负责单写者生命周期，`src/game/pet-store.ts` 负责存档校验，`src/game/data.ts` 保持不可变更新。
- `src/lib/desktop-bridge.ts` 与 `electron/preload.cjs` 声明通信契约；`electron/main.cjs` 管理原生窗口。
- `src/hooks/use-weather.ts` 限制天气请求时间并在卸载时取消；聊天失败回退本地话术。
- 日志批量写入，限制队列和单条大小，并按实际文件大小切卷。
- 状态回归：`node scripts/test-pet-state.mjs`；Electron 集成：项目上级 `output/diagnostics/test-desktop-stability.cjs`，使用独立 audit-profile。
- 全量 lint 的模板 UI 既有错误应与本轮业务文件检查分别报告；不通过关闭全局规则掩盖问题。
- 2026-10-04 验证：Node 24.19 构建、修改业务文件 lint、9 项状态回归通过；源码与独立新版打包内容各通过 19 项 Electron 集成检查，结果位于项目上级 `output/diagnostics/`。全量 lint 仍有 8 个模板 UI 既有错误。
- 独立新版为 `release/stability-check-v2/win-unpacked/桌面小仙.exe`；启动前退出旧版，保留完整目录。打包内容验证使用隔离存档，不替换原部署或用户数据。
- 发布前仍需在目标 Windows 桌面实测真实鼠标透传、多屏/DPI、全屏应用与具体显卡驱动。程序内 API 与页面绘制验证不能替代这些平台验收。
