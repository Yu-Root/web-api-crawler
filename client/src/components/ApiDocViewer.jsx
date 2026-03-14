import { useState, useEffect } from 'react'

export default function ApiDocViewer({ apiUrl = '/docs/apidocs/swagger.json' }) {
  const [spec, setSpec] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedPaths, setExpandedPaths] = useState({})

  useEffect(() => {
    fetch(apiUrl)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load API documentation')
        return res.json()
      })
      .then(data => {
        setSpec(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [apiUrl])

  const togglePath = (path) => {
    setExpandedPaths(prev => ({
      ...prev,
      [path]: !prev[path]
    }))
  }

  const getMethodClass = (method) => {
    const classes = {
      get: 'bg-green-600',
      post: 'bg-blue-600',
      put: 'bg-amber-600',
      delete: 'bg-red-600',
      patch: 'bg-purple-600'
    }
    return classes[method.toLowerCase()] || 'bg-gray-600'
  }

  const renderSchema = (schema, indent = 0) => {
    if (!schema) return null
    const padding = `pl-${indent * 4}`
    
    if (schema.type === 'object' && schema.properties) {
      return (
        <div className={padding}>
          <span className="text-purple-400">object</span>
          {Object.entries(schema.properties).map(([key, prop]) => (
            <div key={key} className="ml-4 my-1">
              <span className="text-blue-300">{key}:</span>{' '}
              {renderSchema(prop, 0)}
            </div>
          ))}
        </div>
      )
    }
    
    if (schema.type === 'array' && schema.items) {
      return (
        <div>
          <span className="text-yellow-400">array</span>
          <span className="ml-2">[ {renderSchema(schema.items, 0)} ]</span>
        </div>
      )
    }
    
    return <span className="text-green-400">{schema.type || 'any'}</span>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading API documentation...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-800 rounded-lg p-4">
        <div className="text-red-400">Error: {error}</div>
        <div className="text-slate-400 text-sm mt-2">
          Generate API documentation first by capturing API requests.
        </div>
      </div>
    )
  }

  if (!spec) {
    return (
      <div className="text-center text-slate-500 py-8">
        No API documentation available
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-xl font-bold text-white">{spec.info?.title || 'API Documentation'}</h2>
        <div className="text-slate-400 text-sm mt-1">
          Version: {spec.info?.version || '1.0.0'}
        </div>
      </div>

      {spec.servers && spec.servers.length > 0 && (
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-sm font-medium text-slate-300 mb-2">Servers:</h3>
          {spec.servers.map((server, idx) => (
            <div key={idx} className="text-blue-400 text-sm">{server.url}</div>
          ))}
        </div>
      )}

      <div className="divide-y divide-slate-700">
        {Object.entries(spec.paths || {}).map(([path, methods]) => (
          <div key={path} className="border-b border-slate-700 last:border-0">
            <button
              onClick={() => togglePath(path)}
              className="w-full px-4 py-3 text-left hover:bg-slate-700/50 flex items-center justify-between"
            >
              <span className="text-white font-mono text-sm">{path}</span>
              <span className="text-slate-400">
                {expandedPaths[path] ? '▼' : '▶'}
              </span>
            </button>

            {expandedPaths[path] && (
              <div className="px-4 pb-4 space-y-3">
                {Object.entries(methods).map(([method, operation]) => (
                  <div key={method} className="bg-slate-900 rounded-md overflow-hidden">
                    <div className="flex items-center p-2 bg-slate-800">
                      <span className={`${getMethodClass(method)} text-white text-xs font-bold px-2 py-1 rounded uppercase`}>
                        {method}
                      </span>
                      <span className="ml-2 text-white text-sm">
                        {operation.summary || operation.operationId || ''}
                      </span>
                    </div>

                    {operation.requestBody && (
                      <div className="p-3 border-t border-slate-700">
                        <div className="text-slate-300 text-sm font-medium mb-1">Request Body:</div>
                        <div className="text-xs bg-slate-950 p-2 rounded">
                          {renderSchema(operation.requestBody.content?.['application/json']?.schema)}
                        </div>
                      </div>
                    )}

                    {operation.responses && (
                      <div className="p-3 border-t border-slate-700">
                        <div className="text-slate-300 text-sm font-medium mb-1">Responses:</div>
                        {Object.entries(operation.responses).map(([status, response]) => (
                          <div key={status} className="mb-2 last:mb-0">
                            <div className="flex items-center">
                              <span className="text-green-400 font-mono text-xs">{status}</span>
                              <span className="ml-2 text-slate-300 text-xs">{response.description}</span>
                            </div>
                            {response.content && (
                              <div className="ml-4 mt-1 text-xs bg-slate-950 p-2 rounded">
                                {renderSchema(response.content['application/json']?.schema)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
