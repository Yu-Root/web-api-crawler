import { useState, useEffect } from 'react'

const API_BASE = '/api'

export default function PerformanceDashboard({ onClose }) {
  const [stats, setStats] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [history, setHistory] = useState({ requests: [], responseTimes: [], memory: [] })
  const [loading, setLoading] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(5000)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, refreshInterval)
    return () => clearInterval(interval)
  }, [refreshInterval])

  const fetchData = async () => {
    try {
      const [statsRes, alertsRes, historyRes] = await Promise.all([
        fetch(`${API_BASE}/performance/stats`),
        fetch(`${API_BASE}/performance/alerts`),
        fetch(`${API_BASE}/performance/history`)
      ])

      const statsData = await statsRes.json()
      const alertsData = await alertsRes.json()
      const historyData = await historyRes.json()

      setStats(statsData)
      setAlerts(alertsData.alerts || [])
      setHistory(historyData)
    } catch (err) {
      console.error('Error fetching performance data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleClearAlerts = async () => {
    try {
      await fetch(`${API_BASE}/performance/alerts/clear`, { method: 'POST' })
      setAlerts([])
    } catch (err) {
      console.error('Error clearing alerts:', err)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-slate-200">Performance Dashboard</h2>
          <div className="flex items-center gap-4">
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
              className="bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-200"
            >
              <option value={2000}>2s refresh</option>
              <option value={5000}>5s refresh</option>
              <option value={10000}>10s refresh</option>
              <option value={30000}>30s refresh</option>
            </select>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard
              title="Total Requests"
              value={stats?.summary?.totalRequests || 0}
              icon="📊"
              color="blue"
            />
            <StatCard
              title="Error Rate"
              value={`${((stats?.windows?.['1min']?.errorRate || 0) * 100).toFixed(1)}%`}
              icon="⚠️"
              color={parseFloat(stats?.windows?.['1min']?.errorRate || 0) > 0.1 ? 'red' : 'green'}
            />
            <StatCard
              title="Avg Response Time"
              value={`${stats?.windows?.['1min']?.avgResponseTime || 0}ms`}
              icon="⏱️"
              color={stats?.windows?.['1min']?.avgResponseTime > 1000 ? 'amber' : 'green'}
            />
            <StatCard
              title="Memory Usage"
              value={`${stats?.windows?.['1min']?.memoryUsage?.percent || 0}%`}
              icon="💾"
              color={parseFloat(stats?.windows?.['1min']?.memoryUsage?.percent || 0) > 80 ? 'red' : 'green'}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-800 rounded-lg p-4">
              <h3 className="text-slate-200 font-medium mb-3">Request Rate (req/s)</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">{stats?.windows?.['1min']?.requestRate || 0}</div>
                  <div className="text-xs text-slate-500">1 min</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">{stats?.windows?.['5min']?.requestRate || 0}</div>
                  <div className="text-xs text-slate-500">5 min</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">{stats?.windows?.['15min']?.requestRate || 0}</div>
                  <div className="text-xs text-slate-500">15 min</div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 rounded-lg p-4">
              <h3 className="text-slate-200 font-medium mb-3">Response Times</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{stats?.windows?.['1min']?.minResponseTime || 0}ms</div>
                  <div className="text-xs text-slate-500">Min</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-400">{stats?.windows?.['1min']?.avgResponseTime || 0}ms</div>
                  <div className="text-xs text-slate-500">Avg</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">{stats?.windows?.['1min']?.maxResponseTime || 0}ms</div>
                  <div className="text-xs text-slate-500">Max</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-slate-200 font-medium">Response Time Chart</h3>
              <span className="text-sm text-slate-500">Last {history.responseTimes?.length || 0} requests</span>
            </div>
            <div className="h-40 relative">
              <ResponseTimeChart data={history.responseTimes || []} />
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-slate-200 font-medium">
                Alerts ({alerts.length})
              </h3>
              {alerts.length > 0 && (
                <button
                  onClick={handleClearAlerts}
                  className="text-sm text-slate-400 hover:text-slate-200"
                >
                  Clear All
                </button>
              )}
            </div>

            {alerts.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {alerts.slice(-20).reverse().map((alert, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded border ${
                      alert.severity === 'critical'
                        ? 'bg-red-900/30 border-red-700'
                        : alert.severity === 'warning'
                          ? 'bg-amber-900/30 border-amber-700'
                          : 'bg-blue-900/30 border-blue-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${
                        alert.severity === 'critical'
                          ? 'text-red-400'
                          : alert.severity === 'warning'
                            ? 'text-amber-400'
                            : 'text-blue-400'
                      }`}>
                        [{alert.severity.toUpperCase()}] {alert.ruleName}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">{alert.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-slate-500 py-8">
                No alerts
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-700 flex items-center justify-between text-sm text-slate-500">
          <div>
            Uptime: {formatUptime(stats?.summary?.uptime || 0)}
          </div>
          <div>
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, color }) {
  const colorClasses = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    amber: 'text-amber-400',
    red: 'text-red-400'
  }

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-sm text-slate-400">{title}</span>
      </div>
      <div className={`text-2xl font-bold ${colorClasses[color] || 'text-slate-200'}`}>
        {value}
      </div>
    </div>
  )
}

function ResponseTimeChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        No data
      </div>
    )
  }

  const max = Math.max(...data.map(d => d.value), 1)
  const width = 100 / data.length

  return (
    <div className="h-full flex items-end gap-px">
      {data.slice(-100).map((d, i) => {
        const height = (d.value / max) * 100
        const color = d.value > 1000 ? 'bg-red-500' : d.value > 500 ? 'bg-amber-500' : 'bg-green-500'
        return (
          <div
            key={i}
            className={`${color} rounded-t`}
            style={{
              width: `${width}%`,
              height: `${height}%`,
              minHeight: '2px'
            }}
            title={`${d.value}ms`}
          />
        )
      })}
    </div>
  )
}

function formatUptime(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return `${hours}h ${minutes}m ${secs}s`
}
