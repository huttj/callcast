'use client'

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { searchUtterances } from '@/lib/dbUtils';
import './AskInterface.css';

/**
 * PIP Video Player Component - Resizable corner player
 */
function PipVideoPlayer({ videoUrl, timestamp, title, onClose }) {
  const [size, setSize] = useState({ width: 400, height: 225 });
  const [position, setPosition] = useState({ top: 20, right: 20 });
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const playerRef = useRef(null);
  const startPosRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const dragStartRef = useRef({ x: 0, y: 0, top: 0, right: 0 });

  // Convert timestamp to seconds
  const timestampToSeconds = (ts) => {
    const parts = ts.split(':').map(Number);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1]; // MM:SS
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
    }
    return 0;
  };

  // Extract YouTube video ID
  const getYouTubeId = (url) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    return match ? match[1] : null;
  };

  // Handle drag start
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

  // Handle resize start
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

  // Handle drag
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;

      const newTop = Math.max(0, dragStartRef.current.top + deltaY);
      const newRight = Math.max(0, dragStartRef.current.right - deltaX);

      setPosition({ top: newTop, right: newRight });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Handle resize
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      const deltaX = startPosRef.current.x - e.clientX; // Reversed for bottom-left handle
      const deltaY = e.clientY - startPosRef.current.y;

      const newWidth = Math.max(300, Math.min(800, startPosRef.current.width + deltaX));
      const newHeight = Math.max(169, Math.min(450, startPosRef.current.height + deltaY));

      setSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

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
            ref={playerRef}
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/${videoId}?start=${startSeconds}&autoplay=1`}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Citation Video"
          />
        ) : (
          <div className="pip-error">Unable to load video</div>
        )}
      </div>
      <div
        className="pip-resize-handle"
        onMouseDown={handleResizeStart}
        title="Drag to resize"
      />
    </div>
  );
}

/**
 * Custom component to render text with citation links
 */
function CitableMarkdown({ content, episodeMap, onCitationClick }) {
  // Parse citations in the format (Title, timestamp)
  const citationRegex = /\(([^,]+),\s*(\d{1,2}:\d{2}(?::\d{2})?)\)/g;

  // Helper to parse text and create citation links
  const parseTextWithCitations = (text) => {
    if (typeof text !== 'string') return text;

    const parts = [];
    let lastIndex = 0;
    const regex = new RegExp(citationRegex);
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before citation
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Add citation link
      const title = match[1].trim();
      const timestamp = match[2].trim();
      const episode = episodeMap[title];

      if (episode) {
        parts.push(
          <button
            key={`cite-${match.index}`}
            className="citation-link"
            onClick={() => onCitationClick(title, timestamp)}
            title={`Play ${title} at ${timestamp}`}
          >
            ({title}, {timestamp})
          </button>
        );
      } else {
        parts.push(match[0]); // Keep original if episode not found
      }

      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  // Process children - handle both strings and React elements
  const processChildren = (children) => {
    if (typeof children === 'string') {
      return parseTextWithCitations(children);
    }
    if (Array.isArray(children)) {
      return children.map((child, idx) =>
        typeof child === 'string' ? parseTextWithCitations(child) : child
      );
    }
    // If it's already a React element or other type, return as-is
    return children;
  };

  const components = {
    p: ({ children, ...props }) => {
      return <p {...props}>{processChildren(children)}</p>;
    },
    li: ({ children, ...props }) => {
      return <li {...props}>{processChildren(children)}</li>;
    },
    // Handle other text-containing elements
    strong: ({ children, ...props }) => {
      return <strong {...props}>{processChildren(children)}</strong>;
    },
    em: ({ children, ...props }) => {
      return <em {...props}>{processChildren(children)}</em>;
    }
  };

  return <ReactMarkdown components={components}>{content}</ReactMarkdown>;
}

/**
 * Interactive Ask interface with LLM-powered multi-shot queries
 */
function AskInterface() {
  const [userQuestion, setUserQuestion] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [currentSearches, setCurrentSearches] = useState([]);
  const [starredItems, setStarredItems] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [maxRounds] = useState(3);
  const [currentRound, setCurrentRound] = useState(0);
  const [episodeMap, setEpisodeMap] = useState({}); // title -> { id: number, url: string }
  const [pipVideo, setPipVideo] = useState(null); // { url, timestamp, title }
  const chatMessagesRef = useRef(null);
  const episodeCounterRef = useRef(0); // Counter for episode IDs

  // Auto-scroll to bottom when new messages appear
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [conversationHistory, isProcessing]);

  /**
   * Get or create episode ID for a title
   */
  const getEpisodeId = (title, videoUrl) => {
    // Check if we already have this title
    if (episodeMap[title]) {
      return episodeMap[title].id;
    }

    // Create new ID
    episodeCounterRef.current += 1;
    const newId = episodeCounterRef.current;
    setEpisodeMap(prev => ({
      ...prev,
      [title]: { id: newId, url: videoUrl }
    }));
    return newId;
  };

  /**
   * Handle citation click - open PIP player
   */
  const handleCitationClick = (title, timestamp) => {
    const episode = episodeMap[title];
    if (episode) {
      setPipVideo({ title, timestamp, videoUrl: episode.url });
    }
  };

  /**
   * Call LLM API
   */
  const callLLM = async (messages, maxTokens = 8000) => {
    const response = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, maxTokens })
    });

    if (!response.ok) {
      let errorMessage = 'LLM API call failed';
      try {
        const error = await response.json();
        errorMessage = error.error || errorMessage;
      } catch (e) {
        // If response is not JSON, use status text
        errorMessage = `${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.content;
  };

  /**
   * Format results for LLM with episode numbers for citations
   */
  const formatResultsForLLM = (results) => {
    return results.map(r => {
      const episodeId = getEpisodeId(r.title, r.video_url);
      const header = `Episode #${episodeId}: "${r.title}" (${r.date})`;
      return `${header}
[${r.timestamp}] ${r.speaker}: ${r.text}
Similarity: ${(r.similarity * 100).toFixed(1)}%${r.ai_summary ? `
Summary: ${r.ai_summary}` : ''}`;
    }).join('

---

');
  };

  /**
   * Execute a search query
   */
  const executeSearch = async (query) => {
    const results = await searchUtterances(query.text, {}, query.limit || 10);
    return {
      ...query,
      results,
      timestamp: Date.now()
    };
  };

  /**
   * Star/unstar a search result
   */
  const toggleStarResult = (searchId, resultId) => {
    const itemKey = `${searchId}-${resultId}`;
    const search = currentSearches.find(s => s.id === searchId);
    const result = search?.results?.find(r => r.id === resultId);

    if (!result) return;

    setStarredItems(prev => {
      const existing = prev.find(item => item.key === itemKey);
      if (existing) {
        return prev.filter(item => item.key !== itemKey);
      } else {
        return [...prev, {
          key: itemKey,
          type: 'result',
          searchId,
          resultId,
          data: result
        }];
      }
    });
  };

  /**
   * Star/unstar an entire search query
   */
  const toggleStarSearch = (searchId) => {
    const search = currentSearches.find(s => s.id === searchId);
    if (!search) return;

    setStarredItems(prev => {
      const existing = prev.find(item => item.key === searchId && item.type === 'search');
      if (existing) {
        return prev.filter(item => !(item.key === searchId && item.type === 'search'));
      } else {
        return [...prev, {
          key: searchId,
          type: 'search',
          searchId,
          data: search
        }];
      }
    });
  };

  /**
   * Check if an item is starred
   */
  const isStarred = (searchId, resultId = null) => {
    if (resultId !== null) {
      return starredItems.some(item => item.key === `${searchId}-${resultId}`);
    } else {
      return starredItems.some(item => item.key === searchId && item.type === 'search');
    }
  };

  /**
   * Edit and re-run a search
   */
  const editAndRerunSearch = async (searchId, newText) => {
    const search = currentSearches.find(s => s.id === searchId);
    if (!search) return;

    const updatedQuery = { ...search, text: newText };
    const newResults = await executeSearch(updatedQuery);

    setCurrentSearches(prev =>
      prev.map(s => s.id === searchId ? newResults : s)
    );
  };

  /**
   * Build context for LLM from starred items
   */
  const buildStarredContext = () => {
    if (starredItems.length === 0) return '';

    const starredSearches = starredItems.filter(item => item.type === 'search');
    const starredResults = starredItems.filter(item => item.type === 'result');

    let context = 'PINNED/STARRED ITEMS (always available):

';

    if (starredSearches.length > 0) {
      context += 'Starred Searches:
';
      starredSearches.forEach(item => {
        context += `- Query [${item.data.id}]: "${item.data.text}"
`;
      });
      context += '
';
    }

    if (starredResults.length > 0) {
      context += 'Starred Results:
';
      starredResults.forEach(item => {
        const result = item.data;
        context += `- [${result.timestamp}] ${result.speaker}: ${result.text}
  Episode: "${result.title}" (${result.date})
`;
      });
      context += '
';
    }

    return context;
  };

  /**
   * Start a new query
   */
  const handleAsk = async () => {
    if (!userQuestion.trim() || isProcessing) return;

    setIsProcessing(true);
    setCurrentRound(0);
    setCurrentSearches([]);

    const questionToSend = userQuestion;
    setUserQuestion(''); // Clear input immediately

    // Add user question to conversation immediately
    const userMessage = {
      role: 'user',
      content: questionToSend,
      timestamp: Date.now()
    };
    const newHistory = [...conversationHistory, userMessage];
    setConversationHistory(newHistory); // Update state immediately

    try {
      await runQueryLoop(questionToSend, newHistory);
    } catch (error) {
      console.error('Query error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Main query loop
   */
  const runQueryLoop = async (question, history) => {
    const starredContext = buildStarredContext();

    // Initial planning prompt
    const planningPrompt = `You are helping search a podcast transcript database to answer this question:

"${question}"

${starredContext}

SEARCH PARAMETERS:
Each search query can have:
- id: Unique identifier for this query (e.g., "q1", "q2") - REQUIRED
- text: The semantic search query - REQUIRED
- limit: Max results to return (default 10)

RESPONSE FORMAT:
You must respond in ONE of two ways:

Option 1 - SEARCH: Request searches by responding with ONLY a JSON array:
[
  {
    "id": "q1",
    "text": "glory and beauty in life",
    "limit": 5
  },
  {
    "id": "q2",
    "text": "aesthetic experience",
    "limit": 10
  }
]

Option 2 - ANSWER: If you already have enough information, provide your final answer as plain text.

CITATION FORMAT:
When providing answers, you MUST cite your sources using this format: (Episode Title, timestamp)
Examples:
- "Joshua discussed glory (Messy Magic, 12:34)"
- "The concept was mentioned (Epistemic Maps, 05:12)"

Each search result includes an episode title and timestamp. Always cite specific claims using the exact episode title.

IMPORTANT: Each search round completely replaces previous results (unless they are starred). If you want to keep earlier results, you must re-request them or star them.

Generate 1-5 initial search queries to help answer the question. Respond with ONLY the JSON array, no other text.`;

    const messages = [...history, { role: 'user', content: planningPrompt }];
    let round = 0;

    while (round < maxRounds) {
      round++;
      setCurrentRound(round);

      // Get LLM response
      const llmResponse = await callLLM(messages, 4000);

      // Add to conversation history
      const assistantMessage = {
        role: 'assistant',
        content: llmResponse,
        timestamp: Date.now()
      };
      messages.push(assistantMessage);

      // Try to parse as JSON array
      let queries = null;
      try {
        const jsonMatch = llmResponse.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          queries = JSON.parse(jsonMatch[0]);
          if (!Array.isArray(queries)) {
            queries = null;
          }
        }
      } catch (e) {
        queries = null;
      }

      // If no queries, this is the final answer
      if (!queries || queries.length === 0) {
        setConversationHistory([...history, assistantMessage]);
        return;
      }

      // Execute searches
      const searchResults = await Promise.all(
        queries.map(q => executeSearch(q))
      );

      // Accumulate and deduplicate searches
      setCurrentSearches(prev => {
        const combined = [...prev, ...searchResults];
        const seen = new Map();
        // Deduplicate by search text (case-insensitive)
        combined.forEach(search => {
          const key = search.text.toLowerCase().trim();
          if (!seen.has(key) || seen.get(key).timestamp < search.timestamp) {
            seen.set(key, search);
          }
        });
        return Array.from(seen.values());
      });

      // Format results for LLM
      const resultsText = searchResults.map((item) => {
        const queryInfo = `Query ID: ${item.id}
Query: "${item.text}"`;
        return `${queryInfo}

${formatResultsForLLM(item.results)}`;
      }).join('

========

');

      const isLastRound = round >= maxRounds;

      // Ask LLM to review and decide
      const reviewPrompt = `SEARCH RESULTS:

${resultsText}

${starredContext}

ORIGINAL QUESTION: "${question}"

SEARCH ROUNDS USED: ${round}/${maxRounds}

${isLastRound ? 'This is your FINAL search round. You must answer now.

' : ''}You can now either:
1. ${isLastRound ? '(NOT AVAILABLE)' : 'Request NEW searches - respond with ONLY a JSON array (this will REPLACE all current results unless they are starred)'}
2. Answer the question - provide a comprehensive answer as plain text

CITATION REMINDER: When answering, cite your sources using (Episode Title, timestamp) format (e.g., (Messy Magic, 12:34)). Use the exact episode title from the results.

${isLastRound ? 'Provide your final answer now with proper citations.' : 'If you need different data, specify a NEW complete set of queries. Otherwise, provide your answer with citations.'}`;

      messages.push({ role: 'user', content: reviewPrompt });
    }

    // Force final answer
    const answerPrompt = `You have used all ${maxRounds} search rounds. Based on the results you've seen and any starred items, please answer:

"${question}"

IMPORTANT: Cite your sources using (Episode Title, timestamp) format (e.g., (Messy Magic, 12:34)).

Provide your answer now with proper citations.`;

    messages.push({ role: 'user', content: answerPrompt });

    const finalAnswer = await callLLM(messages, 8000);

    setConversationHistory([
      ...history,
      ...messages.slice(history.length),
      {
        role: 'assistant',
        content: finalAnswer,
        timestamp: Date.now()
      }
    ]);
  };

  /**
   * Ask a follow-up question
   */
  const handleFollowUp = async () => {
    if (!userQuestion.trim() || isProcessing) return;

    setIsProcessing(true);
    setCurrentRound(0);

    const questionToSend = userQuestion;
    setUserQuestion(''); // Clear input immediately

    // Add user question to conversation immediately
    const userMessage = {
      role: 'user',
      content: questionToSend,
      timestamp: Date.now()
    };
    const newHistory = [...conversationHistory, userMessage];
    setConversationHistory(newHistory); // Update state immediately

    try {
      await runQueryLoop(questionToSend, newHistory);
    } catch (error) {
      console.error('Follow-up error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="ask-interface">
      {/* PIP Video Player */}
      {pipVideo && (
        <PipVideoPlayer
          videoUrl={pipVideo.videoUrl}
          timestamp={pipVideo.timestamp}
          title={pipVideo.title}
          onClose={() => setPipVideo(null)}
        />
      )}

      {/* Sidebar */}
      <div className="ask-sidebar">
        <div className="sidebar-header">
          <h2>Ask</h2>
          {conversationHistory.length > 0 && (
            <button
              className="new-chat-button"
              onClick={() => {
                setConversationHistory([]);
                setCurrentSearches([]);
                setStarredItems([]);
                setUserQuestion('');
              }}
              disabled={isProcessing}
              title="New Conversation"
            >
              +
            </button>
          )}
        </div>

        {/* Starred Items in Sidebar */}
        {starredItems.length > 0 && (
          <div className="sidebar-section starred-section">
            <h3>Starred ({starredItems.length})</h3>
            <div className="starred-items">
              {starredItems.map((item) => (
                <div key={item.key} className={`starred-item ${item.type}`}>
                  {item.type === 'search' ? (
                    <div className="starred-content">
                      <div className="starred-label">Query [{item.data.id}]</div>
                      <div className="starred-text">{item.data.text}</div>
                    </div>
                  ) : (
                    <div className="starred-content">
                      <div className="starred-label">{item.data.speaker} • {item.data.timestamp}</div>
                      <div className="starred-text">{item.data.text.substring(0, 80)}...</div>
                    </div>
                  )}
                  <button
                    className="unstar-button"
                    onClick={() => {
                      if (item.type === 'search') {
                        toggleStarSearch(item.searchId);
                      } else {
                        toggleStarResult(item.searchId, item.resultId);
                      }
                    }}
                  >
                    ★
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Episode Reference */}
        {Object.keys(episodeMap).length > 0 && (
          <div className="sidebar-section episode-reference">
            <h3>Episodes</h3>
            <div className="episode-list">
              {Object.entries(episodeMap).map(([title, data]) => {
                return (
                  <div key={data.id} className="episode-item">
                    <span className="episode-id-badge">#{data.id}</span>
                    <span className="episode-title-short" title={title}>
                      {title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Current Searches in Sidebar */}
        {currentSearches.length > 0 && (
          <div className="sidebar-section searches-section">
            <h3>Searches</h3>
            {currentSearches.map((search) => (
              <div key={search.id} className="search-item">
                <div className="search-header">
                  <div className="search-query">
                    <span className="search-id">[{search.id}]</span>
                    <span className="search-text">{search.text}</span>
                  </div>
                  <button
                    className={`star-button ${isStarred(search.id) ? 'starred' : ''}`}
                    onClick={() => toggleStarSearch(search.id)}
                  >
                    {isStarred(search.id) ? '★' : '☆'}
                  </button>
                </div>
                <div className="search-results">
                  <div className="results-count">{search.results?.length || 0} results</div>
                  {search.results?.map((result) => (
                    <div key={result.id} className="result-item">
                      <div className="result-header">
                        <span className="result-speaker">{result.speaker}</span>
                        <span className="result-similarity">{(result.similarity * 100).toFixed(1)}%</span>
                        <button
                          className={`star-button ${isStarred(search.id, result.id) ? 'starred' : ''}`}
                          onClick={() => toggleStarResult(search.id, result.id)}
                        >
                          {isStarred(search.id, result.id) ? '★' : '☆'}
                        </button>
                      </div>
                      <div className="result-text">{result.text.substring(0, 100)}...</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="ask-main">
        {/* Chat Messages */}
        <div className="chat-messages" ref={chatMessagesRef}>
          {conversationHistory.length === 0 ? (
            <div className="chat-empty">
              <h1>Ask Anything</h1>
              <p>Ask questions and the LLM will search the database iteratively</p>
            </div>
          ) : (
            conversationHistory.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.role}`}>
                <div className="message-bubble">
                  <div className="message-role">{msg.role === 'user' ? 'You' : 'Assistant'}</div>
                  <div className="message-content">
                    {msg.role === 'assistant' ? (
                      <CitableMarkdown
                        content={msg.content}
                        episodeMap={episodeMap}
                        onCitationClick={handleCitationClick}
                      />
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          {isProcessing && (
            <div className="chat-message assistant">
              <div className="message-bubble processing">
                <div className="message-role">Assistant</div>
                <div className="message-content">Processing round {currentRound}/{maxRounds}...</div>
              </div>
            </div>
          )}
        </div>

        {/* Fixed Input Area */}
        <div className="chat-input-container">
          <div className="chat-input-wrapper">
            <textarea
              className="chat-input"
              placeholder="Ask a question about the podcasts..."
              value={userQuestion}
              onChange={(e) => setUserQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (userQuestion.trim() && !isProcessing) {
                    conversationHistory.length === 0 ? handleAsk() : handleFollowUp();
                  }
                }
              }}
              disabled={isProcessing}
              rows={1}
            />
            <button
              className="send-button"
              onClick={conversationHistory.length === 0 ? handleAsk : handleFollowUp}
              disabled={isProcessing || !userQuestion.trim()}
            >
              {isProcessing ? '⋯' : '↑'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AskInterface;
