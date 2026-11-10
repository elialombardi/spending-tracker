import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import { NoteStyle } from '../../types/notes';

export const folderTypeAppearance = {
    buy_list: { icon: ShoppingBagOutlinedIcon, color: 'success' },
    tasks_list: { icon: ChecklistRoundedIcon, color: 'primary' },
    diary: { icon: AutoStoriesOutlinedIcon, color: 'secondary' },
} as const;

export type NotesWorkspaceProps = {
    canWrite: boolean;
};

export const colorOptions = ['#1f2937', '#0f766e', '#7c2d12', '#7c3aed', '#be123c'];
export const backgroundOptions = ['#ffffff', '#eff6ff', '#f0fdf4', '#fff7ed', '#fdf2f8'];
export const defaultStyle: NoteStyle = {
    bold: false,
    italic: false,
    textColor: '#1f2937',
    backgroundColor: '#ffffff',
    fontSize: 16,
};