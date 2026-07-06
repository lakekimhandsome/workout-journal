import { createContext, useContext } from 'react'
import type { Location } from 'react-router-dom'
import type { NavigationDirection } from './routeHierarchy'
import { getParentPath } from './routeHierarchy'

export type InteractivePopState = {
  offset: number
  parentLocation: Location
  animate: boolean
}

export type NavigationStackContextValue = {
  direction: NavigationDirection | 'idle'
  isAnimating: boolean
  interactivePop: InteractivePopState | null
  goBack: () => void
  startInteractivePop: (parentPath: string) => void
  updateInteractivePop: (offset: number) => void
  finishInteractivePop: (offset: number) => void
  getParentPath: (pathname: string) => string | null
}

export const NavigationStackContext = createContext<NavigationStackContextValue | null>(null)

export function useNavigationStack() {
  const context = useContext(NavigationStackContext)

  if (!context) {
    throw new Error('useNavigationStack must be used within NavigationStack')
  }

  return context
}

export function useOptionalNavigationStack() {
  return useContext(NavigationStackContext)
}

export const navigationStackDefaults: NavigationStackContextValue = {
  direction: 'idle',
  isAnimating: false,
  interactivePop: null,
  goBack: () => {},
  startInteractivePop: () => {},
  updateInteractivePop: () => {},
  finishInteractivePop: () => {},
  getParentPath,
}
