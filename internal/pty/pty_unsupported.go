//go:build !windows && !darwin && !linux

package pty

import (
	"errors"
	"io"
)

// Terminal represents a pseudo-terminal on unsupported platforms (stub).
type Terminal struct{}

// Start returns an unsupported error on non-Windows / non-POSIX platforms.
func Start(commandLine string, cols, rows int) (*Terminal, error) {
	return nil, errors.New("native pseudo-terminal is not supported on this platform")
}

// Read returns io.ErrClosedPipe.
func (t *Terminal) Read(p []byte) (n int, err error) {
	return 0, io.ErrClosedPipe
}

// Write returns io.ErrClosedPipe.
func (t *Terminal) Write(p []byte) (n int, err error) {
	return 0, io.ErrClosedPipe
}

// Resize is a no-op on unsupported platforms.
func (t *Terminal) Resize(cols, rows int) error {
	return nil
}

// Close is a no-op on unsupported platforms.
func (t *Terminal) Close() error {
	return nil
}

// Pid returns 0 on unsupported platforms.
func (t *Terminal) Pid() int {
	return 0
}
