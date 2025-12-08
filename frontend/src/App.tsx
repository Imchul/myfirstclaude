import { Routes, Route } from 'react-router-dom'
import MainStage from './pages/MainStage'
import OperatorConsole from './pages/OperatorConsole'

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainStage />} />
      <Route path="/operator" element={<OperatorConsole />} />
    </Routes>
  )
}

export default App
