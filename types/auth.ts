import type { Role } from "@/constants/roles";

export type AppActor = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
};
