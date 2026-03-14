import { useState, useEffect } from 'react'
import PerformanceDashboard from '../components/PerformanceDashboard'

const API_BASE = '/api'

export default function PerformanceDashboardPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [alerts, setAlerts] = useState([])

  const fetchData = async () => {
    try {
      const [metricsRes, alertsRes] = await Promise.all([
        fetch(`${API_BASE}/crawl/performance/metrics`),
        fetch(`${API_BASE}/crawl/performance/alerts`)
      ])
      const metricsData = await metricsRes.json()
      const alertsData = await alertsRes.json()
      
      if (metricsData.success) {
        setMetrics(metricsData.metrics)
      }
      if (alertsData.success) {
        setAlerts(alertsData.alerts || [])
      }
    } catch (err) {
      console.error('Error fetching performance data:', err)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleReset = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/crawl/performance/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await response.json()
      if (data.success) {
        fetchData()
      } else {
        setError(data.error || 'Failed to reset stats')
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
          <h2 className="text-xl font-bold text-slate-100">Performance Dashboard</h2>
          <button
            onClick={handleReset}
            disabled={loading}
            className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-md font-medium transition-colors disabled:bg-red-800"
          >
            {loading ? 'Resetting...' : 'Reset Stats'}
          </button>
        </div>
        {error && (
          <div className="mt-2 bg-red-900/30 border border-red-700 rounded-md px-4 py-2 text-red-400 text-sm">
            {error}
          </div>
        )}
        {alerts.length > 0 && (
          <div className="mt-2 space-y-1">
            {alerts.map((alert, idx) => (
              <div key={idx} className={`border rounded-md px-3 py-1 text-sm ${
                alert.level === 'critical' ? 'bg-red-900/30 border-red-700 text-red-400' :
                alert.level === 'warning' ? 'bg-amber-900/30 border-amber-700 text-amber-400' :
                'bg-blue-900/30 border-blue-700 text-blue-400'
              }`}>
                <span className="font-medium">{alert.level.toUpperCase()}:</span> {alert.message}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        <PerformanceDashboard metrics={metrics} alerts={alerts} />
      </div>
    </div>
  )
}
