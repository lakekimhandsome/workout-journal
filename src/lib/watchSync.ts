import { Capacitor } from '@capacitor/core'
import { WatchConnectivity } from '../plugins/watchConnectivity'

export type WatchTimerSyncState = {
  running: boolean
  endTime: number | null
  totalSeconds: number
}

export const pushWatchTimerState = (state: WatchTimerSyncState) => {
  if (!Capacitor.isNativePlatform()) {
    return
  }

  void WatchConnectivity.pushTimerState({
    running: state.running,
    endTime: state.endTime ?? 0,
    totalSeconds: state.totalSeconds,
  }).catch(() => {})
}
