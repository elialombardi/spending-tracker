import React, { useState } from 'react';
import { Box, Paper } from '@mui/material';

import { DateNavigator } from '../../components/Diary/DateNavigator';
import { EntryEditor } from '../../components/Diary/EntryEditor';
import { parseDateInput, isToday } from '../../helpers/diary';
import { DiaryEntry, useListEntriesQuery } from '../../api/diaryApi';

import { useAutoSave } from './hooks/useAutoSave';
import { useDiaryNavigation } from './hooks/useDiaryNavigation';
import { useDiaryEntry } from './hooks/useDiaryEntry';
import { AutoSaveRestoreDialog } from './components/AutoSaveRestoreDialog/AutoSaveRestoreDialog';
import { SearchSection } from './components/SearchSection/SearchSection';

const DiaryPage: React.FC = () => {
  const { initialDate, updateUrl } = useDiaryNavigation();
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);

  // Diary entry management
  const { content, setContent, entry, isLoading, loadError, handleSave, dateStr } =
    useDiaryEntry(selectedDate);

  // Auto-save functionality
  const { showRestoreDialog, savedContent, handleRestore, handleDiscard, clearAutoSave } =
    useAutoSave(content, dateStr);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DiaryEntry[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const { data: searchData, isLoading: searchLoading, error: searchQueryError } =
    useListEntriesQuery(
      { search: searchQuery, limit: 20 },
      { skip: !searchQuery.trim() }
    );

  // Update search results
  React.useEffect(() => {
    if (searchData) {
      setSearchResults(searchData.data);
    }
    if (searchQueryError) {
      setSearchError('Search failed.');
    } else {
      setSearchError(null);
    }
  }, [searchData, searchQueryError]);

  // Update URL when date changes
  React.useEffect(() => {
    updateUrl(selectedDate);
  }, [selectedDate, updateUrl]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      event.preventDefault();

      const newDate = new Date(selectedDate);

      switch (event.key) {
        case 'ArrowLeft':
          newDate.setDate(newDate.getDate() - 1);
          setSelectedDate(newDate);
          break;
        case 'ArrowRight':
          newDate.setDate(newDate.getDate() + 1);
          setSelectedDate(newDate);
          break;
        case 'ArrowDown':
          setSelectedDate(new Date());
          break;
        default:
          return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDate]);

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  const handleRestoreWithContent = () => {
    const restoredContent = handleRestore();
    if (restoredContent !== null) {
      setContent(restoredContent);
    }
  };

  const handleSaveWithCleanup = async (contentToSave: string) => {
    await handleSave(contentToSave);
    clearAutoSave();
  };

  return (
    <Box sx={{ mx: 'auto', minHeight: '100vh' }}>
      <Paper
        elevation={3}
        sx={{
          p: { xs: 3, md: 5 },
          position: 'relative',
          borderRadius: 2,
          border: (theme) => `1px solid ${theme.palette.divider}`,
          bgcolor: 'background.paper',
        }}
      >
        <AutoSaveRestoreDialog
          open={showRestoreDialog}
          onRestore={handleRestoreWithContent}
          onDiscard={handleDiscard}
        />

        <SearchSection
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          searchResults={searchResults}
          searchLoading={searchLoading}
          searchError={searchError}
          onResultClick={(date) => setSelectedDate(parseDateInput(date))}
        />

        <DateNavigator
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          isToday={isToday(selectedDate)}
        />

        <EntryEditor
          selectedDate={selectedDate}
          content={content}
          onContentChange={setContent}
          onSave={handleSaveWithCleanup}
          loading={isLoading}
          saving={false}
          error={loadError ? 'Failed to load entry.' : null}
          isToday={isToday(selectedDate)}
        />
      </Paper>
    </Box>
  );
};

export default DiaryPage;