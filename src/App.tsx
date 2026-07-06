import { JournalProvider } from './context/JournalProvider'
import { NavigationStack } from './navigation/NavigationStack'
import './App.css'

export default function App() {
  return (
    <JournalProvider>
      <NavigationStack />
    </JournalProvider>
  )
}
