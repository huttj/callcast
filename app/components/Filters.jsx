'use client'

import { useState } from 'react';
import './Filters.css';

function Filters({ speakers, dateRange, filters, onFilterChange }) {
  const [showFilters, setShowFilters] = useState(false);
  const [localFilters, setLocalFilters] = useState(filters);

  const handleSpeakerChange = (speaker) => {
    const newSpeakers = localFilters.speaker.includes(speaker)
      ? localFilters.speaker.filter(s => s !== speaker)
      : [...localFilters.speaker, speaker];

    const newFilters = { ...localFilters, speaker: newSpeakers };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleDateChange = (field, value) => {
    const newFilters = { ...localFilters, [field]: value };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleCheckboxChange = (field, value) => {
    const newFilters = { ...localFilters, [field]: value };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleClearFilters = () => {
    const cleared = { speaker: [], startDate: '', endDate: '', hasAiSummary: false };
    setLocalFilters(cleared);
    onFilterChange(cleared);
  };

  const hasActiveFilters =
    localFilters.speaker.length > 0 ||
    localFilters.startDate ||
    localFilters.endDate ||
    localFilters.hasAiSummary;

  return (
    <div className="filters">
      <div className="filters-toggle">
        <button
          className="toggle-button"
          onClick={() => setShowFilters(!showFilters)}
        >
          Filters {hasActiveFilters && `(${localFilters.speaker.length + (localFilters.startDate ? 1 : 0) + (localFilters.endDate ? 1 : 0) + (localFilters.hasAiSummary ? 1 : 0)})`}
        </button>
        {hasActiveFilters && (
          <button className="clear-button" onClick={handleClearFilters}>
            Clear
          </button>
        )}
      </div>

      {showFilters && (
        <div className="filters-content">
          <div className="filter-section">
            <h4>Content</h4>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={localFilters.hasAiSummary}
                onChange={(e) => handleCheckboxChange('hasAiSummary', e.target.checked)}
              />
              <span>Only show utterances with AI summaries</span>
            </label>
          </div>

          <div className="filter-section">
            <h4>Speakers</h4>
            <div className="speaker-checkboxes">
              {speakers.map(speaker => (
                <label key={speaker} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={localFilters.speaker.includes(speaker)}
                    onChange={() => handleSpeakerChange(speaker)}
                  />
                  <span>{speaker}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <h4>Date Range</h4>
            <div className="date-inputs">
              <label>
                From:
                <input
                  type="date"
                  value={localFilters.startDate}
                  min={dateRange.min}
                  max={dateRange.max}
                  onChange={(e) => handleDateChange('startDate', e.target.value)}
                />
              </label>
              <label>
                To:
                <input
                  type="date"
                  value={localFilters.endDate}
                  min={dateRange.min}
                  max={dateRange.max}
                  onChange={(e) => handleDateChange('endDate', e.target.value)}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Filters;
