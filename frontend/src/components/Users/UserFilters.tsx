import React from 'react';
import {
  Box,
  Paper,
  Grid,
  OutlinedInput,
  InputAdornment,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
} from '@mui/material';
import { Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material';

const UserFilters = ({
  searchTerm,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  onClearFilters,
}) => {
  const hasFilters = searchTerm || roleFilter !== 'all';

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} sm={6} md={4}>
          <OutlinedInput
            placeholder="Search by username..."
            value={searchTerm}
            onChange={onSearchChange}
            startAdornment={
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            }
            endAdornment={
              searchTerm && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => onSearchChange({ target: { value: '' } })}>
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              )
            }
            fullWidth
            size="small"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Role</InputLabel>
            <Select
              value={roleFilter}
              onChange={onRoleFilterChange}
              label="Role"
            >
              <MenuItem value="all">All Roles</MenuItem>
              <MenuItem value="Admin">Admin</MenuItem>
              <MenuItem value="Writer">Writer</MenuItem>
              <MenuItem value="Reader">Reader</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={12} md={5}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            {hasFilters && (
              <Button
                variant="outlined"
                onClick={onClearFilters}
                size="small"
              >
                Clear Filters
              </Button>
            )}
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default React.memo(UserFilters);