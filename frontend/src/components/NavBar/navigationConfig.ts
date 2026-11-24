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
  PlayArrowRounded,
  Search,
} from "@mui/icons-material";
import { NavSection } from "../../types/navigation";

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Main",
    items: [
      { path: "/notes", label: "Notes", icon: Note },
      { path: "/fuel-manager", label: "Fuel Manager", icon: LocalGasStation },
      { path: "/dashboard", label: "Money", icon: Euro },
      { path: "/tasks", label: "Tasks", icon: Assignment },
    ],
    roles: ["Admin"],
  },
  {
    title: "More tools",
    items: [
      { path: "/map", label: "Map", icon: Home },
      { path: "/search", label: "Marketplace search", icon: Search },
      { path: "/cognitive", label: "Cognitive Training", icon: Psychology },
      { path: "/workout", label: "Workout", icon: FitnessCenter },
      { path: "/diary", label: "Diary", icon: CalendarToday, roles: ["Admin"] },
      { path: "/boxing-events", label: "Boxing Events", icon: SportsMma, roles: ["Admin"] },
      { path: "/youtube-manager", label: "YouTube Manager", icon: PlayArrowRounded, roles: ["Admin"] }
    ],
  },
];

export function getNavigationSections(isAdmin: boolean): NavSection[] {
  const role = isAdmin ? "Admin" : "User";
  return NAV_SECTIONS
    .filter(section => !section.roles || section.roles.includes(role))
    .map(section => ({
      ...section,
      items: section.items.filter(item => !item.roles || item.roles.includes(role)),
    }))
    .filter(section => section.items.length > 0);
}
