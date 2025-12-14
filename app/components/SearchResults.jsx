'use client'

import './SearchResults.css';

function SearchResults({ results, onClipSelect, selectedClip, searching }) {
  if (searching) {
    return (
      <div className="search-results">
        <div className="searching-message">
          <div className="spinner small"></div>
          <p>Searching...</p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="search-results empty">
        <p>No results yet. Try searching for something!</p>
      </div>
    );
  }

  return (
    <div className="search-results">
      {results.map((result, index) => (
        <div
          key={index}
          className={`result-card ${selectedClip === result ? 'selected' : ''}`}
          onClick={() => onClipSelect(result)}
        >
          <div className="result-header">
            <span className="result-speaker">{result.speaker}</span>
            <span className="result-timestamp">{result.timestamp}</span>
            <span className="result-similarity">
              {(result.similarity * 100).toFixed(1)}% match
            </span>
          </div>

          <div className="result-text">{result.text}</div>

          {result.ai_summary && (
            <div className="result-summary">
              <span className="summary-label">AI Summary:</span> {result.ai_summary}
            </div>
          )}

          <div className="result-footer">
            <span className="result-title">{result.title}</span>
            <span className="result-date">{result.date}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default SearchResults;
