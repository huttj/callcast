'use client'

import { useEffect, useRef } from 'react';
import './TranscriptView.css';

function TranscriptView({ utterances, currentTime, onSeek }) {
  const scrollContainerRef = useRef(null);
  const activeItemRef = useRef(null);
  const lastScrolledIndexRef = useRef(-1);

  // Find the current utterance based on playback time
  const getCurrentUtteranceIndex = () => {
    if (currentTime === undefined || currentTime === null || !utterances || utterances.length === 0) {
      return -1;
    }

    // Find the utterance that matches the current playback time
    for (let i = utterances.length - 1; i >= 0; i--) {
      if (utterances[i].timestamp_seconds <= currentTime) {
        return i;
      }
    }
    return -1;
  };

  const currentIndex = getCurrentUtteranceIndex();

  // Reset scroll tracking when utterances change (new video loaded)
  useEffect(() => {
    lastScrolledIndexRef.current = -1;
  }, [utterances]);

  // Debug logging
  useEffect(() => {
    if (currentTime !== undefined && currentTime > 0) {
      console.log('TranscriptView - currentTime:', currentTime, 'currentIndex:', currentIndex);
    }
  }, [currentTime, currentIndex]);

  // Auto-scroll to keep current utterance in view
  useEffect(() => {
    // Only scroll if the index actually changed
    if (currentIndex >= 0 && currentIndex !== lastScrolledIndexRef.current && activeItemRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const item = activeItemRef.current;

      const containerRect = container.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();

      // Check if item is out of view
      if (itemRect.top < containerRect.top || itemRect.bottom > containerRect.bottom) {
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        lastScrolledIndexRef.current = currentIndex;
      }
    }
  }, [currentIndex]);

  if (!utterances || utterances.length === 0) {
    return (
      <div className="transcript-view">
        <div className="transcript-empty">
          Select a video clip to view the full transcript
        </div>
      </div>
    );
  }

  return (
    <div className="transcript-view">
      <div className="transcript-header">
        <h3>Full Transcript</h3>
        <span className="utterance-count">{utterances.length} utterances</span>
      </div>
      <div className="transcript-scroll" ref={scrollContainerRef}>
        {utterances.map((utterance, index) => (
          <div
            key={utterance.id}
            ref={index === currentIndex ? activeItemRef : null}
            className={`transcript-item ${index === currentIndex ? 'active' : ''}`}
            onClick={() => {
              console.log('TranscriptView - clicked utterance at', utterance.timestamp_seconds);
              onSeek && onSeek(utterance.timestamp_seconds);
            }}
          >
            <div className="transcript-item-header">
              <span className="transcript-speaker">{utterance.speaker}</span>
              <span className="transcript-timestamp">{utterance.timestamp}</span>
            </div>
            <div className="transcript-text">{utterance.text}</div>
            {utterance.ai_summary && (
              <div className="transcript-summary">
                <span className="summary-label">AI Summary:</span> {utterance.ai_summary}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default TranscriptView;
