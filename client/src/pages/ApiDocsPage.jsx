import { useState, useEffect } from 'react'
import ApiDocViewer from '../components/ApiDocViewer'

const API_BASE = '/api'

export default function ApiDocsPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleGenerateDocs = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/crawl/docs/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await response.json()
      if (!data.success) {
        setError(data.error || 'Failed to generate docs')
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
          <h2 className="text-xl font-bold text-slate-100">API Documentation</h2>
          <button
            onClick={handleGenerateDocs}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md font-medium transition-colors disabled:bg-blue-800"
          >
            {loading ? 'Generating...' : 'Generate API Docs'}
          </button>
        </div>
        {error && (
          <div className="mt-2 bg-red-900/30 border border-red-700 rounded-md px-4 py-2 text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        <ApiDocViewer />
      </div>
    </div>
  )
}
