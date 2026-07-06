import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  type TouchEvent,
} from 'react'
import { flushSync } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { paths } from '../routes/paths'
import {
  applyThresholdHaptics,
  buildImportData,
  createDefaultJournal,
  dampedGestureDistance,
  dampedSwipeOffset,
  DEFAULT_TIMER_SECONDS,
  formatExportRangeDate,
  formatSessionDate,
  formatSessionListDate,
  getInitialTimerRuntime,
  getRemainingSecondsFromEndAt,
  GESTURE_LOCK_THRESHOLD,
  id,
  loadJournal,
  loadTimerSeconds,
  nowIso,
  PALETTE,
  PULL_MAX,
  PULL_THRESHOLD,
  saveTimerState,
  STORAGE_KEY,
  swipeKey,
  SWIPE_DELETE_THRESHOLD,
  SWIPE_RESET_TRANSITION_MS,
  TIMER_KEY,
  today,
  type Category,
  type Exercise,
  type Session,
  type SwipeDrag,
} from '../lib/journal'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JournalContextValue = Record<string, any>

const JournalContext = createContext<JournalContextValue | null>(null)

export function useJournal() {
  const context = useContext(JournalContext)

  if (!context) {
    throw new Error('useJournal must be used within JournalProvider')
  }

  return context
}

export function JournalProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const isHome = location.pathname === paths.home

  const initialData = useMemo(() => loadJournal(), [])
  const [categories, setCategories] = useState<Category[]>(initialData.categories)
  const [sessions, setSessions] = useState<Session[]>(initialData.sessions)
  const [exercises, setExercises] = useState<Exercise[]>(initialData.exercises)
  const [expandedSessionIds, setExpandedSessionIds] = useState<string[]>([])
  const [expandedPreviousSessionIds, setExpandedPreviousSessionIds] = useState<string[]>([])
  const [pullDistance, setPullDistance] = useState(0)
  const [pullFingerDistance, setPullFingerDistance] = useState(0)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState(PALETTE[0])
  const [draftExerciseNames, setDraftExerciseNames] = useState<Record<string, string>>({})
  const [restSeconds, setRestSeconds] = useState(loadTimerSeconds)
  const initialTimerRuntime = useRef(getInitialTimerRuntime())
  const [remainingSeconds, setRemainingSeconds] = useState(initialTimerRuntime.current.remainingSeconds)
  const [timerRunning, setTimerRunning] = useState(initialTimerRuntime.current.running)
  const [timerOpen, setTimerOpen] = useState(false)
  const timerTotalSeconds = useRef(initialTimerRuntime.current.totalSeconds)
  const timerEndAt = useRef<number | null>(initialTimerRuntime.current.endAt)
  const timerButtonRef = useRef<HTMLButtonElement | null>(null)
  const [timerRingSize, setTimerRingSize] = useState({ width: 0, height: 0 })
  const [homeSurfaceVersion, setHomeSurfaceVersion] = useState(0)
  const [referenceOffsets, setReferenceOffsets] = useState<Record<string, number>>({})
  const [exportStartDate, setExportStartDate] = useState('')
  const [exportEndDate, setExportEndDate] = useState(today())
  const [importText, setImportText] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const [swipeOffsets, setSwipeOffsets] = useState<Record<string, number>>({})
  const [activeSwipeKey, setActiveSwipeKey] = useState<string | null>(null)
  const swipeDrag = useRef<SwipeDrag | null>(null)
  const swipeWasPastThreshold = useRef(false)
  const swipeAxisLocked = useRef(false)
  const swipeOffsetsRef = useRef<Record<string, number>>({})
  const importFileInput = useRef<HTMLInputElement>(null)
  const sessionListRef = useRef<HTMLElement | null>(null)
  const pullStartY = useRef<number | null>(null)
  const pullStartX = useRef<number | null>(null)
  const pullWasPastThreshold = useRef(false)
  const pullFingerDistanceRef = useRef(0)
  const gestureAxis = useRef<'horizontal' | 'vertical' | null>(null)

  const notifyHomeSurfaceMounted = useCallback(() => {
    setHomeSurfaceVersion((version) => version + 1)
  }, [])

  const setSessionListNode = useCallback(
    (node: HTMLElement | null) => {
      sessionListRef.current = node

      if (node) {
        notifyHomeSurfaceMounted()
      }
    },
    [notifyHomeSurfaceMounted],
  )

  const setTimerButtonNode = useCallback(
    (node: HTMLButtonElement | null) => {
      timerButtonRef.current = node

      if (node) {
        notifyHomeSurfaceMounted()
      }
    },
    [notifyHomeSurfaceMounted],
  )

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort((a, b) => {
        if (a.date !== b.date) {
          return b.date.localeCompare(a.date)
        }

        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }),
    [sessions],
  )

  const duplicateIndexBySession = useMemo(() => {
    const map = new Map<string, number>()
    const sessionsByDate = new Map<string, Session[]>()

    for (const session of sessions) {
      sessionsByDate.set(session.date, [...(sessionsByDate.get(session.date) ?? []), session])
    }

    for (const sameDateSessions of sessionsByDate.values()) {
      sameDateSessions
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .forEach((session, index) => map.set(session.id, index))
    }

    return map
  }, [sessions])

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        categories,
        sessions,
        exercises,
      }),
    )
  }, [categories, sessions, exercises])

  useEffect(() => {
    window.localStorage.setItem(TIMER_KEY, String(restSeconds))
  }, [restSeconds])

  const syncTimerFromEndAt = useCallback(() => {
    if (timerEndAt.current === null) {
      setRemainingSeconds(0)
      setTimerRunning(false)
      return
    }

    const remaining = getRemainingSecondsFromEndAt(timerEndAt.current)
    setRemainingSeconds(remaining)

    if (remaining <= 0) {
      timerEndAt.current = null
      saveTimerState(null)
      setTimerRunning(false)
    }
  }, [])

  useEffect(() => {
    if (!timerRunning) {
      return
    }

    syncTimerFromEndAt()

    const timerId = window.setInterval(syncTimerFromEndAt, 250)

    return () => window.clearInterval(timerId)
  }, [timerRunning, syncTimerFromEndAt])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && timerEndAt.current !== null) {
        syncTimerFromEndAt()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [syncTimerFromEndAt])

  const startRestTimer = () => {
    if (restSeconds <= 0) {
      return
    }

    const endAt = Date.now() + restSeconds * 1000

    timerTotalSeconds.current = restSeconds
    timerEndAt.current = endAt
    saveTimerState({ endAt, totalSeconds: restSeconds })
    setRemainingSeconds(restSeconds)
    setTimerRunning(true)
  }

  const stopRestTimer = () => {
    timerEndAt.current = null
    saveTimerState(null)
    setTimerRunning(false)
    setRemainingSeconds(0)
  }

  const createSession = useCallback(() => {
    const categoryId = categories[0]?.id

    if (!categoryId) {
      return
    }

    const sessionId = id()

    setSessions((current) => [
      {
        id: sessionId,
        date: today(),
        categoryId,
        createdAt: nowIso(),
      },
      ...current,
    ])
    setExpandedSessionIds((current) => [...current, sessionId])
  }, [categories])

  const resolveGestureAxis = useCallback(
    (startX: number, startY: number, currentX: number, currentY: number) => {
      if (gestureAxis.current) {
        return gestureAxis.current
      }

      const deltaX = Math.abs(currentX - startX)
      const deltaY = Math.abs(currentY - startY)

      if (deltaX < GESTURE_LOCK_THRESHOLD && deltaY < GESTURE_LOCK_THRESHOLD) {
        return null
      }

      gestureAxis.current = deltaX > deltaY ? 'horizontal' : 'vertical'
      return gestureAxis.current
    },
    [],
  )

  const setSwipeOffset = useCallback((key: string, offset: number) => {
    swipeOffsetsRef.current = { ...swipeOffsetsRef.current, [key]: offset }
    setSwipeOffsets((current) => ({ ...current, [key]: offset }))
  }, [])

  useEffect(() => {
    if (!isHome) {
      setPullDistance(0)
      pullStartY.current = null
      pullStartX.current = null
      pullWasPastThreshold.current = false
      pullFingerDistanceRef.current = 0
      setPullFingerDistance(0)
      gestureAxis.current = null
      return
    }

    const node = sessionListRef.current

    if (!node) {
      return
    }

    const onTouchStart = (event: globalThis.TouchEvent) => {
      gestureAxis.current = null
      pullStartX.current = event.touches[0].clientX
      pullStartY.current = event.touches[0].clientY
      pullWasPastThreshold.current = false
      pullFingerDistanceRef.current = 0
      setPullFingerDistance(0)
      setPullDistance(0)
    }

    const onTouchMove = (event: globalThis.TouchEvent) => {
      if (pullStartY.current === null || pullStartX.current === null || window.scrollY > 2) {
        return
      }

      const touch = event.touches[0]
      if (!touch) {
        return
      }

      const deltaY = touch.clientY - pullStartY.current
      const axis = resolveGestureAxis(
        pullStartX.current,
        pullStartY.current,
        touch.clientX,
        touch.clientY,
      )

      if (axis === 'horizontal') {
        return
      }

      if (axis === 'vertical' && deltaY > 0) {
        event.preventDefault()
        const fingerDistance = Math.min(deltaY, PULL_MAX)
        pullFingerDistanceRef.current = fingerDistance
        setPullFingerDistance(fingerDistance)
        setPullDistance(dampedGestureDistance(fingerDistance))
        applyThresholdHaptics(fingerDistance, PULL_THRESHOLD, pullWasPastThreshold)
      }
    }

    const finishPull = () => {
      const releaseDistance = pullFingerDistanceRef.current

      setPullDistance(0)
      pullFingerDistanceRef.current = 0
      setPullFingerDistance(0)

      if (releaseDistance >= PULL_THRESHOLD) {
        createSession()
      }

      pullStartY.current = null
      pullStartX.current = null
      pullWasPastThreshold.current = false
      gestureAxis.current = null
    }

    node.addEventListener('touchstart', onTouchStart, { passive: true })
    node.addEventListener('touchmove', onTouchMove, { passive: false })
    node.addEventListener('touchend', finishPull)
    node.addEventListener('touchcancel', finishPull)

    return () => {
      node.removeEventListener('touchstart', onTouchStart)
      node.removeEventListener('touchmove', onTouchMove)
      node.removeEventListener('touchend', finishPull)
      node.removeEventListener('touchcancel', finishPull)
    }
  }, [createSession, resolveGestureAxis, isHome, homeSurfaceVersion])

  useLayoutEffect(() => {
    if (!isHome) {
      return
    }

    const node = timerButtonRef.current

    if (!node) {
      return
    }

    const updateSize = () => {
      setTimerRingSize({
        width: node.clientWidth,
        height: node.clientHeight,
      })
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(node)

    return () => observer.disconnect()
  }, [isHome, homeSurfaceVersion])

  const clearSwipeOffset = useCallback(
    (type: SwipeDrag['type'], id: string) => {
      const key = swipeKey(type, id)
      const next = { ...swipeOffsetsRef.current }
      delete next[key]
      swipeOffsetsRef.current = next
      setSwipeOffsets(next)
      setActiveSwipeKey((current) => (current === key ? null : current))
    },
    [],
  )

  const animateSwipeReset = useCallback(
    (
      type: SwipeDrag['type'],
      id: string,
      options?: {
        fallbackOffset?: number
        onResetPainted?: () => void
      },
    ) => {
      const key = swipeKey(type, id)
      const storedOffset = swipeOffsetsRef.current[key]
      const startOffset =
        storedOffset !== undefined
          ? storedOffset
          : options?.fallbackOffset && options.fallbackOffset !== 0
            ? options.fallbackOffset
            : undefined

      const cleanupKey = () => {
        window.setTimeout(() => {
          setSwipeOffsets((current) => {
            if (current[key] !== 0) {
              return current
            }

            const next = { ...current }
            delete next[key]
            swipeOffsetsRef.current = next
            return next
          })
        }, SWIPE_RESET_TRANSITION_MS)
      }

      if (startOffset === undefined || startOffset === 0) {
        setActiveSwipeKey(null)
        options?.onResetPainted?.()
        cleanupKey()
        return
      }

      flushSync(() => {
        setActiveSwipeKey(null)
        setSwipeOffset(key, startOffset)
      })

      requestAnimationFrame(() => {
        flushSync(() => {
          setSwipeOffset(key, 0)
        })

        requestAnimationFrame(() => {
          window.setTimeout(() => {
            options?.onResetPainted?.()
          }, 32)
        })

        cleanupKey()
      })
    },
    [setSwipeOffset],
  )

  const removeSession = (sessionId: string) => {
    const session = sessions.find((item) => item.id === sessionId)

    if (!session) {
      return
    }

    const category = categoryById.get(session.categoryId)
    const sessionLabel = [
      formatSessionListDate(session.date, duplicateIndexBySession.get(session.id) ?? 0),
      category?.name,
    ]
      .filter(Boolean)
      .join(' ')

    if (
      !window.confirm(
        `'${sessionLabel}' 세션을 삭제할까요? 세션 안의 운동들도 함께 삭제됩니다.`,
      )
    ) {
      return
    }

    setSessions((current) => current.filter((session) => session.id !== sessionId))
    setExercises((current) => current.filter((exercise) => exercise.sessionId !== sessionId))
    setExpandedSessionIds((current) => current.filter((id) => id !== sessionId))
    clearSwipeOffset('session', sessionId)
    setReferenceOffsets((current) => {
      const next = { ...current }
      delete next[sessionId]
      return next
    })
  }

  const createCategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const name = newCategoryName.trim()

    if (!name) {
      return
    }

    const category: Category = {
      id: id(),
      name,
      color: newCategoryColor,
      createdAt: nowIso(),
    }

    setCategories((current) => [...current, category])
    setNewCategoryName('')
  }

  const updateCategory = (categoryId: string, patch: Partial<Category>) => {
    setCategories((current) =>
      current.map((category) =>
        category.id === categoryId ? { ...category, ...patch } : category,
      ),
    )
  }

  const removeCategory = (categoryId: string) => {
    const isUsed = sessions.some((session) => session.categoryId === categoryId)

    if (isUsed || categories.length <= 1) {
      return
    }

    setCategories((current) => current.filter((category) => category.id !== categoryId))
  }

  const toggleSession = (sessionId: string) => {
    setExpandedSessionIds((current) =>
      current.includes(sessionId)
        ? current.filter((id) => id !== sessionId)
        : [...current, sessionId],
    )
    clearSwipeOffset('session', sessionId)
  }

  const togglePreviousSession = (sessionId: string) => {
    setExpandedPreviousSessionIds((current) =>
      current.includes(sessionId)
        ? current.filter((id) => id !== sessionId)
        : [...current, sessionId],
    )
  }

  const updateSessionCategory = (sessionId: string, categoryId: string) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId ? { ...session, categoryId } : session,
      ),
    )
  }

  function getSessionExercises(sessionId: string) {
    return exercises
      .filter((exercise) => exercise.sessionId === sessionId)
      .sort((a, b) => a.order - b.order)
  }

  const filteredExportSessions = [...sortedSessions]
    .filter((session) => {
      const afterStart = exportStartDate ? session.date >= exportStartDate : true
      const beforeEnd = exportEndDate ? session.date <= exportEndDate : true

      return afterStart && beforeEnd
    })
    .sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date)
      }

      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })

  const exportRangeStart = exportStartDate
    ? formatExportRangeDate(exportStartDate)
    : filteredExportSessions[0]?.date
      ? formatExportRangeDate(filteredExportSessions[0].date)
      : '처음'
  const exportRangeEnd = exportEndDate ? formatExportRangeDate(exportEndDate) : formatExportRangeDate(today())
  const exportRangeText = `${exportRangeStart} ~ ${exportRangeEnd}`
  const exportBlocks = filteredExportSessions.map((session) => {
    const category = categoryById.get(session.categoryId)
    const sessionTitle = `${formatSessionDate(
      session.date,
      duplicateIndexBySession.get(session.id) ?? 0,
    )} [${category?.name ?? '카테고리 없음'}]`
    const lines = getSessionExercises(session.id).map((exercise) => {
      const comment = exercise.comment.trim()
      const base = `- ${exercise.name} x${exercise.sets}`

      return comment ? `${base}\n${comment}` : base
    })

    return [sessionTitle, ...lines].join('\n')
  })
  const exportText = [`운동일지 by lakekim`, `기간: ${exportRangeText}`, '', ...exportBlocks]
    .join('\n\n')
    .trim()

  const addExercise = (sessionId: string, name: string) => {
    const trimmedName = name.trim()

    if (!trimmedName) {
      return
    }

    const sessionExercises = getSessionExercises(sessionId)

    setExercises((current) => [
      ...current,
      {
        id: id(),
        sessionId,
        name: trimmedName,
        sets: 0,
        comment: '',
        order: sessionExercises.length,
      },
    ])
    setDraftExerciseNames((current) => ({ ...current, [sessionId]: '' }))
  }

  const updateExercise = (exerciseId: string, patch: Partial<Exercise>) => {
    setExercises((current) =>
      current.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, ...patch } : exercise,
      ),
    )
  }

  const removeExercise = (exerciseId: string) => {
    const exercise = exercises.find((item) => item.id === exerciseId)

    if (!exercise) {
      return
    }

    const exerciseLabel = exercise.name.trim()
    const exerciseConfirmMessage = exerciseLabel
      ? `'${exerciseLabel}' 운동을 삭제할까요?`
      : '이름 없는 운동을 삭제할까요?'

    if (!window.confirm(exerciseConfirmMessage)) {
      return
    }

    setExercises((current) => current.filter((exercise) => exercise.id !== exerciseId))
    clearSwipeOffset('exercise', exerciseId)
  }

  const changeSets = (exercise: Exercise, direction: 1 | -1) => {
    const nextSets = Math.max(0, exercise.sets + direction)

    updateExercise(exercise.id, { sets: nextSets })

    if (direction === 1) {
      startRestTimer()
    }
  }

  const getPreviousSameCategorySessions = (session: Session) => {
    const isEarlierSession = (candidate: Session) => {
      if (candidate.date !== session.date) {
        return candidate.date < session.date
      }

      return new Date(candidate.createdAt).getTime() < new Date(session.createdAt).getTime()
    }

    return sessions
      .filter(
        (candidate) =>
          candidate.id !== session.id &&
          candidate.categoryId === session.categoryId &&
          isEarlierSession(candidate),
      )
      .sort((a, b) => {
        if (a.date !== b.date) {
          return b.date.localeCompare(a.date)
        }

        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
  }

  const moveReference = (sessionId: string, direction: 1 | -1, maxOffset: number) => {
    setReferenceOffsets((current) => {
      const currentOffset = current[sessionId] ?? 0
      const nextOffset = Math.min(Math.max(currentOffset + direction, 0), maxOffset)

      return { ...current, [sessionId]: nextOffset }
    })
  }

  const copyExportText = async () => {
    await window.navigator.clipboard.writeText(exportText)
  }

  const downloadExportText = () => {
    const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `workout-journal-${exportStartDate || 'start'}-${exportEndDate || 'end'}.txt`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const importFromText = () => {
    const result = buildImportData(importText, categories)

    if (!result.ok) {
      setImportMessage(result.message)
      return
    }

    setCategories(result.categories)
    setSessions((current) => [...result.sessions, ...current])
    setExercises((current) => [...result.exercises, ...current])
    window.alert(`세션 ${result.sessionCount}개, 운동 ${result.exerciseCount}개를 가져왔습니다.`)
    setImportText('')
    setImportMessage('')
    navigate(paths.home)
  }

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      const text = await file.text()
      setImportText(text)
      setImportMessage('')
    } catch {
      setImportMessage('파일을 읽지 못했습니다.')
    }

    event.target.value = ''
  }

  const resetAllData = () => {
    if (
      !window.confirm(
        '모든 운동 기록과 카테고리를 삭제하며, 이 작업은 되돌릴 수 없습니다.\n초기화 할까요?',
      )
    ) {
      return
    }

    const defaults = createDefaultJournal()

    setCategories(defaults.categories)
    setSessions(defaults.sessions)
    setExercises(defaults.exercises)
    setExpandedSessionIds([])
    setReferenceOffsets({})
    setDraftExerciseNames({})
    setRestSeconds(DEFAULT_TIMER_SECONDS)
    timerEndAt.current = null
    saveTimerState(null)
    setRemainingSeconds(0)
    timerTotalSeconds.current = 0
    setTimerRunning(false)
    setTimerOpen(false)
    setImportText('')
    setImportMessage('')
    setExportStartDate('')
    setExportEndDate(today())
    setSwipeOffsets({})
    swipeOffsetsRef.current = {}
    setActiveSwipeKey(null)
    setNewCategoryName('')
    setNewCategoryColor(PALETTE[0])
    navigate(paths.home)
  }

  const handleSwipeStart = (
    type: SwipeDrag['type'],
    targetId: string,
    event: TouchEvent<HTMLElement>,
  ) => {
    swipeDrag.current = {
      type,
      id: targetId,
      startX: event.touches[0].clientX,
      startY: event.touches[0].clientY,
    }
    swipeWasPastThreshold.current = false
    swipeAxisLocked.current = false
  }

  const handleSwipeMove = (
    type: SwipeDrag['type'],
    targetId: string,
    event: TouchEvent<HTMLElement>,
  ) => {
    const drag = swipeDrag.current

    if (!drag || drag.type !== type || drag.id !== targetId) {
      return
    }

    const touch = event.touches[0]
    if (!touch) {
      return
    }

    const deltaX = touch.clientX - drag.startX
    const axis = resolveGestureAxis(drag.startX, drag.startY, touch.clientX, touch.clientY)

    if (axis === 'vertical') {
      return
    }

    if (axis !== 'horizontal') {
      return
    }

    swipeAxisLocked.current = true

    event.preventDefault()
    event.stopPropagation()

    const key = swipeKey(type, targetId)
    setActiveSwipeKey(key)

    const offset = dampedSwipeOffset(deltaX)

    setSwipeOffset(key, offset)
    applyThresholdHaptics(Math.abs(deltaX), SWIPE_DELETE_THRESHOLD, swipeWasPastThreshold)
  }

  const handleSwipeEnd = (
    type: SwipeDrag['type'],
    targetId: string,
    event: TouchEvent<HTMLElement>,
  ) => {
    const drag = swipeDrag.current
    const key = swipeKey(type, targetId)

    if (!drag || drag.type !== type || drag.id !== targetId) {
      return
    }

    const deltaX = event.changedTouches[0].clientX - drag.startX
    const fallbackOffset = dampedSwipeOffset(deltaX)
    const wasHorizontal = swipeAxisLocked.current
    const releasePastThreshold =
      Math.abs(deltaX) >= SWIPE_DELETE_THRESHOLD || swipeWasPastThreshold.current
    const shouldDelete = wasHorizontal && releasePastThreshold

    swipeDrag.current = null
    swipeWasPastThreshold.current = false
    swipeAxisLocked.current = false
    gestureAxis.current = null

    if (wasHorizontal) {
      animateSwipeReset(type, targetId, {
        fallbackOffset,
        onResetPainted: shouldDelete
          ? () => {
              if (type === 'session') {
                removeSession(targetId)
              } else {
                removeExercise(targetId)
              }
            }
          : undefined,
      })
    } else {
      setActiveSwipeKey((current) => (current === key ? null : current))

      if (shouldDelete) {
        if (type === 'session') {
          removeSession(targetId)
        } else {
          removeExercise(targetId)
        }
      }
    }
  }

  const value: JournalContextValue = {
    categories,
    sessions,
    exercises,
    expandedSessionIds,
    expandedPreviousSessionIds,
    pullDistance,
    pullFingerDistance,
    newCategoryName,
    setNewCategoryName,
    newCategoryColor,
    setNewCategoryColor,
    draftExerciseNames,
    setDraftExerciseNames,
    restSeconds,
    setRestSeconds,
    remainingSeconds,
    timerRunning,
    timerOpen,
    setTimerOpen,
    timerTotalSeconds,
    timerButtonRef: setTimerButtonNode,
    timerRingSize,
    referenceOffsets,
    exportStartDate,
    setExportStartDate,
    exportEndDate,
    setExportEndDate,
    importText,
    setImportText,
    importMessage,
    setImportMessage,
    swipeOffsets,
    activeSwipeKey,
    importFileInput,
    sessionListRef: setSessionListNode,
    categoryById,
    sortedSessions,
    duplicateIndexBySession,
    startRestTimer,
    stopRestTimer,
    createSession,
    removeSession,
    createCategory,
    updateCategory,
    removeCategory,
    toggleSession,
    togglePreviousSession,
    updateSessionCategory,
    getSessionExercises,
    exportText,
    addExercise,
    updateExercise,
    removeExercise,
    changeSets,
    getPreviousSameCategorySessions,
    moveReference,
    copyExportText,
    downloadExportText,
    importFromText,
    handleImportFile,
    resetAllData,
    handleSwipeStart,
    handleSwipeMove,
    handleSwipeEnd,
    PALETTE,
  }

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>
}
