import { useState, useEffect, useRef } from "react";

const AUTO_SAVE_KEY = "diary_auto_save";

interface AutoSaveData {
  content: string;
  date: string;
  timestamp: number;
}

export const useAutoSave = (content: string, dateStr: string) => {
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [savedContent, setSavedContent] = useState<string | null>(null);
  const autoSaveIntervalRef = useRef<number | null>(null);

  // Check for auto-saved content on mount
  useEffect(() => {
    const saved = localStorage.getItem(AUTO_SAVE_KEY);
    if (saved) {
      try {
        const parsed: AutoSaveData = JSON.parse(saved);
        const savedDate = new Date(parsed.date);
        const today = new Date();
        const isRecent =
          today.getTime() - savedDate.getTime() < 24 * 60 * 60 * 1000;

        if (isRecent && parsed.content.trim()) {
          setSavedContent(parsed.content);
          setShowRestoreDialog(true);
        } else {
          localStorage.removeItem(AUTO_SAVE_KEY);
        }
      } catch (error) {
        console.error("Failed to parse auto-saved content:", error);
        localStorage.removeItem(AUTO_SAVE_KEY);
      }
    }
  }, []);

  // Auto-save content every 30 seconds
  useEffect(() => {
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
    }

    if (!content.trim()) {
      return;
    }

    autoSaveIntervalRef.current = window.setInterval(() => {
      const autoSaveData: AutoSaveData = {
        content: content,
        date: new Date().toISOString(),
        timestamp: Date.now(),
      };
      localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(autoSaveData));
    }, 30000);

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
        autoSaveIntervalRef.current = null;
      }
    };
  }, [content]);

  const handleRestore = () => {
    if (savedContent !== null) {
      setShowRestoreDialog(false);
      return savedContent;
    }
    return null;
  };

  const handleDiscard = () => {
    localStorage.removeItem(AUTO_SAVE_KEY);
    setShowRestoreDialog(false);
    setSavedContent(null);
  };

  const clearAutoSave = () => {
    localStorage.removeItem(AUTO_SAVE_KEY);
    setShowRestoreDialog(false);
    setSavedContent(null);
  };

  return {
    showRestoreDialog,
    savedContent,
    handleRestore,
    handleDiscard,
    clearAutoSave,
  };
};
