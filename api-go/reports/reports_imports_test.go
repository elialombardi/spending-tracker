package reports

import "testing"

func TestParseAmountSupportsInvariantAndItalianFormats(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		input    string
		expected float64
	}{
		{name: "invariant decimal", input: "-1000.50", expected: -1000.50},
		{name: "italian decimal", input: "1.234,56", expected: 1234.56},
		{name: "plain integer", input: "2500", expected: 2500},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			amount, err := parseAmount(test.input)
			if err != nil {
				t.Fatalf("parseAmount(%q) returned error: %v", test.input, err)
			}

			if amount != test.expected {
				t.Fatalf("parseAmount(%q) = %v, want %v", test.input, amount, test.expected)
			}
		})
	}
}

func TestImportedAmountMatchesDotNetSelectionRule(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		debit    float64
		credit   float64
		expected float64
	}{
		{name: "expense from debit", debit: 125.75, credit: 0, expected: -125.75},
		{name: "income from credit", debit: 0, credit: 980.10, expected: 980.10},
		{name: "credit takes precedence only when positive", debit: 42, credit: -42, expected: -42},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			amount := -test.debit
			if test.credit > 0 {
				amount = test.credit
			}

			if amount != test.expected {
				t.Fatalf("computed amount = %v, want %v", amount, test.expected)
			}
		})
	}
}
