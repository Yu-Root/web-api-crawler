import { useState, useEffect } from 'react'
import DependencyGraph from '../components/DependencyGraph'

const API_BASE = '/api'

export default function DependencyGraphPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [graphData, setGraphData] = useState(null)

  useEffect(() => {
    fetchGraphData()
  }, [])

  const fetchGraphData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/crawl/dependencies/graph`)
      const data = await response.json()
      if (data.success) {
        setGraphData(data.graph)
      } else {
        setError(data.error || 'Failed to fetch graph data')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAnalyze = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/crawl/dependencies/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await response.json()
      if (data.success) {
        setGraphData(data.graph)
      } else {
        setError(data.error || 'Failed to analyze dependencies')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-100">Request Dependency Graph</h2>
          <div className="flex gap-2">
            <button
              onClick={fetchGraphData}
              disabled={loading}
              className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-md font-medium transition-colors disabled:bg-slate-800"
            >
              Refresh
            </button>
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md font-medium transition-colors disabled:bg-blue-800"
            >
              {loading ? 'Analyzing...' : 'Analyze Dependencies'}
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-2 bg-red-900/30 border border-red-700 rounded-md px-4 py-2 text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>
      <div className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full"></div>
          </div>
        ) : graphData && (graphData.nodes?.length > 0 || graphData.edges?.length > 0) ? (
          <DependencyGraph data={graphData} />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            <div className="text-center">
              <div className="text-4xl mb-2">🕸️</div>
              <div>No dependency data available</div>
              <div className="text-sm mt-2">
                Click "Analyze Dependencies" to analyze request relationships
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
