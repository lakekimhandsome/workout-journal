import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

export type Category = {
  id: string
  name: string
  color: string
  createdAt: string
}

export type Session = {
  id: string
  date: string
  categoryId: string
  createdAt: string
}

export type Exercise = {
  id: string
  sessionId: string
  name: string
  sets: number
  comment: string
  order: number
}

export type JournalData = {
  categories: Category[]
  sessions: Session[]
  exercises: Exercise[]
}

export type SwipeDrag = {
  type: 'session' | 'exercise'
  id: string
  startX: number
  startY: number
}

export const swipeKey = (type: SwipeDrag['type'], id: string) => `${type}:${id}`

export const triggerImpactHaptic = () => {
  if (Capacitor.isNativePlatform()) {
    void Haptics.impact({ style: ImpactStyle.Medium })
    return
  }

  navigator.vibrate?.(12)
}

export const THRESHOLD_HYSTERESIS = 10

export const applyThresholdHaptics = (
  amount: number,
  threshold: number,
  wasPastThreshold: { current: boolean },
) => {
  const isPastThreshold = amount >= threshold
  const isInsideThreshold = amount < threshold - THRESHOLD_HYSTERESIS

  if (isPastThreshold) {
    if (!wasPastThreshold.current) {
      triggerImpactHaptic()
    }
    wasPastThreshold.current = true
    return
  }

  if (wasPastThreshold.current && isInsideThreshold) {
    triggerImpactHaptic()
    wasPastThreshold.current = false
  }
}

export const GESTURE_LOCK_THRESHOLD = 10

export const STORAGE_KEY = 'workout-journal:v1'
export const TIMER_KEY = 'workout-journal:timer-seconds'
export const TIMER_STATE_KEY = 'workout-journal:timer-state'
export const DEFAULT_TIMER_SECONDS = 90

export type PersistedTimerState = {
  endAt: number
  totalSeconds: number
}

export const PALETTE = [
  '#111827',
  '#ef4444',
  '#f97316',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
]

export const nowIso = () => new Date().toISOString()

export const id = () => {
  if ('crypto' in window && 'randomUUID' in window.crypto) {
    return window.crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const defaultCategories = (): Category[] => [
  { id: 'cat-push', name: 'PUSH', color: PALETTE[5], createdAt: nowIso() },
  { id: 'cat-pull', name: 'PULL', color: PALETTE[6], createdAt: nowIso() },
  { id: 'cat-legs', name: 'LEGS', color: PALETTE[2], createdAt: nowIso() },
]

export const loadJournal = (): JournalData => {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)

    if (!saved) {
      return {
        categories: defaultCategories(),
        sessions: [],
        exercises: [],
      }
    }

    const parsed = JSON.parse(saved) as Partial<JournalData>

    return {
      categories: parsed.categories?.length ? parsed.categories : defaultCategories(),
      sessions: parsed.sessions ?? [],
      exercises: parsed.exercises ?? [],
    }
  } catch {
    return {
      categories: defaultCategories(),
      sessions: [],
      exercises: [],
    }
  }
}

export const loadTimerSeconds = () => {
  const saved = Number(window.localStorage.getItem(TIMER_KEY))

  return Number.isFinite(saved) && saved >= 0 ? saved : DEFAULT_TIMER_SECONDS
}

export const saveTimerState = (state: PersistedTimerState | null) => {
  if (!state) {
    window.localStorage.removeItem(TIMER_STATE_KEY)
    return
  }

  window.localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(state))
}

export const loadTimerState = (): PersistedTimerState | null => {
  try {
    const saved = window.localStorage.getItem(TIMER_STATE_KEY)

    if (!saved) {
      return null
    }

    const parsed = JSON.parse(saved) as Partial<PersistedTimerState>

    if (
      !Number.isFinite(parsed.endAt) ||
      !Number.isFinite(parsed.totalSeconds) ||
      parsed.endAt! <= Date.now()
    ) {
      saveTimerState(null)
      return null
    }

    return {
      endAt: parsed.endAt!,
      totalSeconds: parsed.totalSeconds!,
    }
  } catch {
    saveTimerState(null)
    return null
  }
}

export const getRemainingSecondsFromEndAt = (endAt: number) =>
  Math.max(0, Math.ceil((endAt - Date.now()) / 1000))

export const getInitialTimerRuntime = () => {
  const persisted = loadTimerState()

  if (!persisted) {
    return {
      endAt: null as number | null,
      totalSeconds: 0,
      remainingSeconds: 0,
      running: false,
    }
  }

  const remainingSeconds = getRemainingSecondsFromEndAt(persisted.endAt)

  if (remainingSeconds <= 0) {
    saveTimerState(null)

    return {
      endAt: null as number | null,
      totalSeconds: 0,
      remainingSeconds: 0,
      running: false,
    }
  }

  return {
    endAt: persisted.endAt,
    totalSeconds: persisted.totalSeconds,
    remainingSeconds,
    running: true,
  }
}

export const createDefaultJournal = (): JournalData => ({
  categories: defaultCategories(),
  sessions: [],
  exercises: [],
})

export const today = () => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export const formatSessionDate = (date: string, index: number) => {
  const [year, month, day] = date.split('-')
  const suffix = index > 0 ? ` (${index})` : ''

  return `${year}.${month}.${day}${suffix}`
}

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const

export const formatSessionListDate = (date: string, index: number) => {
  const [year, month, day] = date.split('-')
  const weekday = WEEKDAY_LABELS[new Date(`${date}T12:00:00`).getDay()]
  const suffix = index > 0 ? ` (${index})` : ''

  return `${year}.${month}.${day} (${weekday})${suffix}`
}

export const formatExportRangeDate = (date: string) => {
  const [year, month, day] = date.split('-')

  return `${year}.${month}.${day}`
}

export const formatTimer = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const restSeconds = seconds % 60

  return `${minutes}:${String(restSeconds).padStart(2, '0')}`
}

export const formatTimerPreset = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const restSeconds = seconds % 60

  return `${minutes}:${String(restSeconds).padStart(2, '0')}`
}

export type ParsedImportExercise = {
  name: string
  sets: number
  comment: string
}

export type ParsedImportSession = {
  date: string
  categoryName: string
  exercises: ParsedImportExercise[]
}

export const SESSION_TITLE_RE = /^(\d{2,4})\.(\d{2})\.(\d{2})(?: \((\d+)\))? \[([^\]]+)\]$/
export const EXERCISE_LINE_RE = /^- (.+) x(\d+)$/

export const parseExportText = (text: string): ParsedImportSession[] => {
  const parsedSessions: ParsedImportSession[] = []
  let currentSession: ParsedImportSession | null = null
  let currentExercise: ParsedImportExercise | null = null

  for (const rawLine of text.replace(/\r\n/g, '\n').split('\n')) {
    const trimmed = rawLine.trim()

    if (!trimmed || /^운동일지/.test(trimmed) || /^기간:/.test(trimmed)) {
      continue
    }

    const sessionMatch = trimmed.match(SESSION_TITLE_RE)

    if (sessionMatch) {
      const [, year, month, day, , categoryName] = sessionMatch
      const fullYear = year.length === 2 ? `20${year}` : year
      currentSession = {
        date: `${fullYear}-${month}-${day}`,
        categoryName,
        exercises: [],
      }
      currentExercise = null
      parsedSessions.push(currentSession)
      continue
    }

    const exerciseMatch = trimmed.match(EXERCISE_LINE_RE)

    if (exerciseMatch && currentSession) {
      currentExercise = {
        name: exerciseMatch[1].trim(),
        sets: Number(exerciseMatch[2]),
        comment: '',
      }
      currentSession.exercises.push(currentExercise)
      continue
    }

    if (currentExercise) {
      currentExercise.comment = currentExercise.comment
        ? `${currentExercise.comment}\n${trimmed}`
        : trimmed
    }
  }

  return parsedSessions
}

export const buildImportData = (
  text: string,
  categories: Category[],
): {
  ok: true
  categories: Category[]
  sessions: Session[]
  exercises: Exercise[]
  sessionCount: number
  exerciseCount: number
} | {
  ok: false
  message: string
} => {
  const parsedSessions = parseExportText(text)

  if (parsedSessions.length === 0) {
    return { ok: false, message: '가져올 세션을 찾지 못했습니다. 내보내기 형식인지 확인해 주세요.' }
  }

  const nextCategories = [...categories]
  const categoryIdByName = new Map(
    nextCategories.map((category) => [category.name.toLowerCase(), category.id]),
  )
  const newSessions: Session[] = []
  const newExercises: Exercise[] = []
  const baseTime = Date.now()

  parsedSessions.forEach((parsedSession, index) => {
    let categoryId = categoryIdByName.get(parsedSession.categoryName.toLowerCase())

    if (!categoryId) {
      const category: Category = {
        id: id(),
        name: parsedSession.categoryName,
        color: PALETTE[nextCategories.length % PALETTE.length],
        createdAt: nowIso(),
      }

      nextCategories.push(category)
      categoryId = category.id
      categoryIdByName.set(parsedSession.categoryName.toLowerCase(), categoryId)
    }

    const sessionId = id()

    newSessions.push({
      id: sessionId,
      date: parsedSession.date,
      categoryId,
      createdAt: new Date(baseTime + index * 1000).toISOString(),
    })

    parsedSession.exercises.forEach((exercise, order) => {
      newExercises.push({
        id: id(),
        sessionId,
        name: exercise.name,
        sets: exercise.sets,
        comment: exercise.comment,
        order,
      })
    })
  })

  return {
    ok: true,
    categories: nextCategories,
    sessions: newSessions,
    exercises: newExercises,
    sessionCount: parsedSessions.length,
    exerciseCount: newExercises.length,
  }
}

export const PULL_THRESHOLD = 320
export const PULL_MAX = 360
export const TIMER_RING_INSET = 1.25
export const TIMER_RING_RADIUS = 20

export const buildTimerRingPath = (width: number, height: number) => {
  const x = TIMER_RING_INSET
  const y = TIMER_RING_INSET
  const w = width - TIMER_RING_INSET * 2
  const h = height - TIMER_RING_INSET * 2
  const r = Math.min(TIMER_RING_RADIUS, w / 2, h / 2)
  const cx = x + w / 2
  const right = x + w
  const bottom = y + h

  return [
    `M ${cx} ${y}`,
    `L ${right - r} ${y}`,
    `A ${r} ${r} 0 0 1 ${right} ${y + r}`,
    `L ${right} ${bottom - r}`,
    `A ${r} ${r} 0 0 1 ${right - r} ${bottom}`,
    `L ${x + r} ${bottom}`,
    `A ${r} ${r} 0 0 1 ${x} ${bottom - r}`,
    `L ${x} ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    `L ${cx} ${y}`,
  ].join(' ')
}
export const SWIPE_DELETE_THRESHOLD = 120
export const SWIPE_DELETE_MAX = 132
export const SWIPE_RESET_TRANSITION_MS = 200
export const GESTURE_FOLLOW_RATIO = 0.5

export const dampedGestureDistance = (distance: number) => distance * GESTURE_FOLLOW_RATIO

export const isInteractiveElement = (target: EventTarget | null) =>
  target instanceof Element &&
  Boolean(target.closest('button, select, input, textarea, a, label'))

export const dampedSwipeOffset = (deltaX: number) => {
  if (deltaX >= 0) {
    return 0
  }

  const fingerOffset = Math.max(-SWIPE_DELETE_MAX, deltaX)

  return fingerOffset * GESTURE_FOLLOW_RATIO
}

export const resizeExerciseComment = (element: HTMLTextAreaElement) => {
  element.style.height = 'auto'
  const style = window.getComputedStyle(element)
  const lineHeight = Number.parseFloat(style.lineHeight) || 20
  const padding =
    Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom)
  const singleLineHeight = lineHeight + padding
  const nextHeight = Math.max(singleLineHeight, element.scrollHeight)

  element.style.height = `${nextHeight}px`
}

