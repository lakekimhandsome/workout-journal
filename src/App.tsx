import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, TouchEvent } from 'react'
import './App.css'

type Category = {
  id: string
  name: string
  color: string
  createdAt: string
}

type Session = {
  id: string
  date: string
  categoryId: string
  createdAt: string
}

type Exercise = {
  id: string
  sessionId: string
  name: string
  sets: number
  comment: string
  order: number
}

type JournalData = {
  categories: Category[]
  sessions: Session[]
  exercises: Exercise[]
}

type SwipeTarget = {
  type: 'session' | 'exercise'
  id: string
  x: number
}

const STORAGE_KEY = 'workout-journal:v1'
const TIMER_KEY = 'workout-journal:timer-seconds'
const DEFAULT_TIMER_SECONDS = 90

const PALETTE = [
  '#111827',
  '#ef4444',
  '#f97316',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
]

const nowIso = () => new Date().toISOString()

const id = () => {
  if ('crypto' in window && 'randomUUID' in window.crypto) {
    return window.crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const defaultCategories = (): Category[] => [
  { id: 'cat-push', name: 'PUSH', color: PALETTE[5], createdAt: nowIso() },
  { id: 'cat-pull', name: 'PULL', color: PALETTE[6], createdAt: nowIso() },
  { id: 'cat-legs', name: 'LEGS', color: PALETTE[2], createdAt: nowIso() },
]

const loadJournal = (): JournalData => {
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

const loadTimerSeconds = () => {
  const saved = Number(window.localStorage.getItem(TIMER_KEY))

  return Number.isFinite(saved) && saved >= 0 ? saved : DEFAULT_TIMER_SECONDS
}

const today = () => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const formatSessionDate = (date: string, index: number) => {
  const [year, month, day] = date.split('-')
  const suffix = index > 0 ? ` (${index})` : ''

  return `${year.slice(2)}.${month}.${day}${suffix}`
}

const formatTimer = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const restSeconds = seconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(restSeconds).padStart(2, '0')}`
}

const formatTimerPreset = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const restSeconds = seconds % 60

  return `${minutes}:${String(restSeconds).padStart(2, '0')}`
}

function App() {
  const initialData = useMemo(() => loadJournal(), [])
  const [categories, setCategories] = useState<Category[]>(initialData.categories)
  const [sessions, setSessions] = useState<Session[]>(initialData.sessions)
  const [exercises, setExercises] = useState<Exercise[]>(initialData.exercises)
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    initialData.categories[0]?.id ?? '',
  )
  const [expandedSessionIds, setExpandedSessionIds] = useState<string[]>([])
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState(PALETTE[0])
  const [draftExerciseNames, setDraftExerciseNames] = useState<Record<string, string>>({})
  const [restSeconds, setRestSeconds] = useState(loadTimerSeconds)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerOpen, setTimerOpen] = useState(false)
  const [page, setPage] = useState<'home' | 'categories' | 'export'>('home')
  const [referenceOffsets, setReferenceOffsets] = useState<Record<string, number>>({})
  const [exportStartDate, setExportStartDate] = useState('')
  const [exportEndDate, setExportEndDate] = useState(today())
  const [revealedSessionDeletes, setRevealedSessionDeletes] = useState<string[]>([])
  const [revealedExerciseDeletes, setRevealedExerciseDeletes] = useState<string[]>([])
  const swipeStart = useRef<SwipeTarget | null>(null)

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
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

  const activeCategoryId = categories.some((category) => category.id === selectedCategoryId)
    ? selectedCategoryId
    : categories[0]?.id ?? ''

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

  useEffect(() => {
    if (!timerRunning) {
      return
    }

    const timerId = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          setTimerRunning(false)
          return 0
        }

        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [timerRunning])

  const startRestTimer = () => {
    setRemainingSeconds(restSeconds)
    setTimerRunning(restSeconds > 0)
  }

  const stopRestTimer = () => {
    setTimerRunning(false)
    setRemainingSeconds(0)
  }

  const createSession = () => {
    if (!activeCategoryId) {
      return
    }

    setSessions((current) => [
      {
        id: id(),
        date: today(),
        categoryId: activeCategoryId,
        createdAt: nowIso(),
      },
      ...current,
    ])
  }

  const removeSession = (sessionId: string) => {
    setSessions((current) => current.filter((session) => session.id !== sessionId))
    setExercises((current) => current.filter((exercise) => exercise.sessionId !== sessionId))
    setExpandedSessionIds((current) => current.filter((id) => id !== sessionId))
    setRevealedSessionDeletes((current) => current.filter((id) => id !== sessionId))
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
    setSelectedCategoryId(category.id)
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
    setRevealedSessionDeletes((current) => current.filter((id) => id !== sessionId))
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

  const exportRangeText = `${exportStartDate || '처음'} ~ ${exportEndDate || '오늘'}`
  const exportBlocks = filteredExportSessions.map((session) => {
    const category = categoryById.get(session.categoryId)
    const sessionTitle = `${formatSessionDate(
      session.date,
      duplicateIndexBySession.get(session.id) ?? 0,
    )} [${category?.name ?? '카테고리 없음'}]`
    const lines = getSessionExercises(session.id).map((exercise) => {
      const comment = exercise.comment.trim()
      const base = `- ${exercise.name} / ${exercise.sets}세트`

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
    setExercises((current) => current.filter((exercise) => exercise.id !== exerciseId))
    setRevealedExerciseDeletes((current) => current.filter((id) => id !== exerciseId))
  }

  const changeSets = (exercise: Exercise, direction: 1 | -1) => {
    const nextSets = Math.max(0, exercise.sets + direction)

    updateExercise(exercise.id, { sets: nextSets })

    if (direction === 1) {
      startRestTimer()
    }
  }

  const getPreviousSameCategorySessions = (session: Session) => {
    return sessions
      .filter(
        (candidate) =>
          candidate.id !== session.id &&
          candidate.categoryId === session.categoryId &&
          new Date(candidate.createdAt).getTime() < new Date(session.createdAt).getTime(),
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
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

  const handleSwipeStart = (
    type: SwipeTarget['type'],
    targetId: string,
    event: TouchEvent<HTMLElement>,
  ) => {
    swipeStart.current = { type, id: targetId, x: event.touches[0].clientX }
  }

  const handleSwipeEnd = (
    type: SwipeTarget['type'],
    targetId: string,
    event: TouchEvent<HTMLElement>,
  ) => {
    const start = swipeStart.current

    if (!start || start.type !== type || start.id !== targetId) {
      return
    }

    const deltaX = event.changedTouches[0].clientX - start.x
    swipeStart.current = null

    if (deltaX < -48) {
      if (type === 'session') {
        setRevealedSessionDeletes((current) =>
          current.includes(targetId) ? current : [...current, targetId],
        )
      } else {
        setRevealedExerciseDeletes((current) =>
          current.includes(targetId) ? current : [...current, targetId],
        )
      }
    }

    if (deltaX > 48) {
      if (type === 'session') {
        setRevealedSessionDeletes((current) => current.filter((id) => id !== targetId))
      } else {
        setRevealedExerciseDeletes((current) => current.filter((id) => id !== targetId))
      }
    }
  }

  if (page === 'categories') {
    return (
      <main className="app">
        <header className="page-header">
          <button type="button" onClick={() => setPage('home')}>
            ← 기록으로
          </button>
          <div>
            <p className="eyebrow">설정</p>
            <h1>카테고리 수정</h1>
          </div>
        </header>

        <section className="category-card">
          <div className="section-title">
            <h2>카테고리</h2>
            <span>세션에서 사용할 이름과 색상</span>
          </div>

          <form className="category-form" onSubmit={createCategory}>
            <input
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="PUSH, 상체, Day 1..."
              aria-label="새 카테고리 이름"
            />
            <div className="palette" aria-label="카테고리 색상 선택">
              {PALETTE.map((color) => (
                <button
                  key={color}
                  className={color === newCategoryColor ? 'swatch selected' : 'swatch'}
                  type="button"
                  style={{ background: color }}
                  onClick={() => setNewCategoryColor(color)}
                  aria-label={`${color} 선택`}
                />
              ))}
            </div>
            <button type="submit">추가</button>
          </form>

          <div className="category-list">
            {categories.map((category) => {
              const isUsed = sessions.some((session) => session.categoryId === category.id)

              return (
                <div className="category-item" key={category.id}>
                  <input
                    type="color"
                    value={category.color}
                    onChange={(event) => updateCategory(category.id, { color: event.target.value })}
                    aria-label={`${category.name} 색상`}
                  />
                  <input
                    value={category.name}
                    onChange={(event) => updateCategory(category.id, { name: event.target.value })}
                    aria-label={`${category.name} 이름`}
                  />
                  <button
                    type="button"
                    disabled={isUsed || categories.length <= 1}
                    onClick={() => removeCategory(category.id)}
                  >
                    삭제
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      </main>
    )
  }

  if (page === 'export') {
    return (
      <main className="app">
        <header className="page-header">
          <button type="button" onClick={() => setPage('home')}>
            ← 기록으로
          </button>
          <div>
            <p className="eyebrow">내보내기</p>
            <h1>텍스트로 내보내기</h1>
          </div>
        </header>

        <section className="export-card">
          <div className="export-range">
            <label>
              시작
              <input
                type="date"
                value={exportStartDate}
                onChange={(event) => setExportStartDate(event.target.value)}
              />
            </label>
            <label>
              끝
              <input
                type="date"
                value={exportEndDate}
                onChange={(event) => setExportEndDate(event.target.value)}
              />
            </label>
          </div>
          <textarea className="export-text" readOnly value={exportText} aria-label="내보낼 텍스트" />
          <div className="export-actions">
            <button type="button" onClick={copyExportText}>
              복사
            </button>
            <button className="primary-button" type="button" onClick={downloadExportText}>
              txt 다운로드
            </button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="app">
      <header className="timer-bar">
        <div className="timer-row">
          <button
            className="timer-button"
            type="button"
            onClick={() => setTimerOpen((open) => !open)}
          >
            <span>휴식</span>
            <strong>{formatTimer(timerRunning ? remainingSeconds : restSeconds)}</strong>
            <small>{timerRunning ? '진행 중' : `${formatTimerPreset(restSeconds)} 설정`}</small>
          </button>
          <button className="timer-stop" type="button" onClick={stopRestTimer}>
            종료
          </button>
        </div>
        {timerOpen && (
          <div className="timer-settings">
            <label>
              <input
                type="number"
                min="0"
                step="5"
                value={restSeconds}
                onChange={(event) => setRestSeconds(Math.max(0, Number(event.target.value)))}
              />
              <span>초</span>
            </label>
            <div className="quick-times" aria-label="빠른 타이머 설정">
              {[60, 90, 120, 180].map((seconds) => (
                <button key={seconds} type="button" onClick={() => setRestSeconds(seconds)}>
                  {formatTimerPreset(seconds)}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <section className="top-card">
        <div className="new-session-row">
          <select
            value={activeCategoryId}
            onChange={(event) => setSelectedCategoryId(event.target.value)}
            aria-label="새 세션 카테고리"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button className="primary-button" type="button" onClick={createSession}>
            + 새 세션 시작
          </button>
          <button type="button" onClick={() => setPage('categories')}>
            카테고리 수정
          </button>
          <button type="button" onClick={() => setPage('export')}>
            내보내기
          </button>
        </div>
      </section>

      <section className="session-list" aria-label="운동 세션 목록">
        {sortedSessions.length === 0 && (
          <div className="empty-card">
            <strong>아직 기록이 없습니다.</strong>
            <span>카테고리를 고르고 새 세션을 시작하세요.</span>
          </div>
        )}

        {sortedSessions.map((session) => {
          const category = categoryById.get(session.categoryId)
          const isExpanded = expandedSessionIds.includes(session.id)
          const sessionExercises = getSessionExercises(session.id)
          const previousSessions = getPreviousSameCategorySessions(session)
          const referenceOffset = Math.min(
            referenceOffsets[session.id] ?? 0,
            Math.max(previousSessions.length - 1, 0),
          )
          const previousSession = previousSessions[referenceOffset]
          const previousExercises = previousSession ? getSessionExercises(previousSession.id) : []
          const previousSessionDate = previousSession
            ? formatSessionDate(
                previousSession.date,
                duplicateIndexBySession.get(previousSession.id) ?? 0,
              )
            : ''

          return (
            <div
              className={
                revealedSessionDeletes.includes(session.id)
                  ? 'session-swipe-row delete-revealed'
                  : 'session-swipe-row'
              }
              key={session.id}
              onTouchStart={(event) => {
                if (!isExpanded) {
                  handleSwipeStart('session', session.id, event)
                }
              }}
              onTouchEnd={(event) => {
                if (!isExpanded) {
                  handleSwipeEnd('session', session.id, event)
                }
              }}
            >
              <button
                className="session-swipe-delete"
                type="button"
                onClick={() => removeSession(session.id)}
              >
                삭제
              </button>
              <article className="session-card">
              <div className="session-header">
                <button
                  className="expand-button"
                  type="button"
                  onClick={() => toggleSession(session.id)}
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? '▼' : '▶'}
                </button>
                <div className="session-title">
                  {formatSessionDate(session.date, duplicateIndexBySession.get(session.id) ?? 0)}
                </div>
                <select
                  className="session-category"
                  value={session.categoryId}
                  style={{ borderColor: category?.color, color: category?.color }}
                  onChange={(event) => updateSessionCategory(session.id, event.target.value)}
                  aria-label="세션 카테고리"
                >
                  {categories.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
                <button
                  className="session-delete desktop-delete"
                  type="button"
                  onClick={() => removeSession(session.id)}
                >
                  삭제
                </button>
              </div>

              {isExpanded && (
                <div className="session-body">
                  <div className="exercise-list">
                    {sessionExercises.length === 0 && (
                      <p className="muted">운동 이름만 먼저 추가하세요. 세트와 코멘트는 바로 아래에서 기록합니다.</p>
                    )}

                    {sessionExercises.map((exercise) => (
                      <div
                        className={
                          revealedExerciseDeletes.includes(exercise.id)
                            ? 'exercise-swipe-row delete-revealed'
                            : 'exercise-swipe-row'
                        }
                        key={exercise.id}
                        onTouchStart={(event) => {
                          event.stopPropagation()
                          handleSwipeStart('exercise', exercise.id, event)
                        }}
                        onTouchEnd={(event) => {
                          event.stopPropagation()
                          handleSwipeEnd('exercise', exercise.id, event)
                        }}
                      >
                        <button
                          className="exercise-swipe-delete"
                          type="button"
                          onClick={() => removeExercise(exercise.id)}
                        >
                          삭제
                        </button>
                        <div className="exercise-card">
                          <input
                            className="exercise-name"
                            value={exercise.name}
                            onChange={(event) =>
                              updateExercise(exercise.id, { name: event.target.value })
                            }
                            aria-label="운동 이름 수정"
                          />
                          <div className="set-control" aria-label={`${exercise.name} 세트 수`}>
                            <button type="button" onClick={() => changeSets(exercise, -1)}>
                              -
                            </button>
                            <strong>{exercise.sets}</strong>
                            <button type="button" onClick={() => changeSets(exercise, 1)}>
                              +
                            </button>
                          </div>
                          <textarea
                            value={exercise.comment}
                            onChange={(event) =>
                              updateExercise(exercise.id, { comment: event.target.value })
                            }
                            placeholder="70 4&#10;발 내리고 몸 틀기"
                            aria-label={`${exercise.name} 코멘트`}
                          />
                          <button
                            className="text-button desktop-delete"
                            type="button"
                            onClick={() => removeExercise(exercise.id)}
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <form
                    className="exercise-add"
                    onSubmit={(event) => {
                      event.preventDefault()
                      addExercise(session.id, draftExerciseNames[session.id] ?? '')
                    }}
                  >
                    <input
                      value={draftExerciseNames[session.id] ?? ''}
                      onChange={(event) =>
                        setDraftExerciseNames((current) => ({
                          ...current,
                          [session.id]: event.target.value,
                        }))
                      }
                      placeholder="운동 이름"
                      aria-label="운동 이름"
                    />
                    <button type="submit">운동 추가</button>
                  </form>

                  {previousExercises.length > 0 && (
                    <div className="previous-session">
                      <p>
                        직전 {category?.name ?? '카테고리'} 참고
                        <span>{previousSessionDate}</span>
                      </p>
                      <div className="reference-nav">
                        <button
                          type="button"
                          disabled={referenceOffset <= 0}
                          onClick={() => moveReference(session.id, -1, previousSessions.length - 1)}
                        >
                          최근
                        </button>
                        <span>
                          {referenceOffset + 1} / {previousSessions.length}
                        </span>
                        <button
                          type="button"
                          disabled={referenceOffset >= previousSessions.length - 1}
                          onClick={() => moveReference(session.id, 1, previousSessions.length - 1)}
                        >
                          더 전
                        </button>
                      </div>
                      <div className="previous-exercise-list">
                        {previousExercises.map((exercise) => (
                          <button
                            className="previous-exercise"
                            key={exercise.id}
                            type="button"
                            onClick={() => addExercise(session.id, exercise.name)}
                          >
                            <span className="previous-exercise-top">
                              <strong>{exercise.name}</strong>
                              <em>{exercise.sets}세트</em>
                            </span>
                            {exercise.comment.trim() && <small>{exercise.comment}</small>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              </article>
            </div>
          )
        })}
      </section>
    </main>
  )
}

export default App
