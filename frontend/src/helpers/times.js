// utils/timeHelpers.js

/**
 * Converts seconds to MM:SS format with padding
 * @param {number} totalSeconds - Total seconds to convert
 * @returns {string} Formatted time string (MM:SS)
 * @example secondsToTime(65) => "01:05"
 * @example secondsToTime(0) => "00:00"
 */
export const secondsToTime = (totalSeconds) => {
  if (totalSeconds == null || isNaN(totalSeconds)) return '00:00';
  
  const absoluteSeconds = Math.abs(totalSeconds);
  const minutes = Math.floor(absoluteSeconds / 60);
  const seconds = absoluteSeconds % 60;
  const sign = totalSeconds < 0 ? '-' : '';
  
  return `${sign}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

/**
 * Converts MM:SS string to seconds
 * @param {string} timeStr - Time string in MM:SS format
 * @returns {number} Total seconds
 * @example timeToSeconds("01:05") => 65
 * @example timeToSeconds("00:30") => 30
 */
export const timeToSeconds = (timeStr) => {
  if (!timeStr) return 0;
  
  // Handle negative values
  const isNegative = timeStr.startsWith('-');
  const cleanStr = isNegative ? timeStr.substring(1) : timeStr;
  
  const parts = cleanStr.split(':');
  
  if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10) || 0;
    const seconds = parseInt(parts[1], 10) || 0;
    const total = minutes * 60 + seconds;
    return isNegative ? -total : total;
  }
  
  // If no colon, treat as seconds
  const value = parseInt(cleanStr, 10) || 0;
  return isNegative ? -value : value;
};

/**
 * Validates if a string is in valid MM:SS format
 * @param {string} timeStr - Time string to validate
 * @returns {boolean} True if valid MM:SS format
 * @example isValidTimeFormat("01:05") => true
 * @example isValidTimeFormat("1:05") => false (needs padding)
 * @example isValidTimeFormat("01:5") => false (needs padding)
 */
export const isValidTimeFormat = (timeStr) => {
  if (!timeStr) return false;
  
  // Check for negative sign
  const cleanStr = timeStr.startsWith('-') ? timeStr.substring(1) : timeStr;
  
  // Must be exactly MM:SS format with 2 digits each
  const pattern = /^[0-9]{2}:[0-9]{2}$/;
  if (!pattern.test(cleanStr)) return false;
  
  // Validate minutes and seconds ranges
  const parts = cleanStr.split(':');
  const minutes = parseInt(parts[0], 10);
  const seconds = parseInt(parts[1], 10);
  
  return minutes >= 0 && seconds >= 0 && seconds <= 59;
};

/**
 * Parses a time input allowing flexible formats (MM:SS or just seconds)
 * @param {string} input - User input string
 * @returns {number} Total seconds
 * @example parseTimeInput("01:30") => 90
 * @example parseTimeInput("90") => 90
 * @example parseTimeInput("1:30") => 90
 */
export const parseTimeInput = (input) => {
  if (!input) return 0;
  
  const cleanInput = input.trim();
  
  // If it contains a colon, parse as MM:SS
  if (cleanInput.includes(':')) {
    // Allow flexible format (1:30, 01:30, etc.)
    const parts = cleanInput.split(':');
    if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10) || 0;
      const seconds = parseInt(parts[1], 10) || 0;
      return minutes * 60 + seconds;
    }
  }
  
  // Otherwise, treat as seconds
  return parseInt(cleanInput, 10) || 0;
};

/**
 * Formats a time for display in a human-readable format
 * @param {number} seconds - Total seconds
 * @param {string} format - Display format ('mm:ss', 'h:mm:ss', 'auto')
 * @returns {string} Formatted time string
 * @example formatTimeDisplay(3665) => "1:01:05" (auto format)
 * @example formatTimeDisplay(90, 'mm:ss') => "01:30"
 */
export const formatTimeDisplay = (seconds, format = 'auto') => {
  if (seconds == null || isNaN(seconds)) return '00:00';
  
  const absSeconds = Math.abs(seconds);
  const sign = seconds < 0 ? '-' : '';
  
  const hours = Math.floor(absSeconds / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);
  const secs = absSeconds % 60;
  
  if (format === 'auto' && hours > 0) {
    return `${sign}${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  
  if (format === 'h:mm:ss' || (format === 'auto' && hours > 0)) {
    return `${sign}${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  
  // mm:ss format (default)
  const totalMinutes = Math.floor(absSeconds / 60);
  const remainingSeconds = absSeconds % 60;
  return `${sign}${String(totalMinutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

/**
 * Adds two time strings or numbers together
 * @param {string|number} time1 - First time (MM:SS or seconds)
 * @param {string|number} time2 - Second time (MM:SS or seconds)
 * @returns {number} Total seconds
 */
export const addTimes = (time1, time2) => {
  const seconds1 = typeof time1 === 'string' ? timeToSeconds(time1) : time1;
  const seconds2 = typeof time2 === 'string' ? timeToSeconds(time2) : time2;
  return seconds1 + seconds2;
};

/**
 * Formats seconds to a compact display (e.g., "1m 30s")
 * @param {number} seconds - Total seconds
 * @returns {string} Compact time string
 * @example formatCompactTime(90) => "1m 30s"
 * @example formatCompactTime(3600) => "1h 0m"
 */
export const formatCompactTime = (seconds) => {
  if (seconds == null || isNaN(seconds)) return '0s';
  
  const absSeconds = Math.abs(seconds);
  const sign = seconds < 0 ? '-' : '';
  
  const hours = Math.floor(absSeconds / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);
  const secs = absSeconds % 60;
  
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return `${sign}${parts.join(' ')}`;
};

/**
 * Converts minutes to seconds
 * @param {number} minutes - Minutes to convert
 * @returns {number} Total seconds
 */
export const minutesToSeconds = (minutes) => {
  return Math.round(minutes * 60);
};

/**
 * Converts seconds to minutes (with decimal)
 * @param {number} seconds - Seconds to convert
 * @param {number} decimals - Number of decimal places
 * @returns {number} Minutes
 */
export const secondsToMinutes = (seconds, decimals = 2) => {
  return Number((seconds / 60).toFixed(decimals));
};

// utils/timeFormat.js
export function formatTime(seconds) {
  if (seconds < 0) seconds = 0;
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  // If hours > 0, show HH:MM:SS
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }
  
  // Otherwise show MM:SS
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}