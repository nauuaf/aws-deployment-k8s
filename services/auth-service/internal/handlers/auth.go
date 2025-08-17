package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/sirupsen/logrus"

	"auth-service/internal/models"
	"auth-service/internal/service"
)

type AuthHandler struct {
	authService *service.AuthService
	validator   *validator.Validate
}

func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{
		authService: authService,
		validator:   validator.New(),
	}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req models.RegisterRequest
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request format",
			"message": err.Error(),
		})
		return
	}

	if err := h.validator.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Validation failed",
			"message": err.Error(),
		})
		return
	}

	user, err := h.authService.Register(&req)
	if err != nil {
		logrus.WithError(err).Error("Registration failed")
		
		if err.Error() == "user already exists" {
			c.JSON(http.StatusConflict, gin.H{
				"error": "User already exists",
				"message": "An account with this email already exists",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Registration failed",
			"message": "Unable to create account",
		})
		return
	}

	// Generate tokens
	authResponse, err := h.authService.GenerateTokens(user)
	if err != nil {
		logrus.WithError(err).Error("Token generation failed")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Registration successful but token generation failed",
			"message": "Please try logging in",
		})
		return
	}

	logrus.WithField("user_id", user.ID).Info("User registered successfully")
	
	c.JSON(http.StatusCreated, gin.H{
		"message": "Registration successful",
		"token": authResponse.Token,
		"refreshToken": authResponse.RefreshToken,
		"user": user,
		"expiresIn": authResponse.ExpiresIn,
		"expiresAt": authResponse.ExpiresAt,
	})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request format",
			"message": err.Error(),
		})
		return
	}

	if err := h.validator.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Validation failed",
			"message": err.Error(),
		})
		return
	}

	user, err := h.authService.Login(&req)
	if err != nil {
		logrus.WithError(err).WithField("email", req.Email).Warning("Login attempt failed")
		
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid credentials",
			"message": "Email or password is incorrect",
		})
		return
	}

	// Generate tokens
	authResponse, err := h.authService.GenerateTokens(user)
	if err != nil {
		logrus.WithError(err).Error("Token generation failed")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Login successful but token generation failed",
			"message": "Please try again",
		})
		return
	}

	// Update last login time
	if err := h.authService.UpdateLastLogin(user.ID); err != nil {
		logrus.WithError(err).Warning("Failed to update last login time")
	}

	logrus.WithField("user_id", user.ID).Info("User logged in successfully")
	
	c.JSON(http.StatusOK, gin.H{
		"message": "Login successful",
		"token": authResponse.Token,
		"refreshToken": authResponse.RefreshToken,
		"user": user,
		"expiresIn": authResponse.ExpiresIn,
		"expiresAt": authResponse.ExpiresAt,
	})
}

func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req models.RefreshTokenRequest
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request format",
			"message": err.Error(),
		})
		return
	}

	if err := h.validator.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Validation failed",
			"message": err.Error(),
		})
		return
	}

	authResponse, err := h.authService.RefreshToken(req.RefreshToken)
	if err != nil {
		logrus.WithError(err).Warning("Token refresh failed")
		
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid refresh token",
			"message": "Please login again",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Token refreshed successfully",
		"token": authResponse.Token,
		"refreshToken": authResponse.RefreshToken,
		"user": authResponse.User,
		"expiresIn": authResponse.ExpiresIn,
		"expiresAt": authResponse.ExpiresAt,
	})
}

func (h *AuthHandler) VerifyToken(c *gin.Context) {
	var req models.VerifyTokenRequest
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request format",
			"message": err.Error(),
		})
		return
	}

	if err := h.validator.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Validation failed",
			"message": err.Error(),
		})
		return
	}

	user, err := h.authService.VerifyToken(req.Token)
	if err != nil {
		c.JSON(http.StatusOK, models.VerifyTokenResponse{
			Valid: false,
			Error: "Token is invalid or expired",
		})
		return
	}

	c.JSON(http.StatusOK, models.VerifyTokenResponse{
		Valid: true,
		User:  user,
	})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Authorization header required",
			"message": "Please provide a valid token",
		})
		return
	}

	// Extract token from "Bearer <token>"
	token := authHeader
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		token = authHeader[7:]
	}

	err := h.authService.Logout(token)
	if err != nil {
		logrus.WithError(err).Warning("Logout failed")
		// Still return success for security reasons
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Logout successful",
	})
}

func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req models.ForgotPasswordRequest
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request format",
			"message": err.Error(),
		})
		return
	}

	if err := h.validator.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Validation failed",
			"message": err.Error(),
		})
		return
	}

	err := h.authService.ForgotPassword(req.Email)
	if err != nil {
		logrus.WithError(err).Warning("Password reset request failed")
	}

	// Always return success for security reasons
	c.JSON(http.StatusOK, gin.H{
		"message": "If an account with that email exists, a password reset email has been sent",
	})
}

func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req models.ResetPasswordRequest
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request format",
			"message": err.Error(),
		})
		return
	}

	if err := h.validator.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Validation failed",
			"message": err.Error(),
		})
		return
	}

	err := h.authService.ResetPassword(req.Token, req.Password)
	if err != nil {
		logrus.WithError(err).Warning("Password reset failed")
		
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Password reset failed",
			"message": "Invalid or expired reset token",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Password reset successful",
	})
}