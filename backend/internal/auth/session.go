package auth

import (
	"crypto/rand"
	"time"

	"github.com/oklog/ulid/v2"
)

const SessionDuration = 30 * 24 * time.Hour // 30 days

// GenerateID creates a new ULID
func GenerateID() string {
	return ulid.MustNew(ulid.Timestamp(time.Now()), rand.Reader).String()
}

// GetCurrentTimestamp returns the current time in milliseconds
func GetCurrentTimestamp() int64 {
	return time.Now().UnixMilli()
}

// GetSessionExpiry returns the expiry time for a new session
func GetSessionExpiry() int64 {
	return time.Now().Add(SessionDuration).UnixMilli()
}
