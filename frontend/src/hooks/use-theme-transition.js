import { useCallback, useState, useEffect } from "react"

export function useThemeTransition() {
  const [theme, setThemeState] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('light') ? 'light' : 'dark'
    }
    return 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'light') {
      root.classList.add('light')
      root.classList.remove('dark')
    } else {
      root.classList.add('dark')
      root.classList.remove('light')
    }
    root.style.colorScheme = theme
  }, [theme])

  const changeTheme = useCallback((next) => {
    const apply = () => {
      const root = document.documentElement
      root.classList.remove("light", "dark")
      root.classList.add(next)
      root.style.colorScheme = next
      setThemeState(next)
      try {
        localStorage.setItem('aerotrace_theme', next)
      } catch (_) {}
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!document.startViewTransition || reduceMotion) {
      apply()
      return
    }
    document.startViewTransition(apply)
  }, [])

  return { theme, changeTheme }
}
