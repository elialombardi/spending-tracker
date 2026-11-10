import { useState, type DragEvent } from 'react';

export function useReorderDrag<T extends { id: number }>(
    enabled: boolean,
    onMove: (siblings: T[], id: number, offset: number) => void,
) {
    const [draggedID, setDraggedID] = useState<number | null>(null);
    const [dropTargetID, setDropTargetID] = useState<number | null>(null);

    function clearDrag() {
        setDraggedID(null);
        setDropTargetID(null);
    }

    function canDrop(id: number, siblings: T[]) {
        return enabled && draggedID !== null && draggedID !== id
            && siblings.some((item) => item.id === draggedID);
    }

    return {
        dropTargetID: enabled ? dropTargetID : null,
        handleProps: (id: number, count: number) => ({
            draggable: enabled && count > 1,
            onDragStart: (event: DragEvent<HTMLElement>) => {
                if (!enabled || count < 2) {
                    event.preventDefault();
                    return;
                }
                event.stopPropagation();
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', String(id));
                setDraggedID(id);
            },
            onDragEnd: clearDrag,
        }),
        rowProps: (id: number, siblings: T[]) => ({
            onDragOver: (event: DragEvent<HTMLElement>) => {
                if (!canDrop(id, siblings)) return;
                event.preventDefault();
                event.stopPropagation();
                event.dataTransfer.dropEffect = 'move';
                setDropTargetID(id);
            },
            onDragLeave: (event: DragEvent<HTMLElement>) => {
                if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
                    setDropTargetID(null);
                }
            },
            onDrop: (event: DragEvent<HTMLElement>) => {
                if (draggedID === null || !canDrop(id, siblings)) return;
                event.preventDefault();
                event.stopPropagation();
                const offset = siblings.findIndex((item) => item.id === id)
                    - siblings.findIndex((item) => item.id === draggedID);
                const sourceID = draggedID;
                clearDrag();
                onMove(siblings, sourceID, offset);
            },
        }),
    };
}
