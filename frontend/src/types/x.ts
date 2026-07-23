export type Location = {
  id: number;
  title: string;
  tags: string[];
  url?: string;
  lat: number;
  lng: number;
  description?: string;
}

type AuthRole = 'Reader' | 'Writer' | 'Admin';

type AuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'anonymous';

export type LoginRequest = {
  username: string;
  password: string;
}

export type AuthTokenResponse = {
  accessToken: string;
  tokenType: string;
  expiresAt: string;
  username: string;
  role: AuthRole;
}

export type AuthState = {
  message: string;
  session: AuthTokenResponse | null;
  status: AuthStatus;
}

export type Project = {
  id: number;
  name: string;
  description?: string;
}

export type Task = {
  id: number;
  projectId: number;
  name: string;
  cost: number;
  date: string;
  sentOn?: string;
  description?: string;
}

export type TaskDetails = {
  id: number;
  projectId: number;
  projectName: string;
  name: string;
  cost: number;
  date: string;
  sentOn?: string;
  description?: string;
}

export type ImportResultResponse = {
  accountNumber: string;
  fileName: string;
  importedTransactions: number;
  skippedDuplicates: number;
  autoCategorizedTransactions: number;
  reviewTransactions: number;
  reviewQueue: ReviewTransactionResponse[];
}

export type ReviewTransactionResponse = {
  transactionId: string;
  bookingDate: string;
  amount: number;
  description: string;
  merchantKey: string;
  merchantRuleBehavior: string;
  suggestedCategory?: string | null;
  suggestionConfidence?: number | null;
}

export type CycleOptionResponse = {
  from: string;
  to: string;
}

export type MonthlyReportResponse = {
  year: number;
  month: number;
  from: string;
  to: string;
  totalTransactions: number;
  totalSpent: number;
  totalIncome: number;
  uncategorizedSpent: number;
  categories: CategorySpendResponse[];
  topMerchants: MerchantSpendResponse[];
  largestExpenses: ReportTransactionResponse[];
}

export type MerchantSpendResponse = {
  merchantKey: string;
  category?: string | null;
  totalSpent: number;
  transactions: number;
}

export type ReportTransactionResponse = {
  transactionId: string;
  bookingDate: string;
  valueDate: string;
  amount: number;
  direction: string;
  description: string;
  merchantKey: string;
  category?: string | null;
  needsReview: boolean;
}

export type TransactionResponse = {
  transactionId: string;
  accountNumber: string;
  bookingDate: string;
  valueDate: string;
  amount: number;
  direction: string;
  description: string;
  merchantKey: string;
  merchantRuleBehavior: string;
  category?: string | null;
  suggestedCategory?: string | null;
  suggestionConfidence?: number | null;
  needsReview: boolean;
  isMonthlyRecurring: boolean;
}

export type CategorizeTransactionRequest = {
  category: string;
  saveRule: boolean;
  ruleBehavior?: string | null;
  merchantKey?: string | null;
  excludeFromCalculations: boolean;
  isMonthlyRecurring: boolean;
}

export type SpendingSummaryResponse = {
  from?: string | null;
  to?: string | null;
  totalSpent: number;
  uncategorizedSpent: number;
  categories: CategorySpendResponse[];
}

export type CategorySpendResponse = {
  category: string;
  totalSpent: number;
  transactions: number;
  shareOfSpent: number;
}

export type CategoryResponse = {
  name: string;
  rules: number;
  transactions: number;
}

export type CategoryMappingResponse = {
  mappingId: string;
  merchantKey: string;
  category?: string | null;
  behavior: string;
  appliedCount: number;
  matchingTransactions: number;
}

export type UpdateCategoryMappingRequest = {
  category?: string | null;
  behavior: string;
}

export type CycleIncomeCategoriesResponse = {
  usesAllIncomeTransactions: boolean;
  categories: CycleIncomeCategoryOptionResponse[];
}

export type CycleIncomeCategoryOptionResponse = {
  name: string;
  incomeTransactions: number;
  definesCycle: boolean;
}

export type UpdateCycleIncomeCategoriesRequest = {
  categories: string[];
}