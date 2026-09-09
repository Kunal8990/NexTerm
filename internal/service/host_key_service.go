package service

import (
	"fmt"
	"net"
	"nexterm/internal/hostkey"
	"sync"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/ssh"
)

// HostKeyService manages SSH known_hosts validation, interactive prompt dispatch, and host identity storage.
type HostKeyService struct {
	mu                sync.RWMutex
	mgr               *hostkey.Manager
	pendingHostKeysMu sync.Mutex
	pendingHostKeys   map[string]chan string
	emitter           EventEmitter
}

// NewHostKeyService constructs a new HostKeyService.
func NewHostKeyService(emitter EventEmitter) *HostKeyService {
	if emitter == nil {
		emitter = &NullEventEmitter{}
	}
	return &HostKeyService{
		mgr:             hostkey.GetDefaultManager(),
		pendingHostKeys: make(map[string]chan string),
		emitter:         emitter,
	}
}

// SetManager overrides or updates the hostkey Manager.
func (h *HostKeyService) SetManager(m *hostkey.Manager) {
	h.mu.Lock()
	h.mgr = m
	h.mu.Unlock()
}

// GetKnownHosts returns all known_hosts entries.
func (h *HostKeyService) GetKnownHosts() ([]hostkey.HostKeyEntry, error) {
	h.mu.RLock()
	mgr := h.mgr
	h.mu.RUnlock()

	if mgr == nil {
		mgr = hostkey.GetDefaultManager()
	}
	return mgr.List()
}

// DeleteKnownHost removes a host entry from known_hosts.
func (h *HostKeyService) DeleteKnownHost(hostname string, port int) error {
	h.mu.RLock()
	mgr := h.mgr
	h.mu.RUnlock()

	if mgr == nil {
		mgr = hostkey.GetDefaultManager()
	}
	return mgr.Remove(hostname, port)
}

// BuildHostKeyCallback produces an ssh.HostKeyCallback that checks known_hosts and emits interactive verify requests.
func (h *HostKeyService) BuildHostKeyCallback() ssh.HostKeyCallback {
	return func(hostname string, remote net.Addr, key ssh.PublicKey) error {
		h.mu.RLock()
		mgr := h.mgr
		h.mu.RUnlock()

		if mgr == nil {
			mgr = hostkey.GetDefaultManager()
		}

		res, err := mgr.Check(hostname, remote, key)
		if err != nil {
			return err
		}

		if res.Status == hostkey.StatusTrusted {
			return nil
		}

		if res.Status == hostkey.StatusRevoked {
			return fmt.Errorf("host key for %s is revoked in known_hosts", hostname)
		}

		// Prompt user interactively for Unknown or Mismatch
		reqID := uuid.NewString()
		respChan := make(chan string, 1)

		h.pendingHostKeysMu.Lock()
		h.pendingHostKeys[reqID] = respChan
		h.pendingHostKeysMu.Unlock()

		defer func() {
			h.pendingHostKeysMu.Lock()
			delete(h.pendingHostKeys, reqID)
			h.pendingHostKeysMu.Unlock()
		}()

		// Emit event to frontend
		h.emitter.Emit("ssh:hostkey:verify_request", map[string]interface{}{
			"requestId":         reqID,
			"host":              res.Host,
			"port":              res.Port,
			"normalizedAddr":    res.NormalizedAddr,
			"keyType":           res.KeyType,
			"fingerprintSha256": res.FingerprintSHA256,
			"fingerprintMd5":    res.FingerprintMD5,
			"status":            string(res.Status),
			"oldKeyType":        res.OldKeyType,
			"oldFingerprintSha": res.OldFingerprintSHA,
			"oldFingerprintMd5": res.OldFingerprintMD5,
			"knownHostsPath":    res.KnownHostsPath,
			"message":           res.Message,
		})

		select {
		case action := <-respChan:
			switch action {
			case "accept_save":
				if res.Status == hostkey.StatusMismatch {
					if rErr := mgr.Replace(hostname, remote, key); rErr != nil {
						return fmt.Errorf("failed to update known_hosts: %w", rErr)
					}
				} else {
					if aErr := mgr.Add(hostname, remote, key); aErr != nil {
						return fmt.Errorf("failed to save to known_hosts: %w", aErr)
					}
				}
				return nil
			case "accept_once":
				return nil
			case "reject":
				return fmt.Errorf("connection rejected by user: host key untrusted")
			default:
				return fmt.Errorf("connection rejected: unexpected action %q", action)
			}
		case <-time.After(120 * time.Second):
			return fmt.Errorf("connection timed out: host key verification took too long")
		}
	}
}

// RespondHostKey delivers user decision for a pending host key prompt.
func (h *HostKeyService) RespondHostKey(requestID string, action string) error {
	h.pendingHostKeysMu.Lock()
	ch, ok := h.pendingHostKeys[requestID]
	h.pendingHostKeysMu.Unlock()

	if !ok || ch == nil {
		return fmt.Errorf("verification request not found or expired: %s", requestID)
	}

	select {
	case ch <- action:
		return nil
	default:
		return fmt.Errorf("host key request already answered")
	}
}

// GetAlgorithmsForHost returns known public key algorithm types for the host and port.
func (h *HostKeyService) GetAlgorithmsForHost(hostname string, port int) []string {
	h.mu.RLock()
	mgr := h.mgr
	h.mu.RUnlock()

	if mgr == nil {
		mgr = hostkey.GetDefaultManager()
	}
	return mgr.GetAlgorithmsForHost(hostname, port)
}
