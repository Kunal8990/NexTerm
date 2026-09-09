package service

// EventEmitter abstracts event dispatching (e.g. to Wails runtime.EventsEmit)
// allowing services to remain decoupled from any specific GUI framework and easy to mock in tests.
type EventEmitter interface {
	Emit(event string, optionalData ...interface{})
}

// NullEventEmitter is a fallback emitter that ignores all events.
type NullEventEmitter struct{}

func (n *NullEventEmitter) Emit(event string, optionalData ...interface{}) {}
