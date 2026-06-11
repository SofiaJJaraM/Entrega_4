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

const app = express();
app.use(express.json());

// Configurar el motor de vistas EJS
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(expressLayouts); // Activamos el middleware para layouts

// Opcional: definir el layout por defecto (busca views/layout.ejs)
app.set('layout', 'layout');

// Configurar Multer para manejar archivos en memoria
const upload = multer({ storage: multer.memoryStorage() });

// Configurar el almacenamiento de sesiones en el sistema de archivos
const sessionsDir = path.join(__dirname, "sessions");
// Asegurarse de que el directorio existe
if (!fs.existsSync(sessionsDir)) {
  fs.mkdirSync(sessionsDir, { recursive: true });
}

app.use(session({
  store: new FileStore({ path: sessionsDir }),
  secret: process.env.SESSIONS_SECRET, // Reemplaza con una cadena secreta segura en producción
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 60 * 60 * 1000 } // Opcional: 1 hora de duración
}));

app.use((req, res, next) => { //Se supone que esta $#% deberia evitar el user is not defined y no lo hace aaaaaaaaaaaaa -Sofi
  res.locals.user = req.session.user || null;
  next();
});

// Directorio local para almacenar archivos
const FILES_DIR = path.join(__dirname, "files");

// Asegurarse de que el directorio exista
if (!fs.existsSync(FILES_DIR)) {
  fs.mkdirSync(FILES_DIR, { recursive: true });
}

// Configuración de la conexión a PostgreSQL
// Ambiente de ejecución
const ENV = process.env.NODE_ENV || 'development';

let dbPoolOptions = {
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "postgres",
};

if (ENV === 'production') {
  try {
    dbPoolOptions.ssl = {
      ca: fs.readFileSync("./certs/db.crt"),
      rejectUnauthorized: true
    };
  } catch (err) {
    console.error('Error reading SSL certificate:', err.message);
    process.exit(1);
  }
}

// Configuración de la conexión a PostgreSQL
const pool = new Pool(dbPoolOptions);

const isAdmin = (req, res, next) => { //verifica si el user loggeado es admin o no -Sofi 
  if (req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  res.status(403).json({ error: "Acceso denegado. Se requiere rol de administrador." });
};


/**
 * Endpoint para subir archivos al servidor local.
 * Guarda el archivo en ./files con su nombre original.
 */
app.post("/upload", (req, res) => {
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
      res.status(500).json({ error: "Error al insertar en la BD", details: error.message });
    }
  });
});


app.post("/clinical-files/upload", (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: "Upload failed", details: err.message });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const fichas = [];
    const stream = Readable.from(req.file.buffer.toString());

    stream
      .pipe(csv()) 
      .on('data', (fila) => {
        fichas.push(fila);
      })
      .on('end', async () => {
        const client = await pool.connect(); 
        try {
          await client.query('BEGIN'); 

          // Consulta SQL basada en tu tabla Clinical_File
          const insertQuery = `
            INSERT INTO Clinical_File (doc_id, doc_type, doc_date, title, patient_id, filename, sha256)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (doc_id) DO NOTHING;
          `;

          let insertados = 0;

          for (const f of fichas) {
            // Asegúrate de que las cabeceras de tu CSV coincidan con estas propiedades (f.doc_id, etc.)
            await client.query(insertQuery, [
              f.doc_id, 
              f.doc_type, 
              f.doc_date, 
              f.title, 
              f.patient_id, 
              f.filename, 
              f.sha256
            ]);
            insertados++;
          }

          await client.query('COMMIT'); 
          res.json({ success: true, message: `Se procesaron ${insertados} fichas clínicas correctamente.` });

        } catch (dbError) {
          await client.query('ROLLBACK'); 
          console.error("Error en base de datos:", dbError);
          res.status(500).json({ error: "Error al guardar en la base de datos", details: dbError.message });
        } finally {
          client.release(); 
        }
      });
  });
});

app.post("/admin/users", isAdmin, async (req, res) => { //Crear usuario -Sofi
  const { user_id, username, password, full_name, email, role } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    
    await pool.query(
      "INSERT INTO users (user_id, username, password, full_name, email, role) VALUES ($1, $2, $3, $4, $5, $6)",
      [user_id, username, hashedPassword, full_name, email, role]
    );
    res.json({ success: true, message: "Usuario creado correctamente" });
  } catch (error) {
    res.status(500).json({ error: "Error al crear usuario", details: error.message });
  }
});

app.delete("/admin/users/:id", isAdmin, async (req, res) => { //Eliminar usuario -Sof
  const userId = req.params.id;
  
  if (req.session.user && req.session.user.user_id === userId) { //Wacho si ves esto deberíamos hacer que el admin se pueda eliminar a si mismo??? -Sofi
    return res.status(400).json({ error: "No puedes eliminar tu propia cuenta." });
  }

  try {
    await pool.query("DELETE FROM users WHERE user_id = $1", [userId]);
    res.json({ success: true, message: "Usuario eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ 
      error: "Error al eliminar usuario", 
      details: error.message 
    });
  }
});

app.get("/admin/users", isAdmin, async (req, res) => { //Lista de usuarios -Sofi
  try {
    // Consulta para obtener usuarios ordenados por nombre completo
    const result = await pool.query("SELECT user_id, username, full_name, role FROM users ORDER BY full_name ASC");
    res.json({ success: true, users: result.rows });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener la lista de usuarios", details: error.message });
  }
});

/**
 * 2. Endpoint para listar todas las fichas desde la base de datos
 */
app.get("/clinical-files", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM Clinical_File ORDER BY doc_date DESC");
    res.json({ success: true, records: result.rows });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener fichas", details: error.message });
  }
});

/**
 * 3. Endpoint para obtener una ficha específica por su ID
 */
app.get("/clinical-files/:id", async (req, res) => {
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
    res.status(500).json({ error: "Error en la base de datos", details: error.message });
  }
});


app.post("/patients/upload", (req, res) => {
  // Usamos "file" porque es el nombre del campo en el FormData del frontend
  upload.single("file")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: "Upload failed", details: err.message });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const pacientes = [];

    // Convertimos el buffer del archivo en un Stream legible
    const stream = Readable.from(req.file.buffer.toString());

    stream
      .pipe(csv()) // ¡Ojo! Los nombres de las columnas en tu CSV deben coincidir con lo que leas aquí
      .on('data', (fila) => {
        pacientes.push(fila);
      })
      .on('end', async () => {
        const client = await pool.connect(); // Usamos un cliente dedicado para la transacción
        try {
          await client.query('BEGIN'); // Iniciamos transacción

          // Consulta SQL basada en tu tabla patients
          const insertQuery = `
            INSERT INTO patients (patient_id, national_id_fake, full_name, sex, birth_date, phone, address, insurance, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (patient_id) DO NOTHING;
          `;

          let insertados = 0;

          for (const p of pacientes) {
            // Asegúrate de que las propiedades (p.patient_id, etc.) coincidan EXACTAMENTE 
            // con los encabezados de la primera fila de tu archivo .csv
            await client.query(insertQuery, [
              p.patient_id, 
              p.national_id_fake, 
              p.full_name, 
              p.sex, 
              p.birth_date, 
              p.phone, 
              p.address, 
              p.insurance, 
              p.notes || null // notes permite nulos según tu esquema
            ]);
            insertados++;
          }

          await client.query('COMMIT'); // Guardamos los cambios
          res.json({ success: true, message: `Se procesaron ${insertados} pacientes correctamente.` });

        } catch (dbError) {
          await client.query('ROLLBACK'); // Si algo falla, deshacemos todo
          console.error("Error en base de datos:", dbError);
          res.status(500).json({ error: "Error al guardar en la base de datos", details: dbError.message });
        } finally {
          client.release(); // Liberamos el cliente
        }
      });
  });
});


app.get("/patients", async (req, res) => {
  try {
    // Consultamos todos los pacientes, ordenados alfabéticamente por nombre
    const result = await pool.query("SELECT * FROM patients");
    
    // Devolvemos el array de pacientes bajo la propiedad "patients"
    res.json({ success: true, patients: result.rows });
  } catch (error) {
    console.error("Error al obtener pacientes:", error);
    res.status(500).json({ error: "Error al obtener pacientes", details: error.message });
  }
});


app.get("/patients/:id", async (req, res) => {
  const patientId = req.params.id;
  try {
    // 1. Buscamos primero al paciente solito
    const patientResult = await pool.query("SELECT * FROM patients WHERE patient_id = $1", [patientId]);
    
    // Si no hay filas, el paciente no existe
    if (patientResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Paciente no encontrado" });
    }

    // Guardamos los datos del paciente en una variable
    const patientData = patientResult.rows[0];

    // 2. Buscamos las fichas clínicas básicas del paciente
    const filesResult = await pool.query("SELECT * FROM Clinical_File WHERE patient_id = $1 ORDER BY doc_date DESC", [patientId]);
    const clinicalFiles = filesResult.rows;


    for (let file of clinicalFiles) {
      const obsResult = await pool.query("SELECT doc_extra_txt FROM doc_extra WHERE doc_extra_id = $1", [file.filename]);
      file.observations = obsResult.rows; 
    }
    patientData.clinical_files = clinicalFiles;

    res.json({ success: true, patient: patientData });

  } catch (error) {
    res.status(500).json({ error: "Error en la base de datos", details: error.message });
  }
});

/**
 * Endpoint para descargar archivos desde el servidor local.
 */
app.get("/download/:filename", (req, res) => {
  const filePath = path.join(FILES_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }
  res.download(filePath, req.params.filename, (err) => {
    if (err) {
      res.status(500).json({ error: "Error downloading file", details: err.message });
    }
  });
});

/**
 * Endpoint para listar los archivos disponibles en el directorio local.
 */
app.get("/files", (req, res) => {
  fs.readdir(FILES_DIR, (err, files) => {
    if (err) {
      return res.status(500).json({ error: "Error listing files", details: err.message });
    }
    res.json({ success: true, files });
  });
});

/**
 * Endpoint de login (POST) para validar credenciales.
 */
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ result: false, error: "Missing data" });

  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      const match = await bcrypt.compare(password, user.password);

      if (match) {
        if (user.two_factor_secret) {
          req.session.tempUser = user.username; 
          return res.json({ result: true, require2FA: true, message: "Por favor ingresa tu código 2FA" });
        } else {
          req.session.user = { username: user.username, role: user.role }; 
          return res.json({ result: true, require2FA: false });
        }
      } else {
        return res.json({ result: false, error: "Credenciales inválidas" });
      }
    } else {
      return res.json({ result: false, error: "Credenciales inválidas" });
    }
  } catch (error) {
    res.status(500).json({ result: false, error: error.message });
  }
});

// 2FA
app.post("/setup-2fa", async (req, res) => {
  // Asumimos que el usuario ya inició sesión para configurar su 2FA
  if (!req.session.user) {
    return res.status(401).json({ error: "Debes iniciar sesión para configurar 2FA" });
  }

  try {
    // 1. Generamos el secreto único para este usuario
    const newSecret = twofactor.generateSecret({ 
      name: 'DocLocker', 
      account: req.session.user.username 
    });

    // 2. Guardamos el secreto en la base de datos
    await pool.query(
      "UPDATE users SET two_factor_secret = $1 WHERE username = $2",
      [newSecret.secret, req.session.user.username]
    );

    // 3. Devolvemos el QR para que el frontend lo muestre
    res.json({ 
      success: true, 
      message: "Escanea el código QR en tu app de autenticación",
      qr_url: newSecret.qr // Url de un código QR listo para usar
    });
  } catch (error) {
    res.status(500).json({ error: "Error configurando 2FA", details: error.message });
  }
});


app.post("/verify-2fa", async (req, res) => {
  const { token } = req.body;
  const username = req.session.tempUser; // Rescatamos al usuario de la sala de espera

  if (!username) {
    return res.status(400).json({ result: false, error: "No hay un inicio de sesión pendiente" });
  }

  try {
    // Buscamos el secreto del usuario en la base de datos
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    const user = result.rows[0];

    // Verificamos el código (node-2fa devuelve null si es inválido)
    const isValid = twofactor.verifyToken(user.two_factor_secret, token);

    if (isValid != null) {
      // ¡Código válido! Le damos acceso total y limpiamos la sala de espera
      req.session.user = { username: user.username, role: user.role };
      delete req.session.tempUser;
      return res.json({ result: true, message: "Inicio de sesión exitoso" });
    } else {
      return res.status(401).json({ result: false, error: "Código 2FA incorrecto" });
    }
  } catch (error) {
    res.status(500).json({ result: false, error: error.message });
  }
});


app.get("/login", (req, res) => {
  // Asumiendo que el archivo se llama "login.html.ejs" en ./views.
  // Si se usa res.render('login') y el motor de vistas es ejs, por defecto se buscará "login.ejs".
  // Si deseas mantener la extensión "html.ejs", puedes invocar res.render('login.html').
  res.render("login", { title: "DocLocker Login" });
});

app.get("/", (req, res) => {
  res.redirect("/login");
});

app.get("/logout", (req, res) => { //si funciona para login supongo que funcionará para logout - Sofi
  req.session.destroy(() => {
    res.redirect("/login"); //Wacho me dijiste que redireccionara a login de vuelta si hacen logout lo dejo? -Sofi
  });
});

app.get("/api/me", (req, res) => { //Esta cuestion es para que solo los admins vean el panel -Sofi
  if (req.session.user) {
    res.json({ success: true, user: req.session.user });
  } else {
    res.json({ success: false });
  }
});

/**
 * Nuevo endpoint GET /home para renderizar la vista de pruebas de la API.
 */
app.get("/home", (req, res) => {
  if (!req.session.user) { //proteger home para que no se metan por el url (puro cine la verdad) -Sofi
    return res.redirect("/login");
  }

  // Asumiendo que el archivo se llama "home.html.ejs" en ./views.
  res.render("home", { title: "DocLocker" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
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
  }, (proxyRes) => {
    const responseHeaders = {
      ":status": proxyRes.statusCode,
    };

    for (const [name, value] of Object.entries(proxyRes.headers)) {
      if (HOP_BY_HOP_HEADERS.has(name)) continue;
      responseHeaders[name] = value;
    }

    stream.respond(responseHeaders);
    proxyRes.pipe(stream);
  });

  proxyReq.on("error", (err) => {
    console.error("Error proxying HTTP/2 request to Express:", err);
    if (!stream.destroyed) {
      stream.respond({ ":status": 502 });
      stream.end("Bad Gateway");
    }
  });

  stream.on("error", () => {
    proxyReq.destroy();
  });

  stream.pipe(proxyReq);
}

if (ENV === 'production' && !process.env.SESSIONS_SECRET) {
  console.error("SESSIONS_SECRET debe estar configurado en producción.");
  process.exit(1);
}

if (ENV === 'production') {
  // Ojo, modificar los archivos del certificado y referenciar los
  // que han recibido por correo electrónico
  const certPath = process.env.SSL_CERT_PATH || '/app/certs/4104.grupotest.crt';
  const keyPath = process.env.SSL_KEY_PATH || '/app/certs/4104.grupotest.key';

  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.error("Certificado o clave no encontrada en el contenedor.");
    process.exit(1);
  }

  try {
    const options = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
      allowHTTP1: true,
    };

    const expressServer = http.createServer(app);
    expressServer.listen(0, "127.0.0.1", () => {
      const expressPort = expressServer.address().port;
      const http2Server = http2.createSecureServer(options);

      http2Server.on("request", (req, res) => {
        if (req.httpVersionMajor === 1) {
          app(req, res);
        }
      });

      http2Server.on("stream", (stream, headers) => {
        proxyHttp2StreamToExpress(stream, headers, expressPort);
      });

      http2Server.listen(PORT, () => {
        console.log(`HTTP/2 server running in ${ENV} mode on port ${PORT}`);
      });
    });
    
  } catch (err) {
    console.error('Failed to start HTTPS server: could not load key/cert files');
    console.error(err);
    process.exit(1);
  }

} else {
  http.createServer(app).listen(PORT, () => {
    console.log(`HTTP server running in ${ENV} mode on port ${PORT}`);
  });
}