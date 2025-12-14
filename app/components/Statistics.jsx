'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getStatistics } from '@/lib/dbUtils';
import './Statistics.css';

function Statistics({ results }) {
  const stats = getStatistics(results);

  return (
    <div className="statistics">
      <h3>Search Results Statistics</h3>

      <div className="stats-grid">
        <div className="stat-card">
          <h4>Results by Speaker</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.bySpeaker}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="speaker" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card">
          <h4>Results by Date</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.byDate}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card">
          <h4>Results by Episode</h4>
          <div className="episode-list">
            {stats.byEpisode.slice(0, 10).map((ep, i) => (
              <div key={i} className="episode-stat">
                <span className="episode-title">{ep.title}</span>
                <span className="episode-count">{ep.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Statistics;
