import { downloadFile, fetchApiResponse, fetchJSON, readError } from '../../../api/client'
import { API_BASE } from '../../../config'

export async function fetchJson<T>(url: string, options: Parameters<typeof fetchJSON>[1] = {}) {
    return fetchJSON<T>(url, options)
}

export { API_BASE, downloadFile, fetchApiResponse, readError }