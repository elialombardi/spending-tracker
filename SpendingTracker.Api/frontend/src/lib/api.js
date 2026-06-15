export async function fetchJson(url, options) {
    const response = await fetch(url, options)

    if (!response.ok) {
        throw new Error(await readError(response))
    }

    if (response.status === 204) {
        return null
    }

    return response.json()
}

export async function readError(response) {
    const contentType = response.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
        const payload = await response.json()
        return payload.title || payload.detail || JSON.stringify(payload)
    }

    return (await response.text()) || `${response.status} ${response.statusText}`
}