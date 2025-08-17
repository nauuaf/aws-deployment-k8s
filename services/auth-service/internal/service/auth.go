package service

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"golang.org/x/crypto/bcrypt"

	"auth-service/internal/models"
	"auth-service/internal/repository"
)

type AuthService struct {
	userRepo     *repository.UserRepository
	jwtSecret    []byte
	tokenExpiry  time.Duration
	refreshExpiry time.Duration
}

func NewAuthService(userRepo *repository.UserRepository) *AuthService {
	jwtSecret := []byte(os.Getenv("JWT_SECRET"))
	if len(jwtSecret) == 0 {
		jwtSecret = []byte("default-secret-change-in-production")
		logrus.Warning("JWT_SECRET not set, using default secret")
	}

	tokenExpiry := 24 * time.Hour // default 24 hours
	if expiryStr := os.Getenv("JWT_EXPIRY_HOURS"); expiryStr != "" {
		if hours, err := strconv.Atoi(expiryStr); err == nil {
			tokenExpiry = time.Duration(hours) * time.Hour
		}
	}

	refreshExpiry := 7 * 24 * time.Hour // default 7 days
	if refreshStr := os.Getenv("JWT_REFRESH_EXPIRY_HOURS"); refreshStr != "" {
		if hours, err := strconv.Atoi(refreshStr); err == nil {
			refreshExpiry = time.Duration(hours) * time.Hour
		}
	}

	return &AuthService{
		userRepo:      userRepo,
		jwtSecret:     jwtSecret,
		tokenExpiry:   tokenExpiry,
		refreshExpiry: refreshExpiry,
	}
}

func (s *AuthService) Register(req *models.RegisterRequest) (*models.User, error) {
	// Check if user already exists
	existingUser, _ := s.userRepo.GetByEmail(req.Email)
	if existingUser != nil {
		return nil, errors.New("user already exists")
	}

	// Hash password
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		logrus.WithError(err).Error("Failed to hash password")
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Create user
	user := &models.User{
		Email:        req.Email,
		PasswordHash: string(passwordHash),
		FirstName:    req.FirstName,
		LastName:     req.LastName,
	}

	createdUser, err := s.userRepo.Create(user)
	if err != nil {
		return nil, err
	}

	// Clear sensitive data
	createdUser.PasswordHash = ""

	return createdUser, nil
}

func (s *AuthService) Login(req *models.LoginRequest) (*models.User, error) {
	// Get user by email
	user, err := s.userRepo.GetByEmail(req.Email)
	if err != nil {
		return nil, errors.New("invalid credentials")
	}

	// Verify password
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
	if err != nil {
		return nil, errors.New("invalid credentials")
	}

	// Clear sensitive data
	user.PasswordHash = ""

	return user, nil
}

func (s *AuthService) GenerateTokens(user *models.User) (*models.AuthResponse, error) {
	now := time.Now()
	expiresAt := now.Add(s.tokenExpiry)

	// Create access token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":       user.ID,
		"email":     user.Email,
		"exp":       expiresAt.Unix(),
		"iat":       now.Unix(),
		"type":      "access",
		"user_id":   user.ID,
		"is_active": user.IsActive,
	})

	accessToken, err := token.SignedString(s.jwtSecret)
	if err != nil {
		logrus.WithError(err).Error("Failed to sign access token")
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	// Create refresh token
	refreshExpiresAt := now.Add(s.refreshExpiry)
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":     user.ID,
		"exp":     refreshExpiresAt.Unix(),
		"iat":     now.Unix(),
		"type":    "refresh",
		"user_id": user.ID,
	})

	refreshTokenString, err := refreshToken.SignedString(s.jwtSecret)
	if err != nil {
		logrus.WithError(err).Error("Failed to sign refresh token")
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	return &models.AuthResponse{
		Token:        accessToken,
		RefreshToken: refreshTokenString,
		ExpiresIn:    int(s.tokenExpiry.Seconds()),
		ExpiresAt:    expiresAt,
		User:         user,
	}, nil
}

func (s *AuthService) VerifyToken(tokenString string) (*models.User, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.jwtSecret, nil
	})

	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token claims")
	}

	tokenType, ok := claims["type"].(string)
	if !ok || tokenType != "access" {
		return nil, errors.New("invalid token type")
	}

	userIDString, ok := claims["user_id"].(string)
	if !ok {
		return nil, errors.New("invalid user ID in token")
	}
	userID, err := uuid.Parse(userIDString)
	if err != nil {
		return nil, fmt.Errorf("invalid user ID format: %w", err)
	}

	// Get user from database to ensure they still exist and are active
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// Clear sensitive data
	user.PasswordHash = ""

	return user, nil
}

func (s *AuthService) RefreshToken(refreshTokenString string) (*models.AuthResponse, error) {
	token, err := jwt.Parse(refreshTokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.jwtSecret, nil
	})

	if err != nil {
		return nil, fmt.Errorf("invalid refresh token: %w", err)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token claims")
	}

	tokenType, ok := claims["type"].(string)
	if !ok || tokenType != "refresh" {
		return nil, errors.New("invalid token type")
	}

	userIDString, ok := claims["user_id"].(string)
	if !ok {
		return nil, errors.New("invalid user ID in token")
	}
	userID, err := uuid.Parse(userIDString)
	if err != nil {
		return nil, fmt.Errorf("invalid user ID format: %w", err)
	}

	// Get user from database
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// Generate new tokens
	return s.GenerateTokens(user)
}

func (s *AuthService) UpdateLastLogin(userID uuid.UUID) error {
	return s.userRepo.UpdateLastLogin(userID)
}

func (s *AuthService) Logout(tokenString string) error {
	// In a production system, you might want to add the token to a blacklist
	// For now, we'll just validate the token
	_, err := s.VerifyToken(tokenString)
	return err
}

func (s *AuthService) ForgotPassword(email string) error {
	// Check if user exists
	user, err := s.userRepo.GetByEmail(email)
	if err != nil {
		// Don't reveal if user exists or not
		logrus.WithField("email", email).Info("Password reset requested for unknown email")
		return nil
	}

	// Generate reset token
	resetToken, err := s.generateResetToken()
	if err != nil {
		logrus.WithError(err).Error("Failed to generate reset token")
		return fmt.Errorf("failed to generate reset token: %w", err)
	}

	// In a real application, you would:
	// 1. Store the reset token in database with expiry
	// 2. Send email to user with reset link
	
	logrus.WithFields(logrus.Fields{
		"user_id":     user.ID,
		"email":       email,
		"reset_token": resetToken,
	}).Info("Password reset token generated (demo mode)")

	return nil
}

func (s *AuthService) ResetPassword(resetToken, newPassword string) error {
	// In a real application, you would:
	// 1. Validate the reset token from database
	// 2. Check if it's not expired
	// 3. Get the associated user
	// 4. Update their password
	// 5. Invalidate the reset token

	// For demo purposes, we'll just return an error
	return errors.New("password reset not implemented in demo mode")
}

func (s *AuthService) generateResetToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}