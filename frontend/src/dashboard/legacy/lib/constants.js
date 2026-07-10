export const REVIEW_PAGE_SIZE = 20
export const CORRECTION_PAGE_SIZE = 20
export const INCOME_PAGE_SIZE = 20
export const MAPPING_PAGE_SIZE = 20
export const PAGE_SIZE_OPTIONS = [6, 10, 20, 50]

export const DASHBOARD_TABS = [
    {
        id: 'import',
        title: 'Import',
        note: 'Upload workbooks, fix categories, and manage cycle rules',
    },
    {
        id: 'overview',
        title: 'Overview',
        note: 'Totals and category split for the selected cycle',
    },
    {
        id: 'review',
        title: 'Review',
        note: 'Categorize the uncertain transactions',
    },
    {
        id: 'insights',
        title: 'Insights',
        note: 'Merchants, biggest expenses, and learned categories',
    },
]

export const VALID_TAB_IDS = new Set(DASHBOARD_TABS.map((tab) => tab.id))