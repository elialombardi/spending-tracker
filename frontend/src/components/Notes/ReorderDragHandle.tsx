import type { DragEventHandler } from 'react';
import IconButton from '@mui/material/IconButton';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

type ReorderDragHandleProps = {
    label: string;
    count: number;
    isBusy: boolean;
    dragHandleProps: {
        draggable: boolean;
        onDragStart: DragEventHandler<HTMLElement>;
        onDragEnd: DragEventHandler<HTMLElement>;
    };
};

export function ReorderDragHandle({ label, count, isBusy, dragHandleProps }: ReorderDragHandleProps) {
    return (
            <IconButton
                {...dragHandleProps}
                aria-label={`Drag ${label} to reorder`}
                title={`Drag ${label} to reorder`}
                disabled={isBusy || count < 2}
                sx={{ flexShrink: 0, cursor: 'grab', '&:active': { cursor: 'grabbing' } }}
            >
                <DragIndicatorIcon fontSize="small" />
            </IconButton>
    );
}
