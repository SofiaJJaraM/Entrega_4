/**
 * middleware/audit.js
 * -----------------------------------------------------------------------
 * Middleware de auditoría de acceso a recursos sensibles.
 *
 * Registra, para cada petición:
 *   - Identidad: ID/usuario autenticado (o 'anonymous')
 *   - Acción:    read, create, update, delete, etc.
 *   - Recurso:   tipo e ID del recurso accedido (p.ej. "Patient P0001")
 *   - Resultado: código de estado HTTP de la respuesta
 *   - Contexto:  IP, user-agent, endpoint, timestamp
 *
 * Esto permite trazabilidad y forense digital, y ayuda a detectar
 * patrones de explotación de IDOR (ej. múltiples 403/404 seguidos
 * desde la misma IP/usuario probando IDs distintos).
 */

const { accessLogger } = require('../logger');

/**
 * @param {string} action        Acción realizada: 'read' | 'create' | 'update' | 'delete' | ...
 * @param {string} resourceType  Tipo de recurso: 'Patient', 'ClinicalFile', 'User', 'PhysicalFile', etc.
 * @param {(req: import('express').Request) => string} [resourceIdFn]
 *        Función opcional para extraer el ID del recurso desde el request.
 *        Por defecto usa req.params.id.
 */
function auditAccess(action, resourceType, resourceIdFn) {
  return (req, res, next) => {
    const user = req.session?.user || { username: 'anonymous', role: 'none' };
    const resourceId = resourceIdFn ? resourceIdFn(req) : (req.params.id ?? '-');
    const resource = `${resourceType} ${resourceId}`;

    res.on('finish', () => {
      accessLogger.info({
        timestamp: new Date().toISOString(),
        userId: user.user_id || user.username,
        role: user.role,
        action,
        resource,
        endpoint: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        result: res.statusCode < 400 ? 'success'
          : res.statusCode === 401 ? 'unauthorized'
          : res.statusCode === 403 ? 'forbidden'
          : res.statusCode === 404 ? 'not_found'
          : 'error',
        ip: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
      });
    });

    next();
  };
}

module.exports = { auditAccess };
