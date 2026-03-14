import { useState, useEffect } from 'react'

const API_BASE = '/api'

export default function ApiDocViewer({ moduleId, onClose }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [openApiSpec, setOpenApiSpec] = useState(null)
  const [selectedEndpoint, setSelectedEndpoint] = useState(null)
  const [viewMode, setViewMode] = useState('ui')

  useEffect(() => {
    fetchApiDoc()
  }, [moduleId])

  const fetchApiDoc = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/modules/apidoc?id=${moduleId}`)
      const data = await response.json()
      if (data.success) {
        setOpenApiSpec(data.openApi)
      } else {
        setError(data.error || 'Failed to load API documentation')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getMethodColor = (method) => {
    const colors = {
      get: 'bg-green-600',
      post: 'bg-blue-600',
      put: 'bg-amber-600',
      delete: 'bg-red-600',
      patch: 'bg-purple-600'
    }
    return colors[method.toLowerCase()] || 'bg-gray-600'
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-slate-800 rounded-lg p-8">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <div className="text-slate-400 mt-4">Generating API documentation...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-slate-800 rounded-lg p-8 max-w-md">
          <div className="text-red-400 mb-4">Error: {error}</div>
          <div className="flex gap-2">
            <button
              onClick={fetchApiDoc}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-md text-white"
            >
              Retry
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md text-slate-200"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  const endpoints = []
  if (openApiSpec?.paths) {
    for (const [path, methods] of Object.entries(openApiSpec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        endpoints.push({ path, method, operation })
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div>
            <h2 className="text-xl font-semibold text-slate-200">
              {openApiSpec?.info?.title || 'API Documentation'}
            </h2>
            <p className="text-sm text-slate-400">{openApiSpec?.info?.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-800 rounded-md p-1">
              <button
                onClick={() => setViewMode('ui')}
                className={`px-3 py-1 rounded text-sm ${
                  viewMode === 'ui' ? 'bg-blue-600 text-white' : 'text-slate-400'
                }`}
              >
                UI
              </button>
              <button
                onClick={() => setViewMode('json')}
                className={`px-3 py-1 rounded text-sm ${
                  viewMode === 'json' ? 'bg-blue-600 text-white' : 'text-slate-400'
                }`}
              >
                JSON
              </button>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {viewMode === 'ui' ? (
            <>
              <div className="w-80 border-r border-slate-700 overflow-y-auto">
                <div className="p-2">
                  <div className="text-xs text-slate-500 uppercase tracking-wide px-2 mb-2">
                    Endpoints ({endpoints.length})
                  </div>
                  {endpoints.map((ep, idx) => (
                    <button
                      key={`${ep.method}-${ep.path}-${idx}`}
                      onClick={() => setSelectedEndpoint(ep)}
                      className={`w-full text-left px-3 py-2 rounded mb-1 transition-colors ${
                        selectedEndpoint === ep
                          ? 'bg-blue-600/30 border border-blue-500'
                          : 'hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`${getMethodColor(ep.method)} text-white text-xs font-bold px-2 py-0.5 rounded`}>
                          {ep.method.toUpperCase()}
                        </span>
                        <span className="font-mono text-sm text-slate-300 truncate">
                          {ep.path}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {selectedEndpoint ? (
                  <EndpointDetail endpoint={selectedEndpoint} baseUrl={openApiSpec?.servers?.[0]?.url} />
                ) : (
                  <div className="text-slate-500 text-center py-8">
                    Select an endpoint to view details
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-4">
              <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap">
                {JSON.stringify(openApiSpec, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EndpointDetail({ endpoint, baseUrl }) {
  const { path, method, operation } = endpoint

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className={`bg-green-600 text-white text-sm font-bold px-3 py-1 rounded`}>
          {method.toUpperCase()}
        </span>
        <code className="text-lg font-mono text-slate-200">{path}</code>
      </div>

      {operation.summary && (
        <div className="mb-4">
          <h3 className="text-slate-400 text-sm mb-1">Summary</h3>
          <p className="text-slate-200">{operation.summary}</p>
        </div>
      )}

      {operation.description && (
        <div className="mb-4">
          <h3 className="text-slate-400 text-sm mb-1">Description</h3>
          <p className="text-slate-300">{operation.description}</p>
        </div>
      )}

      {baseUrl && (
        <div className="mb-4">
          <h3 className="text-slate-400 text-sm mb-1">Base URL</h3>
          <code className="text-sm text-blue-400">{baseUrl}</code>
        </div>
      )}

      {operation.parameters && operation.parameters.length > 0 && (
        <div className="mb-4">
          <h3 className="text-slate-400 text-sm mb-2">Parameters</h3>
          <div className="bg-slate-800 rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-700">
                <tr>
                  <th className="text-left p-2 text-slate-300">Name</th>
                  <th className="text-left p-2 text-slate-300">In</th>
                  <th className="text-left p-2 text-slate-300">Type</th>
                  <th className="text-left p-2 text-slate-300">Example</th>
                </tr>
              </thead>
              <tbody>
                {operation.parameters.map((param, idx) => (
                  <tr key={idx} className="border-t border-slate-700">
                    <td className="p-2 font-mono text-blue-400">{param.name}</td>
                    <td className="p-2 text-slate-400">{param.in}</td>
                    <td className="p-2 text-slate-400">{param.schema?.type || 'string'}</td>
                    <td className="p-2 font-mono text-slate-300">{param.example || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {operation.requestBody && (
        <div className="mb-4">
          <h3 className="text-slate-400 text-sm mb-2">Request Body</h3>
          <div className="bg-slate-800 rounded-md p-3">
            <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(operation.requestBody.content?.['application/json']?.example || operation.requestBody, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {operation.responses && (
        <div className="mb-4">
          <h3 className="text-slate-400 text-sm mb-2">Responses</h3>
          <div className="space-y-2">
            {Object.entries(operation.responses).map(([code, response]) => (
              <div key={code} className="bg-slate-800 rounded-md p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-sm font-medium ${
                    code.startsWith('2') ? 'bg-green-600/30 text-green-400' :
                    code.startsWith('3') ? 'bg-blue-600/30 text-blue-400' :
                    code.startsWith('4') ? 'bg-amber-600/30 text-amber-400' :
                    'bg-red-600/30 text-red-400'
                  }`}>
                    {code}
                  </span>
                  <span className="text-slate-300">{response.description}</span>
                </div>
                {response.content?.['application/json']?.example && (
                  <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap overflow-x-auto bg-slate-900 rounded p-2">
                    {JSON.stringify(response.content['application/json'].example, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
