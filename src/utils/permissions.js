const config = require('../config/config');

/**
 * Check if user has verified role
 */
function hasVerifiedRole(member) {
    if (!config.roles.verified) return true; // If no verified role configured, allow all
    return member.roles.cache.has(config.roles.verified);
}

/**
 * Check if user has guardian role or higher
 */
function hasGuardianRole(member) {
    const roles = config.roles;
    return member.roles.cache.has(roles.guardian) || 
           member.roles.cache.has(roles.admin) ||
           member.permissions.has('ADMINISTRATOR');
}

/**
 * Check if user has admin role
 */
function hasAdminRole(member) {
    const roles = config.roles;
    return member.roles.cache.has(roles.admin) ||
           member.permissions.has('ADMINISTRATOR');
}

/**
 * Get user's highest permission level
 */
function getUserPermissionLevel(member) {
    if (hasAdminRole(member)) return 'admin';
    if (hasGuardianRole(member)) return 'guardian';
    if (hasVerifiedRole(member)) return 'verified';
    return 'none';
}

/**
 * Check if user can use moderation commands
 */
function canModerate(member) {
    return hasGuardianRole(member);
}

/**
 * Check if user can use advanced moderation (kick/ban)
 */
function canAdvancedModerate(member) {
    return hasAdminRole(member);
}

module.exports = {
    hasVerifiedRole,
    hasGuardianRole,
    hasAdminRole,
    getUserPermissionLevel,
    canModerate,
    canAdvancedModerate
};
