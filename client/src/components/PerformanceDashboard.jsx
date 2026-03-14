import { useState, useEffect } from 'react'

const getSeverityColor = (severity) => {
  const colors = {
    critical: 'bg-red-600',
    warning: 'bg-amber-500',
    info: 'bg-blue-500'
  }
  return colors[severity] || 'bg-gray-500'
}

const getStatusColor = (status) => {
  if (!status) return 'bg-gray-600'
  if (status >= 200 && status < 300) return 'bg-green-600'
  if (status >= 300 && status < 400) return 'bg-blue-600'
  if (status >= 400 && status < 500) return 'bg-amber-600'
  if (status >= 500) return 'bg-red-600'
  return 'bg-gray-600'
}

const formatDuration = (ms) => {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

export default function PerformanceDashboard({ metrics = {} }) {
  const { summary = {}, aggregated = {}, timeSeries = [], alerts = [] } = metrics
  const [activeTab, setActiveTab] = useState('overview')

  const sortedAlerts = [...alerts].sort((a, b) => b.timestamp - a.timestamp)
  const criticalAlerts = sortedAlerts.filter(a => a.severity === 'critical')
  const warningAlerts = sortedAlerts.filter(a => a.severity === 'warning')

  const renderBar = (value, max, color = 'bg-blue-500') => {
    const percent = Math.min((value / max) * 100, 100)
    return (
      <div className="w-full bg-slate-700 rounded-full h-2">
        <div className={`${color} h-2 rounded-full`} style={{ width: `${percent}%` }}></div>
      </div>
    )
  }

  const renderTimeSeriesChart = () => {
    if (!timeSeries || timeSeries.length === 0) {
      return (
        <div className="h-40 flex items-center justify-center text-slate-500">
          No time series data available
        </div>
      )
    }

    const maxRequests = Math.max(...timeSeries.map(d => d.requests), 1)
    const maxResponseTime = Math.max(...timeSeries.map(d => d.avgResponseTime), 1)
    
    return (
      <div className="h-40 relative">
        <div className="absolute inset-0 flex items-end justify-between px-2">
          {timeSeries.map((point, idx) => {
            const requestHeight = (point.requests / maxRequests) * 100
            const responseHeight = (point.avgResponseTime / maxResponseTime) * 100
            
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col gap-1">
                  <div 
                    className="bg-blue-500/30 w-full" 
                    style={{ height: `${requestHeight}%` }}
                    title={`Requests: ${point.requests}`}
                  ></div>
                  <div 
                    className="bg-green-500/50 w-full" 
                    style={{ height: `${responseHeight}%` }}
                    title={`Avg Response: ${point.avgResponseTime}ms`}
                  ></div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-slate-700"></div>
        <div className="absolute top-2 right-2 text-xs text-slate-400 flex gap-2">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-blue-500/30"></span>
            Requests
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500/50"></span>
            Response Time
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 text-white">
      <div className="p-4 bg-slate-800 border-b border-slate-700">
        <h2 className="text-xl font-bold mb-4">Performance Dashboard</h2>
        
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded text-sm ${
              activeTab === 'overview' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-3 py-1.5 rounded text-sm ${
              activeTab === 'alerts' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            Alerts {sortedAlerts.length > 0 && `(${sortedAlerts.length})`}
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`px-3 py-1.5 rounded text-sm ${
              activeTab === 'details' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            Details
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="text-slate-400 text-sm mb-1">Total Requests</div>
                <div className="text-3xl font-bold">{summary.totalRequests || 0}</div>
                <div className="text-slate-500 text-xs mt-1">
                  {summary.requestsPerSecond || 0} req/s
                </div>
              </div>

              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="text-slate-400 text-sm mb-1">Avg Response Time</div>
                <div className="text-3xl font-bold">{summary.averageResponseTime || 0}ms</div>
                <div className="text-slate-500 text-xs mt-1">
                  Last minute: {aggregated.averageResponseTime || 0}ms
                </div>
              </div>

              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="text-slate-400 text-sm mb-1">Error Rate</div>
                <div className={`text-3xl font-bold ${
                  (summary.errorRate || 0) > 10 ? 'text-red-500' : 'text-green-500'
                }`}>
                  {summary.errorRate || 0}%
                </div>
                <div className="text-slate-500 text-xs mt-1">
                  {summary.totalErrors || 0} errors total
                </div>
              </div>

              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="text-slate-400 text-sm mb-1">Duration</div>
                <div className="text-3xl font-bold">{formatDuration(summary.durationMs || 0)}</div>
                <div className="text-slate-500 text-xs mt-1">
                  Since {new Date(summary.startTime || Date.now()).toLocaleTimeString()}
                </div>
              </div>
            </div>

            {criticalAlerts.length > 0 && (
              <div className="bg-red-900/30 border border-red-800 rounded-lg p-4">
                <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2">
                  <span className="text-xl">⚠️</span>
                  Critical Alerts ({criticalAlerts.length})
                </h3>
                <div className="space-y-2">
                  {criticalAlerts.slice(0, 3).map(alert => (
                    <div key={alert.id} className="bg-red-900/50 p-2 rounded text-sm">
                      {alert.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {warningAlerts.length > 0 && criticalAlerts.length === 0 && (
              <div className="bg-amber-900/30 border border-amber-800 rounded-lg p-4">
                <h3 className="text-amber-400 font-bold mb-2 flex items-center gap-2">
                  <span className="text-xl">⚠️</span>
                  Warnings ({warningAlerts.length})
                </h3>
                <div className="space-y-2">
                  {warningAlerts.slice(0, 3).map(alert => (
                    <div key={alert.id} className="bg-amber-900/50 p-2 rounded text-sm">
                      {alert.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <h3 className="text-white font-medium mb-4">Performance Over Time</h3>
                {renderTimeSeriesChart()}
              </div>

              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <h3 className="text-white font-medium mb-4">Status Codes</h3>
                <div className="space-y-3">
                  {Object.entries(summary.statusCodes || {})
                    .sort(([,a], [,b]) => b - a)
                    .map(([status, count]) => (
                      <div key={status} className="flex items-center gap-3">
                        <span className={`${getStatusColor(parseInt(status))} text-white text-xs font-bold px-2 py-1 rounded w-12 text-center`}>
                          {status}
                        </span>
                        <div className="flex-1">
                          {renderBar(count, summary.totalRequests || 1, getStatusColor(parseInt(status)))}
                        </div>
                        <span className="text-slate-400 text-sm w-12 text-right">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-4">
            {sortedAlerts.length === 0 ? (
              <div className="bg-slate-800 rounded-lg p-8 text-center text-slate-400">
                <div className="text-4xl mb-2">✅</div>
                <div>No active alerts</div>
                <div className="text-sm mt-2">System is operating normally</div>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedAlerts.map(alert => (
                  <div key={alert.id} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                    <div className={`${getSeverityColor(alert.severity)} h-1`}></div>
                    <div className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className={`${getSeverityColor(alert.severity)} text-white text-xs font-bold px-2 py-1 rounded uppercase`}>
                            {alert.severity}
                          </span>
                          <h4 className="font-medium mt-2">{alert.ruleName}</h4>
                          <p className="text-slate-400 text-sm mt-1">{alert.message}</p>
                        </div>
                        <span className="text-slate-500 text-xs">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'details' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <h3 className="text-white font-medium mb-4">HTTP Methods</h3>
                <div className="space-y-3">
                  {Object.entries(summary.methods || {})
                    .sort(([,a], [,b]) => b - a)
                    .map(([method, count]) => (
                      <div key={method} className="flex items-center gap-3">
                        <span className="w-16 font-mono">{method}</span>
                        <div className="flex-1">
                          {renderBar(count, summary.totalRequests || 1)}
                        </div>
                        <span className="text-slate-400 text-sm w-12 text-right">{count}</span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <h3 className="text-white font-medium mb-4">Resource Types</h3>
                <div className="space-y-3">
                  {Object.entries(summary.resourceTypes || {})
                    .sort(([,a], [,b]) => b - a)
                    .map(([type, count]) => (
                      <div key={type} className="flex items-center gap-3">
                        <span className="w-24 truncate">{type}</span>
                        <div className="flex-1">
                          {renderBar(count, summary.totalRequests || 1)}
                        </div>
                        <span className="text-slate-400 text-sm w-12 text-right">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {(summary.slowRequests?.length > 0 || summary.errorRequests?.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {summary.slowRequests?.length > 0 && (
                  <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                    <h3 className="text-white font-medium mb-4">Slow Requests</h3>
                    <div className="space-y-2">
                      {summary.slowRequests.slice(0, 5).map((req, idx) => (
                        <div key={idx} className="text-sm border-b border-slate-700 pb-2">
                          <div className="flex justify-between">
                            <span className="font-medium truncate">{req.method} {req.url}</span>
                            <span className="text-amber-400">{req.responseTime}ms</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {summary.errorRequests?.length > 0 && (
                  <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                    <h3 className="text-white font-medium mb-4">Error Requests</h3>
                    <div className="space-y-2">
                      {summary.errorRequests.slice(0, 5).map((req, idx) => (
                        <div key={idx} className="text-sm border-b border-slate-700 pb-2">
                          <div className="flex justify-between">
                            <span className="font-medium truncate">{req.method} {req.url}</span>
                            <span className={`${getStatusColor(req.status)} text-white px-1 rounded text-xs`}>
                              {req.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
