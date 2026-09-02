package user

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// UserService defines the user service interface
type UserService interface {
	Create(userReq *CreateUserRequest) (*UserResponse, error)
	GetByID(id uint) (*UserResponse, error)
	GetByUsername(username string) (*UserResponse, error)
	GetAll(page, limit int) ([]UserResponse, int64, error)
	Update(id uint, updateReq *UpdateUserRequest) (*UserResponse, error)
	Delete(id uint) error
	Authenticate(username, password string) (*User, error)
	SeedDefaultUsers() error
}

// userService implements UserService
type userService struct {
	db *gorm.DB
}

// NewUserService creates a new user service instance
func NewUserService(database *gorm.DB) UserService {
	return &userService{
		db: database,
	}
}

// Create creates a new user
func (s *userService) Create(userReq *CreateUserRequest) (*UserResponse, error) {
	// Check if username already exists
	var existingUser User
	if err := s.db.Where("username = ?", userReq.Username).First(&existingUser).Error; err == nil {
		return nil, errors.New("username already exists")
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(userReq.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.New("failed to hash password")
	}

	// Create user
	user := &User{
		Username: userReq.Username,
		Password: string(hashedPassword),
		Role:     userReq.Role,
	}

	// Set default role if not provided
	if user.Role == "" {
		user.Role = "user"
	}

	if err := s.db.Create(user).Error; err != nil {
		return nil, err
	}

	response := user.ToResponse()
	return &response, nil
}

// GetByID retrieves a user by ID
func (s *userService) GetByID(id uint) (*UserResponse, error) {
	var user User
	if err := s.db.First(&user, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}

	response := user.ToResponse()
	return &response, nil
}

// GetByUsername retrieves a user by username
func (s *userService) GetByUsername(username string) (*UserResponse, error) {
	var user User
	if err := s.db.Where("username = ?", username).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}

	response := user.ToResponse()
	return &response, nil
}

// GetAll retrieves all users with pagination
func (s *userService) GetAll(page, limit int) ([]UserResponse, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 10
	}

	offset := (page - 1) * limit

	var users []User
	var total int64

	// Count total records
	if err := s.db.Model(&User{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Get paginated results
	if err := s.db.Offset(offset).Limit(limit).Order("created_at DESC").Find(&users).Error; err != nil {
		return nil, 0, err
	}

	// Convert to response
	responses := make([]UserResponse, len(users))
	for i, user := range users {
		responses[i] = user.ToResponse()
	}

	return responses, total, nil
}

// Update updates a user
func (s *userService) Update(id uint, updateReq *UpdateUserRequest) (*UserResponse, error) {
	var user User
	if err := s.db.First(&user, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}

	// Prepare update data
	updateData := make(map[string]interface{})

	if updateReq.Username != "" && updateReq.Username != user.Username {
		// Check if new username is already taken
		var existingUser User
		if err := s.db.Where("username = ? AND id != ?", updateReq.Username, id).First(&existingUser).Error; err == nil {
			return nil, errors.New("username already taken")
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		updateData["username"] = updateReq.Username
	}

	if updateReq.Password != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(updateReq.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, errors.New("failed to hash password")
		}
		updateData["password"] = string(hashedPassword)
	}

	if updateReq.Role != "" && updateReq.Role != user.Role {
		updateData["role"] = updateReq.Role
	}

	// Perform update
	if len(updateData) > 0 {
		if err := s.db.Model(&user).Updates(updateData).Error; err != nil {
			return nil, err
		}
	}

	// Refresh user data
	if err := s.db.First(&user, id).Error; err != nil {
		return nil, err
	}

	response := user.ToResponse()
	return &response, nil
}

// Delete deletes a user (soft delete)
func (s *userService) Delete(id uint) error {
	result := s.db.Delete(&User{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("user not found")
	}
	return nil
}

func (s *userService) Authenticate(username, password string) (*User, error) {
	var user User
	if err := s.db.Where("LOWER(username) = ?", strings.ToLower(strings.TrimSpace(username))).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("invalid credentials")
		}
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		return nil, errors.New("invalid credentials")
	}

	return &user, nil
}

// SeedDefaultUsers creates default admin and writer users if they don't exist
func (s *userService) SeedDefaultUsers() error {
	defaultUsers := []struct {
		Username string
		Password string
		Role     string
	}{
		{
			Username: getEnv("SPENDING_TRACKER_ADMIN_USERNAME", "admin"),
			Password: getEnv("SPENDING_TRACKER_ADMIN_PASSWORD", "dev-password-change-me"),
			Role:     "Admin",
		},
		{
			Username: getEnv("SPENDING_TRACKER_WRITER_USERNAME", "user"),
			Password: getEnv("SPENDING_TRACKER_WRITER_PASSWORD", "dev-password-change-me"),
			Role:     "Writer",
		},
	}

	for _, defaultUser := range defaultUsers {
		// Check if user exists
		var existingUser User
		err := s.db.Where("LOWER(username) = ?", strings.ToLower(defaultUser.Username)).First(&existingUser).Error
		if err == nil {
			// User exists, update password if needed
			if err := bcrypt.CompareHashAndPassword([]byte(existingUser.Password), []byte(defaultUser.Password)); err != nil {
				// Password doesn't match, update it
				hashedPassword, err := bcrypt.GenerateFromPassword([]byte(defaultUser.Password), bcrypt.DefaultCost)
				if err != nil {
					return fmt.Errorf("failed to hash password for %s: %w", defaultUser.Username, err)
				}
				if err := s.db.Model(&existingUser).Update("password", string(hashedPassword)).Error; err != nil {
					return fmt.Errorf("failed to update password for %s: %w", defaultUser.Username, err)
				}
			}
			continue
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		// Create user
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(defaultUser.Password), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("failed to hash password for %s: %w", defaultUser.Username, err)
		}

		user := &User{
			Username: defaultUser.Username,
			Password: string(hashedPassword),
			Role:     defaultUser.Role,
		}

		if err := s.db.Create(user).Error; err != nil {
			return fmt.Errorf("failed to create default user %s: %w", defaultUser.Username, err)
		}
	}

	return nil
}

// Helper functions
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
