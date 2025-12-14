'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Panel,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './MindMap.css';
import useAutoLayout from '@/lib/hooks/useAutoLayout';

/**
 * Convert database nodes to ReactFlow format
 */
function parseNodesFromDatabase(dbNodes) {
  const nodes = [];
  const edges = [];
  const episodeMap = new Map(); // Track video URLs by episode

  for (const dbNode of dbNodes) {
    // Track video URL for each episode
    if (!episodeMap.has(dbNode.title)) {
      episodeMap.set(dbNode.title, dbNode.video_url);
    }

    // Create ReactFlow node
    const node = {
      id: dbNode.node_id,
      type: 'default',
      data: {
        label: dbNode.label,
        description: dbNode.description,
        timestamps: dbNode.timestamps,
        numbering: dbNode.node_id,
        depth: dbNode.depth,
        title: dbNode.title,
        videoUrl: dbNode.video_url,
      },
      position: { x: 0, y: 0 }, // Will be calculated by layout
      style: {
        opacity: dbNode.similarity !== undefined ? 0.2 + dbNode.similarity * 0.8 : 1,
      },
    };

    nodes.push(node);

    // Create edge to parent if parent exists
    if (dbNode.parent_id) {
      edges.push({
        id: `e-${dbNode.parent_id}-${dbNode.node_id}`,
        source: dbNode.parent_id,
        target: dbNode.node_id,
        type: 'smoothstep',
        animated: false,
      });
    }
  }

  return { nodes, edges, episodeMap };
}

/**
 * PIP Video Player for Mind Map
 */
function MindMapPipPlayer({ videoUrl, timestamp, title, onClose }) {
  const [size, setSize] = useState({ width: 400, height: 225 });
  const [position, setPosition] = useState({ top: 80, right: 20 }); // Start below nav bar
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const dragStartRef = useRef({ x: 0, y: 0, top: 0, right: 0 });

  const timestampToSeconds = (ts) => {
    // Remove brackets if present
    const cleaned = ts.replace(/[\[\]]/g, '');
    // Handle range timestamps like "00:00-03:42" - take the start time
    const startTime = cleaned.split('-')[0].trim();
    const parts = startTime.split(':').map(Number);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  };

  const getYouTubeId = (url) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    return match ? match[1] : null;
  };

  const handleDragStart = (e) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      top: position.top,
      right: position.right
    };
  };

  const handleResizeStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    startPosRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    };
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e) => {
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;
      setPosition({
        top: Math.max(60, dragStartRef.current.top + deltaY), // Min 60px to stay below nav
        right: Math.max(0, dragStartRef.current.right - deltaX)
      });
    };
    const handleMouseUp = () => setIsDragging(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e) => {
      const deltaX = startPosRef.current.x - e.clientX;
      const deltaY = e.clientY - startPosRef.current.y;
      setSize({
        width: Math.max(300, Math.min(800, startPosRef.current.width + deltaX)),
        height: Math.max(169, Math.min(450, startPosRef.current.height + deltaY))
      });
    };
    const handleMouseUp = () => setIsResizing(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const videoId = getYouTubeId(videoUrl);
  const startSeconds = timestampToSeconds(timestamp);

  return (
    <div
      className="pip-player-corner"
      style={{
        width: `${size.width}px`,
        height: `${size.height}px`,
        top: `${position.top}px`,
        right: `${position.right}px`
      }}
    >
      <div className="pip-header" onMouseDown={handleDragStart}>
        <span className="pip-title">{title} • {timestamp}</span>
        <button className="pip-close" onClick={onClose}>✕</button>
      </div>
      <div className="pip-video-container">
        {videoId ? (
          <iframe
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/${videoId}?start=${startSeconds}&autoplay=1`}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Mind Map Video"
          />
        ) : (
          <div className="pip-error">Unable to load video</div>
        )}
      </div>
      <div className="pip-resize-handle" onMouseDown={handleResizeStart} />
    </div>
  );
}

/**
 * MindMap Inner Component (uses ReactFlow hooks)
 */
function MindMapInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [pipVideo, setPipVideo] = useState(null);
  const [layoutDirection, setLayoutDirection] = useState('TB'); // 'TB', 'LR', 'RL', 'BT'

  // Episode selection
  const [episodes, setEpisodes] = useState([]);
  const [selectedEpisodes, setSelectedEpisodes] = useState([]);
  const [similarityCutoff, setSimilarityCutoff] = useState(0.0);
  const [isLoading, setIsLoading] = useState(false);
  const [episodeMap, setEpisodeMap] = useState(new Map());

  // Layout options for useAutoLayout hook
  const layoutOptions = useMemo(
    () => ({
      algorithm: 'd3-hierarchy',
      direction: layoutDirection,
      spacing: [100, 150],
    }),
    [layoutDirection]
  );

  // Apply auto-layout
  useAutoLayout(layoutOptions);

  // Load available episodes on mount
  useEffect(() => {
    loadEpisodes();
  }, []);

  // Load nodes when selectedEpisodes, searchQuery, or similarityCutoff changes
  useEffect(() => {
    loadMindMapNodes();
  }, [selectedEpisodes, searchQuery, similarityCutoff]);

  const loadEpisodes = async () => {
    try {
      const response = await fetch('/api/mind-maps');
      if (!response.ok) {
        throw new Error('Failed to load episodes');
      }
      const { episodes } = await response.json();
      setEpisodes(episodes);

      // If there are episodes, select all by default
      if (episodes.length > 0) {
        setSelectedEpisodes(episodes.map(ep => ep.title));
      }
    } catch (error) {
      console.error('Failed to load episodes:', error);
    }
  };

  const loadMindMapNodes = async () => {
    try {
      setIsLoading(true);

      const response = await fetch('/api/mind-map-nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titles: selectedEpisodes.length > 0 ? selectedEpisodes : null,
          searchQuery: searchQuery || null,
          similarityCutoff
        })
      });

      if (!response.ok) {
        throw new Error('Failed to load mind map nodes');
      }

      const { nodes: dbNodes } = await response.json();
      const { nodes: parsedNodes, edges: parsedEdges, episodeMap: parsedEpisodeMap } = parseNodesFromDatabase(dbNodes);

      setNodes(parsedNodes);
      setEdges(parsedEdges);
      setEpisodeMap(parsedEpisodeMap);
    } catch (error) {
      console.error('Failed to load mind map nodes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle node click
  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
  }, []);

  // Handle search (debounced via useEffect that watches searchQuery)
  const handleSearch = () => {
    // The actual search is triggered by the useEffect watching searchQuery
    // This is just for the button click
    loadMindMapNodes();
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setSimilarityCutoff(0.0);
  };

  // Handle timestamp click
  const handleTimestampClick = (timestamps, title, videoUrl, episodeTitle) => {
    if (!videoUrl) {
      alert('Video URL not available for this node');
      return;
    }
    setPipVideo({ videoUrl, timestamp: timestamps, title: `${episodeTitle} - ${title}` });
  };

  // Handle episode selection toggle
  const toggleEpisode = (episodeTitle) => {
    setSelectedEpisodes(prev => {
      if (prev.includes(episodeTitle)) {
        return prev.filter(t => t !== episodeTitle);
      } else {
        return [...prev, episodeTitle];
      }
    });
  };

  const toggleAllEpisodes = () => {
    if (selectedEpisodes.length === episodes.length) {
      setSelectedEpisodes([]);
    } else {
      setSelectedEpisodes(episodes.map(ep => ep.title));
    }
  };

  return (
    <div className="mindmap-container">
      {/* PIP Video Player */}
      {pipVideo && (
        <MindMapPipPlayer
          videoUrl={pipVideo.videoUrl}
          timestamp={pipVideo.timestamp}
          title={pipVideo.title}
          onClose={() => setPipVideo(null)}
        />
      )}

      {/* Controls Panel */}
      <Panel position="top-left" className="mindmap-controls-panel">
        {/* Episode Selector */}
        <div className="mindmap-episode-selector">
          <label className="mindmap-label">Episodes:</label>
          <button onClick={toggleAllEpisodes} className="mindmap-toggle-all">
            {selectedEpisodes.length === episodes.length ? 'Deselect All' : 'Select All'}
          </button>
          <div className="mindmap-episode-list">
            {episodes.map((ep) => (
              <label key={ep.title} className="mindmap-episode-item">
                <input
                  type="checkbox"
                  checked={selectedEpisodes.includes(ep.title)}
                  onChange={() => toggleEpisode(ep.title)}
                />
                <span className="mindmap-episode-title">{ep.title}</span>
                <span className="mindmap-episode-date">{ep.date}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="mindmap-search">
          <label className="mindmap-label">Semantic Search:</label>
          <div>
            <input
              type="text"
              placeholder="Search topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              className="mindmap-search-input"
            />
            {searchQuery && (
              <button onClick={clearSearch} className="mindmap-clear-button">
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Similarity Cutoff Slider */}
        {searchQuery && (
          <div className="mindmap-similarity-slider">
            <label className="mindmap-label">
              Similarity Cutoff: {similarityCutoff.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={similarityCutoff}
              onChange={(e) => setSimilarityCutoff(parseFloat(e.target.value))}
              className="mindmap-slider"
            />
          </div>
        )}

        {/* Layout Selector */}
        <div className="mindmap-layout-selector">
          <label className="mindmap-label">Layout:</label>
          <div className="mindmap-layout-buttons">
            <button
              onClick={() => setLayoutDirection('TB')}
              className={`mindmap-layout-button ${layoutDirection === 'TB' ? 'active' : ''}`}
              title="Top to Bottom"
            >
              ↓ TB
            </button>
            <button
              onClick={() => setLayoutDirection('LR')}
              className={`mindmap-layout-button ${layoutDirection === 'LR' ? 'active' : ''}`}
              title="Left to Right"
            >
              → LR
            </button>
            <button
              onClick={() => setLayoutDirection('RL')}
              className={`mindmap-layout-button ${layoutDirection === 'RL' ? 'active' : ''}`}
              title="Right to Left"
            >
              ← RL
            </button>
            <button
              onClick={() => setLayoutDirection('BT')}
              className={`mindmap-layout-button ${layoutDirection === 'BT' ? 'active' : ''}`}
              title="Bottom to Top"
            >
              ↑ BT
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="mindmap-loading">Loading...</div>
        )}
      </Panel>

      {/* Node Details Panel */}
      {selectedNode && (
        <Panel position="top-right" className="mindmap-details-panel">
          <div className="mindmap-details">
            <button
              className="mindmap-close-button"
              onClick={() => setSelectedNode(null)}
            >
              ✕
            </button>
            <h3>{selectedNode.data.label}</h3>
            <div className="mindmap-node-id">{selectedNode.data.numbering}</div>
            {selectedNode.data.description && (
              <p className="mindmap-description">{selectedNode.data.description}</p>
            )}
            {selectedNode.data.timestamps && (
              <div
                className="mindmap-timestamps"
                onClick={() =>
                  handleTimestampClick(
                    selectedNode.data.timestamps,
                    selectedNode.data.label,
                    selectedNode.data.videoUrl,
                    selectedNode.data.title
                  )
                }
              >
                {selectedNode.data.timestamps}
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* React Flow */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        attributionPosition="bottom-left"
      >
        <Controls />
        <MiniMap />
        <Background variant="dots" gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}

/**
 * MindMap Component (wrapped with ReactFlowProvider)
 */
function MindMap() {
  return (
    <ReactFlowProvider>
      <MindMapInner />
    </ReactFlowProvider>
  );
}

export default MindMap;
