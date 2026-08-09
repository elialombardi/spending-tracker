package di

import "testing"

func TestInitializeApp(t *testing.T) {
	container, err := InitializeApp()
	if err != nil {
		t.Fatalf("InitializeApp() error = %v", err)
	}
	if container == nil {
		t.Fatal("InitializeApp() returned nil container")
	}
	if container.DB == nil {
		t.Fatal("InitializeApp() returned nil database")
	}
	if container.ProjectTaskService == nil {
		t.Fatal("InitializeApp() returned nil project task service")
	}
	if container.LocationService == nil {
		t.Fatal("InitializeApp() returned nil location service")
	}
	if container.TransactionHandler == nil {
		t.Fatal("InitializeApp() returned nil transaction handler")
	}
}
