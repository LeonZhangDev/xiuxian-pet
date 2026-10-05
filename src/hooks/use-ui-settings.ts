import { useEffect, useState } from 'react'
import { applyUiToDocument, getSettings, subscribeSettings, setSettings, type UiSettings } from '../lib/settings'

/**
 * 界面偏好：订阅式读取 + 自动落 DOM。
 * 设置项即刻生效（无"保存"按钮），所以任何视图改了都能马上看到，
 * 也避免了"改完忘了点保存"这种经典交互陷阱。
 */
export function useUiSettings(): [UiSettings, (patch: Partial<UiSettings>) => void] {
  const [settings, setLocal] = useState(getSettings)
  useEffect(() => subscribeSettings(setLocal), [])
  useEffect(() => { applyUiToDocument(settings) }, [settings])
  return [settings, setSettings]
}
