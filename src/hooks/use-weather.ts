import { useEffect, useState } from 'react'

export function useWeather() {
  const [weather, setWeather] = useState<'rain' | 'snow' | null>(null)
  useEffect(() => {
    let stopped = false
    let pending: AbortController | null = null
    const load = async () => {
      pending?.abort()
      const controller = new AbortController()
      pending = controller
      const timeout = window.setTimeout(() => controller.abort(), 8000)
      try {
        const geoResponse = await fetch('https://ipapi.co/json/', { signal: controller.signal })
        if (!geoResponse.ok) return
        const geo = await geoResponse.json()
        if (!Number.isFinite(geo.latitude) || !Number.isFinite(geo.longitude)) return
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&current_weather=true`, { signal: controller.signal })
        if (!response.ok) return
        const data = await response.json()
        const code = data.current_weather?.weathercode
        if (typeof code !== 'number' || stopped) return
        setWeather((code >= 71 && code <= 77) || code === 85 || code === 86 ? 'snow' : (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95 ? 'rain' : null)
      } catch { /* Optional weather stays quiet while offline. */ }
      finally { window.clearTimeout(timeout) }
    }
    void load()
    const interval = window.setInterval(() => { void load() }, 30 * 60 * 1000)
    return () => { stopped = true; pending?.abort(); window.clearInterval(interval) }
  }, [])
  return weather
}
