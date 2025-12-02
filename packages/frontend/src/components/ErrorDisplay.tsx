import React from 'react';
import type { ApiError } from '../types';

interface ErrorDisplayProps {
  error: ApiError;
  onDismiss: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onDismiss }) => {
  const getErrorIcon = () => {
    switch (error.source) {
      case 'startgg': return '🏆';
      case 'network': return '🌐';
      default: return '❌';
    }
  };

  const getErrorTitle = () => {
    switch (error.source) {
      case 'startgg': return 'Start.gg API Error';
      case 'network': return 'Network Error';
      default: return 'Unknown Error';
    }
  };

  const getErrorSuggestion = () => {
    switch (error.source) {
      case 'startgg':
        return 'Check your API token in the .env file and ensure the tournament URL is valid.';
      case 'network':
        return 'Check your internet connection and try again.';
      default:
        return 'Please try refreshing the page or contact support if the issue persists.';
    }
  };

  const formatTimestamp = () => {
    return error.timestamp.toLocaleTimeString();
  };

  return (
    <div className="error-display">
      <div className="error-content">
        <div className="error-header">
          <span className="error-icon">{getErrorIcon()}</span>
          <div className="error-title-section">
            <h4 className="error-title">{getErrorTitle()}</h4>
            <span className="error-timestamp">{formatTimestamp()}</span>
          </div>
          <button 
            className="error-dismiss"
            onClick={onDismiss}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
        
        <div className="error-body">
          <p className="error-message">{error.message}</p>
          <p className="error-suggestion">{getErrorSuggestion()}</p>
          
          {error.source === 'startgg' && (
            <div className="error-help">
              <details>
                <summary>Need help with start.gg setup?</summary>
                <ol>
                  <li>Go to <a href="https://developer.start.gg/docs/authentication" target="_blank" rel="noopener noreferrer">start.gg developer docs</a></li>
                  <li>Create an API token</li>
                  <li>Add it to your .env file as VITE_STARTGG_API_TOKEN=your_token_here</li>
                  <li>Restart the application</li>
                </ol>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};