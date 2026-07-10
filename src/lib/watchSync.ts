import { Capacitor } from '@capacitor/core'
import { WatchConnectivity } from '../plugins/watchConnectivity'

export type WatchTimerSyncState = {
  running: boolean
  endTime: number | null
  totalSeconds: number
  /** Previous end time when stopping, so Watch can ignore unrelated stale stops. */
  stoppedEndTime?: number | null
}

export const pushWatchTimerState = (state: WatchTimerSyncState) => {
  if (!Capacitor.isNativePlatform()) {
    return
  }

  void WatchConnectivity.pushTimerState({
    running: state.running,
    endTime: state.endTime ?? 0,
    totalSeconds: state.totalSeconds,
    stoppedEndTime: state.stoppedEndTime ?? 0,
  }).catch(() => {})
}
