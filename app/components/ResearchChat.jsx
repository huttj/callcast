'use client'

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './ResearchChat.css';

/**
 * Component to render markdown with clickable timestamps
 */
function MarkdownWithTimestamps({ content, utteranceResults, onClipSelect }) {
  // Parse text and make timestamps clickable
  const parseTextWithTimestamps = (text) => {
    if (typeof text !== 'string') return text;

    const parts = [];
    // Match timestamps in various formats: [12:34], [1:23:45], 12:34, 1:23:45
    const regex = /\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const timestamp = match[1];

      // Find matching utterance for this timestamp
      const utterance = utteranceResults?.find(u => u.timestamp === timestamp);

      if (utterance) {
        parts.push(
          <button
            key={`ts-${match.index}`}
            className="timestamp-link"
            onClick={() => onClipSelect({
              timestamp,
              timestamp_seconds: utterance.timestamp_seconds,
              video_url: utterance.video_url,
              title: utterance.title,
              speaker: utterance.speaker,
              text: utterance.text,
              date: utterance.date
            })}
            title={`Play at ${timestamp}`}
          >
            [{timestamp}]
          </button>
        );
      } else {
        parts.push(`[${timestamp}]`);
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
      return parseTextWithTimestamps(children);
    }
    if (Array.isArray(children)) {
      return children.map((child, idx) =>
        typeof child === 'string' ? parseTextWithTimestamps(child) : child
      );
    }
    return children;
  };

  const components = {
    p: ({ children, ...props }) => {
      return <p {...props}>{processChildren(children)}</p>;
    },
    li: ({ children, ...props }) => {
      return <li {...props}>{processChildren(children)}</li>;
    },
    strong: ({ children, ...props }) => {
      return <strong {...props}>{processChildren(children)}</strong>;
    },
    em: ({ children, ...props }) => {
      return <em {...props}>{processChildren(children)}</em>;
    }
  };

  return <ReactMarkdown components={components}>{content}</ReactMarkdown>;
}

function ResearchChat({ onTopicSelect, onClipSelect }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const conversationHistory = useRef([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (query) => {
    if (!query.trim() || isLoading) return;

    // Add user message to UI
    const userMessage = { role: 'user', content: query };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/research-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          conversationHistory: conversationHistory.current
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Update conversation history
      conversationHistory.current.push(userMessage);
      conversationHistory.current.push({
        role: 'assistant',
        content: data.response
      });

      // Add assistant message to UI
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response,
        suggestedSearch: data.suggestedSearch,
        topicResults: data.topicResults,
        utteranceResults: data.utteranceResults
      }]);
    } catch (error) {
      console.error('Research chat error:', error);
      setMessages(prev => [...prev, {
        role: 'error',
        content: `Error: ${error.message}. Make sure the API server is running (npm run api).`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleSuggestedSearch = (query) => {
    setInput(query);
    sendMessage(query);
  };

  const handleTopicClick = (topic) => {
    if (onTopicSelect) {
      onTopicSelect(topic.topic_title);
    }
  };

  return (
    <div className="research-chat">
      <div className="chat-header">
        <h3>Research Assistant</h3>
        <p className="chat-subtitle">Ask questions about the transcripts</p>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>Ask me anything about the podcast transcripts!</p>
            <div className="example-questions">
              <button onClick={() => sendMessage("What topics are discussed about love?")}>
                What topics are discussed about love?
              </button>
              <button onClick={() => sendMessage("Tell me about documentation strategies")}>
                Tell me about documentation strategies
              </button>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className={`message message-${message.role}`}>
            {message.role === 'user' && (
              <div className="message-content">
                <strong>You:</strong> {message.content}
              </div>
            )}

            {message.role === 'assistant' && (
              <div className="message-content">
                <div className="assistant-response">
                  <strong>Assistant:</strong>
                  <div className="response-text">
                    <MarkdownWithTimestamps
                      content={message.content}
                      utteranceResults={message.utteranceResults}
                      onClipSelect={onClipSelect}
                    />
                  </div>
                </div>

                {message.suggestedSearch && (
                  <div className="suggested-search">
                    <span className="suggestion-label">Suggested follow-up:</span>
                    <button
                      className="suggestion-button"
                      onClick={() => handleSuggestedSearch(message.suggestedSearch)}
                    >
                      {message.suggestedSearch}
                    </button>
                  </div>
                )}

                {message.topicResults && message.topicResults.length > 0 && (
                  <div className="context-topics">
                    <details>
                      <summary>View {message.topicResults.length} relevant topics</summary>
                      <div className="topic-list">
                        {message.topicResults.map((topic, idx) => (
                          <div
                            key={idx}
                            className="context-topic"
                            onClick={() => handleTopicClick(topic)}
                          >
                            <div className="topic-name">{topic.topic_title}</div>
                            <div className="topic-meta">{topic.title} • {topic.date}</div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            )}

            {message.role === 'error' && (
              <div className="message-content error-content">
                {message.content}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="message message-loading">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="chat-input"
          placeholder="Ask a question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
        />
        <button
          type="submit"
          className="chat-send-button"
          disabled={!input.trim() || isLoading}
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default ResearchChat;
