export interface CycleOption {
    from: string
    to: string
}

export interface ReportTransaction {
    transactionId: string
    bookingDate: string
    amount: number
    direction: 'income' | 'expense'
    category: string
    needsReview: boolean
    excludeFromCalculations: boolean
    isMonthlyRecurring: boolean
    description: string
    merchantKey: string
    merchantRuleBehavior: string
}

export interface CycleReport extends CycleOption {
    year: number
    month: number
    totalTransactions: number
    totalSpent: number
    totalIncome: number
    uncategorizedSpent: number
    categories: { category: string; totalSpent: number; transactions: number; shareOfSpent: number }[]
    topMerchants: { merchantKey: string; category: string | null; totalSpent: number; transactions: number }[]
    largestExpenses: ReportTransaction[]
}

export interface CategoryMapping {
    mappingId: string
    merchantKey: string
    category: string | null
    behavior: string
    appliedCount: number
    matchingTransactions: number
}

export interface ReportCategory {
    name: string
    rules: number
    transactions: number
}

export interface CycleIncomeCategories {
    usesAllIncomeTransactions: boolean
    categories: { name: string; incomeTransactions: number; definesCycle: boolean }[]
}
