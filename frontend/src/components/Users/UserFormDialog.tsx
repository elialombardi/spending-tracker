import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
} from '@mui/material';

const UserFormDialog = ({
  open,
  onClose,
  onSubmit,
  formData,
  onFormChange,
  isEditing,
  loading,
}) => {
  const isFormValid = formData.username && (!isEditing || formData.password !== undefined);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {isEditing ? 'Edit User' : 'Create New User'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            name="username"
            label="Username"
            value={formData.username}
            onChange={onFormChange}
            fullWidth
            required
            disabled={isEditing}
            autoFocus
          />
          {!isEditing && (
            <TextField
              name="password"
              label="Password"
              type="password"
              value={formData.password}
              onChange={onFormChange}
              fullWidth
              required
              helperText="Minimum 6 characters"
            />
          )}
          {isEditing && (
            <TextField
              name="password"
              label="New Password"
              type="password"
              value={formData.password}
              onChange={onFormChange}
              fullWidth
              helperText="Leave blank to keep current password"
            />
          )}
          <FormControl fullWidth>
            <InputLabel>Role</InputLabel>
            <Select
              name="role"
              value={formData.role}
              onChange={onFormChange}
              label="Role"
            >
              <MenuItem value="Admin">Admin</MenuItem>
              <MenuItem value="Writer">Writer</MenuItem>
              <MenuItem value="Reader">Reader</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={onSubmit}
          variant="contained"
          disabled={!isFormValid || loading}
        >
          {loading ? 'Saving...' : isEditing ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default React.memo(UserFormDialog);