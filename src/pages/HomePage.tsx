import { Link } from 'react-router-dom'
import {
  buildTimerRingPath,
  formatSessionListDate,
  formatTimer,
  formatTimerPreset,
  isInteractiveElement,
  PULL_THRESHOLD,
  resizeExerciseComment,
  swipeKey,
  type Category,
  type Exercise,
  type Session,
} from '../lib/journal'
import { useJournal } from '../context/JournalProvider'
import { paths } from '../routes/paths'

export function HomePage() {
  const {
    categories,
    sortedSessions,
    categoryById,
    expandedSessionIds,
    expandedPreviousSessionIds,
    pullDistance,
    pullFingerDistance,
    draftExerciseNames,
    setDraftExerciseNames,
    restSeconds,
    setRestSeconds,
    remainingSeconds,
    timerRunning,
    timerOpen,
    setTimerOpen,
    timerTotalSeconds,
    timerButtonRef,
    timerRingSize,
    referenceOffsets,
    activeSwipeKey,
    swipeOffsets,
    sessionListRef,
    duplicateIndexBySession,
    stopRestTimer,
    toggleSession,
    togglePreviousSession,
    updateSessionCategory,
    getSessionExercises,
    getPreviousSameCategorySessions,
    moveReference,
    removeSession,
    removeExercise,
    updateExercise,
    changeSets,
    addExercise,
    handleSwipeStart,
    handleSwipeMove,
    handleSwipeEnd,
  } = useJournal()

  const displaySeconds = timerRunning ? remainingSeconds : restSeconds
  const timerProgress =
    timerRunning && timerTotalSeconds.current > 0
      ? remainingSeconds / timerTotalSeconds.current
      : 0
  const timerRingPath =
    timerRingSize.width > 0 && timerRingSize.height > 0
      ? buildTimerRingPath(timerRingSize.width, timerRingSize.height)
      : ''

  return (
    <main className="app app-home">
      <header className="timer-bar">
        <div className="timer-row">
          <button
            ref={timerButtonRef}
            className="timer-button"
            type="button"
            onClick={() => setTimerOpen((open: boolean) => !open)}
          >
            {timerRingSize.width > 0 && timerRingSize.height > 0 && (
              <svg
                className="timer-progress-ring"
                viewBox={`0 0 ${timerRingSize.width} ${timerRingSize.height}`}
                aria-hidden="true"
              >
                <path
                  className="timer-progress-track"
                  d={timerRingPath}
                  pathLength="1"
                />
                <path
                  className="timer-progress-value"
                  d={timerRingPath}
                  pathLength="1"
                  style={{ strokeDashoffset: 1 - timerProgress }}
                />
              </svg>
            )}
            <strong>{formatTimer(displaySeconds)}</strong>
          </button>
          <button className="timer-stop" type="button" onClick={stopRestTimer}>
            타이머 초기화
          </button>
          <Link className="settings-button" to={paths.settings.root}>
            설정
          </Link>
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

      <section
        ref={sessionListRef}
        className="session-list"
        aria-label="운동 세션 목록"
      >
        <div className="session-pull-area">
          <p className="session-pull-hint">
            {pullFingerDistance >= PULL_THRESHOLD ? '놓으면 새 세션' : '아래로 당겨서 새 세션 만들기'}
          </p>
          {pullDistance > 0 && (
            <div className="session-pull-spacer" style={{ height: `${pullDistance}px` }} aria-hidden />
          )}
        </div>

        {sortedSessions.length === 0 && (
          <div className="empty-card">
            <strong>아직 기록이 없습니다.</strong>
            <span>목록 맨 위에서 아래로 당기면 새 세션이 시작됩니다.</span>
          </div>
        )}

        {sortedSessions.map((session: Session) => {
          const category = categoryById.get(session.categoryId)
          const isExpanded = expandedSessionIds.includes(session.id)
          const isPreviousExpanded = expandedPreviousSessionIds.includes(session.id)
          const sessionExercises = getSessionExercises(session.id)
          const previousSessions = getPreviousSameCategorySessions(session)
          const referenceOffset = Math.min(
            referenceOffsets[session.id] ?? 0,
            Math.max(previousSessions.length - 1, 0),
          )
          const previousSession = previousSessions[referenceOffset]
          const previousExercises = previousSession ? getSessionExercises(previousSession.id) : []
          const previousSessionDate = previousSession
            ? formatSessionListDate(
                previousSession.date,
                duplicateIndexBySession.get(previousSession.id) ?? 0,
              )
            : ''

        return (
            <div
              className={
                activeSwipeKey === swipeKey('session', session.id)
                  ? 'session-swipe-row is-swiping'
                  : 'session-swipe-row'
              }
              key={session.id}
              onTouchStart={(event) => {
                if (!isExpanded) {
                  handleSwipeStart('session', session.id, event)
                }
              }}
              onTouchMove={(event) => {
                if (!isExpanded) {
                  handleSwipeMove('session', session.id, event)
                }
              }}
              onTouchEnd={(event) => {
                if (!isExpanded) {
                  handleSwipeEnd('session', session.id, event)
                }
              }}
            >
              <div className="session-swipe-track">
              <button
                className="session-swipe-delete"
                type="button"
                onClick={() => removeSession(session.id)}
              >
                삭제
              </button>
              <div
                className="session-swipe-content"
                style={
                  swipeOffsets[swipeKey('session', session.id)] !== undefined
                    ? {
                        transform: `translateX(${swipeOffsets[swipeKey('session', session.id)]}px)`,
                      }
                    : undefined
                }
              >
              <article
                className="session-card"
                style={
                  category?.color
                    ? { borderColor: category.color, borderWidth: 2 }
                    : undefined
                }
              >
              <div
                className="session-header"
                onClick={(event) => {
                  if (isInteractiveElement(event.target)) {
                    return
                  }

                  toggleSession(session.id)
                }}
                aria-expanded={isExpanded}
              >
                <span className="expand-indicator" aria-hidden="true">
                  {isExpanded ? '▼' : '▶'}
                </span>
                <div className="session-summary">
                  <div className="session-title">
                    {formatSessionListDate(session.date, duplicateIndexBySession.get(session.id) ?? 0)}
                  </div>
                  <select
                    className="session-category"
                    value={session.categoryId}
                    style={category?.color ? { color: category.color } : undefined}
                    onChange={(event) => updateSessionCategory(session.id, event.target.value)}
                    aria-label="세션 카테고리"
                  >
                    {categories.map((option: Category) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>
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
                    {sessionExercises.map((exercise: Exercise) => (
                      <div
                        className={
                          activeSwipeKey === swipeKey('exercise', exercise.id)
                            ? 'exercise-swipe-row is-swiping'
                            : 'exercise-swipe-row'
                        }
                        key={exercise.id}
                        onTouchStart={(event) => {
                          event.stopPropagation()
                          handleSwipeStart('exercise', exercise.id, event)
                        }}
                        onTouchMove={(event) => {
                          event.stopPropagation()
                          handleSwipeMove('exercise', exercise.id, event)
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
                        <div
                          className="exercise-swipe-content"
                          style={
                            swipeOffsets[swipeKey('exercise', exercise.id)] !== undefined
                              ? {
                                  transform: `translateX(${swipeOffsets[swipeKey('exercise', exercise.id)]}px)`,
                                }
                              : undefined
                          }
                        >
                        <div className="exercise-card">
                          <div className="exercise-top-row">
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
                          </div>
                          <textarea
                            className="exercise-comment"
                            rows={1}
                            value={exercise.comment}
                            ref={(node) => {
                              if (node) {
                                resizeExerciseComment(node)
                              }
                            }}
                            onChange={(event) => {
                              updateExercise(exercise.id, { comment: event.target.value })
                              resizeExerciseComment(event.currentTarget)
                            }}
                            placeholder="메모 남기기"
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
                        setDraftExerciseNames((current: Record<string, string>) => ({
                          ...current,
                          [session.id]: event.target.value,
                        }))
                      }
                      placeholder="운동 이름"
                      aria-label="운동 이름"
                    />
                    <button type="submit">추가</button>
                  </form>

                  <div className="previous-session">
                    <button
                      type="button"
                      className="previous-session-toggle"
                      onClick={() => togglePreviousSession(session.id)}
                      aria-expanded={isPreviousExpanded}
                    >
                      <span className="previous-session-chevron" aria-hidden="true">
                        {isPreviousExpanded ? '▼' : '▶'}
                      </span>
                      <span className="previous-session-label">
                        지난 {category?.name ?? '카테고리'}
                      </span>
                      <span className="previous-session-date">{previousSessionDate || '없음'}</span>
                    </button>
                    {isPreviousExpanded && (
                      <>
                    {previousSessions.length > 0 && (
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
                          과거
                        </button>
                      </div>
                    )}
                    <div className="previous-exercise-list">
                      {previousExercises.length === 0 ? (
                        <p className="muted previous-empty">기록 없음</p>
                      ) : (
                        previousExercises.map((exercise: Exercise) => (
                          <button
                            className="previous-exercise"
                            key={exercise.id}
                            type="button"
                            onClick={() => addExercise(session.id, exercise.name)}
                          >
                            <span className="previous-exercise-top">
                              <strong>{exercise.name}</strong>
                              <em>x{exercise.sets}</em>
                            </span>
                            {exercise.comment.trim() && <small>{exercise.comment}</small>}
                          </button>
                        ))
                      )}
                    </div>
                      </>
                    )}
                  </div>
                </div>
              )}
              </article>
              </div>
              </div>
            </div>
          )
        })}
      </section>
    </main>
  )
}
