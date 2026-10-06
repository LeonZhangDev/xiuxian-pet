// 审计 src/assets 全部素材：分辨率 / 体积 / 格式，按类别归类输出
const fs = require('fs')
const path = require('path')

const DIR = 'src/assets'

function parseSize(buf, ext) {
  try {
    if (ext === '.png') {
      if (buf.slice(1, 4).toString('ascii') !== 'PNG') return null
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
    }
    if (ext === '.webp') {
      if (buf.slice(0, 4).toString('ascii') !== 'RIFF') return null
      const fourcc = buf.slice(12, 16).toString('ascii')
      if (fourcc === 'VP8 ') {
        const w = buf.readUInt16LE(26) & 0x3fff
        const h = buf.readUInt16LE(28) & 0x3fff
        return { w, h }
      }
      if (fourcc === 'VP8L') {
        const b = buf.readUInt32LE(21)
        return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 }
      }
      if (fourcc === 'VP8X') {
        return { w: (buf.readUIntLE(24, 3) & 0xffffff) + 1, h: (buf.readUIntLE(27, 3) & 0xffffff) + 1 }
      }
      return null
    }
    if (ext === '.jpg' || ext === '.jpeg') {
      let off = 2
      while (off < buf.length - 9) {
        if (buf[off] !== 0xff) { off++; continue }
        const m = buf[off + 1]
        if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { off += 2; continue }
        const len = buf.readUInt16BE(off + 2)
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
          return { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7) }
        }
        off += 2 + len
      }
      return null
    }
  } catch (e) { return null }
  return null
}

const files = fs.readdirSync(DIR)
const rows = []
for (const f of files) {
  const ext = path.extname(f).toLowerCase()
  if (!['.png', '.webp', '.jpg', '.jpeg', '.mp3', '.ogg', '.wav'].includes(ext)) continue
  const full = path.join(DIR, f)
  const st = fs.statSync(full)
  if (['.mp3', '.ogg', '.wav'].includes(ext)) {
    rows.push({ f, w: '-', h: '-', kb: Math.round(st.size / 1024), ext })
    continue
  }
  const buf = fs.readFileSync(full)
  const d = parseSize(buf, ext)
  rows.push({ f, w: d ? d.w : '?', h: d ? d.h : '?', kb: Math.round(st.size / 1024), ext })
}

// 归类
const cat = (f) => {
  if (f.startsWith('pet-') || f.startsWith('skin-')) return '主角/皮肤'
  if (f.startsWith('enemy-')) return '怪物'
  if (f.startsWith('tile-')) return '地块'
  if (f.startsWith('deco-')) return '装饰'
  if (f.startsWith('prop-')) return '奇遇物件'
  if (f.startsWith('cos-')) return '外观(翼/坐骑)'
  if (f.startsWith('sfx-') || f.startsWith('bgm')) return '音频'
  return '其他'
}

const groups = {}
for (const r of rows) { (groups[cat(r.f)] ||= []).push(r) }

let out = ''
const order = ['主角/皮肤', '怪物', '地块', '装饰', '奇遇物件', '外观(翼/坐骑)', '其他', '音频']
const total = { kb: 0, n: 0 }
for (const k of order) {
  const g = groups[k]
  if (!g) continue
  out += `\n【${k}】 ${g.length} 个\n`
  for (const r of g) {
    out += `  ${String(r.f).padEnd(30)} ${String(r.w).padStart(5)}x${String(r.h).padEnd(5)} ${String(r.kb).padStart(5)}KB ${r.ext}\n`
  }
}
for (const r of rows) { total.kb += r.kb; total.n++ }
out += `\n=== 合计 ${total.n} 个文件，${Math.round(total.kb / 1024)}MB ===\n`

// 同时统计：png/webp 双份冗余
const pngs = rows.filter((r) => r.ext === '.png')
const dupTap = pngs.filter((p) => rows.some((q) => q.ext === '.webp' && q.f === p.f.replace('.png', '.webp')))
const orphanPng = pngs.filter((p) => !rows.some((q) => q.ext === '.webp' && q.f === p.f.replace('.png', '.webp')))
out += `\n=== PNG 原图残留：${pngs.length} 个（其中 ${dupTap.length} 个已有同名 webp 双份，${orphanPng.length} 个独占即未被转码）===\n`
if (orphanPng.length) {
  out += '未被转码的 PNG：\n'
  for (const p of orphanPng) out += `  ${p.f} ${p.w}x${p.h} ${p.kb}KB\n`
}
out += `\n=== 双份 PNG 冗余体积：${Math.round(dupTap.reduce((s, p) => s + p.kb, 0) / 1024)}MB ===\n`

fs.writeFileSync('asset-audit.txt', out, 'utf8')
console.log('done, rows=' + rows.length)
