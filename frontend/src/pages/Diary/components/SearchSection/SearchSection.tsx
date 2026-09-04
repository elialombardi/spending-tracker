import React from 'react';
import { DiaryEntry } from '../../../../api/diaryApi';
import { SearchBar } from '../../../../components/Diary/SearchBar';

interface SearchSectionProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchResults: DiaryEntry[];
  searchLoading: boolean;
  searchError: string | null;
  onResultClick: (date: string) => void;
}

export const SearchSection: React.FC<SearchSectionProps> = ({
  searchQuery,
  onSearchChange,
  searchResults,
  searchLoading,
  searchError,
  onResultClick,
}) => {
  return (
    <SearchBar
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
      searchResults={searchResults}
      searchLoading={searchLoading}
      searchError={searchError}
      onResultClick={onResultClick}
    />
  );
};