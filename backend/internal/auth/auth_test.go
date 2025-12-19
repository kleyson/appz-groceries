package auth

import (
	"testing"
	"time"
)

func TestHashPassword(t *testing.T) {
	password := "testpassword123"

	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword failed: %v", err)
	}

	if hash == "" {
		t.Error("Hash should not be empty")
	}

	if hash == password {
		t.Error("Hash should not equal the original password")
	}
}

func TestCheckPassword(t *testing.T) {
	password := "testpassword123"
	wrongPassword := "wrongpassword"

	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword failed: %v", err)
	}

	// Test correct password
	if !CheckPassword(password, hash) {
		t.Error("CheckPassword should return true for correct password")
	}

	// Test wrong password
	if CheckPassword(wrongPassword, hash) {
		t.Error("CheckPassword should return false for wrong password")
	}
}

func TestCheckPasswordWithInvalidHash(t *testing.T) {
	// Test with invalid hash
	if CheckPassword("password", "invalidhash") {
		t.Error("CheckPassword should return false for invalid hash")
	}
}

func TestGenerateID(t *testing.T) {
	id1 := GenerateID()
	id2 := GenerateID()

	if id1 == "" {
		t.Error("GenerateID should not return empty string")
	}

	if len(id1) != 26 {
		t.Errorf("ULID should be 26 characters, got %d", len(id1))
	}

	if id1 == id2 {
		t.Error("GenerateID should return unique IDs")
	}
}

func TestGetCurrentTimestamp(t *testing.T) {
	before := time.Now().UnixMilli()
	ts := GetCurrentTimestamp()
	after := time.Now().UnixMilli()

	if ts < before || ts > after {
		t.Errorf("Timestamp should be between %d and %d, got %d", before, after, ts)
	}
}

func TestGetSessionExpiry(t *testing.T) {
	before := time.Now().Add(SessionDuration).UnixMilli()
	expiry := GetSessionExpiry()
	after := time.Now().Add(SessionDuration).UnixMilli()

	if expiry < before || expiry > after {
		t.Errorf("Session expiry should be ~30 days from now")
	}
}

func TestSessionDuration(t *testing.T) {
	expected := 30 * 24 * time.Hour
	if SessionDuration != expected {
		t.Errorf("SessionDuration should be 30 days, got %v", SessionDuration)
	}
}
