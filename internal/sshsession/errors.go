package sshsession

import (
	"errors"
	"io"
	"net"
	"strings"
)

// ConnectionState represents the formal lifecycle states of a terminal session.
type ConnectionState string

const (
	StateDisconnected   ConnectionState = "Disconnected"
	StateConnecting     ConnectionState = "Connecting"
	StateAuthenticating ConnectionState = "Authenticating"
	StateConnected      ConnectionState = "Connected"
	StateReconnecting   ConnectionState = "Reconnecting"
	StateClosing        ConnectionState = "Closing"
	StateClosed         ConnectionState = "Closed"
	StateFailed         ConnectionState = "Failed"
)

// ErrorCategory represents the classified connection failure reason.
type ErrorCategory string

const (
	ErrTimeout           ErrorCategory = "Timeout"
	ErrConnectionRefused ErrorCategory = "Connection refused"
	ErrDNSFailure        ErrorCategory = "DNS failure"
	ErrAuthFailure       ErrorCategory = "Authentication failure"
	ErrHostKeyMismatch   ErrorCategory = "Host-key mismatch"
	ErrPermissionDenied  ErrorCategory = "Permission denied"
	ErrServerClosed      ErrorCategory = "Server closed connection"
	ErrUnknown           ErrorCategory = "Connection failed"
)

// ClassifiedError contains detailed classification, user-friendly description, and raw error.
type ClassifiedError struct {
	Category    ErrorCategory `json:"category"`
	Message     string        `json:"message"`
	Description string        `json:"description"`
	RawError    string        `json:"rawError"`
}

// ClassifyError inspects an error and maps it to a specific category and explanation.
func ClassifyError(err error) ClassifiedError {
	if err == nil {
		return ClassifiedError{
			Category:    "",
			Message:     "",
			Description: "",
			RawError:    "",
		}
	}

	if errors.Is(err, io.EOF) || err.Error() == "EOF" {
		return ClassifiedError{
			Category:    ErrServerClosed,
			Message:     "Server closed connection",
			Description: "The remote SSH server closed the connection (EOF).",
			RawError:    err.Error(),
		}
	}

	errStr := strings.ToLower(err.Error())

	// 1. Host-Key Mismatch
	if strings.Contains(errStr, "host key verification failed") ||
		strings.Contains(errStr, "host key mismatch") ||
		strings.Contains(errStr, "statusmismatch") ||
		strings.Contains(errStr, "remote host identification has changed") {
		return ClassifiedError{
			Category:    ErrHostKeyMismatch,
			Message:     "Host-key mismatch",
			Description: "The host key presented by the server does not match known_hosts.",
			RawError:    err.Error(),
		}
	}

	// 2. DNS Failure
	var dnsErr *net.DNSError
	if errors.As(err, &dnsErr) ||
		strings.Contains(errStr, "no such host") ||
		strings.Contains(errStr, "getaddrinfo") ||
		strings.Contains(errStr, "server misbehaving") ||
		strings.Contains(errStr, "name resolution") ||
		strings.Contains(errStr, "nodename nor servname provided") {
		return ClassifiedError{
			Category:    ErrDNSFailure,
			Message:     "DNS failure",
			Description: "Unable to resolve server hostname. Verify domain name and DNS configuration.",
			RawError:    err.Error(),
		}
	}

	// 3. Timeout
	var netErr net.Error
	if (errors.As(err, &netErr) && netErr.Timeout()) ||
		strings.Contains(errStr, "i/o timeout") ||
		strings.Contains(errStr, "timed out") ||
		strings.Contains(errStr, "deadline exceeded") {
		return ClassifiedError{
			Category:    ErrTimeout,
			Message:     "Timeout",
			Description: "Connection timed out while waiting for a response from the server.",
			RawError:    err.Error(),
		}
	}

	// 4. Connection Refused
	if strings.Contains(errStr, "connection refused") ||
		strings.Contains(errStr, "actively refused") ||
		strings.Contains(errStr, "connectex:") {
		return ClassifiedError{
			Category:    ErrConnectionRefused,
			Message:     "Connection refused",
			Description: "The target machine actively refused the connection. Verify that SSH is running on this port.",
			RawError:    err.Error(),
		}
	}

	// 5. Authentication Failure
	if strings.Contains(errStr, "unable to authenticate") ||
		strings.Contains(errStr, "handshake failed: unable to authenticate") ||
		strings.Contains(errStr, "password authentication failed") ||
		strings.Contains(errStr, "publickey authentication failed") ||
		strings.Contains(errStr, "auth failed") {
		return ClassifiedError{
			Category:    ErrAuthFailure,
			Message:     "Authentication failure",
			Description: "Credentials rejected by the server. Check username, password, or key passphrase.",
			RawError:    err.Error(),
		}
	}

	// 6. Permission Denied
	if strings.Contains(errStr, "permission denied") {
		return ClassifiedError{
			Category:    ErrPermissionDenied,
			Message:     "Permission denied",
			Description: "Access was denied by the server policy or user permissions.",
			RawError:    err.Error(),
		}
	}

	// 7. Server Closed / Reset
	if strings.Contains(errStr, "connection reset by peer") ||
		strings.Contains(errStr, "closed by remote host") ||
		strings.Contains(errStr, "broken pipe") ||
		strings.Contains(errStr, "use of closed network connection") {
		return ClassifiedError{
			Category:    ErrServerClosed,
			Message:     "Server closed connection",
			Description: "The network connection was abruptly closed or reset by the remote host.",
			RawError:    err.Error(),
		}
	}

	return ClassifiedError{
		Category:    ErrUnknown,
		Message:     "Connection failed",
		Description: err.Error(),
		RawError:    err.Error(),
	}
}
