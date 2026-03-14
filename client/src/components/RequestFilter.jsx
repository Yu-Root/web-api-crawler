import { useState, useEffect } from 'react'

const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

const tagOptions = [
  { value: 'authentication', label: '认证授权', color: 'bg-purple-500' },
  { value: 'user', label: '用户管理', color: 'bg-blue-500' },
  { value: 'data', label: '数据操作', color: 'bg-green-500' },
  { value: 'create', label: '创建操作', color: 'bg-cyan-500' },
  { value: 'update', label: '更新操作', color: 'bg-yellow-500' },
  { value: 'delete', label: '删除操作', color: 'bg-red-500' },
  { value: 'file', label: '文件处理', color: 'bg-pink-500' },
  { value: 'notification', label: '消息通知', color: 'bg-orange-500' },
  { value: 'payment', label: '支付交易', color: 'bg-emerald-500' },
  { value: 'analytics', label: '统计分析', color: 'bg-indigo-500' },
  { value: 'system', label: '系统服务', color: 'bg-gray-500' },
  { value: 'content', label: '内容管理', color: 'bg-teal-500' },
  { value: 'social', label: '社交互动', color: 'bg-rose-500' },
  { value: 'thirdParty', label: '第三方服务', color: 'bg-violet-500' },
  { value: 'static', label: '静态资源', color: 'bg-slate-500' }
]

const statusOptions = [
  { value: '2xx', label: '2xx 成功', color: 'text-green-500' },
  { value: '3xx', label: '3xx 重定向', color: 'text-blue-500' },
  { value: '4xx', label: '4xx 客户端错误', color: 'text-amber-500' },
  { value: '5xx', label: '5xx 服务器错误', color: 'text-red-500' },
  { value: 'unknown', label: '未知', color: 'text-slate-500' }
]

const groupByOptions = [
  { value: null, label: '不分组' },
  { value: 'tag', label: '按标签分组' },
  { value: 'domain', label: '按域名分组' },
  { value: 'status', label: '按状态分组' },
  { value: 'method', label: '按方法分组' },
  { value: 'groupId', label: '按去重组分组' }
]

export default function RequestFilter({ requests, filter, setFilter, onGroupByChange, groupBy }) {
  const [stats, setStats] = useState({
    GET: 0,
    POST: 0,
    PUT: 0,
    DELETE: 0,
    PATCH: 0
  })
  const [tagStats, setTagStats] = useState({})
  const [statusStats, setStatusStats] = useState({})
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    const newStats = { GET: 0, POST: 0, PUT: 0, DELETE: 0, PATCH: 0 }
    const newTagStats = {}
    const newStatusStats = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, unknown: 0 }

    requests.forEach(req => {
      if (newStats[req.method] !== undefined) {
        newStats[req.method]++
      }

      if (req.tags) {
        req.tags.forEach(tag => {
          newTagStats[tag] = (newTagStats[tag] || 0) + 1
        })
      }

      if (req.status) {
        const statusGroup = `${Math.floor(req.status / 100)}xx`
        if (newStatusStats[statusGroup] !== undefined) {
          newStatusStats[statusGroup]++
        }
      } else {
        newStatusStats.unknown++
      }
    })

    setStats(newStats)
    setTagStats(newTagStats)
    setStatusStats(newStatusStats)
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

  const isMethodActive = (method) => filter.methods.includes(method)

  const toggleMethod = (method) => {
    const newMethods = filter.methods.includes(method)
      ? filter.methods.filter(m => m !== method)
      : [...filter.methods, method]
    setFilter({ ...filter, methods: newMethods })
  }

  const isTagActive = (tag) => filter.tags && filter.tags.includes(tag)

  const toggleTag = (tag) => {
    const currentTags = filter.tags || []
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag]
    setFilter({ ...filter, tags: newTags })
  }

  const isStatusActive = (status) => filter.status && filter.status.includes(status)

  const toggleStatus = (status) => {
    const currentStatus = filter.status || []
    const newStatus = currentStatus.includes(status)
      ? currentStatus.filter(s => s !== status)
      : [...currentStatus, status]
    setFilter({ ...filter, status: newStatus })
  }

  const clearAllFilters = () => {
    setFilter({ methods: [], url: '', tags: [], status: [] })
  }

  const hasActiveFilters = filter.methods.length > 0 || filter.url || 
    (filter.tags && filter.tags.length > 0) || 
    (filter.status && filter.status.length > 0)

  return (
    <div className="bg-slate-800 rounded-lg p-4 mb-4">
      {/* Basic Filters */}
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
            value={filter.url || ''}
            onChange={(e) => setFilter({ ...filter, url: e.target.value })}
            className="bg-slate-700 border border-slate-600 rounded-md px-3 py-1.5 text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded-md transition-colors"
            >
              清除筛选
            </button>
          )}
        </div>
      </div>

      {/* Group By */}
      <div className="flex items-center gap-4 mb-4">
        <div className="text-slate-400 text-sm font-medium">分组方式:</div>
        <div className="flex flex-wrap gap-2">
          {groupByOptions.map(option => (
            <button
              key={option.value || 'none'}
              onClick={() => onGroupByChange && onGroupByChange(option.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                groupBy === option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced Filters Toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-2 text-slate-400 text-sm hover:text-slate-300 transition-colors mb-2"
      >
        <span>{showAdvanced ? '▼' : '▶'}</span>
        <span>高级筛选</span>
        {(filter.tags?.length > 0 || filter.status?.length > 0) && (
          <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
            {(filter.tags?.length || 0) + (filter.status?.length || 0)}
          </span>
        )}
      </button>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-slate-700">
          {/* Tag Filter */}
          <div className="mb-4">
            <div className="text-slate-400 text-sm font-medium mb-2">标签筛选:</div>
            <div className="flex flex-wrap gap-2">
              {tagOptions.map(tag => {
                const count = tagStats[tag.value] || 0
                if (count === 0) return null
                return (
                  <button
                    key={tag.value}
                    onClick={() => toggleTag(tag.value)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                      isTagActive(tag.value)
                        ? `${tag.color} text-white`
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    <span>{tag.label}</span>
                    <span className="text-xs opacity-75">({count})</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <div className="text-slate-400 text-sm font-medium mb-2">状态码筛选:</div>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map(status => {
                const count = statusStats[status.value] || 0
                if (count === 0) return null
                return (
                  <button
                    key={status.value}
                    onClick={() => toggleStatus(status.value)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                      isStatusActive(status.value)
                        ? 'bg-slate-600 text-white'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    <span className={status.color}>{status.label}</span>
                    <span className="text-xs opacity-75">({count})</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
