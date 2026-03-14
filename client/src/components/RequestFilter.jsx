import { useState, useEffect } from 'react'

const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

export default function RequestFilter({ requests, filter, setFilter, availableTags = [] }) {
  const [stats, setStats] = useState({
    GET: 0,
    POST: 0,
    PUT: 0,
    DELETE: 0,
    PATCH: 0
  })

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

  const isActive = (method) => {
    return filter.methods.includes(method)
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
      <div className="flex flex-wrap items-center gap-4">
        <div className="text-slate-400 text-sm font-medium">HTTP Methods:</div>
        <div className="flex flex-wrap gap-2">
          {methods.map(method => (
            <button
              key={method}
              onClick={() => toggleMethod(method)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive(method)
                  ? getMethodClass(method) + ' text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              {method} ({stats[method]})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter by URL..."
            value={filter.url}
            onChange={(e) => setFilter({ ...filter, url: e.target.value })}
            className="bg-slate-700 border border-slate-600 rounded-md px-3 py-1.5 text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filter.hideDuplicates || false}
            onChange={(e) => setFilter({ ...filter, hideDuplicates: e.target.checked })}
            className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600"
          />
          <span className="text-sm text-slate-400">Hide Duplicates</span>
        </label>
      </div>

      {availableTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-slate-700">
          <div className="text-slate-400 text-sm font-medium">Tags:</div>
          <div className="flex flex-wrap gap-2">
            {availableTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  (filter.tags || []).includes(tag)
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
