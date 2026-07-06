import { SubpageLayout } from '../../components/SubpageLayout'
import { useJournal } from '../../context/JournalProvider'
import { paths } from '../../routes/paths'

export function SettingsImportPage() {
  const {
    importText,
    setImportText,
    importMessage,
    setImportMessage,
    importFileInput,
    handleImportFile,
    importFromText,
  } = useJournal()

  return (
    <SubpageLayout title="운동일지 가져오기" backLabel="설정으로" backTo={paths.settings.root}>
      <section className="export-card">
        <div className="section-title">
          <h2>가져오기</h2>
          <span>내보내기와 같은 형식의 텍스트</span>
        </div>
        <p className="muted import-hint">
          텍스트를 붙여넣으면 세션과 운동이 추가됩니다. 없는 카테고리는 자동으로 만들어집니다.
        </p>
        <textarea
          className="export-text import-text"
          value={importText}
          onChange={(event) => {
            setImportText(event.target.value)
            if (importMessage) {
              setImportMessage('')
            }
          }}
          placeholder={`2026.07.04 [PUSH]\n- 벤치프레스 x3\n70 4\n- 스쿼트 x5\n100 3 보폭 넓게\n\n2026.07.05 [PULL]\n- 풀업 x2\n- 바벨컬 x2\n30 8\n몸 고정하기`}
          aria-label="가져올 텍스트"
        />
        {importMessage && <p className="import-message">{importMessage}</p>}
        <div className="export-actions">
          <button type="button" onClick={() => importFileInput.current?.click()}>
            txt 파일 선택
          </button>
          <input
            ref={importFileInput}
            className="import-file-input"
            type="file"
            accept=".txt,text/plain"
            onChange={handleImportFile}
          />
          <button
            className="primary-button"
            type="button"
            onClick={importFromText}
            disabled={!importText.trim()}
          >
            가져오기
          </button>
        </div>
      </section>
    </SubpageLayout>
  )
}
