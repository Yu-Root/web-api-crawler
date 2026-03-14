import { useState } from 'react'

const methodColors = {
  GET: 'bg-green-600',
  POST: 'bg-blue-600',
  PUT: 'bg-amber-600',
  DELETE: 'bg-red-600',
  PATCH: 'bg-purple-600'
}

export default function ModuleCard({ module, onDelete, onExport, onSelectRequest, selectedRequest, onShowApiDoc, onShowDependencies, onClassify }) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [requests, setRequests] = useState(null)

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/modules/getById?id=${module.id}`)
      const data = await response.json()
      if (data.success) {
        setRequests(data.module.requests || [])
      } else {
        console.error('Error:', data.error)
      }
    } catch (error) {
      console.error('Error fetching requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = () => {
    const willExpand = !expanded
    setExpanded(willExpand)
    if (willExpand && requests === null) {
      fetchRequests()
    }
  }

  const handleRequestClick = (req) => {
    if (onSelectRequest) {
      onSelectRequest(req)
    }
  }

  const formatUrl = (url) => {
    try {
      const urlObj = new URL(url)
      return urlObj.pathname + urlObj.search
    } catch {
      return url
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleString()
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-700/50 transition-colors"
        onClick={handleToggle}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">
            {expanded ? '📂' : '📁'}
          </span>
          <div>
            <h3 className="font-semibold text-slate-200">{module.name}</h3>
            {module.description && (
              <p className="text-sm text-slate-400">{module.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="bg-slate-700 text-slate-300 px-2 py-1 rounded">
              {module.request_count} requests
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onShowApiDoc && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onShowApiDoc(module.id)
                }}
                className="text-slate-400 hover:text-blue-400 p-1"
                title="API Documentation"
              >
                📄
              </button>
            )}
            {onShowDependencies && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onShowDependencies(module.id)
                }}
                className="text-slate-400 hover:text-green-400 p-1"
                title="Dependencies"
              >
                🔗
              </button>
            )}
            {onClassify && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onClassify(module.id)
                }}
                className="text-slate-400 hover:text-purple-400 p-1"
                title="Auto Classify"
              >
                🏷️
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onExport(module.id)
              }}
              className="text-slate-400 hover:text-slate-200 p-1"
              title="Export"
            >
              📤
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (confirm(`Delete module "${module.name}"?`)) {
                  onDelete(module.id)
                }
              }}
              className="text-slate-400 hover:text-red-400 p-1"
              title="Delete"
            >
              🗑️
            </button>
            <span className="text-slate-500">
              {expanded ? '▲' : '▼'}
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-700">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          ) : requests && requests.length > 0 ? (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-slate-900/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 text-slate-400 text-xs font-medium w-20">Method</th>
                    <th className="text-left p-2 text-slate-400 text-xs font-medium w-16">Status</th>
                    <th className="text-left p-2 text-slate-400 text-xs font-medium">URL</th>
                    <th className="text-left p-2 text-slate-400 text-xs font-medium w-24">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr
                      key={req.id}
                      onClick={() => handleRequestClick(req)}
                      className={`border-t border-slate-700/50 hover:bg-slate-700/30 cursor-pointer ${selectedRequest?.id === req.id ? 'bg-blue-900/30 border-l-2 border-l-blue-500' : ''}`}
                    >
                      <td className="p-2">
                        <span className={`${methodColors[req.method] || 'bg-gray-600'} text-white text-xs font-bold px-2 py-0.5 rounded`}>
                          {req.method}
                        </span>
                      </td>
                      <td className="p-2">
                        <span className="font-mono text-xs text-slate-400">
                          {req.status || '---'}
                        </span>
                      </td>
                      <td className="p-2">
                        <span className="font-mono text-xs text-slate-300 truncate block max-w-md" title={req.url}>
                          {formatUrl(req.url)}
                        </span>
                      </td>
                      <td className="p-2">
                        {req.tags && req.tags.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {req.tags.slice(0, 3).map(tag => (
                              <span key={tag} className="text-xs bg-blue-600/30 text-blue-400 px-1.5 py-0.5 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-slate-500 py-4 text-sm">
              No requests in this module
            </div>
          )}

          <div className="p-2 border-t border-slate-700 text-xs text-slate-500 bg-slate-900/30">
            Created: {formatDate(module.created_at)}
            {module.updated_at && ` | Updated: ${formatDate(module.updated_at)}`}
          </div>
        </div>
      )}
    </div>
  )
}
