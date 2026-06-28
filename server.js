const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const csv = require('csv-parser');
const { Readable } = require('stream');
const { Pool } = require("pg");
const http = require("http");
const http2 = require("http2");
const bcrypt = require('bcrypt');
const twofactor = require('node-2fa');

// Importar express-session y session-file-store
const session = require("express-session");
const FileStore = require("session-file-store")(session);

// Validación / sanitización de entradas (XSS, NoSQL/command injection, etc.)
const { body, param, validationResult } = require('express-validator');

// Logging auditable (winston) — ver logger.js
const { logger } = require('./logger');

// Control de acceso RBAC (CASL) y mitigación de IDOR — ver abilities.js y middleware/
const { attachAbility, requireAuth, isAdmin } = require('./middleware/access');
const { auditAccess } = require('./middleware/audit');

// === Logging ===
// Mantenemos esta función `log` como alias delgado sobre winston para no
// tener que reescribir cada llamada existente en este archivo; internamente
// ya escribe a consola y a logs/app.log mediante winston (ver logger.js).
function log(level, msg, meta = {}) {
  const winstonLevel = { FATAL: 'error', ERROR: 'error', WARN: 'warn', INFO: 'info', REQUEST: 'info' }[level] || 'info';
  logger.log(winstonLevel, msg, { level, ...meta });
}

/**
 * Middleware de manejo de errores de validación (express-validator).
 * Se coloca después de las reglas `body(...)`/`param(...)` en cada ruta.
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    log('WARN', 'Validación de entrada fallida', { url: req.originalUrl, errors: errors.array() });
    return res.status(400).json({ success: false, error: 'Datos de entrada inválidos', details: errors.array() });
  }
  next();
}

// Capturar errores no manejados antes de que crasheen el proceso
process.on('uncaughtException', (err) => {
  log('FATAL', 'Excepción no capturada', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log('FATAL', 'Promesa rechazada no manejada', { reason: String(reason) });
});

const app = express();
app.use(express.json());

// Logger de requests: registra cada petición con método, URL, status y tiempo
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    log('REQUEST', `${req.method} ${req.url}`, {
      status: res.statusCode,
      ms: Date.now() - start,
      ip: req.ip || req.socket?.remoteAddress,
    });
  });
  next();
});

// Configurar el motor de vistas EJS
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layout');

// Configurar Multer para manejar archivos en memoria
const upload = multer({ storage: multer.memoryStorage() });

// Configurar el almacenamiento de sesiones en el sistema de archivos
const sessionsDir = path.join(__dirname, "sessions");
if (!fs.existsSync(sessionsDir)) {
  fs.mkdirSync(sessionsDir, { recursive: true });
}

app.use(session({
  store: new FileStore({ path: sessionsDir }),
  secret: process.env.SESSIONS_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 60 * 60 * 1000 }
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Control de acceso RBAC: adjunta req.ability y res.locals.ability
// (este último para poder usar `ability.can(...)` directamente en las vistas EJS)
// según el rol del usuario en sesión. Ver abilities.js.
app.use(attachAbility);

// Directorio local para almacenar archivos
const FILES_DIR = path.join(__dirname, "files");

if (!fs.existsSync(FILES_DIR)) {
  fs.mkdirSync(FILES_DIR, { recursive: true });
}

// Configuración de la conexión a PostgreSQL
const ENV = process.env.NODE_ENV || 'development';

let dbPoolOptions = {
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "postgres",
};

if (ENV === 'production') {
  const dbCertPath = './certs/db.crt';
  if (!fs.existsSync(dbCertPath)) {
    log('FATAL', 'Certificado CA de la BD no encontrado', {
      path: dbCertPath,
      hint: 'Coloca el certificado CA de la base de datos en certs/db.crt',
    });
    process.exit(1);
  }
  try {
    dbPoolOptions.ssl = {
      ca: fs.readFileSync(dbCertPath),
      rejectUnauthorized: true
    };
    log('INFO', 'SSL para PostgreSQL configurado', { cert: dbCertPath });
  } catch (err) {
    log('FATAL', 'Error leyendo certificado SSL de la BD', { error: err.message });
    process.exit(1);
  }
}

const pool = new Pool(dbPoolOptions);

// Loguear errores del pool de conexiones (p.ej. BD caída en mitad de la operación)
pool.on('error', (err) => {
  log('ERROR', 'Error inesperado en el pool de PostgreSQL', { error: err.message });
});

// Verificar conexión a la BD al arrancar
pool.query('SELECT 1').then(() => {
  log('INFO', 'Conexión a PostgreSQL establecida correctamente', {
    host: dbPoolOptions.host,
    database: dbPoolOptions.database,
  });
}).catch((err) => {
  log('ERROR', 'No se pudo conectar a PostgreSQL al arrancar', { error: err.message });
});

// Nota: el middleware `isAdmin` ya no se define aquí; se importa desde
// ./middleware/access.js, donde delega la decisión en req.ability (CASL)
// en lugar de comparar el string de rol directamente. Esto centraliza
// todas las reglas de autorización en abilities.js (RBAC con CASL).


/**
 * Endpoint para subir archivos al servidor local.
 * Protegido: requiere sesión y permiso CASL `create` sobre 'PhysicalFile'.
 */
app.post("/upload", auditAccess('create', 'PhysicalFile'), requireAuth, (req, res) => {
  if (req.ability.cannot('create', 'PhysicalFile')) {
    return res.status(403).json({ error: "Acceso denegado. No tienes permisos para subir archivos." });
  }
  upload.single("file")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: "Upload failed", details: err.message });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const textContent = req.file.buffer.toString('utf8');
    const safeFolder = path.basename(req.body.path || "");
    const safeFilename = path.basename(req.file.originalname);
    const targetDir = path.join(FILES_DIR, safeFolder);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const filePath = path.join(targetDir, safeFilename);

    try {
      fs.writeFileSync(filePath, req.file.buffer);

      await pool.query(
        "INSERT INTO doc_extra (doc_extra_id, doc_extra_txt) VALUES ($1, $2)",
        [safeFilename, textContent]
      );

      res.json({ success: true, message: "Archivo subido correctamente" });
    } catch (error) {
      log('ERROR', 'Error en /upload', { error: error.message });
      res.status(500).json({ error: "Error al insertar en la BD", details: error.message });
    }
  });
});


app.post("/clinical-files/upload", auditAccess('create', 'ClinicalFile'), requireAuth, (req, res) => {
  if (req.ability.cannot('create', 'ClinicalFile')) {
    return res.status(403).json({ error: "Acceso denegado. No tienes permisos para cargar fichas clínicas." });
  }
  upload.single("file")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: "Upload failed", details: err.message });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const fichas = [];
    const stream = Readable.from(req.file.buffer.toString());

    stream
      .pipe(csv())
      .on('data', (fila) => { fichas.push(fila); })
      .on('end', async () => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          const insertQuery = `
            INSERT INTO Clinical_File (doc_id, doc_type, doc_date, title, patient_id, filename, sha256)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (doc_id) DO NOTHING;
          `;

          let insertados = 0;
          for (const f of fichas) {
            await client.query(insertQuery, [
              f.doc_id, f.doc_type, f.doc_date, f.title,
              f.patient_id, f.filename, f.sha256
            ]);
            insertados++;
          }

          await client.query('COMMIT');
          res.json({ success: true, message: `Se procesaron ${insertados} fichas clínicas correctamente.` });
        } catch (dbError) {
          await client.query('ROLLBACK');
          log('ERROR', 'Error en /clinical-files/upload', { error: dbError.message });
          res.status(500).json({ error: "Error al guardar en la base de datos", details: dbError.message });
        } finally {
          client.release();
        }
      });
  });
});

app.post("/admin/users", auditAccess('create', 'User', () => 'new'), isAdmin, [
  body('user_id').trim().escape().notEmpty().withMessage('user_id es requerido'),
  body('username').trim().escape().notEmpty().withMessage('username es requerido'),
  body('password').isStrongPassword().withMessage('La contraseña no cumple los requisitos de seguridad'),
  body('full_name').trim().escape().notEmpty().withMessage('full_name es requerido'),
  body('email').isEmail().normalizeEmail().withMessage('email inválido'),
  body('role').trim().escape().isIn(['admin', 'staff', 'doctor', 'nurse']).withMessage('role inválido'),
], handleValidationErrors, async (req, res) => {
  const { user_id, username, password, full_name, email, role } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 12);

    // Consulta parametrizada: los valores se pasan como arreglo aparte,
    // nunca interpolados directamente en el string SQL (previene SQL Injection).
    await pool.query(
      "INSERT INTO users (user_id, username, password, full_name, email, role) VALUES ($1, $2, $3, $4, $5, $6)",
      [user_id, username, hashedPassword, full_name, email, role]
    );
    log('INFO', 'Usuario creado', { user_id, username, role });
    res.json({ success: true, message: "Usuario creado correctamente" });
  } catch (error) {
    log('ERROR', 'Error en POST /admin/users', { error: error.message });
    res.status(500).json({ error: "Error al crear usuario", details: error.message });
  }
});

app.delete("/admin/users/:id", auditAccess('delete', 'User'), isAdmin, [
  param('id').trim().escape().notEmpty(),
], handleValidationErrors, async (req, res) => {
  const userId = req.params.id;

  // Mitigación de IDOR / regla de negocio: un admin no puede eliminarse a sí mismo,
  // incluso teniendo permisos de gestión total.
  if (req.session.user && req.session.user.user_id === userId) {
    return res.status(400).json({ error: "No puedes eliminar tu propia cuenta." });
  }

  try {
    // Verificamos que el recurso exista antes de actuar, y diferenciamos
    // "no encontrado" de "eliminado", para no dar pistas innecesarias.
    const existing = await pool.query("SELECT user_id FROM users WHERE user_id = $1", [userId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    await pool.query("DELETE FROM users WHERE user_id = $1", [userId]);
    log('INFO', 'Usuario eliminado', { user_id: userId });
    res.json({ success: true, message: "Usuario eliminado correctamente" });
  } catch (error) {
    log('ERROR', 'Error en DELETE /admin/users/:id', { error: error.message, user_id: userId });
    res.status(500).json({
      error: "Error al eliminar usuario",
      details: error.message
    });
  }
});

app.get("/admin/users", auditAccess('read', 'User', () => 'list'), isAdmin, async (req, res) => {
  try {
    const result = await pool.query("SELECT user_id, username, full_name, role FROM users ORDER BY full_name ASC");
    res.json({ success: true, users: result.rows });
  } catch (error) {
    log('ERROR', 'Error en GET /admin/users', { error: error.message });
    res.status(500).json({ error: "Error al obtener la lista de usuarios", details: error.message });
  }
});

app.get("/clinical-files", auditAccess('read', 'ClinicalFile', () => 'list'), requireAuth, async (req, res) => {
  if (req.ability.cannot('read', 'ClinicalFile')) {
    return res.status(403).json({ error: "Acceso denegado." });
  }
  try {
    const result = await pool.query("SELECT * FROM Clinical_File ORDER BY doc_date DESC");
    res.json({ success: true, records: result.rows });
  } catch (error) {
    log('ERROR', 'Error en GET /clinical-files', { error: error.message });
    res.status(500).json({ error: "Error al obtener fichas", details: error.message });
  }
});

app.get("/clinical-files/:id", auditAccess('read', 'ClinicalFile'), requireAuth, [
  param('id').trim().escape().notEmpty(),
], handleValidationErrors, async (req, res) => {
  // Mitigación de IDOR: aunque el ID venga directo en la URL, primero
  // verificamos autenticación (arriba) y permiso RBAC (abajo) antes de
  // exponer cualquier dato del recurso solicitado.
  if (req.ability.cannot('read', 'ClinicalFile')) {
    return res.status(403).json({ error: "Acceso denegado." });
  }
  try {
    const result = await pool.query("SELECT * FROM Clinical_File WHERE doc_id = $1", [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Ficha no encontrada" });
    }

    const clinicalFile = result.rows[0];
    const filesResult = await pool.query("SELECT doc_extra_txt FROM doc_extra WHERE doc_extra_id = $1", [clinicalFile.filename]);
    clinicalFile.observations = filesResult.rows;

    res.json({ success: true, record: clinicalFile });
  } catch (error) {
    log('ERROR', 'Error en GET /clinical-files/:id', { id: req.params.id, error: error.message });
    res.status(500).json({ error: "Error en la base de datos", details: error.message });
  }
});


app.post("/patients/upload", auditAccess('create', 'Patient', () => 'bulk'), requireAuth, (req, res) => {
  if (req.ability.cannot('create', 'Patient') && req.ability.cannot('manage', 'all')) {
    return res.status(403).json({ error: "Acceso denegado. No tienes permisos para cargar pacientes." });
  }
  upload.single("file")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: "Upload failed", details: err.message });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const pacientes = [];
    const stream = Readable.from(req.file.buffer.toString());

    stream
      .pipe(csv())
      .on('data', (fila) => { pacientes.push(fila); })
      .on('end', async () => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          const insertQuery = `
            INSERT INTO patients (patient_id, national_id_fake, full_name, sex, birth_date, phone, address, insurance, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (patient_id) DO NOTHING;
          `;

          let insertados = 0;
          for (const p of pacientes) {
            await client.query(insertQuery, [
              p.patient_id, p.national_id_fake, p.full_name, p.sex,
              p.birth_date, p.phone, p.address, p.insurance, p.notes || null
            ]);
            insertados++;
          }

          await client.query('COMMIT');
          res.json({ success: true, message: `Se procesaron ${insertados} pacientes correctamente.` });
        } catch (dbError) {
          await client.query('ROLLBACK');
          log('ERROR', 'Error en /patients/upload', { error: dbError.message });
          res.status(500).json({ error: "Error al guardar en la base de datos", details: dbError.message });
        } finally {
          client.release();
        }
      });
  });
});


app.get("/patients", auditAccess('read', 'Patient', () => 'list'), requireAuth, async (req, res) => {
  if (req.ability.cannot('read', 'Patient')) {
    return res.status(403).json({ error: "Acceso denegado." });
  }
  try {
    const result = await pool.query("SELECT * FROM patients");
    res.json({ success: true, patients: result.rows });
  } catch (error) {
    log('ERROR', 'Error en GET /patients', { error: error.message });
    res.status(500).json({ error: "Error al obtener pacientes", details: error.message });
  }
});


app.get("/patients/:id", auditAccess('read', 'Patient'), requireAuth, [
  param('id').trim().escape().notEmpty(),
], handleValidationErrors, async (req, res) => {
  // Mitigación de IDOR: el ID de paciente viene directo en la URL
  // (ej. GET /patients/P0001 -> P0002), por lo que SIEMPRE se verifica
  // autenticación + autorización RBAC antes de devolver cualquier dato,
  // independientemente de si el recurso existe o no.
  if (req.ability.cannot('read', 'Patient')) {
    return res.status(403).json({ error: "Acceso denegado." });
  }
  const patientId = req.params.id;
  try {
    const patientResult = await pool.query("SELECT * FROM patients WHERE patient_id = $1", [patientId]);

    if (patientResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Paciente no encontrado" });
    }

    const patientData = patientResult.rows[0];

    const filesResult = await pool.query("SELECT * FROM Clinical_File WHERE patient_id = $1 ORDER BY doc_date DESC", [patientId]);
    const clinicalFiles = filesResult.rows;

    for (let file of clinicalFiles) {
      const obsResult = await pool.query("SELECT doc_extra_txt FROM doc_extra WHERE doc_extra_id = $1", [file.filename]);
      file.observations = obsResult.rows;
    }
    patientData.clinical_files = clinicalFiles;

    res.json({ success: true, patient: patientData });
  } catch (error) {
    log('ERROR', 'Error en GET /patients/:id', { id: patientId, error: error.message });
    res.status(500).json({ error: "Error en la base de datos", details: error.message });
  }
});

app.get("/download/:filename", auditAccess('read', 'PhysicalFile', (req) => req.params.filename), requireAuth, [
  param('filename').trim().notEmpty(),
], handleValidationErrors, (req, res) => {
  if (req.ability.cannot('read', 'PhysicalFile')) {
    return res.status(403).json({ error: "Acceso denegado." });
  }

  // Sanitización de entrada: path.basename() elimina cualquier componente
  // de ruta (../, /, etc.), evitando un path traversal a través del
  // parámetro filename (p.ej. "../../etc/passwd").
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(FILES_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }
  res.download(filePath, safeFilename, (err) => {
    if (err) {
      log('ERROR', 'Error en GET /download/:filename', { filename: safeFilename, error: err.message });
      res.status(500).json({ error: "Error downloading file", details: err.message });
    }
  });
});

app.get("/files", auditAccess('read', 'PhysicalFile', () => 'list'), requireAuth, (req, res) => {
  if (req.ability.cannot('read', 'PhysicalFile')) {
    return res.status(403).json({ error: "Acceso denegado." });
  }
  fs.readdir(FILES_DIR, (err, files) => {
    if (err) {
      log('ERROR', 'Error en GET /files', { error: err.message });
      return res.status(500).json({ error: "Error listing files", details: err.message });
    }
    res.json({ success: true, files });
  });
});

app.post("/login", [
  // Sanitización de entradas: trim + escape neutraliza caracteres peligrosos
  // (<, >, etc.) para mitigar XSS si el username se llegara a reflejar en
  // alguna vista; la autenticación en sí sigue siendo vía consulta
  // parametrizada + bcrypt.compare, nunca por comparación de strings crudos.
  body('username').trim().escape().notEmpty().withMessage('username es requerido'),
  body('password').notEmpty().withMessage('password es requerido'),
], handleValidationErrors, async (req, res) => {
  const { username, password } = req.body;

  try {
    // Consulta parametrizada ($1): el valor de username jamás se concatena
    // directamente en el SQL, por lo que un input como ' OR '1'='1 se trata
    // como un literal de texto y no como código SQL (previene SQL Injection).
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      const match = await bcrypt.compare(password, user.password);

      if (match) {
        if (user.two_factor_secret) {
          req.session.tempUser = user.username;
          log('INFO', 'Login exitoso, requiere 2FA', { username });
          return res.json({ result: true, require2FA: true, message: "Por favor ingresa tu código 2FA" });
        } else {
          req.session.user = { user_id: user.user_id, username: user.username, role: user.role };
          log('INFO', 'Login exitoso', { username, role: user.role });
          return res.json({ result: true, require2FA: false });
        }
      } else {
        log('WARN', 'Login fallido: contraseña incorrecta', { username });
        return res.json({ result: false, error: "Credenciales inválidas" });
      }
    } else {
      log('WARN', 'Login fallido: usuario no encontrado', { username });
      return res.json({ result: false, error: "Credenciales inválidas" });
    }
  } catch (error) {
    log('ERROR', 'Error en POST /login', { error: error.message });
    res.status(500).json({ result: false, error: error.message });
  }
});

app.post("/setup-2fa", requireAuth, async (req, res) => {
  try {
    const newSecret = twofactor.generateSecret({
      name: 'DocLocker',
      account: req.session.user.username
    });

    await pool.query(
      "UPDATE users SET two_factor_secret = $1 WHERE username = $2",
      [newSecret.secret, req.session.user.username]
    );

    log('INFO', '2FA configurado', { username: req.session.user.username });
    res.json({
      success: true,
      message: "Escanea el código QR en tu app de autenticación",
      qr_url: newSecret.qr
    });
  } catch (error) {
    log('ERROR', 'Error en POST /setup-2fa', { error: error.message });
    res.status(500).json({ error: "Error configurando 2FA", details: error.message });
  }
});


app.post("/verify-2fa", [
  body('token').trim().escape().notEmpty().withMessage('token es requerido'),
], handleValidationErrors, async (req, res) => {
  const { token } = req.body;
  const username = req.session.tempUser;

  if (!username) {
    return res.status(400).json({ result: false, error: "No hay un inicio de sesión pendiente" });
  }

  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    const user = result.rows[0];

    const isValid = twofactor.verifyToken(user.two_factor_secret, token);

    if (isValid != null) {
      req.session.user = { user_id: user.user_id, username: user.username, role: user.role };
      delete req.session.tempUser;
      log('INFO', '2FA verificado exitosamente', { username });
      return res.json({ result: true, message: "Inicio de sesión exitoso" });
    } else {
      log('WARN', '2FA fallido: código incorrecto', { username });
      return res.status(401).json({ result: false, error: "Código 2FA incorrecto" });
    }
  } catch (error) {
    log('ERROR', 'Error en POST /verify-2fa', { error: error.message });
    res.status(500).json({ result: false, error: error.message });
  }
});


app.get("/login", (req, res) => {
  res.render("login", { title: "DocLocker Login" });
});

app.get("/", (req, res) => {
  res.redirect("/login");
});

app.get("/logout", (req, res) => {
  const username = req.session.user?.username;
  req.session.destroy(() => {
    log('INFO', 'Sesión cerrada', { username });
    res.redirect("/login");
  });
});

app.get("/api/me", (req, res) => {
  if (req.session.user) {
    res.json({ success: true, user: req.session.user });
  } else {
    res.json({ success: false });
  }
});

app.get("/home", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  res.render("home", { title: "DocLocker" });
});

// === Servidor ===

const PORT = process.env.PORT || 3000;

const HOP_BY_HOP_HEADERS = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade",
]);

function proxyHttp2StreamToExpress(stream, headers, expressPort) {
  const requestHeaders = {};

  for (const [name, value] of Object.entries(headers)) {
    if (name.startsWith(":") || HOP_BY_HOP_HEADERS.has(name)) continue;
    requestHeaders[name] = value;
  }

  requestHeaders.host = `127.0.0.1:${expressPort}`;

  const proxyReq = http.request({
    host: "127.0.0.1",
    port: expressPort,
    method: headers[":method"],
    path: headers[":path"],
    headers: requestHeaders,
    timeout: 30000,
  }, (proxyRes) => {
    const responseHeaders = { ":status": proxyRes.statusCode };

    for (const [name, value] of Object.entries(proxyRes.headers)) {
      if (HOP_BY_HOP_HEADERS.has(name)) continue;
      responseHeaders[name] = value;
    }

    stream.respond(responseHeaders);
    proxyRes.pipe(stream);
  });

  proxyReq.on("timeout", () => {
    log('ERROR', 'Timeout proxying HTTP/2 request to Express', {
      method: headers[":method"],
      path: headers[":path"],
    });
    proxyReq.destroy();
    if (!stream.destroyed) {
      stream.respond({ ":status": 504 });
      stream.end("Gateway Timeout");
    }
  });

  proxyReq.on("error", (err) => {
    log('ERROR', 'Error proxying HTTP/2 request to Express', {
      error: err.message,
      method: headers[":method"],
      path: headers[":path"],
    });
    if (!stream.destroyed) {
      stream.respond({ ":status": 502 });
      stream.end("Bad Gateway");
    }
  });

  stream.on("error", () => { proxyReq.destroy(); });
  stream.pipe(proxyReq);
}

if (ENV === 'production' && !process.env.SESSIONS_SECRET) {
  log('FATAL', 'SESSIONS_SECRET debe estar configurado en producción');
  process.exit(1);
}

if (ENV === 'production') {
  const certPath = process.env.SSL_CERT_PATH || 'certs/4104.grupo12.crt';
  // SSL_KEY_PATH tiene prioridad; si no está, usa CERTIFICATE_PRIVATE_KEY_PATH (path donde entrypoint.sh escribe la clave)
  const keyPath = process.env.SSL_KEY_PATH || process.env.CERTIFICATE_PRIVATE_KEY_PATH || 'certs/4104.grupo12.key';

  log('INFO', 'Iniciando servidor en modo producción', { certPath, keyPath, port: PORT });

  if (!fs.existsSync(certPath)) {
    log('FATAL', 'Certificado SSL no encontrado', { certPath });
    process.exit(1);
  }
  if (!fs.existsSync(keyPath)) {
    log('FATAL', 'Clave privada SSL no encontrada', { keyPath });
    process.exit(1);
  }

  try {
    const options = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
      allowHTTP1: true,
    };

    // Servidor HTTP interno al que http2Server hace proxy para requests HTTP/2
    const expressServer = http.createServer(app);
    expressServer.listen(0, "127.0.0.1", () => {
      const expressPort = expressServer.address().port;
      log('INFO', 'Servidor Express interno escuchando', { port: expressPort });

      const http2Server = http2.createSecureServer(options);

      http2Server.on("error", (err) => {
        log('ERROR', 'Error en el servidor HTTP/2', { error: err.message });
      });

      http2Server.on("request", (req, res) => {
        if (req.httpVersionMajor === 1) {
          app(req, res);
        }
      });

      http2Server.on("stream", (stream, headers) => {
        proxyHttp2StreamToExpress(stream, headers, expressPort);
      });

      http2Server.listen(PORT, () => {
        log('INFO', `Servidor HTTP/2 iniciado en modo ${ENV}`, { port: PORT });
      });
    });

  } catch (err) {
    log('FATAL', 'No se pudo iniciar el servidor HTTPS', { error: err.message, stack: err.stack });
    process.exit(1);
  }

} else {
  // BUG CORREGIDO: app.listen() fue eliminado de aquí (estaba duplicado e incondicional).
  // Solo este bloque debe levantar el servidor en desarrollo.
  http.createServer(app).listen(PORT, () => {
    log('INFO', `Servidor HTTP iniciado en modo ${ENV}`, { port: PORT });
  });
}

