package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/sirupsen/logrus"

	"auth-service/internal/models"
)

type UserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{
		db: db,
	}
}

func (r *UserRepository) Create(user *models.User) (*models.User, error) {
	query := `
		INSERT INTO users (email, password_hash, first_name, last_name, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at, updated_at`

	now := time.Now().UTC()
	user.CreatedAt = now
	user.UpdatedAt = now
	user.IsActive = true

	err := r.db.QueryRow(
		query,
		user.Email,
		user.PasswordHash,
		user.FirstName,
		user.LastName,
		user.IsActive,
		user.CreatedAt,
		user.UpdatedAt,
	).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok {
			switch pqErr.Code {
			case "23505": // unique_violation
				return nil, errors.New("user already exists")
			}
		}
		logrus.WithError(err).Error("Failed to create user")
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return user, nil
}

func (r *UserRepository) GetByEmail(email string) (*models.User, error) {
	query := `
		SELECT id, email, password_hash, first_name, last_name, is_active, 
		       last_login_at, created_at, updated_at
		FROM users 
		WHERE email = $1`

	user := &models.User{}
	err := r.db.QueryRow(query, email).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.FirstName,
		&user.LastName,
		&user.IsActive,
		&user.LastLoginAt,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("user not found")
		}
		logrus.WithError(err).WithField("email", email).Error("Failed to get user by email")
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	if !user.IsActive {
		return nil, errors.New("user account is disabled")
	}

	return user, nil
}

func (r *UserRepository) GetByID(id uuid.UUID) (*models.User, error) {
	query := `
		SELECT id, email, password_hash, first_name, last_name, is_active,
		       last_login_at, created_at, updated_at
		FROM users 
		WHERE id = $1`

	user := &models.User{}
	err := r.db.QueryRow(query, id).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.FirstName,
		&user.LastName,
		&user.IsActive,
		&user.LastLoginAt,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("user not found")
		}
		logrus.WithError(err).WithField("user_id", id).Error("Failed to get user by ID")
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	if !user.IsActive {
		return nil, errors.New("user account is disabled")
	}

	return user, nil
}

func (r *UserRepository) UpdateLastLogin(id uuid.UUID) error {
	query := `UPDATE users SET last_login_at = $1, updated_at = $2 WHERE id = $3`
	
	now := time.Now().UTC()
	_, err := r.db.Exec(query, now, now, id)
	if err != nil {
		logrus.WithError(err).WithField("user_id", id).Error("Failed to update last login")
		return fmt.Errorf("failed to update last login: %w", err)
	}

	return nil
}

func (r *UserRepository) UpdatePassword(id uuid.UUID, passwordHash string) error {
	query := `UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3`
	
	now := time.Now().UTC()
	result, err := r.db.Exec(query, passwordHash, now, id)
	if err != nil {
		logrus.WithError(err).WithField("user_id", id).Error("Failed to update password")
		return fmt.Errorf("failed to update password: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return errors.New("user not found")
	}

	return nil
}

func (r *UserRepository) Delete(id uuid.UUID) error {
	// Soft delete by setting is_active to false
	query := `UPDATE users SET is_active = false, updated_at = $1 WHERE id = $2`
	
	now := time.Now().UTC()
	result, err := r.db.Exec(query, now, id)
	if err != nil {
		logrus.WithError(err).WithField("user_id", id).Error("Failed to delete user")
		return fmt.Errorf("failed to delete user: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return errors.New("user not found")
	}

	return nil
}

func (r *UserRepository) GetActiveUserCount() (int64, error) {
	query := `SELECT COUNT(*) FROM users WHERE is_active = true`
	
	var count int64
	err := r.db.QueryRow(query).Scan(&count)
	if err != nil {
		logrus.WithError(err).Error("Failed to get active user count")
		return 0, fmt.Errorf("failed to get user count: %w", err)
	}

	return count, nil
}

func (r *UserRepository) GetRecentRegistrations(days int) (int64, error) {
	query := `SELECT COUNT(*) FROM users WHERE created_at >= $1 AND is_active = true`
	
	since := time.Now().UTC().AddDate(0, 0, -days)
	var count int64
	err := r.db.QueryRow(query, since).Scan(&count)
	if err != nil {
		logrus.WithError(err).Error("Failed to get recent registrations")
		return 0, fmt.Errorf("failed to get recent registrations: %w", err)
	}

	return count, nil
}