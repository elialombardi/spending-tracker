import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/Delete';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import api from '../../api';
import type { Note, NoteFolderTree, NoteStyle } from '../../types/domain';

type Props = {
  canWrite: boolean
}

const colorOptions = ['#1f2937', '#0f766e', '#7c2d12', '#7c3aed', '#be123c'];
const backgroundOptions = ['#ffffff', '#eff6ff', '#f0fdf4', '#fff7ed', '#fdf2f8'];

const defaultStyle: NoteStyle = {
  bold: false,
  italic: false,
  textColor: '#1f2937',
  backgroundColor: '#ffffff',
  fontSize: 16,
};

function findFolderByID(nodes: NoteFolderTree[], folderID: number): NoteFolderTree | null {
  for (const node of nodes) {
    if (node.id === folderID) return node;
    const nested = findFolderByID(node.children || [], folderID);
    if (nested) return nested;
  }
  return null;
}

function findNoteByID(nodes: NoteFolderTree[], noteID: number): { note: Note; folderId: number } | null {
  for (const node of nodes) {
    const found = (node.notes || []).find((note) => note.id === noteID);
    if (found) return { note: found, folderId: node.id };
    const nested = findNoteByID(node.children || [], noteID);
    if (nested) return nested;
  }
  return null;
}

export default function NotesWorkspace({ canWrite }: Props) {
  const [tree, setTree] = useState<NoteFolderTree[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [selectedFolderID, setSelectedFolderID] = useState<number | null>(null);
  const [selectedNoteID, setSelectedNoteID] = useState<number | null>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [style, setStyle] = useState<NoteStyle>(defaultStyle);

  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [folderDialogMode, setFolderDialogMode] = useState<'create' | 'rename'>('create');
  const [folderNameDraft, setFolderNameDraft] = useState('');

  const selectedFolder = useMemo(
    () => (selectedFolderID ? findFolderByID(tree, selectedFolderID) : null),
    [selectedFolderID, tree],
  );

  useEffect(() => {
    void reloadTree();
  }, []);

  async function reloadTree(noteToReselect?: number) {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await api.listNotesTree();
      const nextTree = Array.isArray(response) ? response : [];
      setTree(nextTree);

      if (!selectedFolderID && nextTree.length > 0) {
        setSelectedFolderID(nextTree[0].id);
      }
      if (noteToReselect) {
        const selected = findNoteByID(nextTree, noteToReselect);
        if (selected) {
          setSelectedNoteID(selected.note.id);
          setSelectedFolderID(selected.folderId);
          setTitle(selected.note.title);
          setContent(selected.note.content);
          setStyle(selected.note.style || defaultStyle);
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load notes.');
    } finally {
      setIsLoading(false);
    }
  }

  function startNewNote() {
    setSelectedNoteID(null);
    setTitle('');
    setContent('');
    setStyle(defaultStyle);
  }

  function pickNote(note: Note, folderID: number) {
    setSelectedFolderID(folderID);
    setSelectedNoteID(note.id);
    setTitle(note.title);
    setContent(note.content);
    setStyle(note.style || defaultStyle);
  }

  async function handleSaveNote() {
    if (!selectedFolderID) {
      setErrorMessage('Select a folder first.');
      return;
    }
    setIsSaving(true);
    setErrorMessage('');
    try {
      const payload = { folderId: selectedFolderID, title, content, style };
      if (selectedNoteID) {
        const updated = await api.updateNote(selectedNoteID, payload);
        await reloadTree(updated?.id);
      } else {
        const created = await api.createNote(payload);
        await reloadTree(created?.id);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save note.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteNote() {
    if (!selectedNoteID) return;
    setIsSaving(true);
    setErrorMessage('');
    try {
      await api.deleteNote(selectedNoteID);
      startNewNote();
      await reloadTree();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete note.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteFolder() {
    if (!selectedFolderID) return;
    setIsSaving(true);
    setErrorMessage('');
    try {
      await api.deleteNoteFolder(selectedFolderID);
      startNewNote();
      setSelectedFolderID(null);
      await reloadTree();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete folder.');
    } finally {
      setIsSaving(false);
    }
  }

  async function submitFolderDialog() {
    if (!folderNameDraft.trim()) {
      return;
    }
    setIsSaving(true);
    setErrorMessage('');
    try {
      if (folderDialogMode === 'create') {
        await api.createNoteFolder({
          name: folderNameDraft.trim(),
          parentId: selectedFolderID || undefined,
        });
      } else if (selectedFolderID) {
        await api.updateNoteFolder(selectedFolderID, { name: folderNameDraft.trim() });
      }
      setIsFolderDialogOpen(false);
      setFolderNameDraft('');
      await reloadTree();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save folder.');
    } finally {
      setIsSaving(false);
    }
  }

  function renderTree(nodes: NoteFolderTree[], depth = 0): ReactNode {
    return nodes.map((folder) => (
      <Box key={folder.id}>
        <ListItemButton
          selected={selectedFolderID === folder.id}
          sx={{ pl: 2 + depth * 2 }}
          onClick={() => setSelectedFolderID(folder.id)}
        >
          <FolderIcon color="primary" fontSize="small" sx={{ mr: 1 }} />
          <ListItemText primary={folder.name} />
        </ListItemButton>
        {(folder.notes || []).map((note) => (
          <ListItemButton
            key={note.id}
            selected={selectedNoteID === note.id}
            sx={{ pl: 6 + depth * 2 }}
            onClick={() => pickNote(note, folder.id)}
          >
            <InsertDriveFileIcon color="action" fontSize="small" sx={{ mr: 1 }} />
            <ListItemText
              primary={note.title}
              secondary={note.updatedAt ? `Updated ${new Date(note.updatedAt).toLocaleString()}` : undefined}
            />
          </ListItemButton>
        ))}
        {renderTree(folder.children || [], depth + 1)}
      </Box>
    ));
  }

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Paper sx={{ p: 2, borderRadius: 3 }} variant="outlined">
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Folders</Typography>
            <Box>
              <Tooltip title="Add child folder">
                <span>
                  <IconButton
                    size="small"
                    disabled={!canWrite}
                    onClick={() => {
                      setFolderDialogMode('create');
                      setFolderNameDraft('');
                      setIsFolderDialogOpen(true);
                    }}
                  >
                    <AddIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Rename folder">
                <span>
                  <IconButton
                    size="small"
                    disabled={!canWrite || !selectedFolder}
                    onClick={() => {
                      setFolderDialogMode('rename');
                      setFolderNameDraft(selectedFolder?.name || '');
                      setIsFolderDialogOpen(true);
                    }}
                  >
                    <DriveFileRenameOutlineIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Delete folder">
                <span>
                  <IconButton size="small" disabled={!canWrite || !selectedFolder} onClick={handleDeleteFolder}>
                    <DeleteOutlineIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Stack>
          <Divider />
          {isLoading ? (
            <Stack alignItems="center" sx={{ py: 6 }}>
              <CircularProgress size={26} />
            </Stack>
          ) : (
            <List dense disablePadding>
              {renderTree(tree)}
            </List>
          )}
        </Paper>
      </Grid>
      <Grid size={{ xs: 12, md: 8 }}>
        <Paper
          variant="outlined"
          sx={{
            p: 2.5,
            borderRadius: 3,
            background: 'linear-gradient(160deg, rgba(99,102,241,0.08), rgba(16,185,129,0.06))',
          }}
        >
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>Creative Notes</Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  startIcon={<NoteAddIcon />}
                  onClick={startNewNote}
                  disabled={!canWrite || isSaving}
                >
                  New note
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSaveNote}
                  disabled={!canWrite || isSaving || !title.trim()}
                >
                  Save note
                </Button>
                <Button
                  variant="text"
                  color="error"
                  onClick={handleDeleteNote}
                  disabled={!canWrite || isSaving || !selectedNoteID}
                >
                  Delete
                </Button>
              </Stack>
            </Stack>

            {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

            <TextField
              label="Note title"
              value={title}
              disabled={!canWrite}
              onChange={(event) => setTitle(event.target.value)}
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
              <ToggleButtonGroup
                value={[style.bold ? 'bold' : '', style.italic ? 'italic' : ''].filter(Boolean)}
                onChange={(_, values) => setStyle((current) => ({ ...current, bold: values.includes('bold'), italic: values.includes('italic') }))}
                size="small"
                exclusive={false}
                disabled={!canWrite}
              >
                <ToggleButton value="bold" sx={{ fontWeight: 700 }}>B</ToggleButton>
                <ToggleButton value="italic" sx={{ fontStyle: 'italic' }}>I</ToggleButton>
              </ToggleButtonGroup>
              <TextField
                select
                size="small"
                label="Text color"
                value={style.textColor}
                disabled={!canWrite}
                onChange={(event) => setStyle((current) => ({ ...current, textColor: event.target.value }))}
                sx={{ minWidth: 150 }}
              >
                {colorOptions.map((color) => (
                  <MenuItem key={color} value={color}>{color}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Background"
                value={style.backgroundColor}
                disabled={!canWrite}
                onChange={(event) => setStyle((current) => ({ ...current, backgroundColor: event.target.value }))}
                sx={{ minWidth: 150 }}
              >
                {backgroundOptions.map((color) => (
                  <MenuItem key={color} value={color}>{color}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Font size"
                value={style.fontSize}
                disabled={!canWrite}
                onChange={(event) => setStyle((current) => ({ ...current, fontSize: Number(event.target.value) }))}
                sx={{ minWidth: 120 }}
              >
                {[14, 16, 18, 20, 24].map((fontSize) => (
                  <MenuItem key={fontSize} value={fontSize}>{fontSize}px</MenuItem>
                ))}
              </TextField>
            </Stack>

            <TextField
              label="Content"
              multiline
              minRows={12}
              value={content}
              disabled={!canWrite}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Write your thoughts here. Multiline notes are fully supported."
            />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Live preview</Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  minHeight: 140,
                  whiteSpace: 'pre-wrap',
                  color: style.textColor,
                  backgroundColor: style.backgroundColor,
                  fontWeight: style.bold ? 700 : 400,
                  fontStyle: style.italic ? 'italic' : 'normal',
                  fontSize: `${style.fontSize}px`,
                }}
              >
                {content || 'Your styled note preview appears here.'}
              </Paper>
            </Box>
          </Stack>
        </Paper>
      </Grid>

      <Dialog open={isFolderDialogOpen} onClose={() => setIsFolderDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{folderDialogMode === 'create' ? 'Create folder' : 'Rename folder'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Folder name"
            value={folderNameDraft}
            onChange={(event) => setFolderNameDraft(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsFolderDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={submitFolderDialog} disabled={!folderNameDraft.trim() || isSaving}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}
