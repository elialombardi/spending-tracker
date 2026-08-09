package db

import (
	"database/sql"
	"strings"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/internal/models"
)

func FetchProjects(database *sql.DB) ([]models.Project, error) {
	rows, err := database.Query(`SELECT Id, Name, Description FROM Projects ORDER BY Name, Id;`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	projects := []models.Project{}
	for rows.Next() {
		var project models.Project
		var description sql.NullString
		if err := rows.Scan(&project.ID, &project.Name, &description); err != nil {
			return nil, err
		}
		if description.Valid {
			project.Description = description.String
		}
		projects = append(projects, project)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return projects, nil
}

func FetchProjectByID(database *sql.DB, id int) (models.Project, error) {
	var project models.Project
	var description sql.NullString
	if err := database.QueryRow(`SELECT Id, Name, Description FROM Projects WHERE Id = ?;`, id).Scan(&project.ID, &project.Name, &description); err != nil {
		return models.Project{}, err
	}
	if description.Valid {
		project.Description = description.String
	}
	return project, nil
}

func InsertProject(database *sql.DB, payload models.Project) (models.Project, error) {
	result, err := database.Exec(
		`INSERT INTO Projects (Name, Description) VALUES (?, ?);`,
		strings.TrimSpace(payload.Name), NullableString(payload.Description),
	)
	if err != nil {
		return models.Project{}, err
	}
	id64, err := result.LastInsertId()
	if err != nil {
		return models.Project{}, err
	}
	return FetchProjectByID(database, int(id64))
}

func ReplaceProject(database *sql.DB, id int, payload models.Project) (models.Project, error) {
	result, err := database.Exec(
		`UPDATE Projects SET Name = ?, Description = ? WHERE Id = ?;`,
		strings.TrimSpace(payload.Name), NullableString(payload.Description), id,
	)
	if err != nil {
		return models.Project{}, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return models.Project{}, err
	}
	if affected == 0 {
		return models.Project{}, sql.ErrNoRows
	}
	return FetchProjectByID(database, id)
}

func DeleteProjectByID(database *sql.DB, id int) (bool, error) {
	result, err := database.Exec(`DELETE FROM Projects WHERE Id = ?;`, id)
	if err != nil {
		return false, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return false, err
	}
	return affected > 0, nil
}

func FetchTasks(database *sql.DB) ([]models.TaskDetails, error) {
	rows, err := database.Query(`
		SELECT t.Id, t.ProjectId, p.Name, t.Name, t.Cost, t.TaskDate, t.SentOn, t.Description
		FROM Tasks t
		INNER JOIN Projects p ON p.Id = t.ProjectId
		ORDER BY t.TaskDate DESC, t.Id DESC;`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tasks := []models.TaskDetails{}
	for rows.Next() {
		var task models.TaskDetails
		var sentOn sql.NullString
		var description sql.NullString
		if err := rows.Scan(&task.ID, &task.ProjectID, &task.ProjectName, &task.Name, &task.Cost, &task.Date, &sentOn, &description); err != nil {
			return nil, err
		}
		if sentOn.Valid {
			task.SentOn = sentOn.String
		}
		if description.Valid {
			task.Description = description.String
		}
		tasks = append(tasks, task)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return tasks, nil
}

func FetchTaskByID(database *sql.DB, id int) (models.TaskDetails, error) {
	var task models.TaskDetails
	var sentOn sql.NullString
	var description sql.NullString
	if err := database.QueryRow(`
		SELECT t.Id, t.ProjectId, p.Name, t.Name, t.Cost, t.TaskDate, t.SentOn, t.Description
		FROM Tasks t
		INNER JOIN Projects p ON p.Id = t.ProjectId
		WHERE t.Id = ?;`, id,
	).Scan(&task.ID, &task.ProjectID, &task.ProjectName, &task.Name, &task.Cost, &task.Date, &sentOn, &description); err != nil {
		return models.TaskDetails{}, err
	}
	if sentOn.Valid {
		task.SentOn = sentOn.String
	}
	if description.Valid {
		task.Description = description.String
	}
	return task, nil
}

func InsertTask(database *sql.DB, payload models.Task) (models.TaskDetails, error) {
	result, err := database.Exec(
		`INSERT INTO Tasks (ProjectId, Name, Cost, TaskDate, SentOn, Description) VALUES (?, ?, ?, ?, ?, ?);`,
		payload.ProjectID, strings.TrimSpace(payload.Name), payload.Cost, strings.TrimSpace(payload.Date), NullableString(payload.SentOn), NullableString(payload.Description),
	)
	if err != nil {
		return models.TaskDetails{}, err
	}
	id64, err := result.LastInsertId()
	if err != nil {
		return models.TaskDetails{}, err
	}
	return FetchTaskByID(database, int(id64))
}

func ReplaceTask(database *sql.DB, id int, payload models.Task) (models.TaskDetails, error) {
	result, err := database.Exec(
		`UPDATE Tasks SET ProjectId = ?, Name = ?, Cost = ?, TaskDate = ?, SentOn = ?, Description = ? WHERE Id = ?;`,
		payload.ProjectID, strings.TrimSpace(payload.Name), payload.Cost, strings.TrimSpace(payload.Date), NullableString(payload.SentOn), NullableString(payload.Description), id,
	)
	if err != nil {
		return models.TaskDetails{}, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return models.TaskDetails{}, err
	}
	if affected == 0 {
		return models.TaskDetails{}, sql.ErrNoRows
	}
	return FetchTaskByID(database, id)
}

func DeleteTaskByID(database *sql.DB, id int) (bool, error) {
	result, err := database.Exec(`DELETE FROM Tasks WHERE Id = ?;`, id)
	if err != nil {
		return false, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return false, err
	}
	return affected > 0, nil
}
