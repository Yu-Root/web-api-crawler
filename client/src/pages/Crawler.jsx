import { useState, useRef, useEffect } from 'react'
import RequestList from '../components/RequestList'
import RequestFilter from '../components/RequestFilter'
import RequestDetail from '../components/RequestDetail'
import ExportButton from '../components/ExportButton'

const API_BASE = '/api'

export default function Crawler() {
  const [url, setUrl] = useState('https://gushitong.baidu.com/')
  const [mode, setMode] = useState('anonymous')
  const [cookies, setCookies] = useState('')
  const [domainFilter, setDomainFilter] = useState('finance.pae.baidu.com')
  const [waitTime, setWaitTime] = useState(10)
  const [headless, setHeadless] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [requests, setRequests] = useState([])
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [filter, setFilter] = useState({
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    url: ''
  })
  const [error, setError] = useState(null)
  const [detailWidth, setDetailWidth] = useState(384)
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef(null)

  // Handle resize drag
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return
      const newWidth = window.innerWidth - e.clientX
      setDetailWidth(Math.min(Math.max(newWidth, 300), 800))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  const handleStartCrawl = async () => {
    if (!url) {
      setError('Please enter a URL')
      return
    }

    setIsLoading(true)
    setError(null)
    setRequests([])
    setSelectedRequest(null)

    try {
      const cookiesArray = mode === 'logged-in' && cookies
        ? cookies.split(';').map(c => {
            const [name, ...valueParts] = c.trim().split('=')
            return {
              name: name.trim(),
              value: valueParts.join('=').trim(),
              domain: '.baidu.com'
            }
          }).filter(c => c.name && c.value)
        : []

      const filters = {
        domains: domainFilter ? domainFilter.split(',').map(d => d.trim()).filter(d => d) : [],
        methods: []
      }

      const response = await fetch(`${API_BASE}/crawl/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url,
          mode,
          cookies: cookiesArray,
          filters,
          waitTime: waitTime * 1000,
          headless
        })
      })

      const data = await response.json()

      if (data.success) {
        setRequests(data.requests)
      } else {
        setError(data.error || 'Crawl failed')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStopCrawl = async () => {
    try {
      await fetch(`${API_BASE}/crawl/stop`, { method: 'POST' })
      setIsLoading(false)
    } catch (err) {
      console.error('Error stopping crawl:', err)
    }
  }

  const handleClear = () => {
    setRequests([])
    setSelectedRequest(null)
    setError(null)
  }

  const stats = {
    total: requests.length,
    get: requests.filter(r => r.method === 'GET').length,
    post: requests.filter(r => r.method === 'POST').length,
    put: requests.filter(r => r.method === 'PUT').length,
    delete: requests.filter(r => r.method === 'DELETE').length,
    success: requests.filter(r => r.status >= 200 && r.status < 300).length,
    pending: requests.filter(r => r.status === null).length
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🕷️</div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">API Crawler</h1>
              <p className="text-sm text-slate-400">Capture and analyze HTTP requests</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton requests={requests} />
          </div>
        </div>
      </header>

      {/* URL Input Section */}
      <div className="bg-slate-800/50 border-b border-slate-700 p-4">
        <div className="flex gap-3 mb-3">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter URL to crawl..."
            className="flex-1 bg-slate-700 border border-slate-600 rounded-md px-4 py-2 text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            disabled={isLoading}
          />
          {isLoading ? (
            <button
              onClick={handleStopCrawl}
              className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-md font-medium transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleStartCrawl}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-md font-medium transition-colors"
            >
              Start Crawl
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Mode Selection */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">Mode:</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded-md px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              disabled={isLoading}
            >
              <option value="anonymous">Anonymous</option>
              <option value="logged-in">Logged In (Cookie)</option>
            </select>
          </div>

          {/* Cookie Input */}
          {mode === 'logged-in' && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400">Cookies:</label>
              <input
                type="text"
                value={cookies}
                onChange={(e) => setCookies(e.target.value)}
                placeholder="BDUSS=xxx; other=yyy"
                className="bg-slate-700 border border-slate-600 rounded-md px-3 py-1.5 text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 w-64"
                disabled={isLoading}
              />
            </div>
          )}

          {/* Domain Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">Filter Domain:</label>
            <input
              type="text"
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              placeholder="domain.com"
              className="bg-slate-700 border border-slate-600 rounded-md px-3 py-1.5 text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 w-48"
              disabled={isLoading}
            />
          </div>

          {/* Wait Time */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">Wait (s):</label>
            <input
              type="number"
              value={waitTime}
              onChange={(e) => setWaitTime(parseInt(e.target.value) || 10)}
              min={5}
              max={60}
              className="bg-slate-700 border border-slate-600 rounded-md px-3 py-1.5 text-sm text-slate-200 w-20 focus:outline-none focus:border-blue-500"
              disabled={isLoading}
            />
          </div>

          {/* Headless Toggle */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">Headless:</label>
            <button
              onClick={() => setHeadless(!headless)}
              disabled={isLoading}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                headless
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {headless ? 'On' : 'Off'}
            </button>
          </div>

          <button
            onClick={handleClear}
            className="text-slate-400 hover:text-slate-200 text-sm"
          >
            Clear Results
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-3 bg-red-900/30 border border-red-700 rounded-md px-4 py-2 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="mt-3 flex items-center gap-2 text-blue-400">
            <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
            <span className="text-sm">Crawling in progress... (waiting {waitTime}s for requests)</span>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="bg-slate-900 border-b border-slate-700 px-4 py-2">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Total:</span>
            <span className="font-semibold text-slate-200">{stats.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-500">●</span>
            <span className="text-slate-400">GET:</span>
            <span className="font-semibold text-slate-200">{stats.get}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-blue-500">●</span>
            <span className="text-slate-400">POST:</span>
            <span className="font-semibold text-slate-200">{stats.post}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-500">●</span>
            <span className="text-slate-400">Success:</span>
            <span className="font-semibold text-green-500">{stats.success}</span>
          </div>
          {stats.pending > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-amber-500">●</span>
              <span className="text-slate-400">Pending:</span>
              <span className="font-semibold text-amber-500">{stats.pending}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Filter and List */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <RequestFilter
            requests={requests}
            filter={filter}
            setFilter={setFilter}
          />
          <RequestList
            requests={requests}
            filter={filter}
            onSelect={setSelectedRequest}
            selectedId={selectedRequest?.id}
          />
        </div>

        {/* Resize Handle */}
        <div
          ref={resizeRef}
          className={`w-1 bg-slate-700 hover:bg-blue-500 cursor-col-resize transition-colors ${
            isResizing ? 'bg-blue-500' : ''
          }`}
          onMouseDown={() => setIsResizing(true)}
        />

        {/* Right Panel - Detail */}
        <div style={{ width: detailWidth, minWidth: 300, maxWidth: 800 }}>
          <RequestDetail
            request={selectedRequest}
            onClose={() => setSelectedRequest(null)}
          />
        </div>
      </div>
    </div>
  )
}
