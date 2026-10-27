package jobs

import (
	"context"
	"time"
)

func Start(ctx context.Context, interval time.Duration, run func(context.Context)) <-chan struct{} {
	done := make(chan struct{})
	go func() {
		defer close(done)
		if ctx.Err() != nil {
			return
		}
		run(ctx)
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if ctx.Err() == nil {
					run(ctx)
				}
			}
		}
	}()
	return done
}
