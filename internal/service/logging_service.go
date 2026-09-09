package service

import (
	"fmt"
	"sync"
	"time"
)

// LogLevel denotes log severity.
type LogLevel string

const (
	LogLevelInfo  LogLevel = "INFO"
	LogLevelWarn  LogLevel = "WARN"
	LogLevelError LogLevel = "ERROR"
	LogLevelDebug LogLevel = "DEBUG"
)

// LogEntry represents a single audit or diagnostic log event.
type LogEntry struct {
	Timestamp time.Time              `json:"timestamp"`
	Level     LogLevel               `json:"level"`
	Category  string                 `json:"category"`
	Message   string                 `json:"message"`
	Details   map[string]interface{} `json:"details,omitempty"`
}

// LoggingService manages session recording, audit logging, and in-memory diagnostic logs.
type LoggingService struct {
	mu         sync.RWMutex
	entries    []LogEntry
	maxEntries int
	emitter    EventEmitter
}

// NewLoggingService creates a new LoggingService instance.
func NewLoggingService(emitter EventEmitter) *LoggingService {
	if emitter == nil {
		emitter = &NullEventEmitter{}
	}
	return &LoggingService{
		entries:    make([]LogEntry, 0, 500),
		maxEntries: 1000,
		emitter:    emitter,
	}
}

func (l *LoggingService) log(level LogLevel, category, message string, details map[string]interface{}) {
	entry := LogEntry{
		Timestamp: time.Now(),
		Level:     level,
		Category:  category,
		Message:   message,
		Details:   details,
	}

	l.mu.Lock()
	if len(l.entries) >= l.maxEntries {
		// Evict oldest entry
		l.entries = l.entries[1:]
	}
	l.entries = append(l.entries, entry)
	l.mu.Unlock()

	// Emit event to UI if needed
	l.emitter.Emit("app:log", entry)
}

func (l *LoggingService) LogInfo(category, message string) {
	l.log(LogLevelInfo, category, message, nil)
}

func (l *LoggingService) LogWarn(category, message string) {
	l.log(LogLevelWarn, category, message, nil)
}

func (l *LoggingService) LogError(category, message string, err error) {
	var details map[string]interface{}
	if err != nil {
		details = map[string]interface{}{"error": err.Error()}
	}
	l.log(LogLevelError, category, message, details)
}

func (l *LoggingService) LogSessionEvent(tabID, event, message string) {
	details := map[string]interface{}{
		"tabId": tabID,
		"event": event,
	}
	l.log(LogLevelInfo, "session", fmt.Sprintf("[%s] %s: %s", tabID, event, message), details)
}

// GetRecentLogs retrieves the most recent N log entries.
func (l *LoggingService) GetRecentLogs(count int) []LogEntry {
	l.mu.RLock()
	defer l.mu.RUnlock()

	n := len(l.entries)
	if count <= 0 || count > n {
		count = n
	}

	start := n - count
	result := make([]LogEntry, count)
	copy(result, l.entries[start:])
	return result
}

// ClearLogs clears all in-memory log entries.
func (l *LoggingService) ClearLogs() {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.entries = l.entries[:0]
}
