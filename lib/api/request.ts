import { ValidationError } from "@/lib/errors/app-error";

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
}
