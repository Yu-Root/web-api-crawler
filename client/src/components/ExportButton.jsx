import { useState } from 'react'

export default function ExportButton({ requests }) {
  const [showMenu, setShowMenu] = useState(false)

  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const exportJSON = () => {
    const data = JSON.stringify(requests, null, 2)
    downloadFile(data, `api-requests-${Date.now()}.json`, 'application/json')
    setShowMenu(false)
  }

  const exportHTML = () => {
    const html = generateHTMLReport(requests)
    downloadFile(html, `api-report-${Date.now()}.html`, 'text/html')
    setShowMenu(false)
  }

  const generateHTMLReport = (requests) => {
    const getMethodStyle = (method) => {
      const colors = {
        GET: '#22c55e',
        POST: '#3b82f6',
        PUT: '#f59e0b',
        DELETE: '#ef4444',
        PATCH: '#8b5cf6'
      }
      return colors[method] || '#6b7280'
    }

    const getStatusStyle = (status) => {
      if (!status) return '#6b7280'
      if (status >= 200 && status < 300) return '#22c55e'
      if (status >= 300 && status < 400) return '#3b82f6'
      if (status >= 400 && status < 500) return '#f59e0b'
      if (status >= 500) return '#ef4444'
      return '#6b7280'
    }

    const rows = requests.map(req => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #374151;">
          <span style="background: ${getMethodStyle(req.method)}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">${req.method}</span>
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #374151; color: ${getStatusStyle(req.status)}; font-family: monospace;">${req.status || '...'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #374151; font-family: monospace; font-size: 12px; word-break: break-all;">${req.url}</td>
        <td style="padding: 8px; border-bottom: 1px solid #374151; color: #9ca3af; font-size: 12px;">${req.resourceType}</td>
      </tr>
    `).join('')

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>API Crawler Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #111827; color: #e5e7eb; padding: 20px; }
    h1 { color: #f9fafb; }
    table { width: 100%; border-collapse: collapse; background: #1f2937; border-radius: 8px; overflow: hidden; }
    th { background: #374151; padding: 12px; text-align: left; font-weight: 600; }
    .stats { display: flex; gap: 16px; margin-bottom: 20px; }
    .stat { background: #1f2937; padding: 12px 20px; border-radius: 8px; }
    .stat-value { font-size: 24px; font-weight: bold; }
    .stat-label { color: #9ca3af; font-size: 14px; }
  </style>
</head>
<body>
  <h1>API Crawler Report</h1>
  <div class="stats">
    <div class="stat">
      <div class="stat-value">${requests.length}</div>
      <div class="stat-label">Total Requests</div>
    </div>
    <div class="stat">
      <div class="stat-value">${requests.filter(r => r.method === 'GET').length}</div>
      <div class="stat-label">GET</div>
    </div>
    <div class="stat">
      <div class="stat-value">${requests.filter(r => r.method === 'POST').length}</div>
      <div class="stat-label">POST</div>
    </div>
    <div class="stat">
      <div class="stat-value">${requests.filter(r => r.status >= 200 && r.status < 300).length}</div>
      <div class="stat-label">Success</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Method</th>
        <th>Status</th>
        <th>URL</th>
        <th>Type</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
      >
        <span>📥</span>
        Export
      </button>
      {showMenu && (
        <div className="absolute right-0 mt-2 w-40 bg-slate-800 border border-slate-700 rounded-md shadow-lg z-10">
          <button
            onClick={exportJSON}
            className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 rounded-t-md"
          >
            📄 Export JSON
          </button>
          <button
            onClick={exportHTML}
            className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 rounded-b-md"
          >
            🌐 Export HTML
          </button>
        </div>
      )}
      {showMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  )
}
