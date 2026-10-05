// ─── 形象配色（换装）────────────────────────────────────────────
// 立绘是整张位图，没有分层素材，因此这里做的是"整体染色"而不是"只染袍子"：
// filter 改色相/饱和度（保留明暗层次），再叠一层半透明色定调。
// 想做到真正的分层换装，需要资源包提供分层图或遮罩——契约见文件末尾的注释。

export interface Look {
  id: string
  name: string
  icon: string
  desc: string
  filter: string // Canvas 2D filter（Chromium 支持）
  tint: string // 叠加色
  alpha: number // 叠加强度 0~0.35
  aura: string // 灵光/闭关光环颜色（r,g,b）
}

export const LOOKS: Look[] = [
  { id: 'plain', name: '本来面貌', icon: '🌿', desc: '不施粉黛，天然一段风流', filter: '', tint: '#000000', alpha: 0, aura: '150,235,200' },
  // 基础立绘是绿衣（hue≈120°）：想变暖色得往负方向转（绿→黄→橙→红）
  { id: 'jade', name: '青玉', icon: '💚', desc: '青玉为骨，灵气自生', filter: 'saturate(1.15) hue-rotate(-8deg)', tint: '#8fbfa8', alpha: 0.15, aura: '150,235,200' },
  { id: 'cinnabar', name: '丹朱', icon: '❤️', desc: '朱砂点额，眉心一抹焰', filter: 'hue-rotate(-75deg) saturate(1.25)', tint: '#c96a4a', alpha: 0.18, aura: '235,170,140' },
  { id: 'gold', name: '鎏金', icon: '✨', desc: '金纹绕身，如沐朝阳', filter: 'hue-rotate(-45deg) saturate(1.1) brightness(1.05)', tint: '#d3b781', alpha: 0.18, aura: '230,200,140' },
  { id: 'moon', name: '月华', icon: '🌙', desc: '月色洗练，清冷出尘', filter: 'saturate(0.6) brightness(1.12)', tint: '#dfe8ff', alpha: 0.16, aura: '200,220,255' },
  { id: 'ink', name: '墨染', icon: '🖤', desc: '水墨入骨，只余一双眼', filter: 'saturate(0.4) brightness(0.9)', tint: '#2b3a44', alpha: 0.22, aura: '150,170,180' },
  { id: 'fox', name: '赤焰', icon: '🔥', desc: '狐火附体，尾焰摇红', filter: 'hue-rotate(-95deg) saturate(1.3)', tint: '#a8452f', alpha: 0.2, aura: '240,150,110' },
]

export const getLook = (id: string | null | undefined): Look | null =>
  id ? LOOKS.find((l) => l.id === id) ?? null : null

// ── 分层换装契约（给未来的资源包）──────────────────────────────
// 资源包 manifest 里可声明 layers，按序叠加绘制在基础立绘之上：
//   "layers": [{ "pose": "idle", "file": "hair-01.webp", "offset": [0, -6] }]
// PetCanvas 目前只支持整体染色；当 packs.ts 读出 layers 后按同样顺序绘制即可，
// 届时"发型/服饰/配饰"自由组合才真正成立，本文件的预设会退化为"配色"一层。
