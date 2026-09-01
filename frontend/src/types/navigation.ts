export interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  roles?: ("Admin" | "User")[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
  roles?: ("Admin" | "User")[];
}

export interface UserSession {
  role?: "Admin" | "User";
  // add other session properties as needed
}
