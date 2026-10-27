package main

import "testing"

func TestJobSettingsPreserveDefaultsAndValidateOverrides(t *testing.T) {
	for _, fallback := range []bool{false, true} {
		value, err := envBool("SPENDING_TRACKER_UNSET_TEST_SETTING", fallback)
		if err != nil || value != fallback {
			t.Fatalf("default = %v, error = %v", value, err)
		}
	}
	for _, test := range []struct {
		text string
		want bool
	}{
		{"true", true}, {"false", false}, {"1", true}, {"0", false},
	} {
		t.Run(test.text, func(t *testing.T) {
			t.Setenv("YOUTUBE_SYNC_ENABLED", test.text)
			value, err := envBool("YOUTUBE_SYNC_ENABLED", !test.want)
			if err != nil || value != test.want {
				t.Fatalf("value = %v, error = %v", value, err)
			}
		})
	}
	for _, text := range []string{"", "yes", "invalid"} {
		t.Run("invalid-"+text, func(t *testing.T) {
			t.Setenv("BOXING_SYNC_ENABLED", text)
			if _, err := envBool("BOXING_SYNC_ENABLED", true); err == nil {
				t.Fatal("expected invalid setting error")
			}
		})
	}
}
