import { useMemo } from 'react'

const getMethodClass = (method) => {
  const classes = {
    GET: 'bg-green-600',
    POST: 'bg-blue-600',
    PUT: 'bg-amber-600',
    DELETE: 'bg-red-600',
    PATCH: 'bg-purple-600'
  }
  return classes[method] || 'bg-gray-600'
}

const getStatusClass = (status) => {
  if (!status) return 'text-slate-500'
  if (status >= 200 && status < 300) return 'text-green-500'
  if (status >= 300 && status < 400) return 'text-blue-500'
  if (status >= 400 && status < 500) return 'text-amber-500'
  if (status >= 500) return 'text-red-500'
  return 'text-slate-500'
}

export default function RequestList({ requests, filter, onSelect, selectedId, selectedIds, onToggleSelect, deduplicationStats }) {
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      if (filter.methods.length > 0 && !filter.methods.includes(req.method)) {
        return false
      }
      if (filter.url && !req.url.toLowerCase().includes(filter.url.toLowerCase())) {
        return false
      }
      if (filter.hideDuplicates && req.isDuplicate) {
        return false
      }
      if (filter.tags && filter.tags.length > 0) {
        const reqTags = req.tags || []
        if (!filter.tags.some(tag => reqTags.includes(tag))) {
          return false
        }
      }
      return true
    })
  }, [requests, filter])

  const formatUrl = (url) => {
    try {
      const urlObj = new URL(url)
      return urlObj.pathname + urlObj.search
    } catch {
      return url
    }
  }

  const handleRowClick = (e, req) => {
    if (e.target.type === 'checkbox') return
    onSelect(req)
  }

  const handleCheckboxChange = (e, reqId) => {
    e.stopPropagation()
    onToggleSelect(reqId)
  }

  if (filteredRequests.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        <div className="text-center">
          <div className="text-4xl mb-2">📭</div>
          <div>No requests found</div>
          <div className="text-sm text-slate-600">Start a crawl to capture API requests</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {deduplicationStats && (
        <div className="bg-slate-800/50 border-b border-slate-700 px-4 py-2 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Total:</span>
            <span className="font-semibold text-slate-200">{deduplicationStats.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-amber-400">⚠</span>
            <span className="text-slate-400">Duplicates:</span>
            <span className="font-semibold text-amber-400">{deduplicationStats.duplicates}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Merged:</span>
            <span className="font-semibold text-blue-400">{deduplicationStats.merged}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Dup Rate:</span>
            <span className="font-semibold text-slate-200">{(deduplicationStats.duplicateRate * 100).toFixed(1)}%</span>
          </div>
        </div>
      )}
      <table className="w-full">
        <thead className="bg-slate-800 sticky top-0">
          <tr>
            <th className="text-left p-3 text-slate-400 text-sm font-medium w-12">
              {selectedIds && onToggleSelect && (
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={filteredRequests.length > 0 && filteredRequests.every(r => selectedIds.includes(r.id))}
                  onChange={() => {}}
                />
              )}
            </th>
            <th className="text-left p-3 text-slate-400 text-sm font-medium w-24">Method</th>
            <th className="text-left p-3 text-slate-400 text-sm font-medium w-20">Status</th>
            <th className="text-left p-3 text-slate-400 text-sm font-medium">URL</th>
            <th className="text-left p-3 text-slate-400 text-sm font-medium w-32">Type</th>
            <th className="text-left p-3 text-slate-400 text-sm font-medium w-20">Dup</th>
          </tr>
        </thead>
        <tbody>
          {filteredRequests.map((req) => (
            <tr
              key={req.id}
              onClick={(e) => handleRowClick(e, req)}
              className={`border-b border-slate-800 cursor-pointer transition-colors ${
                selectedId === req.id
                  ? 'bg-blue-900/30'
                  : req.isDuplicate
                    ? 'bg-amber-900/20 hover:bg-slate-800/50'
                    : 'hover:bg-slate-800/50'
              }`}
            >
              <td className="p-3">
                {selectedIds && onToggleSelect && (
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(req.id)}
                    onChange={(e) => handleCheckboxChange(e, req.id)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600"
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </td>
              <td className="p-3">
                <span className={`${getMethodClass(req.method)} text-white text-xs font-bold px-2 py-1 rounded`}>
                  {req.method}
                </span>
              </td>
              <td className="p-3">
                <span className={`font-mono text-sm ${getStatusClass(req.status)}`}>
                  {req.status || '...'}
                </span>
              </td>
              <td className="p-3">
                <div className="font-mono text-sm text-slate-300 truncate" title={req.url}>
                  {formatUrl(req.url)}
                </div>
              </td>
              <td className="p-3">
                <span className="text-slate-500 text-xs">
                  {req.resourceType}
                </span>
              </td>
              <td className="p-3">
                {req.isDuplicate && (
                  <span className="text-xs bg-amber-600/30 text-amber-400 px-2 py-0.5 rounded" title={`Duplicate #${req.duplicateCount}`}>
                    ×{req.duplicateCount}
                  </span>
                )}
                {req.tags && req.tags.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {req.tags.slice(0, 2).map(tag => (
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
  )
}
