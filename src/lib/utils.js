
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function getValidSellers(users) {
  if (!users) return [];
  // Filter only users with role 'Vendedor'
  return users.filter(u => u.role === 'Vendedor');
}

export function formatResponsableName(user) {
  if (!user) return '';
  // Avoid double labeling if the name already contains the role
  if (user.name && user.role && user.name.toLowerCase().includes(`(${user.role.toLowerCase()})`)) {
    return user.name;
  }
  return user.role ? `${user.name} (${user.role})` : user.name;
}

export function removeDuplicateUsers(users) {
  if (!users) return [];
  const seen = new Set();
  return users.filter(user => {
    const id = user.id || user.name;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
