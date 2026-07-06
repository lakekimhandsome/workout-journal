import type { ReactNode } from 'react'
import { ChevronLeftIcon } from './ChevronLeftIcon'
import { useGoBack } from '../navigation/useGoBack'

type SubpageLayoutProps = {
  title: string
  backLabel: string
  backTo: string
  children: ReactNode
}

export function SubpageLayout({ title, backLabel, children }: SubpageLayoutProps) {
  const goBack = useGoBack()

  return (
    <main className="app app-subpage">
      <header className="page-header">
        <div className="page-header-inner">
          <button
            type="button"
            className="back-button"
            onClick={goBack}
            aria-label={backLabel}
          >
            <ChevronLeftIcon className="back-button-icon" />
          </button>
          <h1>{title}</h1>
          <div className="page-header-spacer" aria-hidden="true" />
        </div>
      </header>
      <div className="page-content">{children}</div>
    </main>
  )
}
