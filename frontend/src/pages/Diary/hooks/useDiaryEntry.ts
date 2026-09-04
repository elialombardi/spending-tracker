import { useState, useEffect } from "react";
import {
  useGetEntryByDateQuery,
  useCreateEntryMutation,
  useUpdateEntryMutation,
} from "../../../api/diaryApi";
import { formatDateInput } from "../../../helpers/diary";

export const useDiaryEntry = (selectedDate: Date) => {
  const dateStr = formatDateInput(selectedDate);
  const [content, setContent] = useState("");

  const {
    data: entry,
    isLoading,
    error: loadError,
    refetch,
  } = useGetEntryByDateQuery(dateStr, {
    skip: !dateStr,
  });

  const [createEntry] = useCreateEntryMutation();
  const [updateEntry] = useUpdateEntryMutation();

  // Update content when entry loads
  useEffect(() => {
    if (entry) {
      setContent(entry.content);
    } else if (loadError && (loadError as any)?.status === 404) {
      setContent("");
    } else if (!entry) {
      setContent("");
    }
  }, [entry, loadError]);

  const handleSave = async (contentToSave: string) => {
    if (!contentToSave.trim()) return;
    try {
      if (entry) {
        await updateEntry({ date: dateStr, content: contentToSave }).unwrap();
      } else {
        await createEntry({ date: dateStr, content: contentToSave }).unwrap();
      }
      await refetch();
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
