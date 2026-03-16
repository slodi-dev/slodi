import { buildApiUrl } from "@/lib/api-utils";
import { fetchWithAuth } from "@/lib/api";

export type Task = {
  id: string;
  content_type: "task";
  name: string;
  description: string | null;
  like_count: number;
  liked_by_me: boolean;
  created_at: string;
  author_id: string;
  author_name: string;
  image: string | null;
  workspace_id: string;
  event_id: string | null;
  program_id: string | null;
  position: number;
  author: {
    id: string;
    name: string;
    email: string;
  };
  workspace: {
    id: string;
    name: string;
  };
  tags?: Array<{ id: string; name: string }>;
  comment_count?: number;
  instructions?: string | null;
  equipment?: string[] | null;
  duration_min?: number | null;
  duration_max?: number | null;
  prep_time_min?: number | null;
  prep_time_max?: number | null;
  age?: string[] | null;
  location?: string | null;
  count_min?: number | null;
  count_max?: number | null;
  price?: number | null;
};

export type TaskCreateInput = {
  name: string;
  description?: string;
  image?: string;
  instructions?: string;
  equipment?: string[];
  duration_min?: number;
  duration_max?: number;
  prep_time_min?: number;
  prep_time_max?: number;
  age?: string[];
  location?: string;
  count_min?: number;
  count_max?: number;
  price?: number;
  tagNames?: string[];
  workspaceId: string;
};

export type TaskUpdateInput = {
  name?: string;
  description?: string | null;
  image?: string | null;
  instructions?: string | null;
  equipment?: string[] | null;
  duration_min?: number | null;
  duration_max?: number | null;
  prep_time_min?: number | null;
  prep_time_max?: number | null;
  age?: string[] | null;
  location?: string | null;
  count_min?: number | null;
  count_max?: number | null;
  price?: number | null;
  tagNames?: string[];
  event_id?: string | null;
  program_id?: string | null;
  position?: number;
};

export async function fetchTasks(
  workspaceId: string,
  getToken: () => Promise<string | null>
): Promise<Task[]> {
  const url = buildApiUrl(`/workspaces/${workspaceId}/tasks`);
  const data = await fetchWithAuth<Task[] | { tasks: Task[] }>(url, { method: "GET" }, getToken);
  return Array.isArray(data) ? data : data.tasks || [];
}

export async function fetchTaskById(
  id: string,
  getToken: () => Promise<string | null>
): Promise<Task> {
  const url = buildApiUrl(`/tasks/${id}`);
  return fetchWithAuth<Task>(url, { method: "GET" }, getToken);
}

export async function createTask(
  input: TaskCreateInput,
  getToken: () => Promise<string | null>
): Promise<Task> {
  const payload = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    image: input.image?.trim() || null,
    instructions: input.instructions?.trim() || null,
    equipment: input.equipment && input.equipment.length > 0 ? input.equipment : null,
    duration_min: input.duration_min ?? null,
    duration_max: input.duration_max ?? null,
    prep_time_min: input.prep_time_min ?? null,
    prep_time_max: input.prep_time_max ?? null,
    age: input.age && input.age.length > 0 ? input.age : null,
    location: input.location?.trim() || null,
    count_min: input.count_min ?? null,
    count_max: input.count_max ?? null,
    price: input.price ?? null,
    tag_names: input.tagNames && input.tagNames.length > 0 ? input.tagNames : null,
    content_type: "task" as const,
  };

  const url = buildApiUrl(`/workspaces/${input.workspaceId}/tasks`);
  const data = await fetchWithAuth<Task | Task[]>(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    getToken
  );
  return Array.isArray(data) ? data[0] : data;
}

export async function updateTask(
  id: string,
  input: TaskUpdateInput,
  getToken: () => Promise<string | null>
): Promise<Task> {
  const { tagNames, ...rest } = input;
  const body = tagNames !== undefined ? { ...rest, tag_names: tagNames } : rest;
  const url = buildApiUrl(`/tasks/${id}`);
  return fetchWithAuth<Task>(
    url,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    getToken
  );
}

export async function deleteTask(
  id: string,
  getToken: () => Promise<string | null>
): Promise<void> {
  const url = buildApiUrl(`/tasks/${id}`);
  await fetchWithAuth(url, { method: "DELETE" }, getToken);
}
