'use client'

import { useState, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import TranscriptView from './TranscriptView';
import { getFullTranscript } from '@/lib/dbUtils';
import './UtteranceMap.css';

/**
 * Generate a color for a cluster based on its index
 */
function generateClusterColor(clusterId, totalClusters) {
  if (clusterId === -1) return '#999'; // Noise cluster
  const hue = (clusterId / totalClusters) * 360;
  return `hsl(${hue}, 70%, 60%)`;
}

/**
 * UtteranceMap - Interactive 2D visualization of utterances using UMAP + HDBSCAN
 */
function UtteranceMap() {
  const [loading, setLoading] = useState(true);
  const [utterances, setUtterances] = useState([]);
  const [clusterCount, setClusterCount] = useState(0);
  const [clusterNames, setClusterNames] = useState({});
  const [clusterColors, setClusterColors] = useState({});
  const [clusterVisibility, setClusterVisibility] = useState({});
  const [namingClusters, setNamingClusters] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterEpisodes, setFilterEpisodes] = useState([]);
  const [filterSpeakers, setFilterSpeakers] = useState([]);
  const [dateRange, setDateRange] = useState([null, null]);

  const [pipVideo, setPipVideo] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [minDate, setMinDate] = useState(null);
  const [maxDate, setMaxDate] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const [numClusters, setNumClusters] = useState(20);
  const [reclustering, setReclustering] = useState(false);
  const [selectedUtterance, setSelectedUtterance] = useState(null);
  const [fullTranscript, setFullTranscript] = useState([]);
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [searchSimilarity, setSearchSimilarity] = useState({});
  const [searching, setSearching] = useState(false);

  const mapContainer = useRef(null);
  const map = useRef(null);
  const popup = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Load utterances with 2D coordinates
  useEffect(() => {
    loadUtterances();
  }, []);

  const loadUtterances = async (forceRecompute = false) => {
    setLoading(true);
    try {
      const url = new URL('/api/utterances-2d');
      url.searchParams.set('numClusters', numClusters);
      if (forceRecompute) {
        url.searchParams.set('forceRecompute', 'true');
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load utterances');

      const data = await response.json();
      setUtterances(data.utterances || []);
      setClusterCount(data.clusterCount || 0);
      setClusterNames(data.clusterNames || {});

      // Generate cluster colors
      const colors = {};
      const visibility = {};
      const uniqueClusters = [...new Set(data.utterances.map(u => u.cluster))];
      uniqueClusters.forEach(clusterId => {
        colors[clusterId] = generateClusterColor(clusterId, data.clusterCount);
        visibility[clusterId] = true;
      });
      setClusterColors(colors);
      setClusterVisibility(visibility);

      // Extract unique episodes and speakers
      const uniqueEpisodes = [...new Set(data.utterances.map(u => u.title))].sort();
      const uniqueSpeakers = [...new Set(data.utterances.map(u => u.speaker))].sort();
      setEpisodes(uniqueEpisodes);
      setSpeakers(uniqueSpeakers);

      // Extract date range
      const dates = data.utterances.map(u => new Date(u.date)).filter(d => !isNaN(d));
      if (dates.length > 0) {
        const min = new Date(Math.min(...dates));
        const max = new Date(Math.max(...dates));
        setMinDate(min.toISOString().split('T')[0]);
        setMaxDate(max.toISOString().split('T')[0]);
        setDateRange([min.toISOString().split('T')[0], max.toISOString().split('T')[0]]);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading utterances:', error);
      alert('Failed to load utterance map: ' + error.message);
      setLoading(false);
    }
  };

  // Name clusters using LLM
  const handleNameClusters = async () => {
    setNamingClusters(true);
    try {
      const response = await fetch('/api/name-clusters', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to name clusters');

      const data = await response.json();
      setClusterNames(data.clusterNames);
    } catch (error) {
      console.error('Error naming clusters:', error);
      alert('Failed to name clusters: ' + error.message);
    } finally {
      setNamingClusters(false);
    }
  };

  // Recluster with new parameters
  const handleRecluster = async () => {
    setReclustering(true);
    setMapLoaded(false);

    // Remove existing map
    if (map.current) {
      map.current.remove();
      map.current = null;
    }

    try {
      await loadUtterances(true);
    } catch (error) {
      console.error('Error reclustering:', error);
      alert('Failed to recluster: ' + error.message);
    } finally {
      setReclustering(false);
    }
  };

  // Load full transcript for selected video
  const loadFullTranscriptForVideo = (videoUrl) => {
    try {
      const transcript = getFullTranscript(videoUrl);
      setFullTranscript(transcript);
    } catch (error) {
      console.error('Error loading transcript:', error);
      setFullTranscript([]);
    }
  };

  // Semantic search with debouncing (using simple text matching for now)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim()) {
      setSearchSimilarity({});
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      setSearching(true);
      try {
        const query = searchQuery.toLowerCase();
        const similarities = {};

        // Simple text-based similarity for now
        for (const u of utterances) {
          const text = u.text.toLowerCase();
          const title = u.title.toLowerCase();
          const speaker = u.speaker.toLowerCase();

          // Calculate simple relevance score
          let score = 0;
          if (text.includes(query)) score += 1.0;
          if (title.includes(query)) score += 0.5;
          if (speaker.includes(query)) score += 0.3;

          similarities[u.id] = Math.min(1, score);
        }

        setSearchSimilarity(similarities);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setSearching(false);
      }
    }, 300); // 300ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, utterances]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || utterances.length === 0 || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#f5f5f5' }
          }
        ]
      },
      center: [0, 0],
      zoom: 1,
      attributionControl: false,
    });

    map.current.on('load', () => {
      setMapLoaded(true);
      renderUtterances();
    });

    // Create popup
    popup.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '400px',
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      setMapLoaded(false);
    };
  }, [utterances]);

  // Re-render when filters or cluster names change
  useEffect(() => {
    if (map.current && mapLoaded && utterances.length > 0) {
      renderUtterances();
    }
  }, [searchSimilarity, filterEpisodes, filterSpeakers, dateRange, clusterVisibility, clusterNames, mapLoaded]);

  // Filter utterances (note: semantic search handled separately via opacity)
  const getFilteredUtterances = () => {
    return utterances.filter(u => {
      // Episode filter (multi-select)
      if (filterEpisodes.length > 0 && !filterEpisodes.includes(u.title)) {
        return false;
      }

      // Speaker filter (multi-select)
      if (filterSpeakers.length > 0 && !filterSpeakers.includes(u.speaker)) {
        return false;
      }

      // Date filter
      if (dateRange[0] && dateRange[1]) {
        const uDate = new Date(u.date);
        const start = new Date(dateRange[0]);
        const end = new Date(dateRange[1]);
        if (uDate < start || uDate > end) return false;
      }

      // Cluster visibility
      if (!clusterVisibility[u.cluster]) return false;

      return true;
    });
  };

  // Render utterances on map
  const renderUtterances = () => {
    if (!map.current || utterances.length === 0) return;

    // Ensure map style is fully loaded before adding sources
    if (!map.current.isStyleLoaded()) {
      console.log('Map style not loaded yet, waiting...');
      map.current.once('styledata', () => {
        renderUtterances();
      });
      return;
    }

    const filteredUtterances = getFilteredUtterances();

    // Prepare GeoJSON with semantic similarity
    const hasSearch = Object.keys(searchSimilarity).length > 0;
    const geojson = {
      type: 'FeatureCollection',
      features: filteredUtterances.map(u => {
        const similarity = hasSearch ? (searchSimilarity[u.id] || 0) : 1;
        // Map similarity (0-1) to opacity (0.2-1) when searching
        const opacity = hasSearch ? Math.max(0.2, Math.min(1, similarity * 1.5)) : 0.8;

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [u.x, u.y]
          },
          properties: {
            id: u.id,
            text: u.text,
            speaker: u.speaker,
            timestamp: u.timestamp,
            title: u.title,
            date: u.date,
            video_url: u.video_url,
            cluster: u.cluster,
            color: clusterColors[u.cluster] || '#999',
            opacity: opacity,
          }
        };
      })
    };

    // Add source
    if (map.current.getSource('utterances')) {
      map.current.getSource('utterances').setData(geojson);
    } else {
      map.current.addSource('utterances', {
        type: 'geojson',
        data: geojson
      });

      // Add layer
      map.current.addLayer({
        id: 'utterances-circles',
        type: 'circle',
        source: 'utterances',
        paint: {
          'circle-radius': 5,
          'circle-color': ['get', 'color'],
          'circle-opacity': ['get', 'opacity'],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff',
        }
      });

      // Add hover effects
      map.current.on('mouseenter', 'utterances-circles', (e) => {
        map.current.getCanvas().style.cursor = 'pointer';
        const feature = e.features[0];
        const coords = feature.geometry.coordinates.slice();
        const props = feature.properties;

        const clusterName = clusterNames[props.cluster] || `Cluster ${props.cluster}`;

        popup.current
          .setLngLat(coords)
          .setHTML(`
            <div class="utterance-popup">
              <div class="popup-cluster">${clusterName}</div>
              <div class="popup-speaker">${props.speaker}</div>
              <div class="popup-text">${props.text.substring(0, 150)}${props.text.length > 150 ? '...' : ''}</div>
              <div class="popup-meta">${props.title} • ${props.timestamp}</div>
            </div>
          `)
          .addTo(map.current);
      });

      map.current.on('mouseleave', 'utterances-circles', () => {
        map.current.getCanvas().style.cursor = '';
        popup.current.remove();
      });

      // Click to play immediately
      map.current.on('click', 'utterances-circles', (e) => {
        const feature = e.features[0];
        const props = feature.properties;
        playVideo(props.video_url, props.timestamp, props.title, props.id);
      });

      // Fit bounds on first render
      if (geojson.features.length > 0) {
        const coords = geojson.features.map(f => f.geometry.coordinates);
        const bounds = coords.reduce((bounds, coord) => {
          return bounds.extend(coord);
        }, new maplibregl.LngLatBounds(coords[0], coords[0]));

        map.current.fitBounds(bounds, { padding: 50 });
      }
    }
  };

  // Play video and load transcript
  const playVideo = (videoUrl, timestamp, title, utteranceId) => {
    setPipVideo({ videoUrl, timestamp, title });
    loadFullTranscriptForVideo(videoUrl);
    // Find the selected utterance
    const utterance = utterances.find(u => u.id === utteranceId);
    setSelectedUtterance(utterance);
  };

  // Toggle cluster visibility
  const toggleCluster = (clusterId) => {
    setClusterVisibility(prev => ({
      ...prev,
      [clusterId]: !prev[clusterId]
    }));
  };

  if (loading) {
    return (
      <div className="utterance-map-loading">
        <div className="spinner"></div>
        <p>Loading utterance map...</p>
        <p className="loading-subtext">Computing UMAP 2D projection and clusters... This may take a minute.</p>
      </div>
    );
  }

  const clusterStats = utterances.reduce((acc, u) => {
    const clusterId = u.cluster;
    acc[clusterId] = (acc[clusterId] || 0) + 1;
    return acc;
  }, {});

  const sortedClusters = Object.keys(clusterStats)
    .map(Number)
    .sort((a, b) => {
      if (a === -1) return 1; // Noise at end
      if (b === -1) return -1;
      return clusterStats[b] - clusterStats[a]; // Sort by size
    });

  return (
    <div className="utterance-map-container">
      {/* Filters Panel */}
      <div className="filters-panel">
        <div className="filter-section">
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search utterances..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="filter-input"
            />
            {searching && (
              <div style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '12px',
                color: '#007bff'
              }}>
                Searching...
              </div>
            )}
          </div>
        </div>

        <div className="filter-section">
          <label>Number of Clusters</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input
              type="number"
              min="2"
              max="100"
              value={numClusters}
              onChange={(e) => setNumClusters(parseInt(e.target.value) || 20)}
              className="filter-input"
              placeholder="Number of clusters"
            />
            <button
              onClick={handleRecluster}
              disabled={reclustering}
              className="recluster-button"
              style={{ width: '100%' }}
            >
              {reclustering ? 'Reclustering...' : 'Recluster'}
            </button>
          </div>
        </div>

        <div className="filter-section">
          <label>Episodes ({filterEpisodes.length} selected)</label>
          <div className="checkbox-list">
            {episodes.map(ep => (
              <label key={ep} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={filterEpisodes.includes(ep)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFilterEpisodes([...filterEpisodes, ep]);
                    } else {
                      setFilterEpisodes(filterEpisodes.filter(e => e !== ep));
                    }
                  }}
                />
                <span className="checkbox-label">{ep}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <label>Speakers ({filterSpeakers.length} selected)</label>
          <div className="checkbox-list">
            {speakers.map(sp => (
              <label key={sp} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={filterSpeakers.includes(sp)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFilterSpeakers([...filterSpeakers, sp]);
                    } else {
                      setFilterSpeakers(filterSpeakers.filter(s => s !== sp));
                    }
                  }}
                />
                <span className="checkbox-label">{sp}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <label>Date Range</label>
          <div className="date-range">
            <input
              type="date"
              value={dateRange[0] || ''}
              min={minDate}
              max={maxDate}
              onChange={(e) => setDateRange([e.target.value, dateRange[1]])}
              className="date-input"
            />
            <span>to</span>
            <input
              type="date"
              value={dateRange[1] || ''}
              min={minDate}
              max={maxDate}
              onChange={(e) => setDateRange([dateRange[0], e.target.value])}
              className="date-input"
            />
          </div>
        </div>

        <div className="map-info">
          <p>{getFilteredUtterances().length} / {utterances.length} utterances</p>
          <p>{clusterCount} clusters</p>
        </div>
      </div>

      {/* Cluster Management Panel */}
      <div className="cluster-panel">
        <div className="cluster-header">
          <h3>Clusters</h3>
          <button
            onClick={handleNameClusters}
            disabled={namingClusters}
            className="name-clusters-button"
            title="Use LLM to name clusters based on their content"
          >
            {namingClusters ? 'Naming...' : 'Name Clusters'}
          </button>
        </div>
        <div className="cluster-list">
          {sortedClusters.map(clusterId => {
            const clusterName = clusterNames[clusterId] || (clusterId === -1 ? 'Noise' : `Cluster ${clusterId}`);
            const count = clusterStats[clusterId];
            const visible = clusterVisibility[clusterId];

            return (
              <div
                key={clusterId}
                className={`cluster-item ${!visible ? 'hidden' : ''}`}
                onClick={() => toggleCluster(clusterId)}
              >
                <div
                  className="cluster-color"
                  style={{ backgroundColor: clusterColors[clusterId] }}
                />
                <div className="cluster-info">
                  <div className="cluster-name">{clusterName}</div>
                  <div className="cluster-count">{count} utterances</div>
                </div>
                <div className="cluster-toggle">
                  {visible ? '👁️' : '🚫'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Map Container */}
      <div ref={mapContainer} className="map-container" />

      {/* Video + Transcript Sidebar */}
      {pipVideo && (
        <div className="video-transcript-sidebar">
          <div className="sidebar-header">
            <span className="sidebar-title">{pipVideo.title}</span>
            <button
              className="sidebar-close"
              onClick={() => {
                setPipVideo(null);
                setSelectedUtterance(null);
                setFullTranscript([]);
              }}
            >
              ✕
            </button>
          </div>

          <div className="sidebar-video">
            <VideoPlayerEmbed
              videoUrl={pipVideo.videoUrl}
              timestamp={pipVideo.timestamp}
              onTimeUpdate={setCurrentVideoTime}
            />
          </div>

          {fullTranscript.length > 0 && (
            <div className="sidebar-transcript">
              <TranscriptView
                utterances={fullTranscript}
                currentTime={currentVideoTime}
                onSeek={(time) => {
                  console.log('Seek to', time);
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Video Player Embed Component
function VideoPlayerEmbed({ videoUrl, timestamp }) {
  const timestampToSeconds = (ts) => {
    const parts = ts.split(':').map(Number);
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

  const videoId = getYouTubeId(videoUrl);
  const startSeconds = timestampToSeconds(timestamp);

  if (!videoId) {
    return <div className="video-error">Unable to load video</div>;
  }

  return (
    <iframe
      width="100%"
      height="100%"
      src={`https://www.youtube.com/embed/${videoId}?start=${startSeconds}&autoplay=1`}
      frameBorder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      title="Video Player"
    />
  );
}

export default UtteranceMap;
