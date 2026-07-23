import { ensureAuthenticated, logout } from './auth'
import { API_BASE } from './config'
import { Task, Project, ImportResultResponse, TransactionResponse, SpendingSummaryResponse, CategorizeTransactionRequest, CategoryResponse, CycleIncomeCategoriesResponse, UpdateCycleIncomeCategoriesRequest, CategoryMappingResponse, UpdateCategoryMappingRequest, CycleOptionResponse, MonthlyReportResponse, TaskDetails, Location } from './types/x'

type Id = number | string
type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
type ApiEndpoint = { method: ApiMethod; path: string }
type ApiErrorCode = 'AUTH_REQUIRED' | 'FORBIDDEN' | 'API_ERROR'
type ApiError = Error & {
    body: unknown
    code: ApiErrorCode
    status: number
}
type ApiRequestOptions = RequestInit & {
    allowAnonymous?: boolean
}
type ApiSuccessResponse = {
    success: true
}
type RenameTagResponse = {
    oldName: string
    newName: string
}
type LocationTagToggleRequest = {
    tag: string
    present: boolean
}
type TransactionListFilters = {
    from?: string
    to?: string
    direction?: 'income' | 'expense'
    needsReview?: boolean
    category?: string
}
type TransactionsSummaryFilters = {
    from?: string
    to?: string
}
type CycleReportQuery = {
    cycleStart: string
}
type MonthlyReportQuery = {
    year: number
    month: number
}
type ExportFormat = 'csv' | 'xlsx'
type DownloadFileOptions = ApiRequestOptions & {
    fileName?: string
}
type TaskWritePayload = Omit<Task, 'id'>
type ProjectWritePayload = Omit<Project, 'id'>
type LocationWritePayload = Omit<Location, 'id'>
type TaskUpdatePayload = Partial<TaskWritePayload> & { id: number }
type ProjectUpdatePayload = Partial<ProjectWritePayload>
type LocationUpdatePayload = Partial<LocationWritePayload>

const endpoints: Record<string, ApiEndpoint> = {
    importPosteItaliane: { method: 'POST', path: '/api/imports/poste-italiane' },

    // Transactions
    listTransactions: { method: 'GET', path: '/api/transactions' },
    getTransactionsSummary: { method: 'GET', path: '/api/transactions/summary' },
    categorizeTransaction: { method: 'POST', path: '/api/transactions/:transactionId/categorize' },

    // Categories
    listCategories: { method: 'GET', path: '/api/categories' },
    getCycleIncomeCategories: { method: 'GET', path: '/api/categories/cycle-income' },
    updateCycleIncomeCategories: { method: 'PUT', path: '/api/categories/cycle-income' },
    listCategoryMappings: { method: 'GET', path: '/api/categories/mappings' },
    updateCategoryMapping: { method: 'PUT', path: '/api/categories/mappings/:mappingId' },
    deleteCategoryMapping: { method: 'DELETE', path: '/api/categories/mappings/:mappingId' },

    // Reports
    listReportCycles: { method: 'GET', path: '/api/reports/cycles' },
    getCycleReport: { method: 'GET', path: '/api/reports/cycle' },
    exportCycleReport: { method: 'GET', path: '/api/reports/cycle/export' },
    getMonthlyReport: { method: 'GET', path: '/api/reports/monthly' },
    exportMonthlyReport: { method: 'GET', path: '/api/reports/monthly/export' },

    // Tasks
    listTasks: { method: 'GET', path: '/api/tasks' },
    getTask: { method: 'GET', path: '/api/tasks/:id' },
    createTask: { method: 'POST', path: '/api/tasks' },
    updateTask: { method: 'PUT', path: '/api/tasks/:id' },
    deleteTask: { method: 'DELETE', path: '/api/tasks/:id' },

    // Projects
    listProjects: { method: 'GET', path: '/api/projects' },
    getProject: { method: 'GET', path: '/api/projects/:id' },
    createProject: { method: 'POST', path: '/api/projects' },
    updateProject: { method: 'PUT', path: '/api/projects/:id' },
    deleteProject: { method: 'DELETE', path: '/api/projects/:id' },

    // Locations
    listLocations: { method: 'GET', path: '/locations' },
    getLocation: { method: 'GET', path: '/locations/:id' },
    createLocation: { method: 'POST', path: '/locations' },
    updateLocation: { method: 'PUT', path: '/locations/:id' },
    deleteLocation: { method: 'DELETE', path: '/locations/:id' },

    // Tags
    listTags: { method: 'GET', path: '/tags' },
    createTag: { method: 'POST', path: '/tags' },
    renameTag: { method: 'PATCH', path: '/tags/:name' },
    deleteTag: { method: 'DELETE', path: '/tags/:name' },

    toggleLocationTag: { method: 'POST', path: '/locations/:id/tags' },
}

const schemas = {
    Location: {
        example: {
            id: 1,
            title: 'Central Park',
            tags: ['kids'],
            url: 'https://example.com',
            lat: 40.7829,
            lng: -73.9654,
            description: 'Great for kids',
        },
    },

    CreateLocation: {
        example: {
            title: 'Joe\'s Pizza',
            tags: ['restaurant'],
            url: 'https://www.joespizza.com',
            lat: 40.7308,
            lng: -73.9973,
            description: 'Classic NY slice',
        },
    },

    UpdateLocation: {
        example: {
            title: 'Updated title',
            tags: ['restaurant', 'favorite'],
            url: 'https://example.com',
            lat: 40.7308,
            lng: -73.9973,
            description: 'Updated',
        },
    },

    Tag: {
        example: 'restaurant',
    },

    TaskDetails: {
        // Represents a richer task view returned by some endpoints
        example: {
            id: 1,
            projectId: 10,
            projectName: 'Example Project',
            name: 'Sample Task',
            cost: 123.45,
            date: '2026-07-23',
            sentOn: null,
            description: 'A detailed task record returned from the API',
        },
    },
}

function isAbsoluteUrl(path: any) {
    return typeof path === 'string' && (path.startsWith('http://') || path.startsWith('https://'))
}

function withQuery(path: string, query?: Record<string, string | number | boolean | undefined>) {
    if (!query) {
        return path
    }

    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
        if (value == null || value === '') {
            continue
        }

        params.set(key, String(value))
    }

    const serialized = params.toString()
    if (!serialized) {
        return path
    }

    return `${path}?${serialized}`
}

function createApiError(message: string, response: Response, body: unknown = '') {
    const error = new Error(message) as ApiError
    error.body = body
    error.code = response.status === 401 ? 'AUTH_REQUIRED' : response.status === 403 ? 'FORBIDDEN' : 'API_ERROR'
    error.status = response.status
    return error
}

async function readError(response: Response) {
    const contentType = response.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
        const payload = await response.json().catch(() => null)
        if (!payload) {
            return `${response.status} ${response.statusText}`
        }

        return (payload as any).title || (payload as any).detail || (payload as any).message || JSON.stringify(payload)
    }

    return (await response.text().catch(() => '')) || `${response.status} ${response.statusText}`
}

async function fetchApiResponse(path: string, opts: any = {}) {
    const url = isAbsoluteUrl(path) ? path : (API_BASE || '') + path
    const headers = new Headers(opts.headers || {})

    if (!opts.allowAnonymous) {
        const session = await ensureAuthenticated()
        headers.set('Authorization', `Bearer ${session?.accessToken}`)
    }

    const response = await fetch(url, { ...opts, headers })

    if (response.status === 401) {
        logout('Your session expired. Please sign in again.')
        throw createApiError('Authentication is required.', response)
    }

    if (response.status === 403) {
        throw createApiError('You do not have permission to perform that action.', response, await readError(response))
    }

    return response
}

function getDownloadName(contentDisposition: string | null, fallback = 'download') {
    if (!contentDisposition) {
        return fallback
    }

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
    if (utf8Match?.[1]) {
        return decodeURIComponent(utf8Match[1])
    }

    const asciiMatch = contentDisposition.match(/filename="?([^";]+)"?/i)
    if (asciiMatch?.[1]) {
        return asciiMatch[1]
    }

    return fallback
}

async function fetchJSON<T>(path: string, opts: ApiRequestOptions = {}) {
    const headers = new Headers(opts.headers || {})

    if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json')
    }

    if (opts.body && !(opts.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
    }

    const res = await fetchApiResponse(path, { ...opts, headers })
    if (!res.ok) {
        const message = await readError(res)
        throw createApiError(message || `Request failed ${res.status} ${res.statusText}`, res, message)
    }
    if (res.status === 204) return null as T
    return res.json().catch(() => null) as Promise<T>
}

async function downloadFile(path: string, opts: DownloadFileOptions = {}) {
    const response = await fetchApiResponse(path, opts)
    if (!response.ok) {
        const message = await readError(response)
        throw createApiError(message || `Request failed ${response.status} ${response.statusText}`, response, message)
    }

    const blob = await response.blob()
    const objectUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = (opts as any).fileName || getDownloadName(response.headers.get('content-disposition'))
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(objectUrl)
}

const api = {
    endpoints,
    schemas,
    API_BASE,

    importPosteItaliane: async (file: File) => {
        const formData = new FormData()
        formData.append('file', file)
        return fetchJSON<ImportResultResponse>(endpoints.importPosteItaliane.path, { method: 'POST', body: formData })
    },

    // Transactions
    listTransactions: async (filters: TransactionListFilters = {}) => fetchJSON<TransactionResponse[]>(withQuery(endpoints.listTransactions.path, filters)),
    getTransactionsSummary: async (filters: TransactionsSummaryFilters = {}) => fetchJSON<SpendingSummaryResponse>(withQuery(endpoints.getTransactionsSummary.path, filters)),
    categorizeTransaction: async (transactionId: string, request: CategorizeTransactionRequest) => fetchJSON<TransactionResponse>(endpoints.categorizeTransaction.path.replace(':transactionId', encodeURIComponent(String(transactionId))), { method: 'POST', body: JSON.stringify(request) }),

    // Categories
    listCategories: async () => fetchJSON<CategoryResponse[]>(endpoints.listCategories.path),
    getCycleIncomeCategories: async () => fetchJSON<CycleIncomeCategoriesResponse>(endpoints.getCycleIncomeCategories.path),
    updateCycleIncomeCategories: async (request: UpdateCycleIncomeCategoriesRequest) => fetchJSON<CycleIncomeCategoriesResponse>(endpoints.updateCycleIncomeCategories.path, { method: 'PUT', body: JSON.stringify(request) }),
    listCategoryMappings: async () => fetchJSON<CategoryMappingResponse[]>(endpoints.listCategoryMappings.path),
    updateCategoryMapping: async (mappingId: string, request: UpdateCategoryMappingRequest) => fetchJSON<CategoryMappingResponse>(endpoints.updateCategoryMapping.path.replace(':mappingId', encodeURIComponent(String(mappingId))), { method: 'PUT', body: JSON.stringify(request) }),
    deleteCategoryMapping: async (mappingId: string) => fetchJSON<null>(endpoints.deleteCategoryMapping.path.replace(':mappingId', encodeURIComponent(String(mappingId))), { method: 'DELETE' }),

    // Reports
    listReportCycles: async () => fetchJSON<CycleOptionResponse[]>(endpoints.listReportCycles.path),
    getCycleReport: async ({ cycleStart }: CycleReportQuery) => fetchJSON<MonthlyReportResponse>(withQuery(endpoints.getCycleReport.path, { cycleStart })),
    exportCycleReport: async ({ cycleStart }: CycleReportQuery, format: ExportFormat = 'csv', fileName?: string) => downloadFile(withQuery(endpoints.exportCycleReport.path, { cycleStart, format }), { fileName }),
    getMonthlyReport: async ({ year, month }: MonthlyReportQuery) => fetchJSON<MonthlyReportResponse>(withQuery(endpoints.getMonthlyReport.path, { year, month })),
    exportMonthlyReport: async ({ year, month }: MonthlyReportQuery, format: ExportFormat = 'csv', fileName?: string) => downloadFile(withQuery(endpoints.exportMonthlyReport.path, { year, month, format }), { fileName }),

    // Tasks
    listTasks: async () => fetchJSON<TaskDetails[]>(endpoints.listTasks.path),
    getTask: async (id: Id) => fetchJSON<TaskDetails>(endpoints.getTask.path.replace(':id', encodeURIComponent(String(id)))),
    createTask: async (task: TaskWritePayload) => fetchJSON<TaskDetails>(endpoints.createTask.path, { method: 'POST', body: JSON.stringify(task) }),
    updateTask: async (task: TaskUpdatePayload) => fetchJSON<TaskDetails>(endpoints.updateTask.path.replace(':id', encodeURIComponent(String(task.id))), { method: 'PUT', body: JSON.stringify(task) }),
    deleteTask: async (id: Id) => fetchJSON<ApiSuccessResponse>(endpoints.deleteTask.path.replace(':id', encodeURIComponent(String(id))), { method: 'DELETE' }),

    // Projects
    listProjects: async () => fetchJSON<Project[]>(endpoints.listProjects.path),
    getProject: async (id: Id) => fetchJSON<Project>(endpoints.getProject.path.replace(':id', encodeURIComponent(String(id)))),
    createProject: async (project: ProjectWritePayload) => fetchJSON<Project>(endpoints.createProject.path, { method: 'POST', body: JSON.stringify(project) }),
    updateProject: async (id: Id, project: ProjectUpdatePayload) => fetchJSON<Project>(endpoints.updateProject.path.replace(':id', encodeURIComponent(String(id))), { method: 'PUT', body: JSON.stringify(project) }),
    deleteProject: async (id: Id) => fetchJSON<ApiSuccessResponse>(endpoints.deleteProject.path.replace(':id', encodeURIComponent(String(id))), { method: 'DELETE' }),

    // Locations
    listLocations: async () => fetchJSON<Location[]>(endpoints.listLocations.path),
    getLocation: async (id: Id) => fetchJSON<Location>(endpoints.getLocation.path.replace(':id', encodeURIComponent(String(id)))),
    createLocation: async (location: LocationWritePayload) => fetchJSON<Location>(endpoints.createLocation.path, { method: 'POST', body: JSON.stringify(location) }),
    updateLocation: async (id: Id, location: LocationUpdatePayload) => fetchJSON<Location>(endpoints.updateLocation.path.replace(':id', encodeURIComponent(String(id))), { method: 'PUT', body: JSON.stringify(location) }),
    deleteLocation: async (id: Id) => fetchJSON<ApiSuccessResponse>(endpoints.deleteLocation.path.replace(':id', encodeURIComponent(String(id))), { method: 'DELETE' }),

    // Tags
    listTags: async () => fetchJSON<string[]>(endpoints.listTags.path),
    createTag: async (name: string) => fetchJSON<string>(endpoints.createTag.path, { method: 'POST', body: JSON.stringify({ name }) }),
    renameTag: async (oldName: string, newName: string) => fetchJSON<RenameTagResponse>(endpoints.renameTag.path.replace(':name', encodeURIComponent(String(oldName))), { method: 'PATCH', body: JSON.stringify({ newName }) }),
    deleteTag: async (name: string) => fetchJSON<ApiSuccessResponse>(endpoints.deleteTag.path.replace(':name', encodeURIComponent(String(name))), { method: 'DELETE' }),

    toggleLocationTag: async (id: Id, tag: string, present: boolean) => fetchJSON<Location>(endpoints.toggleLocationTag.path.replace(':id', encodeURIComponent(String(id))), { method: 'POST', body: JSON.stringify({ tag, present } satisfies LocationTagToggleRequest) }),
}

export default api

export { API_BASE, downloadFile, endpoints, fetchApiResponse, fetchJSON, readError, schemas }
