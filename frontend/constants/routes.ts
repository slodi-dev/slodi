// constants/routes.ts
export const ROUTES = {
  HOME: "/",
  PROGRAMS: "/programs",
  PROGRAM_DETAIL: (id: string) => `/programs/${id}`,
} as const;
