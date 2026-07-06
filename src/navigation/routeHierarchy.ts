import { paths } from '../routes/paths'

export type NavigationDirection = 'push' | 'pop'

export function getRouteDepth(pathname: string): number {
  if (pathname === paths.home) {
    return 0
  }

  if (pathname === paths.settings.root) {
    return 1
  }

  if (pathname.startsWith(`${paths.settings.root}/`)) {
    return 2
  }

  return 0
}

export function getParentPath(pathname: string): string | null {
  if (pathname === paths.home) {
    return null
  }

  if (pathname.startsWith(`${paths.settings.root}/`) && pathname !== paths.settings.root) {
    return paths.settings.root
  }

  if (pathname === paths.settings.root) {
    return paths.home
  }

  return null
}

export function getNavigationDirection(fromPathname: string, toPathname: string): NavigationDirection {
  const fromDepth = getRouteDepth(fromPathname)
  const toDepth = getRouteDepth(toPathname)

  if (toDepth > fromDepth) {
    return 'push'
  }

  if (toDepth < fromDepth) {
    return 'pop'
  }

  const parentPath = getParentPath(fromPathname)
  if (parentPath === toPathname) {
    return 'pop'
  }

  return 'push'
}
