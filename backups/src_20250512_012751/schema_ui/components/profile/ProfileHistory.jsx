import React from 'react';
import { useMemory } from './MemoryProvider';

/**
 * ProfileHistory - Component to display user profile history
 * 
 * @param {Object} props Component props
 * @param {string} props.userId User ID
 * @param {string} props.type Optional filter by history entry type
 * @param {number} props.limit Maximum number of entries to show
 * @param {boolean} props.showTimestamp Whether to show timestamps
 * @param {Object} props.className CSS class names for styling
 */
const ProfileHistory = ({ 
  userId,
  type,
  limit = 10,
  showTimestamp = true,
  className = {}
}) => {
  const { history, loading } = useMemory();
  
  // Filter history by type if provided
  const filteredHistory = type 
    ? history.filter(entry => entry.type === type)
    : history;
  
  // Limit the number of entries
  const limitedHistory = filteredHistory.slice(0, limit);
  
  // Format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  
  // Get type label
  const getTypeLabel = (entryType) => {
    switch (entryType) {
      case 'profile_update':
        return 'Profile Updated';
      case 'preferences_update':
        return 'Preferences Updated';
      case 'theme_update':
        return 'Theme Updated';
      case 'login':
        return 'User Login';
      case 'logout':
        return 'User Logout';
      default:
        return entryType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  if (loading) {
    return <div className={className.loading || 'history-loading'}>Loading history...</div>;
  }

  if (!history || history.length === 0) {
    return <div className={className.empty || 'history-empty'}>No history available</div>;
  }

  return (
    <div className={className.container || 'profile-history'}>
      <h3 className={className.title || 'history-title'}>Activity History</h3>
      
      <ul className={className.list || 'history-list'}>
        {limitedHistory.map(entry => (
          <li key={entry.id} className={className.item || 'history-item'}>
            <div className={className.header || 'history-item-header'}>
              <span className={className.type || 'history-type'}>
                {getTypeLabel(entry.type)}
              </span>
              
              {showTimestamp && entry.timestamp && (
                <span className={className.timestamp || 'history-timestamp'}>
                  {formatTimestamp(entry.timestamp)}
                </span>
              )}
            </div>
            
            {entry.data && entry.data.themeName && (
              <div className={className.details || 'history-details'}>
                <span className={className.label || 'history-label'}>Theme:</span>
                <span className={className.value || 'history-value'}>{entry.data.themeName}</span>
              </div>
            )}
            
            {entry.data && entry.data.sessionId && (
              <div className={className.details || 'history-details'}>
                <span className={className.label || 'history-label'}>Session:</span>
                <span className={className.value || 'history-value'}>
                  {entry.data.sessionId.substring(0, 8)}...
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
      
      {filteredHistory.length > limit && (
        <div className={className.more || 'history-more'}>
          {filteredHistory.length - limit} more entries not shown
        </div>
      )}
    </div>
  );
};

export default ProfileHistory;