import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { GESTURE_LOCK_THRESHOLD } from '../lib/journal'
import { useNavigationStack } from './NavigationStackContext'
import { getParentPath } from './routeHierarchy'

export const EDGE_BACK_ZONE = 24
export const EDGE_BACK_THRESHOLD = 72

export function useEdgeSwipeBack() {
  const location = useLocation()
  const {
    isAnimating,
    interactivePop,
    startInteractivePop,
    updateInteractivePop,
    finishInteractivePop,
  } = useNavigationStack()

  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)
  const axis = useRef<'horizontal' | 'vertical' | null>(null)
  const parentPath = useRef<string | null>(null)
  const isActive = useRef(false)
  const currentOffsetRef = useRef(0)
  const interactivePopRef = useRef(interactivePop)
  interactivePopRef.current = interactivePop

  useEffect(() => {
    if (!getParentPath(location.pathname)) {
      return
    }

    const resetGesture = () => {
      startX.current = null
      startY.current = null
      axis.current = null
      parentPath.current = null
      isActive.current = false
    }

    const onTouchStart = (event: TouchEvent) => {
      if (isAnimating || interactivePopRef.current?.animate) {
        return
      }

      const touch = event.touches[0]
      if (!touch || touch.clientX > EDGE_BACK_ZONE) {
        return
      }

      const nextParent = getParentPath(location.pathname)
      if (!nextParent) {
        return
      }

      parentPath.current = nextParent
      startX.current = touch.clientX
      startY.current = touch.clientY
      axis.current = null
      isActive.current = false
    }

    const onTouchMove = (event: TouchEvent) => {
      if (startX.current === null || startY.current === null || !parentPath.current) {
        return
      }

      const touch = event.touches[0]
      if (!touch) {
        return
      }

      const deltaX = touch.clientX - startX.current
      const deltaY = touch.clientY - startY.current

      if (!axis.current) {
        if (
          Math.abs(deltaX) < GESTURE_LOCK_THRESHOLD &&
          Math.abs(deltaY) < GESTURE_LOCK_THRESHOLD
        ) {
          return
        }

        axis.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical'
      }

      if (axis.current === 'vertical') {
        resetGesture()
        return
      }

      if (deltaX <= 0) {
        return
      }

      event.preventDefault()
      isActive.current = true
      currentOffsetRef.current = deltaX

      if (!interactivePopRef.current) {
        startInteractivePop(parentPath.current)
      }

      updateInteractivePop(deltaX)
    }

    const onTouchEnd = () => {
      if (!isActive.current) {
        resetGesture()
        return
      }

      if (interactivePopRef.current || currentOffsetRef.current > 0) {
        finishInteractivePop(currentOffsetRef.current)
      }

      currentOffsetRef.current = 0
      resetGesture()
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd)
    document.addEventListener('touchcancel', onTouchEnd)

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [
    finishInteractivePop,
    isAnimating,
    location.pathname,
    startInteractivePop,
    updateInteractivePop,
  ])
}
