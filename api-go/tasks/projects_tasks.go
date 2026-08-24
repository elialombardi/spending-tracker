package tasks

type ProjectDTO struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

type TaskDTO struct {
	ID          string  `json:"id"`
	ProjectID   string  `json:"projectId"`
	Name        string  `json:"name"`
	Cost        float64 `json:"cost"`
	Date        string  `json:"date"`
	SentOn      string  `json:"sentOn,omitempty"`
	Description string  `json:"description,omitempty"`
}

type TaskDetails struct {
	ID          string  `json:"id"`
	ProjectID   string  `json:"projectId"`
	ProjectName string  `json:"projectName"`
	Name        string  `json:"name"`
	Cost        float64 `json:"cost"`
	Date        string  `json:"date"`
	SentOn      string  `json:"sentOn,omitempty"`
	Description string  `json:"description,omitempty"`
}
