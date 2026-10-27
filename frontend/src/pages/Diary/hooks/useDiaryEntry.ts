import { useState } from "react";
import {
  useGetEntryByDateQuery,
  useCreateEntryMutation,
  useUpdateEntryMutation,
} from "../../../api/diaryApi";
import { formatDateInput } from "../../../helpers/diary";

export const useDiaryEntry = (selectedDate: Date) => {
  const dateStr = formatDateInput(selectedDate);
  const [draft, setDraft] = useState<{ date: string; content: string } | null>(null);
  const [previousDate, setPreviousDate] = useState(dateStr);
  if (previousDate !== dateStr) {
    setPreviousDate(dateStr);
    setDraft(null);
  }

  const {
    currentData: entry,
    isLoading,
    error: loadError,
    refetch,
  } = useGetEntryByDateQuery(dateStr, {
    skip: !dateStr,
  });

  const [createEntry] = useCreateEntryMutation();
  const [updateEntry] = useUpdateEntryMutation();

  const content = draft?.date === dateStr ? draft.content : entry?.content || "";
  const setContent = (content: string) => setDraft({ date: dateStr, content });

  const handleSave = async (contentToSave: string) => {
    if (!contentToSave.trim()) return;
    try {
      if (entry) {
        await updateEntry({ date: dateStr, content: contentToSave }).unwrap();
      } else {
        await createEntry({ date: dateStr, content: contentToSave }).unwrap();
      }
      await refetch();
      setDraft(current => current?.date === dateStr && current.content === contentToSave ? null : current);
    } catch (err) {
      console.error("Failed to save entry:", err);
      throw err;
    }
  };

  return {
    content,
    setContent,
    entry,
    isLoading,
    loadError,
    handleSave,
    refetch,
    dateStr,
  };
};
