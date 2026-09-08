package sshsession

import (
	"errors"
	"io"
	"net"
	"testing"
)

func TestClassifyError(t *testing.T) {
	tests := []struct {
		name         string
		err          error
		expectedCat  ErrorCategory
		expectedMsg  string
	}{
		{
			name:        "EOF",
			err:         io.EOF,
			expectedCat: ErrServerClosed,
			expectedMsg: "Server closed connection",
		},
		{
			name:        "Connection reset by peer",
			err:         errors.New("read: connection reset by peer"),
			expectedCat: ErrServerClosed,
			expectedMsg: "Server closed connection",
		},
		{
			name:        "DNS failure",
			err:         &net.DNSError{Err: "no such host", Name: "nonexistent.internal"},
			expectedCat: ErrDNSFailure,
			expectedMsg: "DNS failure",
		},
		{
			name:        "Connection refused",
			err:         errors.New("dial tcp 127.0.0.1:22: connectex: No connection could be made because the target machine actively refused it"),
			expectedCat: ErrConnectionRefused,
			expectedMsg: "Connection refused",
		},
		{
			name:        "Timeout",
			err:         errors.New("dial tcp 192.168.1.55:22: i/o timeout"),
			expectedCat: ErrTimeout,
			expectedMsg: "Timeout",
		},
		{
			name:        "Authentication failure",
			err:         errors.New("ssh: handshake failed: ssh: unable to authenticate, attempted methods [none password]"),
			expectedCat: ErrAuthFailure,
			expectedMsg: "Authentication failure",
		},
		{
			name:        "Permission denied",
			err:         errors.New("permission denied (publickey)"),
			expectedCat: ErrPermissionDenied,
			expectedMsg: "Permission denied",
		},
		{
			name:        "Host-key mismatch",
			err:         errors.New("host key verification failed: statusMismatch"),
			expectedCat: ErrHostKeyMismatch,
			expectedMsg: "Host-key mismatch",
		},
		{
			name:        "Generic unknown error",
			err:         errors.New("some unexpected socket protocol anomaly"),
			expectedCat: ErrUnknown,
			expectedMsg: "Connection failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res := ClassifyError(tt.err)
			if res.Category != tt.expectedCat {
				t.Errorf("got category %s, expected %s", res.Category, tt.expectedCat)
			}
			if res.Message != tt.expectedMsg {
				t.Errorf("got message %q, expected %q", res.Message, tt.expectedMsg)
			}
			if res.Description == "" {
				t.Errorf("description should not be empty")
			}
		})
	}
}
