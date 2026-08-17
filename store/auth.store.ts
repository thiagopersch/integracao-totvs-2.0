import { create } from "zustand"

interface AuthState {
  user: {
    id: string
    name: string
    email: string
    role: string
  } | null
  permissions: string[]
  setUser: (user: AuthState["user"]) => void
  setPermissions: (permissions: string[]) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  permissions: [],
  setUser: (user) => set({ user }),
  setPermissions: (permissions) => set({ permissions }),
  clear: () => set({ user: null, permissions: [] }),
}))
