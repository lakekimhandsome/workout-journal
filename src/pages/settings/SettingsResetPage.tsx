import { SubpageLayout } from '../../components/SubpageLayout'
import { useJournal } from '../../context/JournalProvider'
import { paths } from '../../routes/paths'

export function SettingsResetPage() {
  const { resetAllData } = useJournal()

  return (
    <SubpageLayout title="운동일지 초기화" backLabel="설정으로" backTo={paths.settings.root}>
      <section className="reset-card">
        <div className="section-title">
          <h2>초기화</h2>
          <span>모든 기록을 삭제하고 앱을 처음 상태로 되돌립니다</span>
        </div>
        <p className="muted reset-hint">
          운동 세션, 운동 기록, 사용자 카테고리가 모두 삭제되고 PUSH/PULL/LEGS 기본 카테고리와 90초
          휴식 타이머로 초기화됩니다.
        </p>
        <div className="export-actions">
          <button className="danger-button" type="button" onClick={resetAllData}>
            전체 초기화
          </button>
        </div>
      </section>
    </SubpageLayout>
  )
}
