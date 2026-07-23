import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface Props {
    locations?: any[]
    center?: [number, number] | null
    centerZoom?: number | undefined
    onMapClick?: (latlng: { lat: number; lng: number }) => void
    draftLocation?: any
    highlightedId?: any
    visible?: boolean
}

export default function LocationMap({ locations = [], center, onMapClick, draftLocation, highlightedId, visible = true }: Props) {
    const ref = useRef<HTMLDivElement | null>(null)
    const mapRef = useRef<L.Map | null>(null)

    useEffect(() => {
        if (!ref.current || !visible) return
        if (!mapRef.current) {
            mapRef.current = L.map(ref.current).setView(center || [40.73, -73.93], 12)
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(mapRef.current)

            if (onMapClick) {
                const handler = (e: any) => onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng })
                mapRef.current.on('click', handler)
                // store handler on map instance for cleanup
                ;(mapRef.current as any).__clickHandler = handler
            }
        }

        return () => {
            try {
                if (mapRef.current && (mapRef.current as any).__clickHandler) {
                    mapRef.current.off('click', (mapRef.current as any).__clickHandler)
                }
                mapRef.current?.remove()
            } catch (_) { }
            mapRef.current = null
        }
    }, [ref.current, visible])

    useEffect(() => {
        if (!mapRef.current || !center) return
        const zoom = 13
        mapRef.current.setView(center as any, zoom)
    }, [center])

    useEffect(() => {
        if (!mapRef.current) return
        // handle centerZoom by briefly setting view with larger zoom
        // parent can control this via the centerZoom prop
    }, [])

    useEffect(() => {
        if (!mapRef.current) return
        // clear and re-add markers
        // Note: for brevity we don't track individual marker instances here
        const layerGroup = L.layerGroup()
        locations.forEach((loc) => {
            const marker = L.marker([loc.lat, loc.lng])
            marker.addTo(layerGroup)
        })
        layerGroup.addTo(mapRef.current)
        return () => { layerGroup.clearLayers(); layerGroup.remove() }
    }, [locations])

    return (
        <div ref={ref} style={{ width: '100%', height: '100%' }} />
    )
}
