package sshsession

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net"

	"golang.org/x/crypto/ssh"
)

// x11Request is the payload for an SSH "x11-req" channel request.
type x11Request struct {
	SingleConnection bool
	AuthProtocol     string
	AuthCookie       string
	ScreenNumber     uint32
}

// setupX11Forwarding asks the server to enable X11 forwarding on this session
// and then forwards any x11 channels the server opens back to the local X server
// (for example VcXsrv or Xming on Windows) listening on 127.0.0.1:(6000+display).
// It is best-effort: it returns an error only if the initial request fails.
func setupX11Forwarding(session *ssh.Session, client *ssh.Client, display int) error {
	if session == nil || client == nil {
		return fmt.Errorf("nil session or client")
	}

	cookie := make([]byte, 16)
	if _, err := rand.Read(cookie); err != nil {
		return err
	}

	payload := x11Request{
		SingleConnection: false,
		AuthProtocol:     "MIT-MAGIC-COOKIE-1",
		AuthCookie:       hex.EncodeToString(cookie),
		ScreenNumber:     0,
	}

	ok, err := session.SendRequest("x11-req", true, ssh.Marshal(&payload))
	if err != nil {
		return err
	}
	if !ok {
		return fmt.Errorf("server rejected x11 forwarding request")
	}

	channels := client.HandleChannelOpen("x11")
	if channels == nil {
		return fmt.Errorf("x11 channels already being handled")
	}

	go func() {
		for newCh := range channels {
			ch, reqs, aerr := newCh.Accept()
			if aerr != nil {
				continue
			}
			go ssh.DiscardRequests(reqs)
			go forwardX11Channel(ch, display)
		}
	}()

	return nil
}

// forwardX11Channel pipes a single incoming x11 channel to the local X server.
func forwardX11Channel(ch ssh.Channel, display int) {
	if display < 0 {
		display = 0
	}
	port := 6000 + display
	xconn, err := net.Dial("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		_ = ch.Close()
		return
	}

	done := make(chan struct{}, 2)
	go func() { _, _ = io.Copy(ch, xconn); done <- struct{}{} }()
	go func() { _, _ = io.Copy(xconn, ch); done <- struct{}{} }()
	<-done

	_ = xconn.Close()
	_ = ch.Close()
}
