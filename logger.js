/**
 * logger.js
 * -----------------------------------------------------------------------
 * Logger central de la aplicación, basado en winston.
 *
 * Se usa para:
 *  - Logs generales de aplicación (arranque, errores, conexión a BD, etc.)
 *  - Logs de auditoría de acceso a recursos sensibles (ver middleware
 *    auditAccess en middleware/audit.js), que se escriben además en
 *    logs/access.log para trazabilidad y cumplimiento normativo
 *    (GDPR, HIPAA, etc.).
 */

const path = require('path');
const fs = require('fs');
const { createLogger, format, transports } = require('winston');

const LOG_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// Logger general de la aplicación: consola + archivo app.log
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
    new transports.File({ filename: path.join(LOG_DIR, 'app.log') }),
  ],
});

// Logger de auditoría: dedicado a accesos a recursos sensibles
// (quién, qué acción, sobre qué recurso, resultado y contexto).
const accessLogger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.File({ filename: path.join(LOG_DIR, 'access.log') }),
  ],
});

module.exports = { logger, accessLogger };
