'use client'

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from 'next/navigation';
import SearchBar from './components/SearchBar';
import SearchResults from './components/SearchResults';
import ResearchResults from './components/ResearchResults';
import ResearchChat from './components/ResearchChat';
import ResizeHandle from './components/ResizeHandle';
import VideoPlayer from './components/VideoPlayer';
import TranscriptView from './components/TranscriptView';
import Filters from './components/Filters';
import Statistics from './components/Statistics';
import MindMap from './components/MindMap';
import UtteranceMap from './components/UtteranceMap';
import LoginButton from './components/LoginButton';
import { initDatabase, initModel, searchUtterances, searchResearchTopics, getSpeakers, getDateRange, getFullTranscript } from '@/lib/dbUtils';
import './App.css';

function HomePageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [researchResults, setResearchResults] = useState<any[]>([]);
  const [selectedClip, setSelectedClip] = useState<any>(null);
  const [speakers, setSpeakers] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<{ min: string | null; max: string | null }>({ min: null, max: null });
  const [filters, setFilters] = useState({
    speaker: [] as string[],
    startDate: '',
    endDate: '',
    hasAiSummary: false
  });
  const [showStats, setShowStats] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [fullTranscript, setFullTranscript] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const seekRef = useRef<any>(null);
  const [activeView, setActiveView] = useState('search');
  const [researchQuery, setResearchQuery] = useState('');
  const [panelSizes, setPanelSizes] = useState({
    chatWidth: 400,
    videoWidth: 500
  });

  // Handle authentication
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Read URL params on mount
  useEffect(() => {
    const viewParam = searchParams.get('view');
    const queryParam = searchParams.get('q');

    if (viewParam) {
      setActiveView(viewParam);
    }

    if (queryParam && viewParam === 'research') {
      setResearchQuery(queryParam);
      if (!loading) {
        handleResearchSearch(queryParam);
      }
    }
  }, [searchParams, loading]);

  // Initialize database
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        await initDatabase();
        await initModel();

        const availableSpeakers = getSpeakers();
        const range = getDateRange();

        setSpeakers(availableSpeakers);
        setDateRange(range);
        setLoading(false);
      } catch (error) {
        console.error('Failed to initialize:', error);
        setLoading(false);
      }
    }

    if (status === 'authenticated') {
      init();
    }
  }, [status]);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setSearching(true);
    setQuery(searchQuery);

    try {
      const searchResults = await searchUtterances(searchQuery, filters, 50);
      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleResearchSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResearchResults([]);
      setResearchQuery('');
      const url = new URL(window.location.href);
      url.searchParams.delete('q');
      window.history.pushState({}, '', url);
      return;
    }

    setSearching(true);
    setQuery(searchQuery);
    setResearchQuery(searchQuery);

    const url = new URL(window.location.href);
    url.searchParams.set('view', 'research');
    url.searchParams.set('q', searchQuery);
    window.history.pushState({}, '', url);

    try {
      const searchResults = await searchResearchTopics(searchQuery, 50);
      setResearchResults(searchResults);
    } catch (error) {
      console.error('Research search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleResizeChatPanel = (deltaX: number) => {
    setPanelSizes(prev => ({
      ...prev,
      chatWidth: Math.max(300, Math.min(600, prev.chatWidth + deltaX))
    }));
  };

  const handleResizeVideoPanel = (deltaX: number) => {
    setPanelSizes(prev => ({
      ...prev,
      videoWidth: Math.max(400, Math.min(800, prev.videoWidth - deltaX))
    }));
  };

  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters);
    if (query) {
      handleSearch(query);
    }
  };

  const handleClipSelect = (clip: any) => {
    setSelectedClip(clip);
    const transcript = getFullTranscript(clip.video_url);
    setFullTranscript(transcript);
    setCurrentTime(clip.timestamp_seconds || 0);
  };

  const handleSeek = (time: number) => {
    if (seekRef.current) {
      seekRef.current(time);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="app loading">
        <div className="loading-container">
          <h1>Podcast Index</h1>
          <p>Loading database and embedding model...</p>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="app-nav">
        <div className="nav-tabs">
          <button
            className={`nav-button ${activeView === 'search' ? 'active' : ''}`}
            onClick={() => setActiveView('search')}
          >
            Search
          </button>
          <button
            className={`nav-button ${activeView === 'research' ? 'active' : ''}`}
            onClick={() => setActiveView('research')}
          >
            Research
          </button>
          <button
            className={`nav-button ${activeView === 'map' ? 'active' : ''}`}
            onClick={() => setActiveView('map')}
          >
            2D Map
          </button>
        </div>
        <div className="nav-user">
          <LoginButton />
        </div>
      </div>

      {activeView === 'map' ? (
        <UtteranceMap />
      ) : activeView === 'mindmap' ? (
        <MindMap />
      ) : activeView === 'research' ? (
        <div className="research-container" style={{
          gridTemplateColumns: `${panelSizes.chatWidth}px 8px 1fr 8px ${panelSizes.videoWidth}px`
        }}>
          <div className="research-chat-panel">
            <ResearchChat
              onTopicSelect={(topicTitle: string) => handleResearchSearch(topicTitle)}
              onClipSelect={handleClipSelect}
            />
          </div>

          <ResizeHandle onResize={handleResizeChatPanel} direction="vertical" />

          <div className="research-main-panel">
            <div className="search-controls">
              <SearchBar
                onSearch={handleResearchSearch}
                searching={searching}
                placeholder="Search topics..."
                initialValue={researchQuery}
              />

              {researchResults.length > 0 && (
                <div className="results-header">
                  <div className="results-count">
                    Found {researchResults.length} relevant topics
                  </div>
                </div>
              )}
            </div>

            <div className="results-section">
              <ResearchResults
                results={researchResults}
                onClipSelect={handleClipSelect}
                selectedClip={selectedClip}
                searching={searching}
              />
            </div>
          </div>

          <ResizeHandle onResize={handleResizeVideoPanel} direction="vertical" />

          <div className="video-section">
            {selectedClip ? (
              <>
                <div className="video-container-wrapper">
                  <VideoPlayer
                    clip={selectedClip}
                    autoPlay={autoPlay}
                    onAutoPlayChange={setAutoPlay}
                    onTimeUpdate={setCurrentTime}
                    onSeek={seekRef}
                  />
                </div>
                <div className="transcript-container">
                  <TranscriptView
                    utterances={fullTranscript}
                    currentTime={currentTime}
                    onSeek={handleSeek}
                  />
                </div>
              </>
            ) : (
              <div className="video-placeholder">
                <h3>No clip selected</h3>
                <p>Select a topic clip to view the video and full transcript</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="app-container">
          <div className="left-panel">
            <div className="search-controls">
              <SearchBar onSearch={handleSearch} searching={searching} />

              <Filters
                speakers={speakers}
                dateRange={dateRange}
                filters={filters}
                onFilterChange={handleFilterChange}
              />

              {results.length > 0 && (
                <div className="results-header">
                  <div className="results-count">
                    Found {results.length} relevant clips
                  </div>
                  <button
                    className="stats-toggle"
                    onClick={() => setShowStats(!showStats)}
                  >
                    {showStats ? 'Hide' : 'Show'} Statistics
                  </button>
                </div>
              )}

              {showStats && results.length > 0 && (
                <Statistics results={results} />
              )}
            </div>

            <div className="results-section">
              <SearchResults
                results={results}
                onClipSelect={handleClipSelect}
                selectedClip={selectedClip}
                searching={searching}
              />
            </div>
          </div>

          <div className="video-section">
            {selectedClip ? (
              <>
                <div className="video-container-wrapper">
                  <VideoPlayer
                    clip={selectedClip}
                    autoPlay={autoPlay}
                    onAutoPlayChange={setAutoPlay}
                    onTimeUpdate={setCurrentTime}
                    onSeek={seekRef}
                  />
                </div>
                <div className="transcript-container">
                  <TranscriptView
                    utterances={fullTranscript}
                    currentTime={currentTime}
                    onSeek={handleSeek}
                  />
                </div>
              </>
            ) : (
              <div className="video-placeholder">
                <h3>No video selected</h3>
                <p>Select a search result to view the video and full transcript</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="app loading">
        <div className="loading-container">
          <h1>Podcast Index</h1>
          <p>Loading...</p>
          <div className="spinner"></div>
        </div>
      </div>
    }>
      <HomePageContent />
    </Suspense>
  );
}
