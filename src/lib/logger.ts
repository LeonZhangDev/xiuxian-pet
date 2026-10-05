// 渲染进程日志：console 留痕 + 桌面端经桥接落盘到 userData/logs
// 浏览器预览时只打 console，不会报错

type Level = 'info' | 'warn' | 'error' | 'debug'

interface LogBridge {
  log: (level: Level, tag: string, msg: string, extra?: unknown) => void
}

function bridge(): LogBridge | undefined {
  return (window as unknown as { desktop?: LogBridge }).desktop
}

function safe(extra: unknown): unknown {
  if (extra === undefined) return undefined
  try {
    // IPC 只传递 JSON 可克隆的数据，避免 DOM/Error 等对象破坏桥接。
    const json = JSON.stringify(extra)
    if (json === undefined) return String(extra)
    if (json.length > 16_384) return json.slice(0, 16_384) + ' [truncated]'
    return JSON.parse(json)
  } catch {
    return String(extra)
  }
}

let verbose = false
export function setUiVerbose(on: boolean) {
  verbose = on
}

export const uiLog = {
  debug: (tag: string, msg: string, extra?: unknown) => {
    if (!verbose) return
    console.debug(`[${tag}]`, msg, extra ?? '')
    try { bridge()?.log('debug', tag, msg, safe(extra)) } catch { /* ignore */ }
  },
  info: (tag: string, msg: string, extra?: unknown) => {
    console.info(`[${tag}]`, msg, extra ?? '')
    try { bridge()?.log('info', tag, msg, safe(extra)) } catch { /* ignore */ }
  },
  warn: (tag: string, msg: string, extra?: unknown) => {
    console.warn(`[${tag}]`, msg, extra ?? '')
    try { bridge()?.log('warn', tag, msg, safe(extra)) } catch { /* ignore */ }
  },
  error: (tag: string, msg: string, extra?: unknown) => {
    console.error(`[${tag}]`, msg, extra ?? '')
    try { bridge()?.log('error', tag, msg, safe(extra)) } catch { /* ignore */ }
  },
}

// 全局错误钩子：脚本错误 + 未处理 Promise 拒绝 → 落盘
let removeErrorHooks: (() => void) | undefined
export function installErrorHooks() {
  if (removeErrorHooks) return removeErrorHooks
  const onError = (e: ErrorEvent) => {
    uiLog.error('crash', `未捕获错误：${e.message}`, { file: e.filename, line: e.lineno, col: e.colno })
  }
  const onRejection = (e: PromiseRejectionEvent) => {
    uiLog.error('crash', '未处理 Promise 拒绝', { reason: String(e.reason) })
  }
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  removeErrorHooks = () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
    removeErrorHooks = undefined
  }
  return removeErrorHooks
}
