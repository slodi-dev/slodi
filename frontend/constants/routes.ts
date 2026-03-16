// constants/routes.ts
export const ROUTES = {
  HOME: "/",
  PROGRAMS: "/content",
  PROGRAM_DETAIL: (id: string) => `/content/${id}`,
} as const;
