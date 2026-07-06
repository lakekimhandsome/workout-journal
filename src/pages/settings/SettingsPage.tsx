import { Link } from 'react-router-dom'
import { SubpageLayout } from '../../components/SubpageLayout'
import { paths } from '../../routes/paths'

export function SettingsPage() {
  return (
    <SubpageLayout title="설정" backLabel="운동일지로" backTo={paths.home}>
      <nav className="settings-menu" aria-label="설정 메뉴">
        <Link className="settings-menu-button" to={paths.settings.categories}>
          카테고리 수정하기
        </Link>
        <Link className="settings-menu-button" to={paths.settings.export}>
          운동일지 내보내기
        </Link>
        <Link className="settings-menu-button" to={paths.settings.import}>
          운동일지 가져오기
        </Link>
        <Link className="settings-menu-button danger" to={paths.settings.reset}>
          운동일지 초기화
        </Link>
      </nav>
    </SubpageLayout>
  )
}
