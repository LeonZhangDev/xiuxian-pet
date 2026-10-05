// ─── 2.5D 渲染层（Three.js / WebGL）──────────────────────────────
// 把原 Canvas2D 世界绘制迁到真 3D 场景：斜俯视透视相机 + 雾深 + 光照氛围，
// 立绘当 billboard（精灵）立在地面平面上 → 真·视差 / 2.5D 纵深。
// 地面（地块/区域/边界）每帧烘焙到离屏画布贴到地面平面；HUD/红雾/小地图/伤害数字仍走 2D overlay。
import * as THREE from 'three'
import { ENEMY_SPRITE_H } from './dungeon'

/** Dungeon 暴露给 GL 渲染器的只读视图（用 any 绕过 private，避免大改可见性） */
export interface DungeonGLView {
  enemies: any[]
  enemyImgs: Record<string, HTMLImageElement>
  enemyImgReady: Record<string, boolean>
  dying: any[]
  player: any
  playerImg: HTMLImageElement
  playerImgReady: boolean
  playerBlinkImg: HTMLImageElement
  playerBlinkReady: boolean
  blinkUntil: number
  companion: any
  companionImg: HTMLImageElement
  companionImgReady: boolean
  companionName: string
  decos: any[]
  props: any[]
  propImgs: Record<string, HTMLImageElement>
  propReady: Record<string, boolean>
  ghosts: any[]
  particles: any[]
  projectiles: any[]
  bolts: any[]
  telegraphs: any[]
  pickups: any[]
  mouse: { x: number; y: number }
  wingImg: HTMLImageElement | null
  wingReady: boolean
  mountImg: HTMLImageElement | null
  mountReady: boolean
}

type GroundDrawer = (ctx: CanvasRenderingContext2D, rx: number, ry: number, rw: number, rh: number) => void

const GROUND_MARGIN = 240

export class GLWorld {
  renderer: THREE.WebGLRenderer
  scene = new THREE.Scene()
  camera: THREE.PerspectiveCamera
  private vw: number
  private vh: number
  private dpr: number
  private groundDrawer: GroundDrawer

  private groundCanvas: HTMLCanvasElement
  private groundCtx: CanvasRenderingContext2D
  private groundTex: THREE.CanvasTexture
  private groundMesh: THREE.Mesh

  private sky: THREE.Mesh
  private hemi: THREE.HemisphereLight
  private sun: THREE.DirectionalLight

  private texCache = new Map<HTMLImageElement, THREE.Texture>()
  private enemyPool = new Map<object, THREE.Sprite>()
  private dyingPool = new Map<object, THREE.Sprite>()
  private decoPool = new Map<object, THREE.Sprite>()
  private propPool = new Map<object, THREE.Sprite>()
  private projPool = new Map<object, THREE.Sprite>()
  private pickupPool = new Map<object, THREE.Sprite>()
  private boltPool = new Map<object, THREE.Line>()
  private telePool = new Map<object, THREE.Mesh>()
  private ghostSprites: THREE.Sprite[] = []
  private playerSprite: THREE.Sprite
  private playerBlinkSprite: THREE.Sprite
  private companionSprite: THREE.Sprite
  private wingSprite: THREE.Sprite
  private mountSprite: THREE.Sprite

  private particleGeo: THREE.BufferGeometry
  private particlePts: THREE.Points
  private particlePos: Float32Array
  private particleCol: Float32Array
  private readonly PMAX = 900

  private raycaster = new THREE.Raycaster()
  private tmpV = new THREE.Vector3()

  constructor(canvas: HTMLCanvasElement, opts: { vw: number; vh: number; dpr: number; quality: string; groundDrawer: GroundDrawer }) {
    this.vw = opts.vw
    this.vh = opts.vh
    this.dpr = Math.min(opts.dpr, opts.quality === 'smooth' ? 1.25 : 2)
    this.groundDrawer = opts.groundDrawer

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: opts.quality !== 'smooth', alpha: false, powerPreference: 'high-performance' })
    console.info('[GLWorld] WebGL 渲染器初始化成功')
    this.renderer.setPixelRatio(this.dpr)
    this.renderer.setSize(this.vw, this.vh, false)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setClearColor(0x0a1010, 1)

    this.scene.fog = new THREE.Fog(0x0c1514, 760, 2700)

    // 斜俯视透视相机（Diablo 式 2.5D）
    const fov = 40
    const H = this.vh * 1.2
    this.camera = new THREE.PerspectiveCamera(fov, this.vw / this.vh, 1, 9000)
    this.camera.position.set(0, H, this.vh * 0.7)
    this.camera.lookAt(0, 0, 0)

    // 光照氛围：天/地半球光 + 一束斜阳（精灵不吃光，但雾 + 地面 Lambert 有体积感）
    this.hemi = new THREE.HemisphereLight(0xbfe6ff, 0x2a332c, 0.95)
    this.scene.add(this.hemi)
    this.sun = new THREE.DirectionalLight(0xffe9c2, 0.7)
    this.sun.position.set(-0.4, 1, 0.6)
    this.scene.add(this.sun)

    // 地面平面（单位平面，每帧缩放贴到可见区域）
    this.groundCanvas = document.createElement('canvas')
    this.groundCtx = this.groundCanvas.getContext('2d')!
    this.groundTex = new THREE.CanvasTexture(this.groundCanvas)
    this.groundTex.colorSpace = THREE.SRGBColorSpace
    this.groundTex.minFilter = THREE.LinearMipmapLinearFilter
    this.groundTex.magFilter = THREE.LinearFilter
    this.groundTex.generateMipmaps = true
    // 地面纹理 y 轴与实体世界坐标（Z=wy）对齐：PlaneGeometry(v=0 在底) + 旋转后，
    // 保持 CanvasTexture 默认 flipY=true 即可让「画布顶部=更远(更小 wy)」与 billboard 一致。
    const groundMat = new THREE.MeshLambertMaterial({ map: this.groundTex, emissive: 0xffffff, emissiveMap: this.groundTex, emissiveIntensity: 0.62 })
    this.groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), groundMat)
    this.groundMesh.rotation.x = -Math.PI / 2
    this.scene.add(this.groundMesh)

    // 远景天幕（视差背景）：靛蓝 → 暖褐渐变，置于高处远处
    this.sky = new THREE.Mesh(
      new THREE.PlaneGeometry(9000, 2600),
      new THREE.MeshBasicMaterial({ map: this.makeSkyTexture(), depthWrite: false, fog: false }),
    )
    this.sky.position.set(0, 1500, -2600)
    this.scene.add(this.sky)

    // 实体精灵（始终存在，按需显隐）
    this.playerSprite = this.makeSprite(null, false)
    this.playerBlinkSprite = this.makeSprite(null, false)
    this.companionSprite = this.makeSprite(null, false)
    this.wingSprite = this.makeSprite(null, false)
    this.mountSprite = this.makeSprite(null, false)
    this.scene.add(this.playerSprite, this.playerBlinkSprite, this.companionSprite, this.wingSprite, this.mountSprite)
    this.playerSprite.visible = this.playerBlinkSprite.visible = this.companionSprite.visible = this.wingSprite.visible = this.mountSprite.visible = false

    // 粒子点云
    this.particleGeo = new THREE.BufferGeometry()
    this.particlePos = new Float32Array(this.PMAX * 3)
    this.particleCol = new Float32Array(this.PMAX * 3)
    this.particleGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePos, 3))
    this.particleGeo.setAttribute('color', new THREE.BufferAttribute(this.particleCol, 3))
    const pMat = new THREE.PointsMaterial({ size: 7, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true, blending: THREE.AdditiveBlending })
    this.particlePts = new THREE.Points(this.particleGeo, pMat)
    this.particlePts.frustumCulled = false
    this.scene.add(this.particlePts)
  }

  private makeSprite(tex: THREE.Texture | null, fog = true): THREE.Sprite {
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog })
    const s = new THREE.Sprite(m)
    s.visible = false
    return s
  }

  private texFor(img: HTMLImageElement | null): THREE.Texture | null {
    if (!img || !img.complete || !img.naturalWidth) return null
    let t = this.texCache.get(img)
    if (!t) {
      t = new THREE.Texture(img)
      t.colorSpace = THREE.SRGBColorSpace
      t.minFilter = THREE.LinearMipmapLinearFilter
      t.magFilter = THREE.LinearFilter
      t.generateMipmaps = true
      t.needsUpdate = true
      this.texCache.set(img, t)
    }
    return t
  }

  private makeSkyTexture(): THREE.Texture {
    const c = document.createElement('canvas')
    c.width = 16
    c.height = 256
    const g = c.getContext('2d')!
    const grad = g.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, '#0a0f1c')
    grad.addColorStop(0.45, '#16203a')
    grad.addColorStop(0.8, '#3a2e3a')
    grad.addColorStop(1, '#6b4a32')
    g.fillStyle = grad
    g.fillRect(0, 0, 16, 256)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }

  setSize(vw: number, vh: number, dpr: number, quality: string) {
    this.vw = vw
    this.vh = vh
    this.dpr = Math.min(dpr, quality === 'smooth' ? 1.25 : 2)
    this.renderer.setPixelRatio(this.dpr)
    this.renderer.setSize(vw, vh, false)
    this.camera.aspect = vw / vh
    this.camera.updateProjectionMatrix()
  }

  // 每帧：推状态 + 渲染
  sync(v: DungeonGLView, cam: { x: number; y: number }, shake: number) {
    const sx = (Math.random() - 0.5) * shake
    const sy = (Math.random() - 0.5) * shake

    // 相机：斜俯视跟随
    const cx = cam.x + this.vw / 2 + sx
    const cz = cam.y + this.vh / 2 + sy
    const H = this.vh * 1.2
    this.camera.position.set(cx, H, cz + this.vh * 0.7)
    this.camera.lookAt(cx, 0, cz)
    this.sky.position.set(cx, 1500, cz - 2600)

    // 地面烘焙
    const rx = cam.x - GROUND_MARGIN + sx
    const ry = cam.y - GROUND_MARGIN + sy
    const rw = this.vw + GROUND_MARGIN * 2
    const rh = this.vh + GROUND_MARGIN * 2
    this.bakeGround(rx, ry, rw, rh)
    this.groundMesh.scale.set(rw, rh, 1)
    this.groundMesh.position.set(rx + rw / 2, 0, ry + rh / 2)

    // 立绘 / 实体
    this.syncEnemies(v)
    this.syncDying(v)
    this.syncDecos(v)
    this.syncProps(v)
    this.syncPlayer(v)
    this.syncCompanion(v)
    this.syncGhosts(v)
    this.syncProjectiles(v)
    this.syncPickups(v)
    this.syncBolts(v)
    this.syncTelegraphs(v)
    this.syncParticles(v)
  }

  private bakeGround(rx: number, ry: number, rw: number, rh: number) {
    const cw = Math.round(rw * this.dpr)
    const ch = Math.round(rh * this.dpr)
    if (this.groundCanvas.width !== cw || this.groundCanvas.height !== ch) {
      this.groundCanvas.width = cw
      this.groundCanvas.height = ch
    }
    const ctx = this.groundCtx
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, rw, rh)
    ctx.save()
    ctx.translate(-rx, -ry)
    this.groundDrawer(ctx, rx, ry, rw, rh)
    ctx.restore()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.groundTex.needsUpdate = true
  }

  private spriteFrom(pool: Map<object, THREE.Sprite>, key: object, tex: THREE.Texture | null): THREE.Sprite | null {
    if (!tex) return null
    let s = pool.get(key)
    if (!s) {
      s = this.makeSprite(tex)
      this.scene.add(s)
      pool.set(key, s)
    }
    s.material.map = tex
    s.material.needsUpdate = true
    s.visible = true
    return s
  }

  private syncEnemies(v: DungeonGLView) {
    const seen = new Set<object>()
    for (const e of v.enemies) {
      if (e.dead) continue
      const img = v.enemyImgs[e.kind]
      const tex = this.texFor(v.enemyImgReady[e.kind] ? img : null)
      if (!tex) continue
      const s = this.spriteFrom(this.enemyPool, e, tex)
      if (!s) continue
      seen.add(e)
      const drawH = ENEMY_SPRITE_H[e.kind as keyof typeof ENEMY_SPRITE_H] ?? 64
      const flip = v.player && v.player.pos.x < e.pos.x ? -1 : 1
      const flash = e.flash > 0 && Math.floor(performance.now() / 60) % 2 === 0
      s.position.set(e.pos.x, drawH * 0.5, e.pos.y)
      s.scale.set(drawH * flip, drawH, 1)
      s.material.opacity = flash ? 0.45 : 1
    }
    for (const [k, s] of this.enemyPool) {
      if (!seen.has(k)) { s.visible = false; this.enemyPool.delete(k); this.disposeSprite(s) }
    }
  }

  private syncDying(v: DungeonGLView) {
    const seen = new Set<object>()
    for (const d of v.dying) {
      const img = v.enemyImgs[d.kind]
      const tex = this.texFor(img)
      if (!tex) continue
      const s = this.spriteFrom(this.dyingPool, d, tex)
      if (!s) continue
      seen.add(d)
      const drawH = ENEMY_SPRITE_H[d.kind as keyof typeof ENEMY_SPRITE_H] ?? 64
      const k = 1 - d.t / d.max
      const sc = (1 + k * 0.25) * (1 - k * 0.8)
      s.position.set(d.pos.x, drawH * 0.5, d.pos.y)
      s.scale.set(drawH * sc, drawH * sc, 1)
      s.material.rotation = k * 0.9
      s.material.opacity = (1 - k) * 0.85
    }
    for (const [k, s] of this.dyingPool) {
      if (!seen.has(k)) { s.visible = false; this.dyingPool.delete(k); this.disposeSprite(s) }
    }
  }

  private syncDecos(v: DungeonGLView) {
    const seen = new Set<object>()
    for (const dc of v.decos) {
      const tex = this.texFor(dc.img)
      if (!tex) continue
      const s = this.spriteFrom(this.decoPool, dc, tex)
      if (!s) continue
      seen.add(dc)
      s.position.set(dc.pos.x, dc.h * 0.5, dc.pos.y)
      s.scale.set(dc.h, dc.h, 1)
      s.material.opacity = 1
    }
    for (const [k, s] of this.decoPool) {
      if (!seen.has(k)) { s.visible = false; this.decoPool.delete(k); this.disposeSprite(s) }
    }
  }

  private syncProps(v: DungeonGLView) {
    const seen = new Set<object>()
    const propH: Record<string, number> = { herb: 56, chest: 66, stele: 116 }
    const t = performance.now() / 1000
    for (const prop of v.props) {
      const img = v.propImgs[prop.kind]
      const tex = this.texFor(v.propReady[prop.kind] ? img : null)
      if (!tex) continue
      const s = this.spriteFrom(this.propPool, prop, tex)
      if (!s) continue
      seen.add(prop)
      const h = propH[prop.kind] ?? 60
      const bob = prop.kind === 'herb' && prop.active ? Math.sin(t * 2 + prop.pos.x) * 3 : 0
      s.position.set(prop.pos.x, h * 0.5, prop.pos.y + (prop.active ? 0 : 0))
      s.scale.set(h, h, 1)
      s.material.opacity = prop.active ? 1 : (prop.kind === 'herb' ? 0.22 : 0.35)
      s.position.y += (prop.active ? 0 : 0)
      if (bob) s.position.y += bob
    }
    for (const [k, s] of this.propPool) {
      if (!seen.has(k)) { s.visible = false; this.propPool.delete(k); this.disposeSprite(s) }
    }
  }

  private syncPlayer(v: DungeonGLView) {
    const p = v.player
    const h = 68
    const flip = v.mouse && v.mouse.x < p.pos.x ? -1 : 1
    const flash = p.flash > 0 && Math.floor(performance.now() / 60) % 2 === 0
    let alpha = 1
    if (p.dashT > 0) alpha *= 0.6
    if (flash) alpha *= 0.5
    if (p.invuln > 0) alpha *= Math.floor(performance.now() / 90) % 2 === 0 ? 0.35 : 0.8

    // 坐骑（垫在脚下）
    const mt = this.texFor(v.mountReady ? v.mountImg : null)
    if (mt) {
      this.mountSprite.visible = true
      this.mountSprite.material.map = mt
      this.mountSprite.material.needsUpdate = true
      const mh = 108
      const mbob = Math.abs(Math.sin(p.walkT * 10)) * (Math.hypot(p.vx, p.vy) > 0.3 ? 3 : 1.2)
      this.mountSprite.position.set(p.pos.x, mh * 0.5 + 8 + mbob, p.pos.y)
      this.mountSprite.scale.set(mh * 1.24 * flip, mh * 1.24, 1)
      this.mountSprite.material.opacity = alpha
    } else this.mountSprite.visible = false

    // 灵翼（本体之后）
    const wt = this.texFor(v.wingReady ? v.wingImg : null)
    if (wt) {
      this.wingSprite.visible = true
      this.wingSprite.material.map = wt
      this.wingSprite.material.needsUpdate = true
      this.wingSprite.position.set(p.pos.x, h * 0.5 - 30 + 16, p.pos.y)
      this.wingSprite.scale.set(124 * flip, 87, 1)
      this.wingSprite.material.opacity = alpha * 0.92
    } else this.wingSprite.visible = false

    // 本体（眨眼或常态）
    const blinking = performance.now() < v.blinkUntil && v.playerBlinkReady && p.swingT <= 0
    const bodyTex = this.texFor((blinking ? v.playerBlinkReady : v.playerImgReady) ? (blinking ? v.playerBlinkImg : v.playerImg) : null)
    if (bodyTex) {
      this.playerSprite.visible = true
      this.playerSprite.material.map = bodyTex
      this.playerSprite.material.needsUpdate = true
      this.playerSprite.position.set(p.pos.x, h * 0.5, p.pos.y)
      this.playerSprite.scale.set(h * flip, h, 1)
      this.playerSprite.material.opacity = alpha
    } else this.playerSprite.visible = false
  }

  private syncCompanion(v: DungeonGLView) {
    const c = v.companion
    const tex = this.texFor(v.companionImgReady ? v.companionImg : null)
    if (tex) {
      this.companionSprite.visible = true
      this.companionSprite.material.map = tex
      this.companionSprite.material.needsUpdate = true
      const h = 56
      const flip = v.player && v.player.pos.x > c.pos.x ? -1 : 1
      this.companionSprite.position.set(c.pos.x, h * 0.5, c.pos.y)
      this.companionSprite.scale.set(h * flip, h, 1)
      this.companionSprite.material.opacity = 1
    } else this.companionSprite.visible = false
  }

  private syncGhosts(v: DungeonGLView) {
    while (this.ghostSprites.length < v.ghosts.length) {
      const s = this.makeSprite(null)
      this.scene.add(s)
      this.ghostSprites.push(s)
    }
    for (let i = 0; i < this.ghostSprites.length; i++) {
      const s = this.ghostSprites[i]
      const g = v.ghosts[i]
      if (!g) { s.visible = false; continue }
      const tex = this.texFor(v.playerImgReady ? v.playerImg : null)
      if (!tex) { s.visible = false; continue }
      s.visible = true
      s.material.map = tex
      s.material.needsUpdate = true
      const flip = g.aimLeft ? -1 : 1
      s.position.set(g.pos.x, 34, g.pos.y)
      s.scale.set(68 * flip, 68, 1)
      s.material.opacity = (g.life / g.maxLife) * 0.45
    }
  }

  private syncProjectiles(v: DungeonGLView) {
    const seen = new Set<object>()
    for (const pr of v.projectiles) {
      const s = this.spriteFrom(this.projPool, pr, this.projTex(pr))
      if (!s) continue
      seen.add(pr)
      s.position.set(pr.pos.x, 16, pr.pos.y)
      s.scale.set(22, 22, 1)
      s.material.rotation = Math.atan2(pr.vel.y, pr.vel.x)
      s.material.opacity = 1
    }
    for (const [k, s] of this.projPool) {
      if (!seen.has(k)) { s.visible = false; this.projPool.delete(k); this.disposeSprite(s) }
    }
  }

  private projTexCache = new Map<boolean, THREE.Texture>()
  private projTex(friendly: boolean): THREE.Texture {
    let t = this.projTexCache.get(friendly)
    if (!t) {
      const c = document.createElement('canvas')
      c.width = c.height = 32
      const g = c.getContext('2d')!
      if (friendly) {
        g.fillStyle = '#cfe8ff'
        g.shadowColor = '#9fd0ff'
        g.shadowBlur = 8
        g.beginPath(); g.moveTo(26, 16); g.lineTo(6, 12); g.lineTo(10, 16); g.lineTo(6, 20); g.closePath(); g.fill()
      } else {
        g.fillStyle = '#b8e05a'
        g.shadowColor = '#b8e05a'
        g.shadowBlur = 8
        g.beginPath(); g.arc(16, 16, 9, 0, Math.PI * 2); g.fill()
      }
      t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      this.projTexCache.set(friendly, t)
    }
    return t
  }

  private syncPickups(v: DungeonGLView) {
    const seen = new Set<object>()
    const colors: Record<string, string> = { stone: '#8fd3f4', herb: '#7ee08a', ore: '#c9a0e8' }
    for (const pk of v.pickups) {
      const tex = this.pickTex(colors[pk.kind] ?? '#ffffff')
      const s = this.spriteFrom(this.pickupPool, pk, tex)
      if (!s) continue
      seen.add(pk)
      const bobY = Math.sin(pk.t) * 4
      s.position.set(pk.pos.x, 14 + bobY, pk.pos.y)
      s.scale.set(18, 18, 1)
      s.material.opacity = 1
    }
    for (const [k, s] of this.pickupPool) {
      if (!seen.has(k)) { s.visible = false; this.pickupPool.delete(k); this.disposeSprite(s) }
    }
  }

  private pickTexCache = new Map<string, THREE.Texture>()
  private pickTex(color: string): THREE.Texture {
    let t = this.pickTexCache.get(color)
    if (!t) {
      const c = document.createElement('canvas')
      c.width = c.height = 32
      const g = c.getContext('2d')!
      g.fillStyle = color
      g.shadowColor = color
      g.shadowBlur = 10
      g.beginPath(); g.arc(16, 16, 7, 0, Math.PI * 2); g.fill()
      t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      this.pickTexCache.set(color, t)
    }
    return t
  }

  private syncBolts(v: DungeonGLView) {
    const seen = new Set<object>()
    for (const b of v.bolts) {
      let line = this.boltPool.get(b)
      if (!line) {
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(7 * 3), 3))
        line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xd2e6ff, transparent: true, fog: false }))
        line.frustumCulled = false
        this.scene.add(line)
        this.boltPool.set(b, line)
      }
      seen.add(b)
      const k = 1 - b.t / b.max
      const pos = line.geometry.getAttribute('position') as THREE.BufferAttribute
      let bx = b.pos.x
      let by = b.pos.y - 300
      for (let i = 1; i <= 7; i++) {
        const ny = b.pos.y - 300 + (300 / 7) * i
        const nx = b.pos.x + (i === 7 ? 0 : (Math.random() - 0.5) * 34)
        pos.setXYZ(i - 1, bx, 40, by)
        bx = nx; by = ny
      }
      pos.setXYZ(6, b.pos.x, 40, b.pos.y + 2)
      pos.needsUpdate = true
      ;(line.material as THREE.LineBasicMaterial).opacity = 0.95 * (1 - k)
      line.visible = true
    }
    for (const [k, s] of this.boltPool) {
      if (!seen.has(k)) { s.visible = false; this.boltPool.delete(k); this.scene.remove(s); s.geometry.dispose(); (s.material as THREE.Material).dispose() }
    }
  }

  private syncTelegraphs(v: DungeonGLView) {
    const seen = new Set<object>()
    for (const t of v.telegraphs) {
      let m = this.telePool.get(t)
      if (!m) {
        m = new THREE.Mesh(
          new THREE.RingGeometry(0.82, 1, 40),
          new THREE.MeshBasicMaterial({ color: 0xff7a3c, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false }),
        )
        m.rotation.x = -Math.PI / 2
        m.frustumCulled = false
        this.scene.add(m)
        this.telePool.set(t, m)
      }
      seen.add(t)
      const a = Math.max(0, t.t / t.max)
      m.position.set(t.pos.x, 2, t.pos.y)
      m.scale.set(t.r, t.r, 1)
      const mat = m.material as THREE.MeshBasicMaterial
      mat.color.setRGB(1, 0.32 + 0.18 * (1 - a), 0.18)
      mat.opacity = 0.12 + 0.1 * (1 - a) + 0.5 * a
      m.visible = true
    }
    for (const [k, s] of this.telePool) {
      if (!seen.has(k)) { s.visible = false; this.telePool.delete(k); this.scene.remove(s); s.geometry.dispose(); (s.material as THREE.Material).dispose() }
    }
  }

  private syncParticles(v: DungeonGLView) {
    const n = Math.min(v.particles.length, this.PMAX)
    for (let i = 0; i < n; i++) {
      const pt = v.particles[i]
      this.particlePos[i * 3] = pt.pos.x
      this.particlePos[i * 3 + 1] = 14
      this.particlePos[i * 3 + 2] = pt.pos.y
      const col = new THREE.Color(pt.color)
      this.particleCol[i * 3] = col.r
      this.particleCol[i * 3 + 1] = col.g
      this.particleCol[i * 3 + 2] = col.b
    }
    this.particleGeo.setDrawRange(0, n)
    ;(this.particleGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    ;(this.particleGeo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }

  // 世界坐标 → overlay 屏幕坐标（逻辑 vw×vh 空间）
  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    this.tmpV.set(wx, 0, wy).project(this.camera)
    return { x: (this.tmpV.x * 0.5 + 0.5) * this.vw, y: (-this.tmpV.y * 0.5 + 0.5) * this.vh }
  }

  // 屏幕（CSS 像素，相对 rect）→ 世界坐标（地面 Y=0 反投影）
  screenToWorld(clientX: number, clientY: number, rect: DOMRect): { x: number; y: number } {
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1
    const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1)
    this.raycaster.setFromCamera({ x: ndcX, y: ndcY } as THREE.Vector2, this.camera)
    const o = this.raycaster.ray.origin
    const dir = this.raycaster.ray.direction
    const tHit = -o.y / dir.y
    return { x: o.x + dir.x * tHit, y: o.z + dir.z * tHit }
  }

  private disposeSprite(s: THREE.Sprite) {
    this.scene.remove(s)
    s.material.dispose()
  }

  dispose() {
    this.renderer.dispose()
    this.groundTex.dispose()
    for (const t of this.texCache.values()) t.dispose()
  }
}
