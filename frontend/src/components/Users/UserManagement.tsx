import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Box } from '@mui/material';
import { usersApi } from '../../api/domains/users';
import UserHeader from './UserHeader';
import UserStats from './UserStats';
import UserFilters from './UserFilters';
import UserTable from './UserTable';
import UserFormDialog from './UserFormDialog';
import UserDeleteDialog from './UserDeleteDialog';
import UserSnackbar from './UserSnackbar';

const UserManagement = () => {
  // State
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  
  // Dialog states
  const [formDialog, setFormDialog] = useState({
    open: false,
    isEditing: false,
    user: null,
  });
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    user: null,
  });
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'Writer',
  });
  
  // Snackbar state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });

  // Loading states for dialogs
  const [formLoading, setFormLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Ref for mounted state
  const isMounted = useRef(true);

  // Snackbar helpers
  const showSnackbar = useCallback((message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleCloseSnackbar = useCallback(() => {
    setSnackbar(prev => ({ ...prev, open: false }));
  }, []);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    if (!isMounted.current) return;
    
    setLoading(true);
    try {
      const response = await usersApi.listUsers(page + 1, rowsPerPage);
      if (isMounted.current) {
        setUsers(response.data || []);
        setTotalUsers(response.meta?.total || 0);
      }
    } catch (error) {
      if (isMounted.current) {
        showSnackbar('Failed to fetch users', 'error');
      }
      console.error('Error fetching users:', error);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [page, rowsPerPage, showSnackbar]);

  // Initial load and pagination changes
  useEffect(() => {
    let cancelled = false;
    
    const loadUsers = async () => {
      if (cancelled) return;
      await fetchUsers();
    };
    
    loadUsers();
    
    return () => {
      cancelled = true;
    };
  }, [fetchUsers]);

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Computed values
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = user.username
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter]);

  const stats = useMemo(() => ({
    total: totalUsers,
    admins: users.filter(u => u.role === 'Admin').length,
    writers: users.filter(u => u.role === 'Writer').length,
    readers: users.filter(u => u.role === 'Reader').length,
  }), [users, totalUsers]);

  // Dialog handlers
  const handleOpenFormDialog = useCallback((user = null) => {
    if (user) {
      setFormDialog({ open: true, isEditing: true, user });
      setFormData({
        username: user.username,
        password: '',
        role: user.role,
      });
    } else {
      setFormDialog({ open: true, isEditing: false, user: null });
      setFormData({
        username: '',
        password: '',
        role: 'Writer',
      });
    }
  }, []);

  const handleCloseFormDialog = useCallback(() => {
    setFormDialog({ open: false, isEditing: false, user: null });
    setFormData({
      username: '',
      password: '',
      role: 'Writer',
    });
    setFormLoading(false);
  }, []);

  const handleOpenDeleteDialog = useCallback((user) => {
    setDeleteDialog({ open: true, user });
  }, []);

  const handleCloseDeleteDialog = useCallback(() => {
    setDeleteDialog({ open: false, user: null });
    setDeleteLoading(false);
  }, []);

  // Form handlers
  const handleFormChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  const handleFormSubmit = useCallback(async () => {
    setFormLoading(true);
    try {
      if (formDialog.isEditing && formDialog.user) {
        await usersApi.updateUser(formDialog.user.id, formData);
        showSnackbar('User updated successfully');
      } else {
        await usersApi.createUser(formData);
        showSnackbar('User created successfully');
      }
      handleCloseFormDialog();
      await fetchUsers();
    } catch (error) {
      showSnackbar(error.message || 'Operation failed', 'error');
      console.error('Error saving user:', error);
    } finally {
      setFormLoading(false);
    }
  }, [formDialog, formData, showSnackbar, handleCloseFormDialog, fetchUsers]);

  const handleDelete = useCallback(async () => {
    if (!deleteDialog.user) return;
    
    setDeleteLoading(true);
    try {
      await usersApi.deleteUser(deleteDialog.user.id);
      showSnackbar('User deleted successfully');
      handleCloseDeleteDialog();
      await fetchUsers();
    } catch (error) {
      showSnackbar('Failed to delete user', 'error');
      console.error('Error deleting user:', error);
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteDialog.user, showSnackbar, handleCloseDeleteDialog, fetchUsers]);

  // Pagination handlers
  const handlePageChange = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  const handleRowsPerPageChange = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  // Filter handlers
  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
  }, []);

  const handleRoleFilterChange = useCallback((e) => {
    setRoleFilter(e.target.value);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setRoleFilter('all');
  }, []);

  return (
    <Box>
      {/* Header */}
      <UserHeader
        title="User Management"
        onRefresh={fetchUsers}
        onAdd={() => handleOpenFormDialog()}
        loading={loading}
      />

      {/* Stats */}
      <UserStats stats={stats} />

      {/* Filters */}
      <UserFilters
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        roleFilter={roleFilter}
        onRoleFilterChange={handleRoleFilterChange}
        onClearFilters={clearFilters}
      />

      {/* Table */}
      <UserTable
        users={filteredUsers}
        totalUsers={totalUsers}
        loading={loading}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={handlePageChange}
        onRowsPerPageChange={handleRowsPerPageChange}
        onEdit={handleOpenFormDialog}
        onDelete={handleOpenDeleteDialog}
      />

      {/* Dialogs */}
      <UserFormDialog
        open={formDialog.open}
        onClose={handleCloseFormDialog}
        onSubmit={handleFormSubmit}
        formData={formData}
        onFormChange={handleFormChange}
        isEditing={formDialog.isEditing}
        loading={formLoading}
      />

      <UserDeleteDialog
        open={deleteDialog.open}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleDelete}
        user={deleteDialog.user}
        loading={deleteLoading}
      />

      {/* Snackbar */}
      <UserSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={handleCloseSnackbar}
      />
    </Box>
  );
};

export default UserManagement;