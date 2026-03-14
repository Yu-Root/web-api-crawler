export default function NavBar({ currentPage, onNavigate }) {
  return (
    <header className="bg-slate-800 border-b border-slate-700">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="text-2xl">🕷️</div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">API Crawler</h1>
            <p className="text-sm text-slate-400">Capture and analyze HTTP requests</p>
          </div>
        </div>
        <nav className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('crawler')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              currentPage === 'crawler'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            🕷️ Crawler
          </button>
          <button
            onClick={() => onNavigate('analyzer')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              currentPage === 'analyzer'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            📊 Analyzer
          </button>
          <button
            onClick={() => onNavigate('dependencies')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              currentPage === 'dependencies'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            🕸️ Dependencies
          </button>
          <button
            onClick={() => onNavigate('performance')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              currentPage === 'performance'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            📈 Performance
          </button>
          <button
            onClick={() => onNavigate('apidocs')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              currentPage === 'apidocs'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            📄 API Docs
          </button>
        </nav>
      </div>
    </header>
  )
}
