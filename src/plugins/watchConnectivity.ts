import { registerPlugin } from '@capacitor/core'

export type WatchTimerStatePayload = {
  running: boolean
  endTime: number
  totalSeconds: number
}

export interface WatchConnectivityPlugin {
  pushTimerState(state: WatchTimerStatePayload): Promise<void>
  addListener(
    eventName: 'setButtonPressed',
    listenerFunc: () => void,
  ): Promise<{ remove: () => Promise<void> }>
  addListener(
    eventName: 'timerReset',
    listenerFunc: () => void,
  ): Promise<{ remove: () => Promise<void> }>
}

export const WatchConnectivity = registerPlugin<WatchConnectivityPlugin>('WatchConnectivity')
