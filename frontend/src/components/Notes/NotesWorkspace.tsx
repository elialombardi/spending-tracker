// NotesWorkspace.tsx (fixed Grid sizing)

import { useEffect, useMemo, useState } from 'react';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { useTheme, alpha } from '@mui/material/styles';
import api from '../../api';
import { Note, NoteFolderTree, NoteStyle } from '../../types/notes';
import { NotesWorkspaceProps, defaultStyle } from './types';
import { findFolderByID, findNoteByID } from './utils/noteTreeUtils';
import { FolderActions } from './FolderActions';
import { FolderDialog } from './FolderDialog';
import { FolderList } from './FolderList';
import { NoteActions } from './NoteActions';
import { NoteEditor } from './NoteEditor';

export default function NotesWorkspace({ canWrite }: NotesWorkspaceProps) {
  const theme = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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

  async function reloadTree(noteToReselect?: number, forceFolderReset = false) {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await api.listNotesTree();
      const nextTree = Array.isArray(response) ? response : [];
      setTree(nextTree);

      if ((forceFolderReset || !selectedFolderID) && nextTree.length > 0) {
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
      await reloadTree(undefined, true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete folder.');
    } finally {
      setIsSaving(false);
    }
  }

  async function submitFolderDialog() {
    if (!folderNameDraft.trim()) return;
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

  return (
    <Grid container sx={{ alignItems: 'flex-start' }}>
      {!isSidebarOpen && (
        <Grid>
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <IconButton
              onClick={() => setIsSidebarOpen(true)}
              size="small"
              sx={{ bgcolor: alpha(theme.palette.background.paper, 0.06) }}
            >
              <ChevronRightIcon sx={{ color: theme.palette.primary.main }} />
            </IconButton>
          </Box>
        </Grid>
      )}
      {/* Folder List Panel */}
      <Grid size={{ md: 3 }} sx={{ display: isSidebarOpen ? 'block' : 'none' }}>
        <Paper sx={{ p: 2, borderRadius: 3 }} variant="outlined">
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Folders</Typography>
          <Stack sx={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", mb: 1 }} >
            <FolderActions
              canWrite={canWrite}
              selectedFolder={selectedFolder}
              isSidebarOpen={isSidebarOpen}
              onToggleSidebar={() => setIsSidebarOpen((s) => !s)}
              onOpenCreateDialog={() => {
                setFolderDialogMode('create');
                setFolderNameDraft('');
                setIsFolderDialogOpen(true);
              }}
              onOpenCreateRootDialog={() => {
                setSelectedFolderID(null);
                setFolderDialogMode('create');
                setFolderNameDraft('');
                setIsFolderDialogOpen(true);
              }}
              onOpenRenameDialog={(name) => {
                setFolderDialogMode('rename');
                setFolderNameDraft(name);
                setIsFolderDialogOpen(true);
              }}
              onDeleteFolder={handleDeleteFolder}
            />
          </Stack>
          <Divider />
          <FolderList
            tree={tree}
            isLoading={isLoading}
            selectedFolderID={selectedFolderID}
            selectedNoteID={selectedNoteID}
            onSelectFolder={setSelectedFolderID}
            onSelectNote={pickNote}
          />
        </Paper>
      </Grid>

      {/* Note Editor Panel */}
      <Grid size={{ xs: 12, md: isSidebarOpen ? 9 : 12 }}>
        <Stack spacing={2}>
          <Stack sx={{ flexDirection: { xs: 'column', sm: 'row' }, justifyContent: "space-between", spacing: 1, alignItems: 'center' }}>
            <Stack sx={{ flexDirection: { xs: 'column', sm: 'row' }, justifyContent: "space-between", spacing: 1, alignItems: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>Editor</Typography>
            </Stack>
            <NoteActions
              canWrite={canWrite}
              isSaving={isSaving}
              hasTitle={!!title.trim()}
              hasSelectedNote={!!selectedNoteID}
              onNewNote={startNewNote}
              onSaveNote={handleSaveNote}
              onDeleteNote={handleDeleteNote}
            />
          </Stack>

          <NoteEditor
            title={title}
            content={content}
            style={style}
            canWrite={canWrite}
            errorMessage={errorMessage}
            tree={tree}
            selectedFolderID={selectedFolderID}
            onFolderChange={setSelectedFolderID}
            onTitleChange={setTitle}
            onContentChange={setContent}
            onStyleChange={setStyle}
          />
        </Stack>
      </Grid>

      {/* Folder Dialog */}
      <FolderDialog
        open={isFolderDialogOpen}
        mode={folderDialogMode}
        folderName={folderNameDraft}
        isSaving={isSaving}
        onClose={() => setIsFolderDialogOpen(false)}
        onChange={setFolderNameDraft}
        onSubmit={submitFolderDialog}
      />
    </Grid>
  );
}