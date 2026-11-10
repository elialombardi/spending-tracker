import type { DragEventHandler } from 'react';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

type ReorderButtonsProps = {
    label: string;
    index: number;
    count: number;
    isBusy: boolean;
    onMove: (direction: -1 | 1) => void;
    dragHandleProps: {
        draggable: boolean;
        onDragStart: DragEventHandler<HTMLElement>;
        onDragEnd: DragEventHandler<HTMLElement>;
    };
};

export function ReorderButtons({ label, index, count, isBusy, onMove, dragHandleProps }: ReorderButtonsProps) {
    return (
        <Stack direction="row" sx={{ flexShrink: 0 }}>
            <IconButton
                {...dragHandleProps}
                aria-label={`Drag ${label} to reorder`}
                title={`Drag ${label} to reorder`}
                disabled={isBusy || count < 2}
                sx={{ cursor: 'grab', '&:active': { cursor: 'grabbing' } }}
            >
                <DragIndicatorIcon fontSize="small" />
            </IconButton>
            <IconButton
                aria-label={`Move ${label} up`}
                title={`Move ${label} up`}
                disabled={isBusy || index === 0}
                onClick={() => onMove(-1)}
            >
                <ArrowUpwardIcon fontSize="small" />
            </IconButton>
            <IconButton
                aria-label={`Move ${label} down`}
                title={`Move ${label} down`}
                disabled={isBusy || index === count - 1}
                onClick={() => onMove(1)}
            >
                <ArrowDownwardIcon fontSize="small" />
            </IconButton>
        </Stack>
    );
}
