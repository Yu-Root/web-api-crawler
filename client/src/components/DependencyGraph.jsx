import { useEffect, useRef, useState, useMemo } from 'react'
import * as echarts from 'echarts'

export default function DependencyGraph({ requests, analysis, onNodeClick }) {
  const chartRef = useRef(null)
  const chartInstance = useRef(null)
  const [viewMode, setViewMode] = useState('force')
  const [selectedNode, setSelectedNode] = useState(null)
  const [showLabels, setShowLabels] = useState(true)

  const graphData = useMemo(() => {
    if (!analysis || !analysis.graph) {
      return { nodes: [], edges: [] }
    }

    const nodes = analysis.graph.nodes.map(node => ({
      id: node.id,
      name: node.url.substring(0, 50) + '...',
      fullUrl: node.url,
      method: node.method,
      status: node.status,
      value: node.status >= 400 ? 2 : 1,
      category: node.group || 'default',
      symbolSize: node.status >= 400 ? 20 : 15,
      itemStyle: {
        color: getStatusColor(node.status)
      },
      label: {
        show: showLabels,
        formatter: `{b}\n{c}`,
        fontSize: 10
      }
    }))

    const edges = analysis.graph.edges.map(edge => ({
      source: edge.source,
      target: edge.target,
      value: edge.strength,
      lineStyle: {
        width: Math.max(1, edge.strength * 5),
        curveness: 0.2,
        opacity: 0.6
      },
      label: {
        show: false,
        formatter: `${(edge.strength * 100).toFixed(0)}%`
      }
    }))

    return { nodes, edges }
  }, [analysis, showLabels])

  const categories = useMemo(() => {
    if (!analysis || !analysis.graph || !analysis.graph.groups) return []
    
    const colors = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4']
    
    return analysis.graph.groups.map((group, index) => ({
      name: group.name,
      itemStyle: { color: colors[index % colors.length] }
    }))
  }, [analysis])

  useEffect(() => {
    if (!chartRef.current) return

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current)
      
      chartInstance.current.on('click', (params) => {
        if (params.dataType === 'node') {
          setSelectedNode(params.data)
          if (onNodeClick) {
            const request = requests.find(r => {
              const nodeId = generateNodeId(r)
              return nodeId === params.data.id
            })
            onNodeClick(request)
          }
        }
      })
    }

    const option = {
      title: {
        text: 'API 依赖关系图',
        subtext: `节点: ${graphData.nodes.length} | 边: ${graphData.edges.length}`,
        left: 'center',
        textStyle: { color: '#e2e8f0' },
        subtextStyle: { color: '#94a3b8' }
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        borderColor: '#475569',
        textStyle: { color: '#e2e8f0' },
        formatter: (params) => {
          if (params.dataType === 'node') {
            return `
              <div style="max-width: 300px;">
                <div style="font-weight: bold; margin-bottom: 4px;">${params.data.method} ${params.data.status || 'N/A'}</div>
                <div style="font-size: 12px; word-break: break-all; color: #94a3b8;">${params.data.fullUrl}</div>
                <div style="margin-top: 4px; font-size: 11px; color: #64748b;">分组: ${params.data.category}</div>
              </div>
            `
          } else {
            return `
              <div>
                <div style="font-weight: bold;">依赖强度</div>
                <div style="font-size: 12px; color: #94a3b8;">${(params.data.value * 100).toFixed(1)}%</div>
              </div>
            `
          }
        }
      },
      legend: {
        data: categories.map(c => c.name),
        bottom: 10,
        textStyle: { color: '#94a3b8' }
      },
      series: [
        {
          name: 'API Dependencies',
          type: 'graph',
          layout: viewMode,
          data: graphData.nodes,
          links: graphData.edges,
          categories: categories,
          roam: true,
          draggable: true,
          focusNodeAdjacency: true,
          itemStyle: {
            borderColor: '#fff',
            borderWidth: 1,
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.3)'
          },
          label: {
            show: showLabels,
            position: 'right',
            formatter: '{b}',
            color: '#e2e8f0',
            fontSize: 10
          },
          lineStyle: {
            color: 'source',
            curveness: 0.3
          },
          emphasis: {
            focus: 'adjacency',
            lineStyle: {
              width: 4
            }
          },
          force: {
            repulsion: 300,
            gravity: 0.1,
            edgeLength: [50, 200],
            layoutAnimation: true
          },
          circular: {
            rotateLabel: true
          },
          zoom: 0.8
        }
      ]
    }

    chartInstance.current.setOption(option)

    const handleResize = () => {
      chartInstance.current?.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [graphData, categories, viewMode, showLabels])

  const getStatusColor = (status) => {
    if (!status) return '#94a3b8'
    if (status >= 200 && status < 300) return '#22c55e'
    if (status >= 300 && status < 400) return '#3b82f6'
    if (status >= 400 && status < 500) return '#f59e0b'
    if (status >= 500) return '#ef4444'
    return '#94a3b8'
  }

  const generateNodeId = (request) => {
    const data = `${request.url}_${request.method}_${request.timestamp || Date.now()}`
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(16).substring(0, 12)
  }

  if (!analysis || !analysis.graph) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-500">
        <div className="text-center">
          <div className="text-4xl mb-2">🕸️</div>
          <div>暂无依赖分析数据</div>
          <div className="text-sm text-slate-600">请先进行爬虫分析</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between mb-4 gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">布局:</span>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm text-slate-200"
            >
              <option value="force">力导向图</option>
              <option value="circular">环形图</option>
              <option value="none">无布局</option>
            </select>
          </div>
          
          <label className="flex items-center gap-2 text-slate-300 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
              className="rounded border-slate-600"
            />
            显示标签
          </label>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span className="text-slate-400">2xx</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            <span className="text-slate-400">3xx</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            <span className="text-slate-400">4xx</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span className="text-slate-400">5xx</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div ref={chartRef} style={{ height: '500px' }} className="w-full" />

      {/* Stats */}
      {analysis.stats && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-700 rounded p-3">
            <div className="text-slate-400 text-xs">总节点</div>
            <div className="text-2xl font-bold text-slate-200">{analysis.stats.totalNodes}</div>
          </div>
          <div className="bg-slate-700 rounded p-3">
            <div className="text-slate-400 text-xs">依赖边</div>
            <div className="text-2xl font-bold text-slate-200">{analysis.stats.totalEdges}</div>
          </div>
          <div className="bg-slate-700 rounded p-3">
            <div className="text-slate-400 text-xs">平均度数</div>
            <div className="text-2xl font-bold text-slate-200">{analysis.stats.avgDegree}</div>
          </div>
          <div className="bg-slate-700 rounded p-3">
            <div className="text-slate-400 text-xs">循环依赖</div>
            <div className={`text-2xl font-bold ${analysis.stats.cycleCount > 0 ? 'text-red-400' : 'text-slate-200'}`}>
              {analysis.stats.cycleCount}
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {analysis.recommendations && analysis.recommendations.length > 0 && (
        <div className="mt-4">
          <h4 className="text-slate-300 font-medium mb-2">分析建议</h4>
          <div className="space-y-2">
            {analysis.recommendations.map((rec, idx) => (
              <div 
                key={idx}
                className={`p-3 rounded text-sm ${
                  rec.type === 'warning' ? 'bg-amber-900/30 border border-amber-700 text-amber-200' :
                  rec.type === 'critical' ? 'bg-red-900/30 border border-red-700 text-red-200' :
                  rec.type === 'performance' ? 'bg-blue-900/30 border border-blue-700 text-blue-200' :
                  'bg-slate-700 text-slate-300'
                }`}
              >
                <div className="font-medium mb-1">
                  {rec.type === 'warning' && '⚠️ '}
                  {rec.type === 'critical' && '🚨 '}
                  {rec.type === 'performance' && '⚡ '}
                  {rec.type === 'info' && 'ℹ️ '}
                  {rec.type === 'suggestion' && '💡 '}
                  {rec.message}
                </div>
                {rec.details && (
                  <div className="text-xs opacity-75 mt-1">
                    {JSON.stringify(rec.details)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Critical Path */}
      {analysis.criticalPath && analysis.criticalPath.path.length > 0 && (
        <div className="mt-4">
          <h4 className="text-slate-300 font-medium mb-2">
            关键路径 ({analysis.criticalPath.totalTime}ms)
          </h4>
          <div className="bg-slate-700 rounded p-3 overflow-x-auto">
            <div className="flex items-center gap-2 text-sm">
              {analysis.criticalPath.path.map((nodeId, idx) => (
                <>
                  <span key={nodeId} className="bg-slate-600 px-2 py-1 rounded text-slate-300 whitespace-nowrap">
                    {nodeId.substring(0, 8)}...
                  </span>
                  {idx < analysis.criticalPath.path.length - 1 && (
                    <span className="text-slate-500">→</span>
                  )}
                </>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
