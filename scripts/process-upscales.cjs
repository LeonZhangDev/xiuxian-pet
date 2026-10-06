// 上采样素材后处理：alpha 检测 + 白底泛洪去背 + 羽化，输出处理后的 PNG
// 用法: NODE_PATH=<workspace>/node_modules node scripts/process-upscales.cjs
const { PNG } = require('pngjs')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

const jobs = [
  {
    src: '.gen-tmp/将这张游戏怪物立绘高清重制为4倍分辨率_严格保持原有的盘绕红_2026-10-06T01-48-33.png',
    out: '.gen-tmp/proc-boss.png',
  },
  {
    src: '.gen-tmp/将这张游戏怪物立绘高清重制为2倍分辨率_严格保持原有的岩石巨_2026-10-06T01-48-31.png',
    out: '.gen-tmp/proc-golem.png',
    checker: true, // 该图背景是画进像素的灰白棋盘格（~248/~232 两色），需扩展判定
  },
  {
    src: '.gen-tmp/将这张游戏场景物件立绘高清重制为2倍分辨率_严格保持原有的修_2026-10-06T01-48-33.png',
    out: '.gen-tmp/proc-stele.png',
  },
]

for (const job of jobs) {
  const srcPath = path.join(ROOT, job.src)
  const png = PNG.sync.read(fs.readFileSync(srcPath))
  const { width: W, height: H, data } = png
  let transparent = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] < 8) transparent++
  const ratio = transparent / (W * H)
  let report = `${path.basename(job.out)}: ${W}x${H} 透明占比=${(ratio * 100).toFixed(1)}%`

  if (ratio < 0.02) {
    // 不透明 → 从画布四边泛洪移除连通浅色背景
    const isLight = job.checker
      ? (i) => Math.min(data[i], data[i + 1], data[i + 2]) >= 200 && Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) <= 24
      : (i) => data[i] >= 235 && data[i + 1] >= 235 && data[i + 2] >= 235
    const visited = new Uint8Array(W * H)
    const removed = new Uint8Array(W * H)
    const stack = []
    for (let x = 0; x < W; x++) stack.push(x, 0, x, H - 1)
    for (let y = 0; y < H; y++) stack.push(0, y, W - 1, y)
    while (stack.length) {
      const y = stack.pop()
      const x = stack.pop()
      if (x < 0 || y < 0 || x >= W || y >= H) continue
      const p = y * W + x
      if (visited[p]) continue
      visited[p] = 1
      const i = p * 4
      if (data[i + 3] < 8 || isLight(i)) {
        removed[p] = 1
        stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1)
      }
    }
    let removedCount = 0
    for (let p = 0; p < W * H; p++) {
      if (removed[p]) { data[p * 4 + 3] = 0; removedCount++ }
    }
    // 棋盘格场景：全局清扫残留的均匀棋盘灰（内部未与边界连通的口袋）
    if (job.checker) {
      let swept = 0
      for (let p = 0; p < W * H; p++) {
        const i = p * 4
        if (data[i + 3] === 0) continue
        const mn = Math.min(data[i], data[i + 1], data[i + 2])
        const mx = Math.max(data[i], data[i + 1], data[i + 2])
        if (mn >= 212 && mx - mn <= 12) { data[i + 3] = 0; swept++ }
      }
      report += `，棋盘灰全局清扫${((swept / (W * H)) * 100).toFixed(1)}%`
    }
    // 羽化：与移除区相邻的浅色像素一并置透明，消除白边
    let feathered = 0
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = y * W + x
        if (removed[p]) continue
        const i = p * 4
        if (data[i] < 200 || data[i + 1] < 200 || data[i + 2] < 200) continue
        const nearRemoved =
          (x > 0 && removed[p - 1]) || (x < W - 1 && removed[p + 1]) ||
          (y > 0 && removed[p - W]) || (y < H - 1 && removed[p + W])
        if (nearRemoved) { data[i + 3] = 0; feathered++ }
      }
    }
    report += ` → 白底已去背(移除${((removedCount / (W * H)) * 100).toFixed(1)}%,羽化${feathered}px级)`
  } else {
    report += ' → 原生透明，无需处理'
  }

  fs.writeFileSync(path.join(ROOT, job.out), PNG.sync.write(png))
  console.log(report)
}
console.log('done')
