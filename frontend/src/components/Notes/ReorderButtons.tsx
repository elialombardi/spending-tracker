import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

type ReorderButtonsProps = {
    label: string;
    index: number;
    count: number;
    isBusy: boolean;
    onMove: (direction: -1 | 1) => void;
};

export function ReorderButtons({ label, index, count, isBusy, onMove }: ReorderButtonsProps) {
    return (
        <Stack direction="row" sx={{ flexShrink: 0 }}>
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
