import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { desktop } from './lib/desktop-bridge'
import { usePetStore } from './hooks/use-pet-store'
import { useUiSettings } from './hooks/use-ui-settings'
import { loadUserPacks } from './game/packs'
import type { ViewMode } from './views/view-types'

const PetView = lazy(() => import('./views/pet-view'))
const HomeView = lazy(() => import('./views/home-view'))

// 闲时预取对面视图的 chunk：桌宠/洞府互相切换零等待
const prefetchView = (mode: ViewMode) => {
  const go = () => {
    void (mode === 'pet' ? import('./views/home-view') : import('./views/pet-view'))
    void import('./views/settings-view') // 设置页轻量，一起预取，进去零等待
  }
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
  if (ric) ric(go)
  else window.setTimeout(go, 2000)
}

export default function App() {
  const store = usePetStore()
  useUiSettings() // 观感设置落到根节点（类名 + CSS 变量），两个窗口同源
  const [mode, setMode] = useState<ViewMode>(() => desktop ? (desktop.windowRole === 'game' ? 'home' : 'pet') : new URLSearchParams(window.location.search).has('pet') ? 'pet' : 'home')
  const navigate = useCallback((next: ViewMode) => {
    if (desktop?.windowRole === 'pet' && next !== 'pet') { desktop.gameMode(next); return }
    if (desktop?.windowRole === 'game' && next === 'pet') { desktop.petMode(); return }
    setMode(next)
  }, [])
  useEffect(() => {
    const removeMode = desktop?.onOpenMode((next) => setMode(next))
    const removeHome = desktop?.onOpenHome(() => navigate('home'))
    void loadUserPacks() // 扫描 %APPDATA%/xiuxian-pet/packs/ 用户资源包（幂等）
    return () => { removeMode?.(); removeHome?.() }
  }, [navigate])
  useEffect(() => {
    const background = mode === 'pet' ? 'transparent' : '#0e1211'
    document.body.style.background = background
    document.documentElement.style.background = background
    prefetchView(mode) // 闲时预取对面视图
  }, [mode])
  return (
      // 桌宠模式的加载占位必须透明，否则透明窗上会闪一个灰盒
      <Suspense fallback={mode === 'pet' ? null : <div role="status" className="rounded-xl bg-slate-900 p-4 text-white">正在唤醒小仙……</div>}>
        {!store.ready ? (mode === 'pet' ? null : <div role="status">正在同步洞府……</div>) : mode === 'pet' ?
          <PetView {...store} mode={mode} navigate={navigate} /> :
          <HomeView {...store} mode={mode} navigate={navigate} />}
      </Suspense>
  )
}
