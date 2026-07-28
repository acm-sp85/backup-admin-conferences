export const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  ADMIN_SPONSORS: 'admin_sponsors',
  USER: 'user'
};

/**
 * Check if the given role has administrative access (admin, superadmin, admin_sponsors)
 * @param {string} role - The user's role
 * @returns {boolean} True if the role is an admin type
 */
export const hasAdminAccess = (role) => {
  return [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.ADMIN_SPONSORS].includes(role);
};
