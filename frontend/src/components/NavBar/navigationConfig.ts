import {
  Home,
  Psychology,
  FitnessCenter,
  Note,
  CalendarToday,
  Assignment,
  Euro,
  SportsMma,
  LocalGasStation,
} from "@mui/icons-material";
import { NavSection } from "../../types/navigation";

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Main",
    items: [{ path: "/", label: "Map", icon: Home }],
    roles: ["User", "Admin"],
  },
  {
    title: "Training",
    items: [
      { path: "/cognitive", label: "Cognitive Training", icon: Psychology },
      { path: "/workout", label: "Workout", icon: FitnessCenter },
    ],
    roles: ["User", "Admin"],
  },
  {
    title: "Finances",
    items: [
      { path: "/dashboard", label: "Money", icon: Euro },
      { path: "/tasks", label: "Tasks", icon: Assignment },
    ],
    roles: ["Admin"],
  },
  {
    title: "Personal",
    items: [
      { path: "/diary", label: "Diary", icon: CalendarToday },
      { path: "/notes", label: "Notes", icon: Note },
      { path: "/boxing-events", label: "Boxing Events", icon: SportsMma },
      { path: "/fuel-manager", label: "Fuel Manager", icon: LocalGasStation },
    ],
    roles: ["Admin"],
  },
];
