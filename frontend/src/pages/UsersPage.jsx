import Paper from '@mui/material/Paper';
import { UserManagement } from '../components/Users';

export default function UsersPage() {
  return (
    <Paper sx={{ p: { xs: 2, md: 3 }, minHeight: '90vh' }}>
      <UserManagement />
    </Paper>
  );
}