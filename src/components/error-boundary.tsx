import { Component, type CSSProperties, type ErrorInfo, type ReactNode } from 'react'
import { uiLog } from '../lib/logger'
import { desktop } from '../lib/desktop-bridge'

interface Props {
  children: ReactNode
  onError?: (error: Error) => void
}

export default class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    uiLog.error('react', error.message, { stack: info.componentStack })
    this.props.onError?.(error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <section role="alert" style={{ padding: 20, margin: 16, borderRadius: 12, background: '#17312a', color: '#e9f4ef', WebkitAppRegion: 'no-drag' } as CSSProperties}>
        <h2>小仙暂时遇到问题</h2>
        <p>界面未能显示，你的存档仍然保留。可以重试或返回桌宠。</p>
        <button onClick={() => window.location.reload()}>重试</button>
        <button onClick={() => {
          if (desktop) desktop.petMode()
          else window.location.reload()
        }}>返回桌宠</button>
      </section>
    )
  }
}
