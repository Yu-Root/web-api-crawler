import { useState, useEffect } from 'react'

export default function ApiDocViewer({ swaggerUrl, openApiUrl }) {
  const [activeTab, setActiveTab] = useState('swagger')
  const [swaggerData, setSwaggerData] = useState(null)
  const [openApiData, setOpenApiData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedPath, setSelectedPath] = useState(null)

  useEffect(() => {
    const fetchDocs = async () => {
      setLoading(true)
      setError(null)

      try {
        if (swaggerUrl) {
          const response = await fetch(swaggerUrl)
          if (response.ok) {
            const data = await response.json()
            setSwaggerData(data)
          }
        }

        if (openApiUrl) {
          const response = await fetch(openApiUrl)
          if (response.ok) {
            const text = await response.text()
            setOpenApiData(text)
          }
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchDocs()
  }, [swaggerUrl, openApiUrl])

  const getMethodColor = (method) => {
    const colors = {
      get: 'bg-green-600',
      post: 'bg-blue-600',
      put: 'bg-amber-600',
      patch: 'bg-purple-600',
      delete: 'bg-red-600'
    }
    return colors[method.toLowerCase()] || 'bg-gray-600'
  }

  const getStatusColor = (code) => {
    const num = parseInt(code)
    if (num >= 200 && num < 300) return 'text-green-400'
    if (num >= 300 && num < 400) return 'text-blue-400'
    if (num >= 400 && num < 500) return 'text-amber-400'
    if (num >= 500) return 'text-red-400'
    return 'text-slate-400'
  }

  const renderSwaggerUI = () => {
    if (!swaggerData) return null

    const { info, paths, tags } = swaggerData

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-slate-700 rounded-lg p-6">
          <h2 className="text-2xl font-bold text-slate-200 mb-2">{info?.title || 'API Documentation'}</h2>
          <p className="text-slate-400">{info?.description}</p>
          <div className="flex items-center gap-4 mt-4">
            <span className="bg-blue-600 text-white px-3 py-1 rounded text-sm">
              Version: {info?.version}
            </span>
            {tags && (
              <span className="text-slate-500 text-sm">
                {tags.length} 个标签
              </span>
            )}
            {paths && (
              <span className="text-slate-500 text-sm">
                {Object.keys(paths).length} 个端点
              </span>
            )}
          </div>
        </div>

        {/* Tags */}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, idx) => (
              <span
                key={idx}
                className="bg-slate-700 text-slate-300 px-3 py-1 rounded-full text-sm"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Paths */}
        <div className="space-y-4">
          {paths && Object.entries(paths).map(([path, methods]) => (
            <div key={path} className="bg-slate-700 rounded-lg overflow-hidden">
              <div className="bg-slate-600 px-4 py-2 font-mono text-slate-300 text-sm">
                {path}
              </div>
              <div className="divide-y divide-slate-600">
                {Object.entries(methods).map(([method, operation]) => (
                  <div
                    key={method}
                    className="p-4 hover:bg-slate-600/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedPath({ path, method, operation })}
                  >
                    <div className="flex items-start gap-4">
                      <span className={`${getMethodColor(method)} text-white text-xs font-bold px-2 py-1 rounded uppercase w-16 text-center`}>
                        {method}
                      </span>
                      <div className="flex-1">
                        <div className="text-slate-200 font-medium">{operation.summary || operation.operationId}</div>
                        {operation.description && (
                          <div className="text-slate-400 text-sm mt-1">{operation.description}</div>
                        )}
                        {operation.tags && (
                          <div className="flex gap-2 mt-2">
                            {operation.tags.map((tag, idx) => (
                              <span key={idx} className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderOpenApiView = () => {
    if (!openApiData) return null

    return (
      <div className="bg-slate-900 rounded-lg p-4 overflow-auto">
        <pre className="text-slate-300 text-sm font-mono whitespace-pre-wrap">
          {openApiData}
        </pre>
      </div>
    )
  }

  const renderPathDetail = () => {
    if (!selectedPath) return null

    const { path, method, operation } = selectedPath

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-auto">
          <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`${getMethodColor(method)} text-white text-xs font-bold px-2 py-1 rounded uppercase`}>
                {method}
              </span>
              <span className="font-mono text-slate-300">{path}</span>
            </div>
            <button
              onClick={() => setSelectedPath(null)}
              className="text-slate-400 hover:text-slate-200 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Summary */}
            <div>
              <h3 className="text-lg font-semibold text-slate-200 mb-2">{operation.summary}</h3>
              {operation.description && (
                <p className="text-slate-400">{operation.description}</p>
              )}
            </div>

            {/* Parameters */}
            {operation.parameters && operation.parameters.length > 0 && (
              <div>
                <h4 className="text-slate-300 font-medium mb-3">参数</h4>
                <div className="bg-slate-700 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-600">
                      <tr>
                        <th className="text-left p-3 text-slate-300">名称</th>
                        <th className="text-left p-3 text-slate-300">位置</th>
                        <th className="text-left p-3 text-slate-300">类型</th>
                        <th className="text-left p-3 text-slate-300">必需</th>
                        <th className="text-left p-3 text-slate-300">描述</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-600">
                      {operation.parameters.map((param, idx) => (
                        <tr key={idx}>
                          <td className="p-3 font-mono text-slate-300">{param.name}</td>
                          <td className="p-3 text-slate-400">{param.in}</td>
                          <td className="p-3 text-slate-400">{param.type || param.schema?.type}</td>
                          <td className="p-3">
                            {param.required ? (
                              <span className="text-red-400">是</span>
                            ) : (
                              <span className="text-slate-500">否</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-400">{param.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Responses */}
            {operation.responses && (
              <div>
                <h4 className="text-slate-300 font-medium mb-3">响应</h4>
                <div className="space-y-2">
                  {Object.entries(operation.responses).map(([code, response]) => (
                    <div key={code} className="bg-slate-700 rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <span className={`font-mono font-bold ${getStatusColor(code)}`}>
                          {code}
                        </span>
                        <span className="text-slate-300">{response.description}</span>
                      </div>
                      {response.schema && (
                        <div className="mt-2 bg-slate-800 rounded p-2">
                          <pre className="text-xs text-slate-400 font-mono">
                            {JSON.stringify(response.schema, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-2">⏳</div>
          <div>加载文档...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="text-center">
          <div className="text-4xl mb-2">❌</div>
          <div>加载失败</div>
          <div className="text-sm text-slate-600">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-slate-700 pb-2">
        <button
          onClick={() => setActiveTab('swagger')}
          className={`px-4 py-2 rounded-t text-sm font-medium transition-colors ${
            activeTab === 'swagger'
              ? 'bg-green-600 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
          }`}
        >
          Swagger UI
        </button>
        <button
          onClick={() => setActiveTab('openapi')}
          className={`px-4 py-2 rounded-t text-sm font-medium transition-colors ${
            activeTab === 'openapi'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
          }`}
        >
          OpenAPI YAML
        </button>
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {activeTab === 'swagger' ? renderSwaggerUI() : renderOpenApiView()}
      </div>

      {/* Detail Modal */}
      {selectedPath && renderPathDetail()}
    </div>
  )
}
