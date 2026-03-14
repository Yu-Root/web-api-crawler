import { useState, useEffect, useRef } from 'react'

const getNodeColor = (type) => {
  const colors = {
    page: '#3B82F6',
    api: '#10B981',
    xhr: '#8B5CF6',
    other: '#6B7280'
  }
  return colors[type] || colors.other
}

const getNodeLabel = (url) => {
  try {
    const urlObj = new URL(url)
    let label = urlObj.pathname
    if (label === '/') label = urlObj.hostname
    return label.length > 30 ? label.substring(0, 27) + '...' : label
  } catch {
    return url.length > 30 ? url.substring(0, 27) + '...' : url
  }
}

export default function DependencyGraph({ requests, onNodeClick }) {
  const canvasRef = useRef(null)
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [selectedNode, setSelectedNode] = useState(null)
  const [hoveredNode, setHoveredNode] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (requests && requests.length > 0) {
      buildGraphData()
    }
  }, [requests])

  useEffect(() => {
    if (graphData.nodes.length > 0) {
      drawGraph()
    }
  }, [graphData, selectedNode, hoveredNode])

  const buildGraphData = () => {
    const nodes = []
    const links = []
    const nodeMap = new Map()

    requests.forEach((req, index) => {
      const nodeId = req.id?.toString() || `node_${index}`
      const urlStr = req.url || ''
      const method = req.method || 'GET'
      
      let nodeType = 'other'
      if (req.resourceType === 'document' || req.resource_type === 'document') {
        nodeType = 'page'
      } else if (urlStr.includes('/api/') || urlStr.includes('/v1/') || urlStr.includes('/v2/')) {
        nodeType = 'api'
      } else if (req.resourceType === 'xhr' || req.resource_type === 'fetch') {
        nodeType = 'xhr'
      }

      const deps = req.dependencies || []
      const dpds = req.dependents || []

      const node = {
        id: nodeId,
        originalId: req.id,
        x: 0,
        y: 0,
        url: urlStr,
        method: method,
        type: nodeType,
        status: req.status,
        dependencies: deps,
        dependents: dpds,
        radius: 25 + Math.min(deps.length + dpds.length, 10) * 2,
        request: req
      }
      
      nodes.push(node)
      nodeMap.set(nodeId, node)
    })

    const centerX = 400
    const centerY = 300
    const radiusStep = 100

    const sortedNodes = [...nodes].sort((a, b) => 
      (b.dependencies?.length || 0) + (b.dependents?.length || 0) - 
      ((a.dependencies?.length || 0) + (a.dependents?.length || 0))
    )

    const levels = {}
    sortedNodes.forEach((node, idx) => {
      const level = Math.min(Math.floor(idx / 5), 3)
      if (!levels[level]) levels[level] = []
      levels[level].push(node)
    })

    Object.keys(levels).forEach((level, levelIdx) => {
      const levelNodes = levels[level]
      const angleStep = (2 * Math.PI) / Math.max(levelNodes.length, 1)
      const r = 100 + levelIdx * 80

      levelNodes.forEach((node, idx) => {
        const angle = idx * angleStep
        node.x = centerX + r * Math.cos(angle)
        node.y = centerY + r * Math.sin(angle)
      })
    })

    requests.forEach((req, reqIndex) => {
      const sourceId = req.id?.toString() || `node_${reqIndex}`
      const sourceNode = nodeMap.get(sourceId)
      
      if (sourceNode && req.dependencies) {
        req.dependencies.forEach(dep => {
          const targetId = dep.id?.toString()
          if (targetId && nodeMap.has(targetId)) {
            links.push({
              source: sourceNode,
              target: nodeMap.get(targetId),
              type: dep.type || 'unknown'
            })
          }
        })
      }
    })

    setGraphData({ nodes, links })
  }

  const drawGraph = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.save()
    ctx.translate(canvas.width / 2 - 400, canvas.height / 2 - 300)

    graphData.links.forEach(link => {
      const isHighlighted = selectedNode && 
        (link.source.id === selectedNode.id || link.target.id === selectedNode.id)
      
      ctx.beginPath()
      ctx.moveTo(link.source.x, link.source.y)
      ctx.lineTo(link.target.x, link.target.y)
      
      if (isHighlighted) {
        ctx.strokeStyle = '#F59E0B'
        ctx.lineWidth = 3
      } else {
        ctx.strokeStyle = '#4B5563'
        ctx.lineWidth = 1
      }
      
      ctx.stroke()

      const angle = Math.atan2(link.target.y - link.source.y, link.target.x - link.source.x)
      const arrowLength = 10
      const arrowWidth = 5
      
      ctx.beginPath()
      ctx.moveTo(
        link.target.x - arrowLength * Math.cos(angle),
        link.target.y - arrowLength * Math.sin(angle)
      )
      ctx.lineTo(
        link.target.x - arrowLength * Math.cos(angle) + arrowWidth * Math.sin(angle),
        link.target.y - arrowLength * Math.sin(angle) - arrowWidth * Math.cos(angle)
      )
      ctx.lineTo(
        link.target.x - arrowLength * Math.cos(angle) - arrowWidth * Math.sin(angle),
        link.target.y - arrowLength * Math.sin(angle) + arrowWidth * Math.cos(angle)
      )
      ctx.closePath()
      ctx.fillStyle = isHighlighted ? '#F59E0B' : '#4B5563'
      ctx.fill()
    })

    graphData.nodes.forEach(node => {
      const isSelected = selectedNode && node.id === selectedNode.id
      const isHovered = hoveredNode && node.id === hoveredNode.id
      
      ctx.beginPath()
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
      
      const gradient = ctx.createRadialGradient(
        node.x, node.y, 0,
        node.x, node.y, node.radius
      )
      const baseColor = getNodeColor(node.type)
      gradient.addColorStop(0, isSelected || isHovered ? '#FFFFFF' : baseColor)
      gradient.addColorStop(1, baseColor)
      
      ctx.fillStyle = gradient
      ctx.fill()
      
      if (isSelected) {
        ctx.strokeStyle = '#F59E0B'
        ctx.lineWidth = 3
      } else if (isHovered) {
        ctx.strokeStyle = '#60A5FA'
        ctx.lineWidth = 2
      } else {
        ctx.strokeStyle = '#1F2937'
        ctx.lineWidth = 1
      }
      ctx.stroke()

      ctx.font = 'bold 10px sans-serif'
      ctx.fillStyle = '#FFFFFF'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(node.method, node.x, node.y - 5)

      ctx.font = '8px sans-serif'
      ctx.fillText(getNodeLabel(node.url), node.x, node.y + 8)

      const depCount = (node.dependencies?.length || 0) + (node.dependents?.length || 0)
      if (depCount > 0) {
        ctx.beginPath()
        ctx.arc(node.x + node.radius - 8, node.y - node.radius + 8, 8, 0, Math.PI * 2)
        ctx.fillStyle = '#EF4444'
        ctx.fill()
        ctx.font = 'bold 9px sans-serif'
        ctx.fillStyle = '#FFFFFF'
        ctx.fillText(depCount.toString(), node.x + node.radius - 8, node.y - node.radius + 8)
      }
    })

    ctx.restore()
  }

  const getNodeAtPosition = (x, y) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const offsetX = canvas.width / 2 - 400
    const offsetY = canvas.height / 2 - 300
    
    const canvasX = x - rect.left - offsetX
    const canvasY = y - rect.top - offsetY

    for (const node of graphData.nodes) {
      const dx = node.x - canvasX
      const dy = node.y - canvasY
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance <= node.radius) {
        return node
      }
    }
    return null
  }

  const handleMouseMove = (e) => {
    const node = getNodeAtPosition(e.clientX, e.clientY)
    setHoveredNode(node)
    
    if (isDragging && selectedNode) {
      const canvas = canvasRef.current
      if (!canvas) return
      
      const rect = canvas.getBoundingClientRect()
      const offsetX = canvas.width / 2 - 400
      const offsetY = canvas.height / 2 - 300
      
      selectedNode.x = e.clientX - rect.left - offsetX - dragOffset.x
      selectedNode.y = e.clientY - rect.top - offsetY - dragOffset.y
      
      drawGraph()
    }
  }

  const handleMouseDown = (e) => {
    const node = getNodeAtPosition(e.clientX, e.clientY)
    if (node) {
      setSelectedNode(node)
      setIsDragging(true)
      
      const canvas = canvasRef.current
      const rect = canvas.getBoundingClientRect()
      const offsetX = canvas.width / 2 - 400
      const offsetY = canvas.height / 2 - 300
      
      setDragOffset({
        x: e.clientX - rect.left - offsetX - node.x,
        y: e.clientY - rect.top - offsetY - node.y
      })
      
      if (onNodeClick) {
        onNodeClick(node.request)
      }
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleMouseLeave = () => {
    setIsDragging(false)
    setHoveredNode(null)
  }

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 rounded-lg overflow-hidden">
      <div className="p-3 bg-slate-800 border-b border-slate-700">
        <h3 className="text-white font-medium">Request Dependency Graph</h3>
        <div className="flex gap-4 mt-2 text-xs text-slate-400">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            <span>Page</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span>API</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-purple-500"></span>
            <span>XHR</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-gray-500"></span>
            <span>Other</span>
          </div>
        </div>
      </div>
      
      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="w-full h-full cursor-pointer"
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />
        
        {hoveredNode && (
          <div className="absolute bottom-4 left-4 bg-slate-800 text-white p-2 rounded shadow-lg text-xs max-w-md">
            <div className="font-bold">{hoveredNode.method}: {hoveredNode.url}</div>
            <div className="text-slate-400">Dependencies: {hoveredNode.dependencies?.length || 0}</div>
            <div className="text-slate-400">Dependents: {hoveredNode.dependents?.length || 0}</div>
            <div className="text-slate-400">Status: {hoveredNode.status || 'N/A'}</div>
          </div>
        )}
        
        {graphData.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500">
            <div className="text-center">
              <div className="text-4xl mb-2">📊</div>
              <div>No dependency data</div>
              <div className="text-sm text-slate-600">Capture requests to see dependency graph</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
