import { useEffect, useState } from "react";

// Replace the useState for locations with lazy initialization:
const [locations, setLocations] = useState(() => {
    const saved = localStorage.getItem('locations');
    return saved ? JSON.parse(saved) : [
        // your initial dummy data...
    ];
});

// Save to localStorage whenever locations change
useEffect(() => {
    localStorage.setItem('locations', JSON.stringify(locations));
}, [locations]);