export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: any;
  userId?: string;
  component?: string;
}

class Logger {
  private level: LogLevel = LogLevel.INFO;

  constructor() {
    // In production, set to WARN or ERROR to reduce noise
    this.level = process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.DEBUG;
  }

  private formatMessage(level: LogLevel, message: string, data?: any, component?: string): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
    };

    if (data) entry.data = data;
    if (component) entry.component = component;
    
    // Try to get user info from token
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        entry.userId = payload.username || payload.id;
      }
    } catch {}

    return entry;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  private log(level: LogLevel, message: string, data?: any, component?: string) {
    if (!this.shouldLog(level)) return;

    const entry = this.formatMessage(level, message, data, component);
    
    // In production, send to logging service instead of console
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to logging service (e.g., LogRocket, DataDog, etc.)
      if (level >= LogLevel.ERROR) {
        console.error('[ERROR]', entry.message, entry.data);
      } else if (level >= LogLevel.WARN) {
        console.warn('[WARN]', entry.message, entry.data);
      }
    } else {
      // Development logging
      const colors = {
        [LogLevel.DEBUG]: 'color: #666',
        [LogLevel.INFO]: 'color: #2196F3',
        [LogLevel.WARN]: 'color: #FF9800',
        [LogLevel.ERROR]: 'color: #F44336',
      };
      const prefix = `%c[${LogLevel[level]}]`;
      console.log(prefix, colors[level], entry.message, entry.data || '');
    }
  }

  debug(message: string, data?: any, component?: string) {
    this.log(LogLevel.DEBUG, message, data, component);
  }

  info(message: string, data?: any, component?: string) {
    this.log(LogLevel.INFO, message, data, component);
  }

  warn(message: string, data?: any, component?: string) {
    this.log(LogLevel.WARN, message, data, component);
  }

  error(message: string, data?: any, component?: string) {
    this.log(LogLevel.ERROR, message, data, component);
  }
}

export const logger = new Logger();