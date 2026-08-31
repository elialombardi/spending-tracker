import { API_BASE, downloadFile, fetchApiResponse, fetchJSON, readError } from '../../../api'

export async function fetchJson(url, options) {
    return fetchJSON(url, options)
}

export { API_BASE, downloadFile, fetchApiResponse, readError }