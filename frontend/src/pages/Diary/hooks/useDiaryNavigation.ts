import { useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { parseDateInput, formatDateInput } from "../../../helpers/diary";

export const useDiaryNavigation = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const isInitialMount = useRef(true);

  const dateParam = searchParams.get("date");
  const initialDate = dateParam ? parseDateInput(dateParam) : new Date();

  // Update URL when date changes
  const updateUrl = useCallback((date: Date) => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const dateStr = formatDateInput(date);
    if (searchParams.get("date") === dateStr) return;
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set("date", dateStr);
      return next;
    });
  }, [searchParams, setSearchParams]);

  return {
    initialDate,
    updateUrl,
  };
};
