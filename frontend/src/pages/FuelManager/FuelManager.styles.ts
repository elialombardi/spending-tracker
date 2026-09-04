import { styled } from '@mui/material/styles';
import { Card } from '@mui/material';

export const StyledContainer = styled('div')(({ theme }) => ({
    padding: theme.spacing(3),
    maxWidth: '1200px',
    margin: '0 auto',
}));

export const StyledStatsCard = styled(Card)(({ theme }) => ({
    padding: theme.spacing(2),
    textAlign: 'center',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
}));