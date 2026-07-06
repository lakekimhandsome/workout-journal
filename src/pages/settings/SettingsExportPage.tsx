import { SubpageLayout } from '../../components/SubpageLayout'
import { useJournal } from '../../context/JournalProvider'
import { paths } from '../../routes/paths'

export function SettingsExportPage() {
  const {
    exportStartDate,
    setExportStartDate,
    exportEndDate,
    setExportEndDate,
    exportText,
    copyExportText,
    downloadExportText,
  } = useJournal()

  return (
    <SubpageLayout title="운동일지 내보내기" backLabel="설정으로" backTo={paths.settings.root}>
      <section className="export-card">
        <div className="section-title">
          <h2>내보내기</h2>
          <span>기간을 고른 뒤 텍스트로 저장</span>
        </div>
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
    </SubpageLayout>
  )
}
