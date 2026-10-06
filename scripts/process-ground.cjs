// 地块无缝化处理：裁掉右下水印 → 边缘交叉渐变无缝化 → 输出为 assets/tile-*.jpg
// 用法: node scripts/process-ground.cjs
const { PNG } = require('pngjs')
const fs = require('fs')
const path = require('path')

const SRC = process.argv[2] || 'C:/Users/admin/Documents/kimi/tasks/2026-03/14-31-05-1025d846/xiuxian-pet/.gen-tmp'
const OUT = process.argv[3] || path.join(__dirname, '..', 'src', 'assets')

const FILES = [
  { src: 'Top_down_seamless_tileable_gro_2026-10-06T02-29-01.png', out: 'tile-forest' },
  { src: 'Top_down_seamless_tileable_swa_2026-10-06T02-28-58.png', out: 'tile-swamp' },
  { src: 'Top_down_seamless_tileable_bar_2026-10-06T02-29-02.png', out: 'tile-barren' },
  { src: 'Top_down_seamless_tileable_vol_2026-10-06T02-28-57.png', out: 'tile-lava' },
]

const lerp = (a, b, t) => a + (b - a) * t
const smooth = (t) => t * t * (3 - 2 * t)

// 1) 修补右下水印区：用其正上方的同尺寸区域垂直翻转覆盖（地面纹理噪声性强，不可察觉）
function patchWatermark(data, W, H) {
  const x0 = Math.floor(W * 0.68), y0 = Math.floor(H * 0.88)
  const pw = W - x0, ph = H - y0
  for (let y = 0; y < ph; y++) {
    const srcY = y0 - 1 - y // 正上方镜像
    for (let x = 0; x < pw; x++) {
      const di = ((y0 + y) * W + (x0 + x)) * 4
      const si = (srcY * W + (x0 + x)) * 4
      data[di] = data[si]; data[di + 1] = data[si + 1]; data[di + 2] = data[si + 2]; data[di + 3] = 255
    }
  }
  return { x0, y0 }
}

// 2) 无缝化：单轴边缘交叉渐变（把边缘混向对面半幅，令首尾连续）
function makeSeamlessAxis(data, W, H, axis, M) {
  const out = Buffer.from(data)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = axis === 'x' ? x : y
      const half = (axis === 'x' ? W : H) / 2
      const d = Math.abs(p - half) // 距中心
      const edgeD = half - d       // 距最近边
      if (edgeD >= M) continue
      const w = smooth(1 - edgeD / M) // 边缘=1，M 处=0
      const q = (p + half) % (axis === 'x' ? W : H)
      const i = (y * W + x) * 4
      const j = axis === 'x' ? (y * W + Math.floor(q)) * 4 : (Math.floor(q) * W + x) * 4
      for (let c = 0; c < 3; c++) out[i + c] = Math.round(lerp(data[i + c], data[j + c], w))
    }
  }
  return out
}

for (const f of FILES) {
  const png = PNG.sync.read(fs.readFileSync(path.join(SRC, f.src)))
  let { width: W, height: H, data } = png

  // 修补水印（保留全分辨率，不裁切）
  const wm = patchWatermark(data, W, H)
  const size = Math.min(W, H)
  console.log(`${f.out}: 源 ${W}x${H}, 水印区已修补 (${wm.x0},${wm.y0}起), 保留 ${size}x${size}`)

  // 无缝化（x 轴、y 轴各做一次，边缘带 8%）
  const M = Math.round(size * 0.08)
  let out = makeSeamlessAxis(data, size, size, 'x', M)
  out = makeSeamlessAxis(out, size, size, 'y', M)

  const pngOut = new PNG({ width: size, height: size })
  out.copy(pngOut.data)
  fs.writeFileSync(path.join(SRC, `seam-${f.out}.png`), PNG.sync.write(pngOut))
  console.log(`  → ${path.join(SRC, `seam-${f.out}.png`)} (${size}x${size})`)
}
console.log('DONE')
