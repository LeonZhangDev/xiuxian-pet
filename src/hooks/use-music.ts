import { useCallback, useEffect, useRef, useState } from 'react'
import { desktop } from '../lib/desktop-bridge'
import { getSettings, getTrackBpm, setSettings, setTrackBpm, subscribeSettings } from '../lib/settings'

// 预览/调试：URL 带 ?dance=1 强制起舞（与 PetCanvas 的 FORCE_DANCE 同源）
const FORCE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('dance')

export interface MusicState {
  systemPlaying: boolean
  dancing: boolean
  enabled: boolean
  manual: boolean
  /** 当前生效的起舞速度（拍/分钟）；曲目记忆优先于全局设置 */
  bpm: number
  /** 当前曲目（GSMTC 提供；浏览器环境为空） */
  track: string
  /** 当前 BPM 是否来自这首曲目的记忆 */
  remembered: boolean
  /** Tap Tempo：连点即出 BPM，点数不够返回 null */
  tap: () => number | null
  /** 手动设定 BPM：有曲目时记到曲目上，否则改全局默认 */
  setBpm: (bpm: number) => void
  setEnabled: (on: boolean) => void
  setManual: (on: boolean) => void
}

/**
 * 系统音乐播放状态 → 起舞。
 * 桌宠窗口与洞府窗口共用：过去只有桌宠窗口订阅 music:state，
 * 洞府里的小仙在放歌时一动不动，是明显的逻辑缺口。
 *
 * 关于"节拍驱动"的诚实说明：Windows 的系统媒体接口只暴露曲目与播放状态，
 * 不提供音频波形，因此拿不到真实 BPM。这里的做法是——用户跟着歌点几下把速度
 * 告诉小仙，按曲目记住，下次播到同一首自动对上拍子。
 * 不做 WASAPI 回环采集：常驻进程的稳定性与权限代价远大于收益。
 */
export function useMusicState(): MusicState {
  const [systemPlaying, setSystemPlaying] = useState(false)
  // 停播后延迟 3 秒收舞：播放器切歌/暂停有抖动，立刻停会一卡一卡
  const [softPlaying, setSoftPlaying] = useState(false)
  const [settings, setLocal] = useState(getSettings)
  const [track, setTrack] = useState('')
  const [trackBpm, setLocalTrackBpm] = useState<number | null>(null)

  useEffect(() => subscribeSettings(setLocal), [])
  useEffect(() => {
    if (!desktop) return
    const offState = desktop.onMusic((on) => setSystemPlaying(on))
    const offTrack = desktop.onMusicTrack?.((t) => {
      setTrack(t)
      setLocalTrackBpm(getTrackBpm(t))
    })
    return () => { offState?.(); offTrack?.() }
  }, [])

  useEffect(() => {
    if (systemPlaying) {
      setSoftPlaying(true)
      return
    }
    if (!settings.danceAutoOff) return // 关掉渐停 = 保持上一段余韵直到手动关
    const id = window.setTimeout(() => setSoftPlaying(false), 3000)
    return () => window.clearTimeout(id)
  }, [systemPlaying, settings.danceAutoOff])

  const enabled = settings.danceEnabled
  const manual = settings.danceManual
  const dancing = FORCE || (enabled && (manual || softPlaying))
  const bpm = trackBpm ?? settings.danceBpm

  // Tap Tempo：取间隔中位数，抗单次手抖；停手 2.5 秒重新起拍
  const tapsRef = useRef<number[]>([])
  const tap = useCallback(() => {
    const now = performance.now()
    const taps = tapsRef.current
    if (taps.length && now - taps[taps.length - 1] > 2500) taps.length = 0
    taps.push(now)
    if (taps.length > 8) taps.shift()
    if (taps.length < 3) return null
    const gaps: number[] = []
    for (let i = 1; i < taps.length; i++) gaps.push(taps[i] - taps[i - 1])
    gaps.sort((a, b) => a - b)
    const mid = gaps[Math.floor(gaps.length / 2)]
    if (!Number.isFinite(mid) || mid <= 0) return null
    const next = Math.min(180, Math.max(60, Math.round(60000 / mid)))
    if (track) {
      setTrackBpm(track, next)
      setLocalTrackBpm(next)
    } else {
      setSettings({ danceBpm: next })
    }
    return next
  }, [track])

  const setBpm = useCallback((value: number) => {
    const next = Math.min(180, Math.max(60, Math.round(value)))
    if (track) {
      setTrackBpm(track, next)
      setLocalTrackBpm(next)
    } else {
      setSettings({ danceBpm: next })
    }
  }, [track])

  return {
    systemPlaying,
    dancing,
    enabled,
    manual,
    bpm,
    track,
    remembered: trackBpm != null,
    tap,
    setBpm,
    setEnabled: (on: boolean) => setSettings({ danceEnabled: on }),
    setManual: (on: boolean) => setSettings({ danceManual: on }),
  }
}
