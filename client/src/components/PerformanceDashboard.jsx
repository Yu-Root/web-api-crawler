import { useEffect, useRef, useState, useMemo } from 'react'
import * as echarts from 'echarts'

export default function PerformanceDashboard({ stats, health, alerts, report }) {
  const timelineChartRef = useRef(null)
  const distributionChartRef = useRef(null)
  const methodChartRef = useRef(null)
  
  const timelineChart = useRef(null)
  const distributionChart = useRef(null)
  const methodChart = useRef(null)

  const [timeRange, setTimeRange] = useState('5m')
  const [activeTab, setActiveTab] = useState('overview')

  const currentStats = useMemo(() => {
    return stats || {
      totalRequests: 0,
      totalErrors: 0,
      errorRate: '0%',
      avgResponseTime: 0,
      requestsPerMinute: 0,
      uniqueUrls: 0,
      timeline: []
    }
  }, [stats])

  useEffect(() => {
    if (!timelineChartRef.current || !currentStats.timeline) return

    if (!timelineChart.current) {
      timelineChart.current = echarts.init(timelineChartRef.current)
    }

    const timelineOption = {
      title: {
        text: '请求趋势',
        left: 'center',
        textStyle: { color: '#e2e8f0', fontSize: 14 }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        borderColor: '#475569',
        textStyle: { color: '#e2e8f0' },
        axisPointer: {
          type: 'cross',
          crossStyle: { color: '#64748b' }
        }
      },
      legend: {
        data: ['请求数', '错误数', '平均响应时间'],
        bottom: 0,
        textStyle: { color: '#94a3b8' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: currentStats.timeline.map(t => {
          const date = new Date(t.timestamp)
          return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`
        }),
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8' }
      },
      yAxis: [
        {
          type: 'value',
          name: '数量',
          position: 'left',
          axisLine: { lineStyle: { color: '#475569' } },
          axisLabel: { color: '#94a3b8' },
          splitLine: { lineStyle: { color: '#334155' } }
        },
        {
          type: 'value',
          name: '响应时间(ms)',
          position: 'right',
          axisLine: { lineStyle: { color: '#475569' } },
          axisLabel: { color: '#94a3b8' },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: '请求数',
          type: 'bar',
          data: currentStats.timeline.map(t => t.count),
          itemStyle: { color: '#3b82f6' }
        },
        {
          name: '错误数',
          type: 'bar',
          data: currentStats.timeline.map(t => t.errors),
          itemStyle: { color: '#ef4444' }
        },
        {
          name: '平均响应时间',
          type: 'line',
          yAxisIndex: 1,
          data: currentStats.timeline.map(t => t.avgResponseTime),
          smooth: true,
          itemStyle: { color: '#10b981' },
          lineStyle: { width: 3 }
        }
      ]
    }

    timelineChart.current.setOption(timelineOption)

    return () => {
      timelineChart.current?.dispose()
      timelineChart.current = null
    }
  }, [currentStats.timeline])

  useEffect(() => {
    if (!distributionChartRef.current || !currentStats.statusCodes) return

    if (!distributionChart.current) {
      distributionChart.current = echarts.init(distributionChartRef.current)
    }

    const statusData = Object.entries(currentStats.statusCodes).map(([code, count]) => ({
      name: code,
      value: count
    }))

    const distributionOption = {
      title: {
        text: '状态码分布',
        left: 'center',
        textStyle: { color: '#e2e8f0', fontSize: 14 }
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        borderColor: '#475569',
        textStyle: { color: '#e2e8f0' },
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        textStyle: { color: '#94a3b8' }
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['40%', '50%'],
          data: statusData,
          itemStyle: {
            borderRadius: 5,
            borderColor: '#1e293b',
            borderWidth: 2
          },
          label: {
            color: '#94a3b8'
          }
        }
      ]
    }

    distributionChart.current.setOption(distributionOption)

    return () => {
      distributionChart.current?.dispose()
      distributionChart.current = null
    }
  }, [currentStats.statusCodes])

  useEffect(() => {
    if (!methodChartRef.current || !currentStats.methods) return

    if (!methodChart.current) {
      methodChart.current = echarts.init(methodChartRef.current)
    }

    const methodData = Object.entries(currentStats.methods)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)

    const methodOption = {
      title: {
        text: 'HTTP 方法分布',
        left: 'center',
        textStyle: { color: '#e2e8f0', fontSize: 14 }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        borderColor: '#475569',
        textStyle: { color: '#e2e8f0' },
        axisPointer: { type: 'shadow' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: methodData.map(([method]) => method),
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8' }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8' },
        splitLine: { lineStyle: { color: '#334155' } }
      },
      series: [
        {
          type: 'bar',
          data: methodData.map(([, count]) => count),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#8b5cf6' },
              { offset: 1, color: '#6366f1' }
            ])
          }
        }
      ]
    }

    methodChart.current.setOption(methodOption)

    return () => {
      methodChart.current?.dispose()
      methodChart.current = null
    }
  }, [currentStats.methods])

  const getHealthStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'bg-green-500'
      case 'warning': return 'bg-amber-500'
      case 'critical': return 'bg-red-500'
      default: return 'bg-slate-500'
    }
  }

  const getHealthStatusText = (status) => {
    switch (status) {
      case 'healthy': return '健康'
      case 'warning': return '警告'
      case 'critical': return '严重'
      default: return '未知'
    }
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-500'
      case 'warning': return 'bg-amber-500'
      case 'info': return 'bg-blue-500'
      default: return 'bg-slate-500'
    }
  }

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-slate-200">性能监控仪表盘</h3>
          {health && (
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${getHealthStatusColor(health.status)}`}></span>
              <span className="text-slate-300">{getHealthStatusText(health.status)}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">时间范围:</span>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm text-slate-200"
          >
            <option value="1m">1分钟</option>
            <option value="5m">5分钟</option>
            <option value="15m">15分钟</option>
            <option value="1h">1小时</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-slate-700 pb-2">
        {[
          { id: 'overview', label: '概览' },
          { id: 'charts', label: '图表' },
          { id: 'alerts', label: `告警 (${alerts?.length || 0})` },
          { id: 'details', label: '详情' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-t text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="text-slate-400 text-sm mb-1">总请求数</div>
            <div className="text-3xl font-bold text-slate-200">{currentStats.totalRequests.toLocaleString()}</div>
            <div className="text-xs text-slate-500 mt-1">
              {currentStats.requestsPerMinute.toFixed(1)} req/min
            </div>
          </div>
          
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="text-slate-400 text-sm mb-1">错误率</div>
            <div className={`text-3xl font-bold ${parseFloat(currentStats.errorRate) > 5 ? 'text-red-400' : 'text-slate-200'}`}>
              {currentStats.errorRate}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {currentStats.totalErrors} 个错误
            </div>
          </div>
          
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="text-slate-400 text-sm mb-1">平均响应时间</div>
            <div className={`text-3xl font-bold ${currentStats.avgResponseTime > 1000 ? 'text-amber-400' : 'text-slate-200'}`}>
              {currentStats.avgResponseTime}ms
            </div>
            <div className="text-xs text-slate-500 mt-1">
              目标: &lt; 500ms
            </div>
          </div>
          
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="text-slate-400 text-sm mb-1">唯一URL</div>
            <div className="text-3xl font-bold text-slate-200">{currentStats.uniqueUrls}</div>
            <div className="text-xs text-slate-500 mt-1">
              不同端点
            </div>
          </div>

          {health?.issues && health.issues.length > 0 && (
            <div className="col-span-2 md:col-span-4 mt-4">
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
                <h4 className="text-red-200 font-medium mb-2">检测到的问题</h4>
                <ul className="space-y-1">
                  {health.issues.map((issue, idx) => (
                    <li key={idx} className="text-red-300 text-sm flex items-center gap-2">
                      <span>⚠️</span>
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts Tab */}
      {activeTab === 'charts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-700 rounded-lg p-4">
            <div ref={timelineChartRef} style={{ height: '300px' }} />
          </div>
          <div className="bg-slate-700 rounded-lg p-4">
            <div ref={distributionChartRef} style={{ height: '300px' }} />
          </div>
          <div className="bg-slate-700 rounded-lg p-4 lg:col-span-2">
            <div ref={methodChartRef} style={{ height: '250px' }} />
          </div>
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div className="space-y-2">
          {alerts && alerts.length > 0 ? (
            alerts.map((alert, idx) => (
              <div
                key={idx}
                className="bg-slate-700 rounded-lg p-4 flex items-start gap-3"
              >
                <span className={`w-2 h-2 rounded-full mt-2 ${getSeverityColor(alert.severity)}`}></span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-200">{alert.ruleName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${getSeverityColor(alert.severity)} text-white`}>
                      {alert.severity}
                    </span>
                  </div>
                  <div className="text-slate-400 text-sm mt-1">{alert.message}</div>
                  <div className="text-slate-500 text-xs mt-2">
                    {new Date(alert.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-slate-500">
              <div className="text-4xl mb-2">✅</div>
              <div>暂无告警</div>
              <div className="text-sm text-slate-600">系统运行正常</div>
            </div>
          )}
        </div>
      )}

      {/* Details Tab */}
      {activeTab === 'details' && report && (
        <div className="space-y-4">
          {report.topUrls && report.topUrls.length > 0 && (
            <div className="bg-slate-700 rounded-lg p-4">
              <h4 className="text-slate-300 font-medium mb-3">最频繁请求的URL</h4>
              <div className="space-y-2">
                {report.topUrls.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 truncate flex-1 mr-4">{item.url}</span>
                    <span className="text-slate-300 font-mono">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.slowestRequests && report.slowestRequests.length > 0 && (
            <div className="bg-slate-700 rounded-lg p-4">
              <h4 className="text-slate-300 font-medium mb-3">最慢的请求</h4>
              <div className="space-y-2">
                {report.slowestRequests.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 truncate flex-1 mr-4">{item.url}</span>
                    <span className={`font-mono ${item.responseTime > 3000 ? 'text-red-400' : 'text-amber-400'}`}>
                      {item.responseTime}ms
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.errorBreakdown && (
            <div className="bg-slate-700 rounded-lg p-4">
              <h4 className="text-slate-300 font-medium mb-3">错误分析</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-slate-500 text-xs mb-2">按状态码</div>
                  {Object.entries(report.errorBreakdown.byStatus || {}).map(([code, count]) => (
                    <div key={code} className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">{code}</span>
                      <span className="text-red-400 font-mono">{count}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-slate-500 text-xs mb-2">按URL</div>
                  {Object.entries(report.errorBreakdown.byUrl || {}).slice(0, 5).map(([url, count]) => (
                    <div key={url} className="flex items-center justify-between text-sm">
                      <span className="text-slate-400 truncate max-w-[150px]">{url}</span>
                      <span className="text-red-400 font-mono">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
