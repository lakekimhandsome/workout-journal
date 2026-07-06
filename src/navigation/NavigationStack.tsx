import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
  type TransitionEvent,
} from 'react'
import { Route, Routes, useLocation, useNavigate, type Location } from 'react-router-dom'
import { HomePage } from '../pages/HomePage'
import { SettingsCategoriesPage } from '../pages/settings/SettingsCategoriesPage'
import { SettingsExportPage } from '../pages/settings/SettingsExportPage'
import { SettingsImportPage } from '../pages/settings/SettingsImportPage'
import { SettingsPage } from '../pages/settings/SettingsPage'
import { SettingsResetPage } from '../pages/settings/SettingsResetPage'
import { paths } from '../routes/paths'
import {
  NavigationStackContext,
  type InteractivePopState,
} from './NavigationStackContext'
import { getNavigationDirection, getParentPath, type NavigationDirection } from './routeHierarchy'
import { EDGE_BACK_THRESHOLD, useEdgeSwipeBack } from './useEdgeSwipeBack'

const NAVIGATION_DURATION_MS = 350
const EDGE_BACK_SNAP_MS = 220
const UNDER_PAGE_SHIFT = 0.33
const NAVIGATION_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)'

const appRoutes = (
  <>
    <Route path={paths.home} element={<HomePage />} />
    <Route path={paths.settings.root} element={<SettingsPage />} />
    <Route path={paths.settings.categories} element={<SettingsCategoriesPage />} />
    <Route path={paths.settings.export} element={<SettingsExportPage />} />
    <Route path={paths.settings.import} element={<SettingsImportPage />} />
    <Route path={paths.settings.reset} element={<SettingsResetPage />} />
  </>
)

type NavigationLayers = {
  current: Location
  under: Location | null
  direction: NavigationDirection
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function createParentLocation(pathname: string): Location {
  return {
    pathname,
    search: '',
    hash: '',
    state: null,
    key: `interactive-parent-${pathname}`,
  }
}

function getInteractivePageStyle(
  layer: 'top' | 'under',
  interactivePop: InteractivePopState,
): CSSProperties {
  const viewportWidth = window.innerWidth || 1
  const progress = Math.min(Math.max(interactivePop.offset / viewportWidth, 0), 1)
  const durationMs = progress >= 1 ? NAVIGATION_DURATION_MS : EDGE_BACK_SNAP_MS
  const transition = interactivePop.animate
    ? `transform ${durationMs}ms ${NAVIGATION_EASING}`
    : 'none'

  if (layer === 'top') {
    return {
      transform: `translate3d(${interactivePop.offset}px, 0, 0)`,
      transition,
    }
  }

  const underShiftPercent = -UNDER_PAGE_SHIFT * (1 - progress) * 100

  return {
    transform: `translate3d(${underShiftPercent}%, 0, 0)`,
    transition,
  }
}

function resolveTopLocation(
  isAnimating: boolean,
  direction: NavigationDirection,
  layers: NavigationLayers,
): Location | undefined {
  if (isAnimating && direction === 'pop' && layers.under) {
    return layers.under
  }

  return undefined
}

function resolveUnderLocation(
  isAnimating: boolean,
  direction: NavigationDirection,
  layers: NavigationLayers,
  interactivePop: InteractivePopState | null,
): Location | null {
  if (interactivePop) {
    return interactivePop.parentLocation
  }

  if (!isAnimating) {
    return null
  }

  if (direction === 'pop') {
    return layers.current
  }

  return layers.under
}

type NavigationPageProps = {
  layer: 'top' | 'under'
  location?: Location
  interactivePop: InteractivePopState | null
  onAnimationEnd?: (event: AnimationEvent<HTMLDivElement>) => void
  onTransitionEnd?: (event: TransitionEvent<HTMLDivElement>) => void
}

function NavigationPage({
  layer,
  location,
  interactivePop,
  onAnimationEnd,
  onTransitionEnd,
}: NavigationPageProps) {
  const style: CSSProperties | undefined =
    interactivePop != null ? getInteractivePageStyle(layer, interactivePop) : undefined

  return (
    <div
      className={`navigation-page navigation-page--${layer}`}
      data-navigation-layer={layer}
      aria-hidden={layer === 'under' ? true : undefined}
      style={style}
      onAnimationEnd={layer === 'top' ? onAnimationEnd : undefined}
      onTransitionEnd={layer === 'top' ? onTransitionEnd : undefined}
    >
      <Routes location={location}>{appRoutes}</Routes>
    </div>
  )
}

export function NavigationStack() {
  const location = useLocation()
  const navigate = useNavigate()
  const previousLocationRef = useRef(location)
  const isInitialNavigationRef = useRef(true)
  const skipNextAnimationRef = useRef(false)
  const pendingPopNavigationRef = useRef(false)
  const [layers, setLayers] = useState<NavigationLayers>({
    current: location,
    under: null,
    direction: 'push',
  })
  const [isAnimating, setIsAnimating] = useState(false)
  const [interactivePop, setInteractivePop] = useState<InteractivePopState | null>(null)

  const finishAnimation = () => {
    setIsAnimating(false)
    setInteractivePop(null)
    setLayers((currentLayers) => ({
      ...currentLayers,
      under: null,
    }))
  }

  const goBack = useCallback(() => {
    navigate(-1)
  }, [navigate])

  const goBackWithoutAnimation = useCallback(() => {
    skipNextAnimationRef.current = true
    navigate(-1)
  }, [navigate])

  const startInteractivePop = useCallback((parentPath: string) => {
    setInteractivePop({
      offset: 0,
      parentLocation: createParentLocation(parentPath),
      animate: false,
    })
  }, [])

  const updateInteractivePop = useCallback((offset: number) => {
    const viewportWidth = window.innerWidth || 1

    setInteractivePop((current) =>
      current
        ? {
            ...current,
            offset: Math.min(Math.max(offset, 0), viewportWidth),
            animate: false,
          }
        : current,
    )
  }, [])

  const finishInteractivePop = useCallback(
    (offset: number) => {
      const viewportWidth = window.innerWidth || 1
      const threshold = Math.min(EDGE_BACK_THRESHOLD, viewportWidth * 0.28)
      const shouldComplete = offset >= threshold

      setInteractivePop((current) => {
        if (!current) {
          return current
        }

        if (prefersReducedMotion()) {
          if (shouldComplete) {
            goBackWithoutAnimation()
          }

          return null
        }

        if (shouldComplete) {
          pendingPopNavigationRef.current = true
          return {
            ...current,
            offset: viewportWidth,
            animate: true,
          }
        }

        return {
          ...current,
          offset: 0,
          animate: true,
        }
      })
    },
    [goBackWithoutAnimation],
  )

  const completeInteractivePop = useCallback(() => {
    if (pendingPopNavigationRef.current) {
      pendingPopNavigationRef.current = false
      goBackWithoutAnimation()
      setInteractivePop(null)
      return
    }

    setInteractivePop((current) => {
      if (!current?.animate || current.offset > 0) {
        return current
      }

      return null
    })
  }, [goBackWithoutAnimation])

  useLayoutEffect(() => {
    if (!interactivePop?.animate) {
      return
    }

    const durationMs =
      interactivePop.offset >= (window.innerWidth || 1) - 1
        ? NAVIGATION_DURATION_MS
        : EDGE_BACK_SNAP_MS
    const timeoutId = window.setTimeout(() => {
      completeInteractivePop()
    }, durationMs + 40)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [completeInteractivePop, interactivePop])

  useLayoutEffect(() => {
    if (isInitialNavigationRef.current) {
      isInitialNavigationRef.current = false
      previousLocationRef.current = location
      setLayers({
        current: location,
        under: null,
        direction: 'push',
      })
      return
    }

    if (location.key === previousLocationRef.current.key) {
      return
    }

    const direction = getNavigationDirection(
      previousLocationRef.current.pathname,
      location.pathname,
    )

    if (skipNextAnimationRef.current) {
      skipNextAnimationRef.current = false
      previousLocationRef.current = location
      setInteractivePop(null)
      setIsAnimating(false)
      setLayers({
        current: location,
        under: null,
        direction,
      })
      return
    }

    setInteractivePop(null)
    setLayers({
      current: location,
      under: previousLocationRef.current,
      direction,
    })
    previousLocationRef.current = location

    if (prefersReducedMotion()) {
      setIsAnimating(false)
      setLayers({
        current: location,
        under: null,
        direction,
      })
      return
    }

    setIsAnimating(true)
  }, [location])

  useLayoutEffect(() => {
    if (!isAnimating) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      finishAnimation()
    }, NAVIGATION_DURATION_MS + 80)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [isAnimating, layers.current.key])

  const handleAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return
    }

    if (!event.animationName.startsWith('nav-')) {
      return
    }

    finishAnimation()
  }

  const handleInteractiveTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') {
      return
    }

    if (!interactivePop?.animate) {
      return
    }

    completeInteractivePop()
  }

  const underLocation = resolveUnderLocation(
    isAnimating,
    layers.direction,
    layers,
    interactivePop,
  )
  const topLocation = resolveTopLocation(isAnimating, layers.direction, layers)

  return (
    <NavigationStackContext.Provider
      value={{
        direction: isAnimating ? layers.direction : 'idle',
        isAnimating,
        interactivePop,
        goBack,
        startInteractivePop,
        updateInteractivePop,
        finishInteractivePop,
        getParentPath,
      }}
    >
      <NavigationStackView
        layers={layers}
        isAnimating={isAnimating}
        interactivePop={interactivePop}
        topLocation={topLocation}
        underLocation={underLocation}
        onAnimationEnd={handleAnimationEnd}
        onInteractiveTransitionEnd={handleInteractiveTransitionEnd}
      />
    </NavigationStackContext.Provider>
  )
}

type NavigationStackViewProps = {
  layers: NavigationLayers
  isAnimating: boolean
  interactivePop: InteractivePopState | null
  topLocation: Location | undefined
  underLocation: Location | null
  onAnimationEnd: (event: AnimationEvent<HTMLDivElement>) => void
  onInteractiveTransitionEnd: (event: TransitionEvent<HTMLDivElement>) => void
}

function NavigationStackView({
  layers,
  isAnimating,
  interactivePop,
  topLocation,
  underLocation,
  onAnimationEnd,
  onInteractiveTransitionEnd,
}: NavigationStackViewProps) {
  useEdgeSwipeBack()

  return (
    <div
      className="navigation-stack"
      data-direction={layers.direction}
      data-animating={isAnimating || undefined}
      data-interactive-pop={interactivePop ? true : undefined}
    >
      {underLocation ? (
        <NavigationPage layer="under" location={underLocation} interactivePop={interactivePop} />
      ) : null}
      <NavigationPage
        layer="top"
        location={topLocation}
        interactivePop={interactivePop}
        onAnimationEnd={onAnimationEnd}
        onTransitionEnd={onInteractiveTransitionEnd}
      />
    </div>
  )
}
