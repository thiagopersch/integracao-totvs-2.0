export function hasPermission(permissions: string[], resource: string, action: string = "read"): boolean {
  return permissions.includes(`${resource}:${action}`);
}
