export const projectCategories = [
  { id: "all", label: "All" },
  { id: "repair", label: "AC Repair" },
  { id: "maintenance", label: "AC Maintenance" },
  { id: "installation", label: "AC Installation" },
  { id: "commercial", label: "Commercial AC (HVAC)" },
] as const;

export type ProjectCategory = (typeof projectCategories)[number]["id"];

// Source: the existing project detail identifies a residential villa installation.
// Do not infer additional projects or commercial, repair or maintenance work.
const projectCategoryMap: Record<string, ProjectCategory[]> = {
  "/project-portfolio/luxury-villa-ac-installation/": ["installation"],
};

export function projectMatchesCategory(route: string, category: ProjectCategory) {
  return category === "all" || Boolean(projectCategoryMap[route]?.includes(category));
}
