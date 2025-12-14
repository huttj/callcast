'use client'

import { useState, useEffect } from 'react';
import './SearchBar.css';

function SearchBar({ onSearch, searching, placeholder = "Search for topics, questions, or keywords...", initialValue = '' }) {
  const [query, setQuery] = useState(initialValue);

  // Update query when initialValue changes
  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        className="search-input"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={searching}
      />
      <button
        type="submit"
        className="search-button"
        disabled={searching || !query.trim()}
      >
        {searching ? 'Searching...' : 'Search'}
      </button>
    </form>
  );
}

export default SearchBar;
