export function parseMaximumPrice(value: string): number | null {
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) return null;
    const [whole, fraction = ''] = value.trim().split(/[.,]/);
    const cents = Number(whole + fraction.padEnd(2, '0'));
    return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function marketplaceError(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (error && typeof error === 'object' && 'data' in error) {
        const data = error.data;
        if (typeof data === 'string') return data;
        if (data && typeof data === 'object') {
            if ('error' in data && typeof data.error === 'string') return data.error;
            if ('message' in data && typeof data.message === 'string') return data.message;
        }
    }
    return 'Unable to access marketplace searches. Please try again.';
}
