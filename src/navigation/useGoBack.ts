import { useNavigationStack } from './NavigationStackContext'

export function useGoBack() {
  const { goBack } = useNavigationStack()

  return goBack
}
