'use client'

import { useRef, useEffect, useState } from 'react';
import YouTube from 'react-youtube';
import './VideoPlayer.css';

function VideoPlayer({ clip, autoPlay = false, onAutoPlayChange, onTimeUpdate, onSeek }) {
  const playerRef = useRef(null);
  const [intervalId, setIntervalId] = useState(null);

  // Extract YouTube video ID from URL
  const getVideoId = (url) => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?#]+)/,
      /youtube\.com\/embed\/([^&?#]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  };

  const videoId = getVideoId(clip.video_url);

  useEffect(() => {
    if (playerRef.current && clip.timestamp_seconds) {
      // Seek to timestamp when clip changes
      playerRef.current.seekTo(clip.timestamp_seconds, true);

      // If autoPlay is enabled, start playing
      if (autoPlay) {
        playerRef.current.playVideo();
      }
    }
  }, [clip, autoPlay]);

  // Expose seek function via callback
  useEffect(() => {
    if (onSeek) {
      onSeek.current = (time) => {
        if (playerRef.current && playerRef.current.seekTo) {
          playerRef.current.seekTo(time, true);
        }
      };
    }
  }, [onSeek]);

  // Poll for current time updates
  useEffect(() => {
    // Clear any existing interval
    if (intervalId) {
      clearInterval(intervalId);
    }

    if (onTimeUpdate) {
      const id = setInterval(() => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          try {
            const currentTime = playerRef.current.getCurrentTime();
            if (currentTime !== undefined && !isNaN(currentTime)) {
              onTimeUpdate(currentTime);
              console.log('VideoPlayer - updating time:', currentTime);
            }
          } catch (e) {
            // Player not ready yet
            console.log('VideoPlayer - player not ready');
          }
        }
      }, 500); // Update every 500ms

      setIntervalId(id);

      return () => {
        clearInterval(id);
      };
    }
  }, [onTimeUpdate, clip]);

  const onReady = (event) => {
    playerRef.current = event.target;
    // Seek to the timestamp when player is ready
    if (clip.timestamp_seconds) {
      event.target.seekTo(clip.timestamp_seconds, true);
    }

    // If autoPlay is enabled, start playing
    if (autoPlay) {
      event.target.playVideo();
    }
  };

  const opts = {
    height: '390',
    width: '100%',
    playerVars: {
      autoplay: autoPlay ? 1 : 0,
      start: clip.timestamp_seconds || 0
    }
  };

  if (!videoId) {
    return (
      <div className="video-player error">
        <p>Unable to load video from URL: {clip.video_url}</p>
      </div>
    );
  }

  return (
    <div className="video-player">
      <div className="video-info">
        <div className="video-title-row">
          <h3>{clip.title}</h3>
          <label className="autoplay-toggle">
            <input
              type="checkbox"
              checked={autoPlay}
              onChange={(e) => onAutoPlayChange && onAutoPlayChange(e.target.checked)}
            />
            <span>Auto</span>
          </label>
        </div>
        <p className="video-meta">
          <span className="speaker">{clip.speaker}</span>
          <span className="separator">•</span>
          <span className="timestamp">{clip.timestamp}</span>
          <span className="separator">•</span>
          <span className="date">{clip.date}</span>
        </p>
      </div>

      <div className="video-container">
        <YouTube
          videoId={videoId}
          opts={opts}
          onReady={onReady}
        />
      </div>
    </div>
  );
}

export default VideoPlayer;
