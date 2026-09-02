import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Paper } from '@mui/material';
import { diaryApi, DiaryEntry } from '../../api/diary';
import { DiaryHeader } from '../../components/Diary/DiaryHeader';
import { DateNavigator } from '../../components/Diary/DateNavigator';
import { EntryEditor } from '../../components/Diary/EntryEditor';
import { SearchBar } from '../../components/Diary/SearchBar';
import { DiaryFooter } from '../../components/Diary/DiaryFooter';
import { formatDateInput, parseDateInput, isToday } from '../../helpers/diary';

// Type for API error responses
interface ApiError {
  status?: number;
  message?: string;
}

const DiaryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const dateParam = searchParams.get('date');
  const initialDate = dateParam ? parseDateInput(dateParam) : new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);

  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DiaryEntry[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const isInitialMount = useRef(true);
  // Track the current date to prevent race conditions
  const currentDateRef = useRef<Date>(selectedDate);

  // Update URL when date changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const dateStr = formatDateInput(selectedDate);
    setSearchParams({ date: dateStr });
  }, [selectedDate, setSearchParams]);

  // Load entry when date changes - using a single setState update to avoid cascading renders
  useEffect(() => {
    currentDateRef.current = selectedDate;

    const loadEntry = async () => {
      const dateStr = formatDateInput(selectedDate);
      setLoading(true);
      setError(null);

      try {
        const response = await diaryApi.getByDate(dateStr);
        // Only update if the date hasn't changed while fetching
        if (currentDateRef.current === selectedDate) {
          setEntry(response);
          setContent(response.content);
        }
      } catch (err) {
        const error = err as ApiError;
        // Only update if the date hasn't changed while fetching
        if (currentDateRef.current === selectedDate) {
          if (error.status === 404) {
            setEntry(null);
            setContent('');
          } else {
            setError('Failed to load entry.');
          }
        }
      } finally {
        // Only update loading state if the date hasn't changed
        if (currentDateRef.current === selectedDate) {
          setLoading(false);
        }
      }
    };

    loadEntry();
  }, [selectedDate]);

  const handleSave = async (content: string) => {
    if (!content.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const dateStr = formatDateInput(selectedDate);
      if (entry) {
        await diaryApi.update(dateStr, content);
      } else {
        await diaryApi.create(dateStr, content);
      }
      const response = await diaryApi.getByDate(dateStr);
      setEntry(response);
      setContent(response.content);
    } catch {
      setError('Failed to save entry.');
    } finally {
      setSaving(false);
    }
  };

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
  };

  // Debounced search
  useEffect(() => {
    const handleSearch = async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }
      setSearchLoading(true);
      setSearchError(null);
      try {
        const response = await diaryApi.list({ search: query, limit: 20 });
        setSearchResults(response.data);
      } catch {
        setSearchError('Search failed.');
      } finally {
        setSearchLoading(false);
      }
    };

    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <Box
      sx={{
        p: { xs: 2, md: 4 },
        maxWidth: 900,
        mx: 'auto',
        minHeight: '100vh',
      }}
    >
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
        <DiaryHeader />

        <DateNavigator
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          isToday={isToday(selectedDate)}
        />

        <EntryEditor
          selectedDate={selectedDate}
          content={content}
          onContentChange={setContent}
          onSave={handleSave}
          loading={loading}
          saving={saving}
          error={error}
        />

        <SearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchResults={searchResults}
          searchLoading={searchLoading}
          searchError={searchError}
          onResultClick={(date) => setSelectedDate(parseDateInput(date))}
        />

        <DiaryFooter />
      </Paper>
    </Box>
  );
};

export default DiaryPage;