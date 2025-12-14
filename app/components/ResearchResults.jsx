'use client'

import { useState } from 'react';
import './ResearchResults.css';

function ResearchResults({ results, onClipSelect, selectedClip, searching }) {
  const [expandedTopics, setExpandedTopics] = useState(new Set());

  const toggleTopic = (topicId) => {
    const newExpanded = new Set(expandedTopics);
    if (newExpanded.has(topicId)) {
      newExpanded.delete(topicId);
    } else {
      newExpanded.add(topicId);
    }
    setExpandedTopics(newExpanded);
  };

  if (searching) {
    return (
      <div className="research-results">
        <div className="searching-message">
          <div className="spinner small"></div>
          <p>Searching topics...</p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="research-results empty">
        <p>No topics yet. Try searching for something!</p>
      </div>
    );
  }

  return (
    <div className="research-results">
      {results.map((topic) => {
        const isExpanded = expandedTopics.has(topic.id);
        const isAnyClipSelected = topic.clips?.some(clip =>
          selectedClip?.video_url === topic.video_url &&
          selectedClip?.timestamp_seconds === clip.timestamp_seconds
        );

        return (
          <div
            key={topic.id}
            className={`topic-card ${isExpanded ? 'expanded' : ''} ${isAnyClipSelected ? 'has-selected-clip' : ''}`}
          >
            <div
              className="topic-header"
              onClick={() => toggleTopic(topic.id)}
            >
              <div className="topic-header-top">
                <h3 className="topic-title">{topic.topic_title}</h3>
                <span className="topic-similarity">
                  {(topic.similarity * 100).toFixed(1)}% match
                </span>
              </div>

              <p className="topic-summary">{topic.comprehensive_summary}</p>

              <div className="topic-meta">
                <span className="topic-episode-title">{topic.title}</span>
                <span className="topic-date">{topic.date}</span>
                <span className="topic-clip-count">
                  {topic.clips?.length || 0} clip{topic.clips?.length !== 1 ? 's' : ''}
                </span>
              </div>

              <button className="topic-expand-button">
                {isExpanded ? '▼ Hide clips' : '▶ Show clips'}
              </button>
            </div>

            {isExpanded && topic.clips && topic.clips.length > 0 && (
              <div className="topic-clips">
                {topic.clips.map((clip, clipIndex) => {
                  const isSelected = selectedClip?.video_url === topic.video_url &&
                                   selectedClip?.timestamp_seconds === clip.timestamp_seconds;

                  return (
                    <div
                      key={clipIndex}
                      className={`clip-item ${isSelected ? 'selected' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onClipSelect({
                          ...clip,
                          video_url: topic.video_url,
                          title: topic.title,
                          topic_title: topic.topic_title
                        });
                      }}
                    >
                      <div className="clip-header">
                        <span className="clip-timestamp">{clip.timestamp}</span>
                        {clip.speaker && (
                          <span className="clip-speaker">{clip.speaker}</span>
                        )}
                      </div>
                      <p className="clip-summary">{clip.clip_summary}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ResearchResults;
