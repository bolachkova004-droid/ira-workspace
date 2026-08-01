export type TelegramUser = {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

type TelegramBackButton = {
  isVisible?: boolean
  show: () => void
  hide: () => void
  onClick: (callback: () => void) => void
  offClick: (callback: () => void) => void
}

type TelegramHapticFeedback = {
  impactOccurred?: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
  notificationOccurred?: (type: 'error' | 'success' | 'warning') => void
  selectionChanged?: () => void
}

export type TelegramWebApp = {
  ready: () => void
  expand: () => void
  close?: () => void
  colorScheme?: 'light' | 'dark'
  platform?: string
  version?: string
  initData?: string
  initDataUnsafe?: { user?: TelegramUser; start_param?: string }
  themeParams?: Record<string, string>
  BackButton?: TelegramBackButton
  HapticFeedback?: TelegramHapticFeedback
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  setBottomBarColor?: (color: string) => void
  onEvent?: (event: string, callback: () => void) => void
  offEvent?: (event: string, callback: () => void) => void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

export const getTelegramApp = () => window.Telegram?.WebApp
export const getTelegramUser = () => getTelegramApp()?.initDataUnsafe?.user

/** Telegram clients differ by version. One unsupported SDK method must never
 * prevent the React application from mounting. */
export function safeTelegramCall(action: () => void) {
  try {
    action()
  } catch (error) {
    console.warn('[Ira Workspace] Telegram SDK call was skipped:', error)
  }
}

export function applyTelegramChrome(dark: boolean) {
  const app = getTelegramApp()
  if (!app) return
  const background = dark ? '#171318' : '#fff8fb'
  const bottom = dark ? '#211b22' : '#ffffff'

  safeTelegramCall(() => app.setHeaderColor?.(background))
  safeTelegramCall(() => app.setBackgroundColor?.(background))
  safeTelegramCall(() => app.setBottomBarColor?.(bottom))
}

export function haptic(type: 'tap' | 'success' | 'warning' = 'tap') {
  const feedback = getTelegramApp()?.HapticFeedback
  if (!feedback) return
  safeTelegramCall(() => {
    if (type === 'success') feedback.notificationOccurred?.('success')
    else if (type === 'warning') feedback.notificationOccurred?.('warning')
    else feedback.impactOccurred?.('light')
  })
}

export function initTelegram() {
  const app = getTelegramApp()
  if (!app) return

  document.documentElement.classList.add('is-telegram')
  safeTelegramCall(() => app.ready())
  safeTelegramCall(() => app.expand())

  const syncTheme = () => {
    let dark = app.colorScheme === 'dark'
    try {
      const saved = localStorage.getItem('ira.v4.dark')
      if (saved !== null) dark = JSON.parse(saved) as boolean
    } catch {
      // Telegram theme remains the fallback.
    }
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    applyTelegramChrome(dark)
  }

  syncTheme()
  safeTelegramCall(() => app.onEvent?.('themeChanged', syncTheme))
}
