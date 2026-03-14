import { useState, useEffect, useMemo } from 'react'

const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

const getTagColor = (tag) => {
  const colorMap = {
    'api': 'bg-blue-600',
    'auth': 'bg-purple-600',
    'data': 'bg-cyan-600',
    'crud': 'bg-amber-600',
    'media': 'bg-pink-600',
    'admin': 'bg-red-600',
    'error': 'bg-red-600',
    'slow': 'bg-orange-600',
    'large-response': 'bg-yellow-600',
    'authenticated': 'bg-indigo-600',
    'json-api': 'bg-green-600',
    'form-data': 'bg-teal-600',
    'external': 'bg-gray-600',
    'internal': 'bg-emerald-600',
    'success': 'bg-green-600',
    'redirect': 'bg-blue-400',
    'client-error': 'bg-amber-600',
    'server-error': 'bg-red-600',
    'write-request': 'bg-amber-600',
    'read-only': 'bg-green-600',
    'fast': 'bg-green-500',
    'medium-speed': 'bg-yellow-500'
  }
  
  if (tag.startsWith('type:')) return 'bg-slate-600'
  return colorMap[tag] || 'bg-slate-500'
}

export default function RequestFilter({ requests, filter, setFilter }) {
  const [stats, setStats] = useState({
    GET: 0,
    POST: 0,
    PUT: 0,
    DELETE: 0,
    PATCH: 0
  })

  const availableTags = useMemo(() => {
    const tags = new Set()
    requests.forEach(req => {
      (req.tags || []).forEach(tag => tags.add(tag))
    })
    return Array.from(tags).sort()
  }, [requests])

  const tagStats = useMemo(() => {
    const stats = {}
    requests.forEach(req => {
      (req.tags || []).forEach(tag => {
        stats[tag] = (stats[tag] || 0) + 1
      })
    })
    return stats
  }, [requests])

  useEffect(() => {
    const newStats = {
      GET: 0,
      POST: 0,
      PUT: 0,
      DELETE: 0,
      PATCH: 0
    }
    requests.forEach(req => {
      if (newStats[req.method] !== undefined) {
        newStats[req.method]++
      }
    })
    setStats(newStats)
  }, [requests])

  const getMethodClass = (method) => {
    const classes = {
      GET: 'bg-green-600 hover:bg-green-500',
      POST: 'bg-blue-600 hover:bg-blue-500',
      PUT: 'bg-amber-600 hover:bg-amber-500',
      DELETE: 'bg-red-600 hover:bg-red-500',
      PATCH: 'bg-purple-600 hover:bg-purple-500'
    }
    return classes[method] || 'bg-gray-600 hover:bg-gray-500'
  }

  const isMethodActive = (method) => {
    return filter.methods.includes(method)
  }

  const isTagActive = (tag) => {
    return filter.tags && filter.tags.includes(tag)
  }

  const toggleMethod = (method) => {
    const newMethods = filter.methods.includes(method)
      ? filter.methods.filter(m => m !== method)
      : [...filter.methods, method]
    setFilter({ ...filter, methods: newMethods })
  }

  const toggleTag = (tag) => {
    const currentTags = filter.tags || []
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag]
    setFilter({ ...filter, tags: newTags })
  }

  return (
    <div className="bg-slate-800 rounded-lg p-4 mb-4">
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="text-slate-400 text-sm font-medium">HTTP Methods:</div>
        <div className="flex flex-wrap gap-2">
          {methods.map(method => (
            <button
              key={method}
              onClick={() => toggleMethod(method)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isMethodActive(method)
                  ? getMethodClass(method) + ' text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              {method} ({stats[method]})
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter by URL..."
            value={filter.url}
            onChange={(e) => setFilter({ ...filter, url: e.target.value })}
            className="bg-slate-700 border border-slate-600 rounded-md px-3 py-1.5 text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {availableTags.length > 0 && (
        <div className="border-t border-slate-700 pt-4">
          <div className="text-slate-400 text-sm font-medium mb-2">Tags:</div>
          <div className="flex flex-wrap gap-2">
            {availableTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                  isTagActive(tag)
                    ? `${getTagColor(tag)} text-white`
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
              >
                {tag}
                <span className="text-xs opacity-75">({tagStats[tag]})</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
