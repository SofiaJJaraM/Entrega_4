#!/bin/bash
set -e

# Función de log con timestamp para facilitar el debugging
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

log "=== Iniciando entrypoint ==="
log "NODE_ENV=${NODE_ENV}"
log "DB_HOST=${DB_HOST}"
log "DB_USER=${DB_USER}"
log "DB_NAME=${DB_NAME}"

# Crear el directorio /etc/secrets si no existe
mkdir -p /etc/secrets

# ──────────────────────────────────────────────
# Montaje de sistema de archivos remoto (SSHFS)
# ──────────────────────────────────────────────

if [ "$NODE_ENV" = "production" ]; then
  log "Modo production: montando sistema de archivos remoto con sshfs..."

  if [ -n "$SSH_PRIVATE_KEY_BASE64" ]; then
    log "Creando archivo de clave SSH en ${SSH_KEY_PATH}..."
    echo "$SSH_PRIVATE_KEY_BASE64" | base64 -d > "$SSH_KEY_PATH" || {
      log "ERROR: Falló al decodificar SSH_PRIVATE_KEY_BASE64 en base64"
      exit 1
    }
    chmod 600 "$SSH_KEY_PATH"

    ssh-keygen -lf "$SSH_KEY_PATH" || {
      log "ERROR: La clave SSH decodificada no es válida (ssh-keygen falló)"
      exit 1
    }
    log "Clave SSH validada correctamente"
  else
    log "ERROR: No se proporcionó SSH_PRIVATE_KEY_BASE64. Asegúrate de inyectar el secreto."
    exit 1
  fi

  if [ -n "$SSH_HOST" ] && [ -n "$SSH_USER" ] && [ -n "$SSHFS_REMOTE_PATH" ] && [ -n "$SSHFS_LOCAL_PATH" ]; then
    log "Montando ${SSH_USER}@${SSH_HOST}:${SSHFS_REMOTE_PATH} → ${SSHFS_LOCAL_PATH}"
    mkdir -p "$SSHFS_LOCAL_PATH"

    sshfs -o StrictHostKeyChecking=no -o IdentityFile="$SSH_KEY_PATH" \
      "$SSH_USER@$SSH_HOST:$SSHFS_REMOTE_PATH" "$SSHFS_LOCAL_PATH" || {
      log "ERROR: sshfs falló al montar el sistema de archivos remoto"
      log "  SSH_HOST=${SSH_HOST}"
      log "  SSH_USER=${SSH_USER}"
      log "  SSHFS_REMOTE_PATH=${SSHFS_REMOTE_PATH}"
      log "  SSHFS_LOCAL_PATH=${SSHFS_LOCAL_PATH}"
      exit 1
    }
    log "sshfs montado correctamente en ${SSHFS_LOCAL_PATH}"
  else
    log "WARN: Variables SSH_HOST, SSH_USER, SSHFS_REMOTE_PATH o SSHFS_LOCAL_PATH no definidas. Omitiendo montaje sshfs."
  fi

else
  log "Modo development: utilizando sistema de archivos local en /app/files"
  mkdir -p /app/files
fi

# ──────────────────────────────────────────────
# Certificado TLS de la aplicación
# ──────────────────────────────────────────────

if [ -n "$CERTIFICATE_PRIVATE_KEY_BASE64" ]; then
  log "Decodificando clave privada TLS en ${CERTIFICATE_PRIVATE_KEY_PATH}..."
  echo "$CERTIFICATE_PRIVATE_KEY_BASE64" | base64 -d > "$CERTIFICATE_PRIVATE_KEY_PATH" || {
    log "ERROR: Falló al decodificar CERTIFICATE_PRIVATE_KEY_BASE64 en base64"
    exit 1
  }
  chmod 600 "$CERTIFICATE_PRIVATE_KEY_PATH"

  ssh-keygen -lf "$CERTIFICATE_PRIVATE_KEY_PATH" || {
    log "ERROR: La clave privada TLS decodificada no es válida (ssh-keygen falló)"
    log "  CERTIFICATE_PRIVATE_KEY_PATH=${CERTIFICATE_PRIVATE_KEY_PATH}"
    exit 1
  }
  log "Clave privada TLS validada correctamente"
else
  log "ERROR: No se proporcionó CERTIFICATE_PRIVATE_KEY_BASE64. Asegúrate de inyectar el secreto."
  exit 1
fi

# ──────────────────────────────────────────────
# Verificar que existen los certificados necesarios
# ──────────────────────────────────────────────

if [ ! -f "/app/certs/db.crt" ]; then
  log "ERROR: No se encontró el certificado CA de la base de datos en /app/certs/db.crt"
  log "ERROR: Este archivo es requerido para conectar a PostgreSQL con SSL."
  log "ERROR: Descarga el certificado CA del servidor de BD y colócalo en certs/db.crt antes de desplegar."
  exit 1
fi
log "Certificado CA de BD encontrado: /app/certs/db.crt"

# ──────────────────────────────────────────────
# Espera a que la base de datos esté disponible
# ──────────────────────────────────────────────

SSL_OPTS="sslmode=verify-ca&sslrootcert=/app/certs/db.crt"
DB_WAIT_TIMEOUT=60
DB_WAIT_COUNT=0

log "Esperando conexión a PostgreSQL en ${DB_HOST}/${DB_NAME}..."

until PGPASSWORD="$DB_PASS" psql "postgresql://$DB_USER@$DB_HOST/$DB_NAME?$SSL_OPTS" -c '\q' &>/dev/null; do
  DB_WAIT_COUNT=$((DB_WAIT_COUNT + 1))
  if [ "$DB_WAIT_COUNT" -ge "$DB_WAIT_TIMEOUT" ]; then
    log "ERROR: No se pudo conectar a PostgreSQL tras ${DB_WAIT_TIMEOUT} intentos."
    log "  Verifica DB_HOST=${DB_HOST}, DB_USER=${DB_USER}, DB_NAME=${DB_NAME}"
    log "  También verifica que /app/certs/db.crt sea el CA correcto."
    exit 1
  fi
  log "BD no disponible todavía (intento ${DB_WAIT_COUNT}/${DB_WAIT_TIMEOUT}), reintentando..."
  sleep 1
done

log "Conexión a PostgreSQL establecida correctamente"

# ──────────────────────────────────────────────
# Inicialización de la base de datos
# ──────────────────────────────────────────────

if [ "$INIT_DB" = "true" ]; then
  log "INIT_DB=true: Reinicializando el esquema de la base de datos..."
  PGPASSWORD="$DB_PASS" psql "postgresql://$DB_USER@$DB_HOST/$DB_NAME?$SSL_OPTS" \
    -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" || {
    log "ERROR: Falló al reinicializar el esquema public"
    exit 1
  }

  log "Ejecutando init.sql..."
  PGPASSWORD="$DB_PASS" psql "postgresql://$DB_USER@$DB_HOST/$DB_NAME?$SSL_OPTS" \
    -f /app/init.sql || {
    log "ERROR: Falló la ejecución de init.sql"
    exit 1
  }
  log "Base de datos inicializada correctamente"
else
  TABLE_COUNT=$(PGPASSWORD="$DB_PASS" psql "postgresql://$DB_USER@$DB_HOST/$DB_NAME?$SSL_OPTS" \
    -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")

  log "Tablas encontradas en el esquema public: ${TABLE_COUNT}"

  if [ "$TABLE_COUNT" -eq 0 ]; then
    log "Base de datos vacía. Ejecutando init.sql para inicializar..."
    PGPASSWORD="$DB_PASS" psql "postgresql://$DB_USER@$DB_HOST/$DB_NAME?$SSL_OPTS" \
      -f /app/init.sql || {
      log "ERROR: Falló la ejecución de init.sql"
      exit 1
    }
    log "Base de datos inicializada correctamente"
  else
    log "La base de datos ya tiene contenido. No se ejecuta init.sql."
  fi
fi

log "=== Entrypoint completado. Iniciando aplicación... ==="

# Ejecuta el comando definido en CMD (node server.js)
exec "$@"
