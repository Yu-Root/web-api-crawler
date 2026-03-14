import { useState, useEffect, useRef } from 'react'

export default function DependencyGraph({ requests, onRequestSelect }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [graph, setGraph] = useState({ nodes: [], edges: [] })
  const [hoveredNode, setHoveredNode] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [layout, setLayout] = useState('force')

  useEffect(() => {
    if (!requests || requests.length === 0) return
    
    const nodes = requests.map((req, index) => ({
      id: req.id || `req_${index}`,
      url: req.url,
      method: req.method,
      status: req.status,
      timestamp: req.timestamp,
      resourceType: req.resourceType
    }))
    
    const edges = []
    const idMap = new Map()
    
    requests.forEach((req, index) => {
      try {
        const urlObj = new URL(req.url)
        urlObj.searchParams.forEach((value, key) => {
          if (value.length > 5 && /^[a-zA-Z0-9_-]+$/.test(value)) {
            if (!idMap.has(value)) {
              idMap.set(value, [])
            }
            idMap.get(value).push(req.id || `req_${index}`)
          }
        })
      } catch (e) {}
    })
    
    requests.forEach((req, index) => {
      if (req.response_body) {
        try {
          const body = typeof req.response_body === 'string' 
            ? JSON.parse(req.response_body) 
            : req.response_body
          
          const extractIds = (obj, depth = 0) => {
            if (depth > 3 || !obj) return
            if (Array.isArray(obj)) {
              obj.forEach(item => extractIds(item, depth + 1))
              return
            }
            if (typeof obj === 'object') {
              Object.entries(obj).forEach(([key, value]) => {
                if (typeof value === 'string' && value.length > 5) {
                  const matchingReqs = idMap.get(value)
                  if (matchingReqs) {
                    matchingReqs.forEach(targetId => {
                      const sourceId = req.id || `req_${index}`
                      if (targetId !== sourceId) {
                        const existingEdge = edges.find(e => 
                          e.source === sourceId && e.target === targetId
                        )
                        if (!existingEdge) {
                          edges.push({
                            source: sourceId,
                            target: targetId,
                            type: 'data'
                          })
                        }
                      }
                    })
                  }
                }
                extractIds(value, depth + 1)
              })
            }
          }
          
          extractIds(body)
        } catch (e) {}
      }
    })
    
    setGraph({ nodes, edges })
  }, [requests])

  useEffect(() => {
    drawGraph()
  }, [graph, zoom, pan, hoveredNode, selectedNode, layout])

  const drawGraph = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height
    
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(0, 0, width, height)
    
    if (graph.nodes.length === 0) {
      ctx.fillStyle = '#64748b'
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('No data to display', width / 2, height / 2)
      return
    }
    
    const nodePositions = calculateNodePositions()
    
    ctx.save()
    ctx.translate(pan.x, pan.y)
    ctx.scale(zoom, zoom)
    
    graph.edges.forEach(edge => {
      const source = nodePositions[edge.source]
      const target = nodePositions[edge.target]
      
      if (source && target) {
        ctx.beginPath()
        ctx.moveTo(source.x, source.y)
        ctx.lineTo(target.x, target.y)
        ctx.strokeStyle = edge.type === 'data' ? '#3b82f6' : '#64748b'
        ctx.lineWidth = 1.5
        ctx.stroke()
        
        const angle = Math.atan2(target.y - source.y, target.x - source.x)
        const arrowX = target.x - 15 * Math.cos(angle)
        const arrowY = target.y - 15 * Math.sin(angle)
        
        ctx.beginPath()
        ctx.moveTo(arrowX, arrowY)
        ctx.lineTo(
          arrowX - 8 * Math.cos(angle - Math.PI / 6),
          arrowY - 8 * Math.sin(angle - Math.PI / 6)
        )
        ctx.lineTo(
          arrowX - 8 * Math.cos(angle + Math.PI / 6),
          arrowY - 8 * Math.sin(angle + Math.PI / 6)
        )
        ctx.closePath()
        ctx.fillStyle = edge.type === 'data' ? '#3b82f6' : '#64748b'
        ctx.fill()
      }
    })
    
    graph.nodes.forEach(node => {
      const pos = nodePositions[node.id]
      if (!pos) return
      
      const isHovered = hoveredNode === node.id
      const isSelected = selectedNode === node.id
      const radius = isHovered || isSelected ? 12 : 8
      
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2)
      
      const methodColors = {
        GET: '#22c55e',
        POST: '#3b82f6',
        PUT: '#f59e0b',
        DELETE: '#ef4444',
        PATCH: '#a855f7'
      }
      
      ctx.fillStyle = methodColors[node.method] || '#64748b'
      ctx.fill()
      
      if (isHovered || isSelected) {
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.stroke()
      }
      
      if (isHovered) {
        ctx.fillStyle = '#f8fafc'
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        
        let displayUrl = node.url
        try {
          const urlObj = new URL(node.url)
          displayUrl = urlObj.pathname + urlObj.search
        } catch (e) {}
        
        const maxWidth = 200
        if (ctx.measureText(displayUrl).width > maxWidth) {
          displayUrl = displayUrl.substring(0, 30) + '...'
        }
        
        ctx.fillText(`${node.method} ${displayUrl}`, pos.x, pos.y - 20)
        ctx.fillText(`Status: ${node.status || 'pending'}`, pos.x, pos.y + 25)
      }
    })
    
    ctx.restore()
  }

  const calculateNodePositions = () => {
    const positions = {}
    const nodeCount = graph.nodes.length
    
    if (nodeCount === 0) return positions
    
    const canvas = canvasRef.current
    if (!canvas) return positions
    
    const width = canvas.width / zoom
    const height = canvas.height / zoom
    const centerX = width / 2
    const centerY = height / 2
    
    if (layout === 'circular') {
      const radius = Math.min(width, height) * 0.35
      graph.nodes.forEach((node, index) => {
        const angle = (2 * Math.PI * index) / nodeCount
        positions[node.id] = {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle)
        }
      })
    } else if (layout === 'tree') {
      const levels = new Map()
      const nodeDependencies = new Map()
      
      graph.nodes.forEach(node => {
        nodeDependencies.set(node.id, 0)
      })
      
      graph.edges.forEach(edge => {
        nodeDependencies.set(edge.target, (nodeDependencies.get(edge.target) || 0) + 1)
      })
      
      graph.nodes.forEach(node => {
        const deps = nodeDependencies.get(node.id) || 0
        if (!levels.has(deps)) {
          levels.set(deps, [])
        }
        levels.get(deps).push(node)
      })
      
      const maxLevel = Math.max(...levels.keys())
      const levelHeight = height / (maxLevel + 1)
      
      levels.forEach((nodes, level) => {
        const levelWidth = width / (nodes.length + 1)
        nodes.forEach((node, index) => {
          positions[node.id] = {
            x: levelWidth * (index + 1),
            y: levelHeight * (level + 0.5)
          }
        })
      })
    } else {
      const nodePositions = new Map()
      const nodeVelocities = new Map()
      
      graph.nodes.forEach(node => {
        nodePositions.set(node.id, {
          x: centerX + (Math.random() - 0.5) * width * 0.5,
          y: centerY + (Math.random() - 0.5) * height * 0.5
        })
        nodeVelocities.set(node.id, { x: 0, y: 0 })
      })
      
      for (let iter = 0; iter < 50; iter++) {
        graph.nodes.forEach(node => {
          const pos = nodePositions.get(node.id)
          const vel = nodeVelocities.get(node.id)
          
          vel.x *= 0.9
          vel.y *= 0.9
          
          graph.nodes.forEach(other => {
            if (node.id === other.id) return
            const otherPos = nodePositions.get(other.id)
            const dx = pos.x - otherPos.x
            const dy = pos.y - otherPos.y
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            const force = 1000 / (dist * dist)
            
            vel.x += (dx / dist) * force
            vel.y += (dy / dist) * force
          })
          
          graph.edges.forEach(edge => {
            if (edge.source === node.id || edge.target === node.id) {
              const otherId = edge.source === node.id ? edge.target : edge.source
              const otherPos = nodePositions.get(otherId)
              const dx = otherPos.x - pos.x
              const dy = otherPos.y - pos.y
              const dist = Math.sqrt(dx * dx + dy * dy) || 1
              
              vel.x += dx * 0.01
              vel.y += dy * 0.01
            }
          })
          
          vel.x += (centerX - pos.x) * 0.001
          vel.y += (centerY - pos.y) * 0.001
        })
        
        graph.nodes.forEach(node => {
          const pos = nodePositions.get(node.id)
          const vel = nodeVelocities.get(node.id)
          pos.x += vel.x
          pos.y += vel.y
        })
      }
      
      graph.nodes.forEach(node => {
        positions[node.id] = nodePositions.get(node.id)
      })
    }
    
    return positions
  }

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left - pan.x) / zoom
    const y = (e.clientY - rect.top - pan.y) / zoom
    
    const nodePositions = calculateNodePositions()
    let foundNode = null
    
    for (const [id, pos] of Object.entries(nodePositions)) {
      const dx = x - pos.x
      const dy = y - pos.y
      if (Math.sqrt(dx * dx + dy * dy) < 15) {
        foundNode = id
        break
      }
    }
    
    setHoveredNode(foundNode)
    
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseDown = (e) => {
    setIsDragging(true)
    setDragStart({
      x: e.clientX - pan.x,
      y: e.clientY - pan.y
    })
  }

  const handleMouseUp = (e) => {
    setIsDragging(false)
    
    if (hoveredNode) {
      setSelectedNode(hoveredNode)
      if (onRequestSelect) {
        const node = graph.nodes.find(n => n.id === hoveredNode)
        if (node) {
          const request = requests.find(r => (r.id || `req_${requests.indexOf(r)}`) === node.id)
          if (request) {
            onRequestSelect(request)
          }
        }
      }
    }
  }

  const handleWheel = (e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(prev => Math.min(Math.max(prev * delta, 0.3), 3))
  }

  const handleResize = () => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (canvas && container) {
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
      drawGraph()
    }
  }

  useEffect(() => {
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const stats = {
    total: graph.nodes.length,
    connections: graph.edges.length,
    avgConnections: graph.nodes.length > 0 
      ? (graph.edges.length * 2 / graph.nodes.length).toFixed(1)
      : 0
  }

  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        <div className="flex items-center gap-4">
          <h3 className="text-slate-200 font-medium">Dependency Graph</h3>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>Nodes: {stats.total}</span>
            <span>•</span>
            <span>Edges: {stats.connections}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={layout}
            onChange={(e) => setLayout(e.target.value)}
            className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200"
          >
            <option value="force">Force Layout</option>
            <option value="circular">Circular</option>
            <option value="tree">Tree</option>
          </select>
          <button
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-300"
          >
            Reset
          </button>
        </div>
      </div>
      
      <div ref={containerRef} className="relative" style={{ height: '400px' }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-move"
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { setHoveredNode(null); setIsDragging(false) }}
          onWheel={handleWheel}
        />
        
        <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-slate-900/80 rounded px-2 py-1">
          <button
            onClick={() => setZoom(prev => Math.min(prev * 1.2, 3))}
            className="text-slate-400 hover:text-slate-200 px-1"
          >
            +
          </button>
          <span className="text-sm text-slate-400">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(prev => Math.max(prev * 0.8, 0.3))}
            className="text-slate-400 hover:text-slate-200 px-1"
          >
            −
          </button>
        </div>
      </div>
      
      <div className="flex items-center gap-4 p-3 border-t border-slate-700 text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span>GET</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span>POST</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
          <span>PUT</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span>DELETE</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-purple-500"></div>
          <span>PATCH</span>
        </div>
        <div className="ml-auto">
          <span className="text-slate-400">Click node to select • Drag to pan • Scroll to zoom</span>
        </div>
      </div>
    </div>
  )
}
