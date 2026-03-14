import { useState } from 'react'
import Crawler from './pages/Crawler'
import Analyzer from './pages/Analyzer'
import ApiDocsPage from './pages/ApiDocsPage'
import DependencyGraphPage from './pages/DependencyGraphPage'
import PerformanceDashboardPage from './pages/PerformanceDashboardPage'
import NavBar from './components/NavBar'

function App() {
  const [currentPage, setCurrentPage] = useState('crawler')

  return (
    <div className="min-h-screen bg-slate-900">
      <NavBar currentPage={currentPage} onNavigate={setCurrentPage} />
      {currentPage === 'crawler' && <Crawler />}
      {currentPage === 'analyzer' && <Analyzer />}
      {currentPage === 'apidocs' && <ApiDocsPage />}
      {currentPage === 'dependencies' && <DependencyGraphPage />}
      {currentPage === 'performance' && <PerformanceDashboardPage />}
    </div>
  )
}

export default App
