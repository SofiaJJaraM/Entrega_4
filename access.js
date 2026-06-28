/**
 * middleware/access.js
 * -----------------------------------------------------------------------
 * Middlewares de control de acceso (RBAC con CASL) y mitigación de IDOR.
 */

const { defineAbilitiesFor } = require('../abilities');
const { logger } = require('../logger');

/**
 * Adjunta req.ability (y res.locals.ability, para usarlo en las vistas EJS)
 * con las habilidades del usuario autenticado en la sesión actual.
 */
function attachAbility(req, res, next) {
  req.ability = defineAbilitiesFor(req.session?.user || null);
  res.locals.ability = req.ability;
  next();
}

/**
 * Middleware genérico de autorización: verifica que req.ability permita
 * `action` sobre el sujeto `subjectType` (string, p.ej. 'User', 'Patient').
 * Útil para rutas que no dependen de un recurso concreto cargado desde BD
 * (p.ej. crear un usuario, listar pacientes).
 */
function requireAbility(action, subjectType) {
  return (req, res, next) => {
    if (req.ability && req.ability.can(action, subjectType)) {
      return next();
    }
    logger.warn('Acceso denegado por RBAC', {
      url: req.originalUrl,
      action,
      subjectType,
      user: req.session?.user?.username || 'anónimo',
      role: req.session?.user?.role || 'none',
    });
    return res.status(403).json({ error: 'Acceso denegado. No tienes permisos suficientes.' });
  };
}

/**
 * Exige que exista una sesión de usuario autenticada. Se usa antes de
 * cualquier ruta protegida para evitar acceso anónimo.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  logger.warn('Acceso denegado: sesión no autenticada', { url: req.originalUrl });
  return res.status(401).json({ error: 'Debes iniciar sesión.' });
}

/**
 * Exige rol admin. Se mantiene por compatibilidad/legibilidad en rutas de
 * administración, pero internamente delega en CASL (req.ability) en vez de
 * comparar el string de rol directamente, de modo que toda la lógica de
 * permisos quede centralizada en abilities.js.
 */
function isAdmin(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Debes iniciar sesión.' });
  }
  if (req.ability && req.ability.can('manage', 'User')) {
    return next();
  }
  logger.warn('Acceso denegado: se requiere rol admin', {
    url: req.originalUrl,
    user: req.session.user?.username || 'anónimo',
  });
  return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
}

module.exports = { attachAbility, requireAbility, requireAuth, isAdmin };
