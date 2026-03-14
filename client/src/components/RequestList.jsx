import { useMemo, useState } from 'react'

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

const getTagClass = (tag) => {
  const classes = {
    authentication: 'bg-purple-500',
    user: 'bg-blue-500',
    data: 'bg-green-500',
    create: 'bg-cyan-500',
    update: 'bg-yellow-500',
    delete: 'bg-red-500',
    file: 'bg-pink-500',
    notification: 'bg-orange-500',
    payment: 'bg-emerald-500',
    analytics: 'bg-indigo-500',
    system: 'bg-gray-500',
    content: 'bg-teal-500',
    social: 'bg-rose-500',
    thirdParty: 'bg-violet-500',
    static: 'bg-slate-500'
  }
  return classes[tag] || 'bg-gray-500'
}

const getTagName = (tag) => {
  const names = {
    authentication: '认证',
    user: '用户',
    data: '数据',
    create: '创建',
    update: '更新',
    delete: '删除',
    file: '文件',
    notification: '通知',
    payment: '支付',
    analytics: '分析',
    system: '系统',
    content: '内容',
    social: '社交',
    thirdParty: '第三方',
    static: '静态'
  }
  return names[tag] || tag
}

export default function RequestList({ 
  requests, 
  filter, 
  onSelect, 
  selectedId, 
  selectedIds, 
  onToggleSelect,
  showTags = true,
  showDeduplication = true,
  groupBy = null
}) {
  const [expandedGroups, setExpandedGroups] = useState(new Set())

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      if (filter.methods.length > 0 && !filter.methods.includes(req.method)) {
        return false
      }
      if (filter.url && !req.url.toLowerCase().includes(filter.url.toLowerCase())) {
        return false
      }
      if (filter.tags && filter.tags.length > 0) {
        const reqTags = req.tags || []
        if (!filter.tags.some(tag => reqTags.includes(tag))) {
          return false
        }
      }
      if (filter.status && filter.status.length > 0) {
        const statusGroup = req.status ? `${Math.floor(req.status / 100)}xx` : 'unknown'
        if (!filter.status.includes(statusGroup)) {
          return false
        }
      }
      return true
    })
  }, [requests, filter])

  const groupedRequests = useMemo(() => {
    if (!groupBy) {
      return { ungrouped: filteredRequests }
    }

    const groups = {}
    filteredRequests.forEach(req => {
      let key = 'default'
      
      if (groupBy === 'tag') {
        key = req.primary_tag || '未分类'
      } else if (groupBy === 'domain') {
        try {
          const urlObj = new URL(req.url)
          key = urlObj.hostname
        } catch {
          key = 'unknown'
        }
      } else if (groupBy === 'status') {
        key = req.status ? `${Math.floor(req.status / 100)}xx` : 'unknown'
      } else if (groupBy === 'method') {
        key = req.method || 'UNKNOWN'
      } else if (groupBy === 'groupId') {
        key = req.group_id || 'ungrouped'
      }

      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(req)
    })

    return groups
  }, [filteredRequests, groupBy])

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

  const toggleGroup = (groupKey) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey)
    } else {
      newExpanded.add(groupKey)
    }
    setExpandedGroups(newExpanded)
  }

  const renderRequestRow = (req) => (
    <tr
      key={req.id}
      onClick={(e) => handleRowClick(e, req)}
      className={`border-b border-slate-800 cursor-pointer transition-colors ${
        selectedId === req.id
          ? 'bg-blue-900/30'
          : 'hover:bg-slate-800/50'
      } ${req.is_duplicate ? 'opacity-60' : ''}`}
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
        {showDeduplication && req.duplicate_count > 0 && (
          <div className="text-xs text-amber-400 mt-1">
            +{req.duplicate_count} 个相似请求
          </div>
        )}
      </td>
      <td className="p-3">
        <span className="text-slate-500 text-xs">
          {req.resourceType}
        </span>
      </td>
      {showTags && (
        <td className="p-3">
          <div className="flex flex-wrap gap-1">
            {req.tags && req.tags.map((tag, idx) => (
              <span
                key={idx}
                className={`${getTagClass(tag)} text-white text-xs px-2 py-0.5 rounded`}
                title={`置信度: ${Math.round((req.tag_confidence || 0) * 100)}%`}
              >
                {getTagName(tag)}
              </span>
            ))}
            {(!req.tags || req.tags.length === 0) && (
              <span className="text-slate-600 text-xs">-</span>
            )}
          </div>
        </td>
      )}
      {showDeduplication && (
        <td className="p-3">
          {req.fingerprint ? (
            <span className="text-xs font-mono text-slate-500" title={req.fingerprint}>
              {req.fingerprint.substring(0, 8)}...
            </span>
          ) : (
            <span className="text-slate-600 text-xs">-</span>
          )}
        </td>
      )}
    </tr>
  )

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
            {showTags && (
              <th className="text-left p-3 text-slate-400 text-sm font-medium w-40">Tags</th>
            )}
            {showDeduplication && (
              <th className="text-left p-3 text-slate-400 text-sm font-medium w-32">Fingerprint</th>
            )}
          </tr>
        </thead>
        <tbody>
          {groupBy ? (
            Object.entries(groupedRequests).map(([groupKey, groupRequests]) => (
              <>
                <tr 
                  key={groupKey}
                  className="bg-slate-700/50 cursor-pointer"
                  onClick={() => toggleGroup(groupKey)}
                >
                  <td colSpan={showTags ? (showDeduplication ? 7 : 6) : (showDeduplication ? 6 : 5)} className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-300">
                        {expandedGroups.has(groupKey) ? '▼' : '▶'}
                      </span>
                      <span className="font-medium text-slate-200">
                        {groupBy === 'tag' ? getTagName(groupKey) : groupKey}
                      </span>
                      <span className="text-slate-500 text-sm">
                        ({groupRequests.length} 请求)
                      </span>
                    </div>
                  </td>
                </tr>
                {expandedGroups.has(groupKey) && groupRequests.map(renderRequestRow)}
              </>
            ))
          ) : (
            filteredRequests.map(renderRequestRow)
          )}
        </tbody>
      </table>
    </div>
  )
}
