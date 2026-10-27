package jobs

import (
	"context"
	"testing"
	"time"
)

func TestScheduleRunsImmediatelyAndWaitsForCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	started := make(chan struct{})
	done := Start(ctx, time.Hour, func(ctx context.Context) {
		close(started)
		<-ctx.Done()
	})
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("job did not start immediately")
	}
	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("job did not stop after cancellation")
	}
}

func TestCancelledScheduleDoesNotStartWork(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	ran := make(chan struct{}, 1)
	done := Start(ctx, time.Hour, func(context.Context) { ran <- struct{}{} })
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("cancelled schedule did not stop")
	}
	select {
	case <-ran:
		t.Fatal("cancelled schedule started work")
	default:
	}
}
