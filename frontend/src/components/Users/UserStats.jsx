import React from 'react';
import { Grid, Card, CardContent, Typography } from '@mui/material';

const UserStats = ({ stats }) => {
  const statItems = [
    { label: 'Total Users', value: stats.total },
    { label: 'Admins', value: stats.admins },
    { label: 'Writers', value: stats.writers },
    { label: 'Readers', value: stats.readers },
  ];

  return (
    <Grid container spacing={3} sx={{ mb: 3 }}>
      {statItems.map((item) => (
        <Grid item xs={12} sm={6} md={3} key={item.label}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                {item.label}
              </Typography>
              <Typography variant="h4">
                {item.value}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default React.memo(UserStats);