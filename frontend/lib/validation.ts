import { z } from "zod";

// Program validation schemas

export const programSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  description: z.string().max(1000, "Description must be 1000 characters or less").nullable(),
  image: z
    .string()
    .max(255, "Image URL must be 255 characters or less")
    .url("Must be a valid URL")
    .nullable(),
  workspace_id: z.string().uuid("Must be a valid workspace ID"),
  public: z.boolean(),
  tags: z.array(z.string().uuid()).optional(),
});

export type ProgramFormData = z.infer<typeof programSchema>;

// Program update validation schema (for editing existing programs)
export const programUpdateSchema = z.object({
  name: z
    .string()
    .min(3, "Nafn verður að vera að minnsta kosti 3 stafir")
    .max(100, "Nafn má ekki vera lengra en 100 stafir")
    .trim(),
  description: z
    .string()
    .max(5000, "Lýsing má ekki vera lengri en 5000 stafir")
    .optional()
    .nullable(),
  public: z.boolean().refine((value) => value !== undefined, {
    message: "Velja þarf sýnileika",
  }),
});

export type ProgramUpdateFormData = z.infer<typeof programUpdateSchema>;

// Filter state validation
export const filterStateSchema = z.object({
  query: z.string().optional(),
  tags: z.array(z.string().uuid()).optional(),
  workspaceId: z.string().uuid().nullable().optional(),
  authorId: z.string().uuid().nullable().optional(),
  visibility: z.enum(["public", "all", "private"]).optional(),
  dateFrom: z.date().nullable().optional(),
  dateTo: z.date().nullable().optional(),
  minLikes: z.number().min(0).optional(),
  maxLikes: z.number().min(0).optional(),
  sortBy: z.enum(["newest", "oldest", "most-liked", "alphabetical", "author"]).optional(),
  page: z.number().min(1).optional(),
});

export type FilterState = z.infer<typeof filterStateSchema>;

// Comment validation
export const commentSchema = z.object({
  body: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(5000, "Comment must be 5000 characters or less"),
});

export type CommentFormData = z.infer<typeof commentSchema>;

// Tag validation
export const tagSchema = z.object({
  name: z.string().min(1, "Tag name is required").max(50, "Tag name must be 50 characters or less"),
});

export type TagFormData = z.infer<typeof tagSchema>;
