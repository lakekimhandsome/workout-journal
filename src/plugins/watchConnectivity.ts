import { registerPlugin } from '@capacitor/core'

export type WatchTimerStatePayload = {
  running: boolean
  endTime: number
  totalSeconds: number
  stoppedEndTime?: number
}

export type WatchSetButtonPressedPayload = {
  id?: string
  timestamp?: number
  endTime?: number
  totalSeconds?: number
}

export type WatchTimerResetPayload = {
  id?: string
  timestamp?: number
  totalSeconds?: number
}

export interface WatchConnectivityPlugin {
  pushTimerState(state: WatchTimerStatePayload): Promise<void>
  addListener(
    eventName: 'setButtonPressed',
    listenerFunc: (payload: WatchSetButtonPressedPayload) => void,
  ): Promise<{ remove: () => Promise<void> }>
  addListener(
    eventName: 'timerReset',
    listenerFunc: (payload: WatchTimerResetPayload) => void,
  ): Promise<{ remove: () => Promise<void> }>
}

export const WatchConnectivity = registerPlugin<WatchConnectivityPlugin>('WatchConnectivity')
