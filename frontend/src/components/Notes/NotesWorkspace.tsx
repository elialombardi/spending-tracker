import { useEffect, useMemo, useState } from 'react';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import Chip from '@mui/material/Chip';
import { isMatch } from 'date-fns';
import { useTheme, alpha } from '@mui/material/styles';
import api from '../../api';
import { Note, NoteFolderTree, NoteFolderType, NoteStyle, folderTypeLabels } from '../../types/notes';
import { NotesWorkspaceProps, defaultStyle, folderTypeAppearance } from './types';
import { findFolderByID, findNoteByID, reorderItems } from './utils/noteTreeUtils';
import { FolderActions } from './FolderActions';
import { FolderDialog } from './FolderDialog';
import { FolderList } from './FolderList';
import { NoteActions } from './NoteActions';
import { NoteEditor } from './NoteEditor';
import { NoteList } from './NoteList';

export default function NotesWorkspace({ canWrite }: NotesWorkspaceProps) {
  const theme = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [tree, setTree] = useState<NoteFolderTree[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [selectedFolderID, setSelectedFolderID] = useState<number | null>(null);
  const [selectedNoteID, setSelectedNoteID] = useState<number | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [position, setPosition] = useState('0');
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');
  const [endDate, setEndDate] = useState('');
  const [completed, setCompleted] = useState(false);
  const [style, setStyle] = useState<NoteStyle>(defaultStyle);

  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [folderDialogMode, setFolderDialogMode] = useState<'create' | 'rename'>('create');
  const [folderNameDraft, setFolderNameDraft] = useState('');
  const [folderTypeDraft, setFolderTypeDraft] = useState<NoteFolderType>('diary');
  const [folderPositionDraft, setFolderPositionDraft] = useState('0');
  const [folderParentID, setFolderParentID] = useState<number | null>(null);

  const selectedFolder = useMemo(
    () => (selectedFolderID ? findFolderByID(tree, selectedFolderID) : null),
    [selectedFolderID, tree],
  );
  const folderType = selectedFolder?.type ?? 'diary';
  const { icon: FolderTypeIcon, color: folderColor } = folderTypeAppearance[folderType];
  const folderAccent = theme.palette[folderColor][theme.palette.mode === 'dark' ? 'light' : 'main'];
  const panelSx = {
    borderRadius: '20px',
    bgcolor: 'background.default',
    boxShadow: `0 8px 32px ${alpha(theme.palette.text.primary, 0.04)}`,
  };

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
          loadNote(selected.note);
        }
      }
      return nextTree;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load notes.');
    } finally {
      setIsLoading(false);
    }
  }

  function startNewNote() {
    resetEditor();
    setIsEditorOpen(true);
  }

  function resetEditor() {
    setIsEditorOpen(false);
    setSelectedNoteID(null);
    setTitle('');
    setPosition('0');
    setContent('');
    setDescription('');
    setEndDate('');
    setCompleted(false);
    setStyle(defaultStyle);
  }

  function pickNote(note: Note, folderID: number) {
    setIsEditorOpen(true);
    setSelectedFolderID(folderID);
    setSelectedNoteID(note.id);
    loadNote(note);
  }

  function loadNote(note: Note) {
    setTitle(note.title);
    setPosition(String(note.position));
    setContent(note.content);
    setDescription(note.description ?? '');
    setEndDate(note.endDate ?? '');
    setCompleted(note.completed);
    setStyle(note.style || defaultStyle);
  }

  async function handleSaveNote() {
    if (!selectedFolderID) {
      setErrorMessage('Select a folder first.');
      return;
    }
    const nextPosition = Number(position);
    if (!position.trim() || !Number.isSafeInteger(nextPosition) || nextPosition < 0) {
      setErrorMessage('Position must be a non-negative integer.');
      return;
    }
    if (folderType === 'tasks_list' && endDate && !isMatch(endDate, 'yyyy-MM-dd')) {
      setErrorMessage('End date must be a valid date.');
      return;
    }
    setIsSaving(true);
    setErrorMessage('');
    try {
      const fields = folderType === 'diary' ? { content, style }
        : folderType === 'tasks_list' ? { description: description === '' ? null : description, endDate, completed }
          : { completed };
      const payload = { folderId: selectedFolderID, title, position: nextPosition, ...fields };
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

  async function handleToggleCompleted(note: Note) {
    if (!canWrite || isSaving) return;
    setIsSaving(true);
    setErrorMessage('');
    try {
      const updated = await api.updateNote(note.id, { completed: !note.completed });
      if (selectedNoteID === note.id) setCompleted(updated.completed);
      await reloadTree();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update item.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReorder(
    items: (Note | NoteFolderTree)[],
    id: number,
    direction: -1 | 1,
    kind: 'folder' | 'note',
  ) {
    if (!canWrite || isSaving || isLoading) return;
    setIsSaving(true);
    setErrorMessage('');
    try {
      await reorderItems(items, id, direction, (itemID, nextPosition) => (
        kind === 'folder'
          ? api.updateNoteFolder(itemID, { position: nextPosition })
          : api.updateNote(itemID, { position: nextPosition })
      ));
      const nextTree = await reloadTree();
      if (kind === 'note' && selectedNoteID && nextTree) {
        const selected = findNoteByID(nextTree, selectedNoteID);
        if (selected) setPosition(String(selected.note.position));
      }
    } catch (error) {
      // Earlier writes may have succeeded; reconcile without discarding editor drafts.
      const nextTree = await reloadTree();
      if (kind === 'note' && selectedNoteID && nextTree) {
        const selected = findNoteByID(nextTree, selectedNoteID);
        if (selected) setPosition(String(selected.note.position));
      }
      setErrorMessage(error instanceof Error ? error.message : 'Failed to reorder items.');
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
      resetEditor();
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
      resetEditor();
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
    const nextPosition = Number(folderPositionDraft);
    if (!folderPositionDraft.trim() || !Number.isSafeInteger(nextPosition) || nextPosition < 0) {
      setErrorMessage('Folder position must be a non-negative integer.');
      return;
    }
    setIsSaving(true);
    setErrorMessage('');
    try {
      if (folderDialogMode === 'create') {
        await api.createNoteFolder({
          name: folderNameDraft.trim(),
          type: folderTypeDraft,
          position: nextPosition,
          parentId: folderParentID ?? undefined,
        });
      } else if (selectedFolderID) {
        await api.updateNoteFolder(selectedFolderID, { name: folderNameDraft.trim(), type: folderTypeDraft, position: nextPosition });
      }
      setIsFolderDialogOpen(false);
      setFolderNameDraft('');
      setFolderTypeDraft('diary');
      setFolderPositionDraft('0');
      await reloadTree();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save folder.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Grid container spacing={2.5} sx={{ alignItems: 'flex-start' }}>
      {/* Folder List Panel */}
      <Grid component="aside" aria-label="Note folders" size={{ xs: 12, md: 3 }} sx={{ display: isSidebarOpen ? 'block' : 'none' }}>
        <Paper sx={{ ...panelSx, overflow: 'hidden', backgroundImage: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.04)}, transparent 220px)` }} variant="outlined">
            <FolderActions
              canWrite={canWrite && !isSaving}
              selectedFolder={selectedFolder}
              isSidebarOpen={isSidebarOpen}
              onToggleSidebar={() => setIsSidebarOpen((s) => !s)}
              onOpenCreateDialog={() => {
                setErrorMessage('');
                setFolderParentID(selectedFolderID);
                setFolderDialogMode('create');
                setFolderNameDraft('');
                setFolderTypeDraft('diary');
                setFolderPositionDraft('0');
                setIsFolderDialogOpen(true);
              }}
              onOpenCreateRootDialog={() => {
                setErrorMessage('');
                setFolderParentID(null);
                setFolderDialogMode('create');
                setFolderNameDraft('');
                setFolderTypeDraft('diary');
                setFolderPositionDraft('0');
                setIsFolderDialogOpen(true);
              }}
              onOpenRenameDialog={(name) => {
                setErrorMessage('');
                setFolderDialogMode('rename');
                setFolderNameDraft(name);
                setFolderTypeDraft(selectedFolder?.type ?? 'diary');
                setFolderPositionDraft(String(selectedFolder?.position ?? 0));
                setIsFolderDialogOpen(true);
              }}
              onDeleteFolder={handleDeleteFolder}
            />
          <Divider sx={{ mx: 2.5 }} />
          <FolderList
            tree={tree}
            isLoading={isLoading}
            canWrite={canWrite}
            isBusy={isSaving || isLoading}
            onMoveFolder={(siblings, id, direction) => handleReorder(siblings, id, direction, 'folder')}
            selectedFolderID={selectedFolderID}
            onSelectFolder={(id) => {
              resetEditor();
              setErrorMessage('');
              setSelectedFolderID(id);
            }}
          />
        </Paper>
      </Grid>

      {/* Folder items and editor */}
      <Grid component="main" aria-label="Folder contents" size={{ xs: 12, md: isSidebarOpen ? 9 : 12 }}>
        <Stack spacing={2}>
          {!isSidebarOpen && (
            <Button
              aria-label="Expand sidebar"
              startIcon={<ChevronRightIcon />}
              onClick={() => setIsSidebarOpen(true)}
              sx={{ alignSelf: 'flex-start', borderRadius: '10px' }}
            >
              Show folders
            </Button>
          )}
          {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
          {selectedFolder ? (
            <>
              <Paper component="section" aria-label="Folder item list" variant="outlined" sx={{ ...panelSx, p: { xs: 2, sm: 3 } }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 3 }}>
                  <Stack direction="row" spacing={2} sx={{ alignItems: 'center', minWidth: 0 }}>
                    <Box sx={{
                      width: 52, height: 52, flexShrink: 0, borderRadius: '16px', display: 'grid', placeItems: 'center',
                      color: folderAccent, bgcolor: alpha(folderAccent, 0.12),
                    }}>
                      <FolderTypeIcon sx={{ fontSize: 28 }} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="h6" component="h2" sx={{ fontWeight: 600, overflowWrap: 'anywhere', mb: 0.75 }}>{selectedFolder.name}</Typography>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        <Chip size="small" label={folderTypeLabels[folderType]} sx={{
                          height: 23, borderRadius: '6px', typography: 'caption', fontWeight: 600,
                          color: 'text.primary', bgcolor: alpha(folderAccent, 0.1),
                        }} />
                        <Typography variant="caption" color="text.secondary">
                          {selectedFolder.notes.length} {folderType === 'diary'
                            ? (selectedFolder.notes.length === 1 ? 'note' : 'notes')
                            : (selectedFolder.notes.length === 1 ? 'item' : 'items')}
                        </Typography>
                      </Stack>
                    </Box>
                  </Stack>
                  {!isEditorOpen && (
                    <Button variant="contained" startIcon={<NoteAddIcon />} onClick={startNewNote} disabled={!canWrite || isSaving || isLoading} sx={{ flexShrink: 0, borderRadius: '12px', px: 2.5, py: 1.2, fontWeight: 600 }}>
                      {folderType === 'diary' ? 'New note' : 'New item'}
                    </Button>
                  )}
                </Stack>
                <NoteList
                  folder={selectedFolder}
                  selectedNoteID={selectedNoteID}
                  canWrite={canWrite}
                  isBusy={isSaving || isLoading}
                  onSelectNote={(note) => pickNote(note, selectedFolder.id)}
                  onToggleCompleted={handleToggleCompleted}
                  onMoveNote={(id, direction) => handleReorder(selectedFolder.notes, id, direction, 'note')}
                />
              </Paper>
              {isEditorOpen && (
                <Paper component="section" aria-label="Item editor" variant="outlined" sx={{ ...panelSx, p: { xs: 2, sm: 3 } }}>
                  <Stack spacing={2}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between' }}>
                      <NoteActions
                        canWrite={canWrite}
                        isSaving={isSaving}
                        hasTitle={!!title.trim()}
                        hasSelectedNote={!!selectedNoteID}
                        isList={folderType !== 'diary'}
                        onNewNote={startNewNote}
                        onSaveNote={handleSaveNote}
                        onDeleteNote={handleDeleteNote}
                      />
                      <Button onClick={resetEditor} disabled={isSaving}>Close editor</Button>
                    </Stack>
                    <NoteEditor
                      title={title}
                      position={position}
                      onPositionChange={setPosition}
                      content={content}
                      style={style}
                      canWrite={canWrite && !isSaving}
                      folderType={folderType}
                      description={description}
                      endDate={endDate}
                      completed={completed}
                      onDescriptionChange={setDescription}
                      onEndDateChange={setEndDate}
                      onCompletedChange={setCompleted}
                      errorMessage=""
                      tree={tree}
                      selectedFolderID={selectedFolderID}
                      onFolderChange={setSelectedFolderID}
                      onTitleChange={setTitle}
                      onContentChange={setContent}
                      onStyleChange={setStyle}
                    />
                  </Stack>
                </Paper>
              )}
            </>
          ) : (
            <Typography role="status" color="text.secondary" sx={{ p: 2 }}>
              {isLoading ? 'Loading folders...' : 'Select or create a folder to view its items.'}
            </Typography>
          )}
        </Stack>
      </Grid>

      {/* Folder Dialog */}
      <FolderDialog
        open={isFolderDialogOpen}
        mode={folderDialogMode}
        folderName={folderNameDraft}
        folderType={folderTypeDraft}
        onTypeChange={setFolderTypeDraft}
        errorMessage={errorMessage}
        position={folderPositionDraft}
        onPositionChange={setFolderPositionDraft}
        isSaving={isSaving}
        onClose={() => setIsFolderDialogOpen(false)}
        onChange={setFolderNameDraft}
        onSubmit={submitFolderDialog}
      />
    </Grid>
  );
}