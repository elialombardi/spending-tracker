import type { Location } from '../types/domain'

export const UNTAGGED = '__untagged__'

export function filterLocations(locations: Location[], search: string, selectedTag: string | null): Location[] {
    const terms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
    return locations.filter(location => {
        const tags = (location.tags || []).filter(tag => tag.trim())
        if (selectedTag === UNTAGGED ? tags.length > 0 : selectedTag !== null && !tags.includes(selectedTag)) return false
        const text = [location.title, location.description, ...tags].filter(Boolean).join(' ').toLocaleLowerCase()
        return terms.every(term => text.includes(term))
    }).sort((a, b) => (a.title || '').localeCompare(b.title || '') || a.id - b.id)
}

export function isMappableLocation(location: Pick<Location, 'lat' | 'lng'>): boolean {
    return Number.isFinite(location.lat) && Number.isFinite(location.lng)
        && Math.abs(location.lat) <= 90 && Math.abs(location.lng) <= 180
}
