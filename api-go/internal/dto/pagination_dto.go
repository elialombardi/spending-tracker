package dto

// PaginationQuery represents URL query params for list endpoints (e.g., GET /workouts?page=1&limit=10)
type PaginationQuery struct {
	Page   int    `query:"page" validate:"omitempty,gt=0"`
	Limit  int    `query:"limit" validate:"omitempty,gt=0,lte=100"`
	Search string `query:"search" validate:"omitempty,max=100"`
}

// SetDefaults sets standard fallback pagination values if omitted
func (p *PaginationQuery) SetDefaults() {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.Limit <= 0 {
		p.Limit = 10
	}
}

// PaginatedMeta holds pagination metadata
type PaginatedMeta struct {
	TotalItems int64 `json:"totalItems"`
	TotalPages int   `json:"totalPages"`
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
}

// PaginatedResponse wrapper for API responses
type PaginatedResponse[T any] struct {
	Data []T           `json:"data"`
	Meta PaginatedMeta `json:"meta"`
}
