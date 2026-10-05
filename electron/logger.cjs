// ─── 桌面小仙 · 日志模块（主进程专用） ─────────────────────────────
// 落盘到 userData/logs/xian-YYYY-MM-DD.log，按天分文件，保留 14 天，单文件超 8MB 自动切卷
const fs = require('fs')
const path = require('path')
const os = require('os')

const KEEP_DAYS = 14
const MAX_FILE_BYTES = 8 * 1024 * 1024
const MAX_QUEUE_BYTES = 128 * 1024
const MAX_LINE_BYTES = 16 * 1024

let logsDir = null
let curFile = null
let curDate = ''
let curSize = 0
let queue = []
let queueBytes = 0
let flushTimer = null
let flushing = false
let verbose = false

function init(app) {
  flush()
  logsDir = path.join(app.getPath('userData'), 'logs')
  curFile = null
  curDate = ''
  curSize = 0
  try {
    fs.mkdirSync(logsDir, { recursive: true })
    pruneOld()
  } catch { /* ignore */ }
}

function dir() {
  return logsDir
}

function pruneOld() {
  try {
    const cutoff = Date.now() - KEEP_DAYS * 86400_000
    for (const f of fs.readdirSync(logsDir)) {
      if (!f.startsWith('xian-') || !f.endsWith('.log')) continue
      const p = path.join(logsDir, f)
      try {
        if (fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p)
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

function fileFor(dateStr, bytes = 0) {
  let base = path.join(logsDir, `xian-${dateStr}.log`)
  // 单文件过大 → 切卷 xian-日期.N.log
  for (let i = 1; ; i++) {
    try {
      if (!fs.existsSync(base) || fs.statSync(base).size + bytes <= MAX_FILE_BYTES) return base
    } catch {
      return base
    }
    base = path.join(logsDir, `xian-${dateStr}.${i}.log`)
  }
}

function write(level, tag, msg, extra) {
  if (!logsDir) return
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10)
  const ts = now.toLocaleString('zh-CN', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0')
  let line = `[${ts}] [${level}] [${tag}] ${msg}`
  if (extra !== undefined) {
    try {
      line += ' ' + JSON.stringify(extra)
    } catch { /* ignore */ }
  }
  // 防止异常对象或高频窗口事件让日志队列无限增长。
  if (Buffer.byteLength(line) > MAX_LINE_BYTES) {
    line = Buffer.from(line).subarray(0, MAX_LINE_BYTES - 32).toString('utf8') + ' [truncated]'
  }
  line += os.EOL
  const bytes = Buffer.byteLength(line)
  if (queueBytes + bytes > MAX_QUEUE_BYTES) flush()
  queue.push({ date: dateStr, line, bytes })
  queueBytes += bytes
  if (!flushTimer) {
    flushTimer = setTimeout(flush, 250)
    flushTimer.unref()
  }
}

function flush() {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = null
  if (flushing || !queue.length || !logsDir) return
  flushing = true
  try {
    let batch = ''
    const appendBatch = () => {
      if (batch) fs.appendFileSync(curFile, batch)
      batch = ''
    }
    for (const entry of queue) {
      if (entry.date !== curDate || !curFile || curSize + entry.bytes > MAX_FILE_BYTES) {
        appendBatch()
        curDate = entry.date
        curFile = fileFor(curDate, entry.bytes)
        curSize = fs.existsSync(curFile) ? fs.statSync(curFile).size : 0
      }
      batch += entry.line
      curSize += entry.bytes
    }
    appendBatch()
  } catch { /* 磁盘不可写就丢，别影响主流程 */
    curFile = null
    curSize = 0
  } finally {
    queue = []
    queueBytes = 0
    flushing = false
  }
}

const log = {
  init,
  dir,
  flush,
  setVerbose: (v) => { verbose = !!v },
  isVerbose: () => verbose,
  debug: (tag, msg, extra) => { if (verbose) write('DEBUG', tag, msg, extra) },
  info: (tag, msg, extra) => write('INFO', tag, msg, extra),
  warn: (tag, msg, extra) => write('WARN', tag, msg, extra),
  error: (tag, msg, extra) => write('ERROR', tag, msg, extra),
}

module.exports = log
