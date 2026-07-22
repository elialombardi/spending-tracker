package models

type Project struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

type Task struct {
	ID          int     `json:"id"`
	ProjectID   int     `json:"projectId"`
	Name        string  `json:"name"`
	Cost        float64 `json:"cost"`
	Date        string  `json:"date"`
	SentOn      string  `json:"sentOn,omitempty"`
	Description string  `json:"description,omitempty"`
}

type TaskDetails struct {
	ID          int     `json:"id"`
	ProjectID   int     `json:"projectId"`
	ProjectName string  `json:"projectName"`
	Name        string  `json:"name"`
	Cost        float64 `json:"cost"`
	Date        string  `json:"date"`
	SentOn      string  `json:"sentOn,omitempty"`
	Description string  `json:"description,omitempty"`
}
