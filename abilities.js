/**
 * abilities.js
 * -----------------------------------------------------------------------
 * Definición de habilidades (permisos) con CASL para MedVault.
 *
 * Implementa control de acceso RBAC (Role-Based Access Control):
 * cada usuario autenticado tiene un rol (admin, doctor, nurse, staff)
 * y las acciones permitidas sobre los recursos del sistema dependen
 * de ese rol.
 *
 * Sujetos (recursos) usados en MedVault:
 *  - 'User'         -> cuentas de usuarios del sistema
 *  - 'Patient'       -> pacientes
 *  - 'ClinicalFile'  -> fichas clínicas (Clinical_File)
 *  - 'PhysicalFile'  -> archivos físicos subidos/descargados (files/)
 *
 * Acciones usadas: 'manage' (todas), 'create', 'read', 'update', 'delete'
 *
 * Referencia: https://casl.js.org/v6/en/
 */

const { AbilityBuilder, createMongoAbility } = require('@casl/ability');

/**
 * Construye el objeto Ability para un usuario dado, según su rol.
 * @param {{ user_id?: string, username?: string, role?: string } | null} user
 * @returns {import('@casl/ability').MongoAbility}
 */
function defineAbilitiesFor(user) {
  const { can, cannot, build } = new AbilityBuilder(createMongoAbility);

  if (!user) {
    // Usuario anónimo (no autenticado): sin permisos sobre recursos protegidos.
    cannot('manage', 'all');
    return build();
  }

  switch (user.role) {
    case 'admin':
      // El administrador puede gestionar todo el sistema, incluyendo usuarios.
      can('manage', 'all');
      break;

    case 'doctor':
      // El personal médico puede leer y actualizar fichas clínicas y pacientes,
      // pero no gestionar usuarios del sistema ni eliminar fichas/pacientes.
      can('read', ['Patient', 'ClinicalFile', 'PhysicalFile']);
      can('create', ['ClinicalFile', 'PhysicalFile']);
      can('update', ['Patient', 'ClinicalFile']);
      cannot('delete', ['Patient', 'ClinicalFile']);
      cannot('manage', 'User');
      break;

    case 'nurse':
      // Enfermería: lectura de pacientes/fichas y carga de archivos físicos,
      // sin edición de datos clínicos críticos ni gestión de usuarios.
      can('read', ['Patient', 'ClinicalFile', 'PhysicalFile']);
      can('create', ['PhysicalFile']);
      cannot('update', ['Patient', 'ClinicalFile']);
      cannot('delete', ['Patient', 'ClinicalFile']);
      cannot('manage', 'User');
      break;

    case 'staff':
      // Personal administrativo: solo lectura general, sin acceso a edición
      // clínica ni gestión de usuarios.
      can('read', ['Patient', 'ClinicalFile', 'PhysicalFile']);
      cannot('update', ['Patient', 'ClinicalFile']);
      cannot('delete', ['Patient', 'ClinicalFile']);
      cannot('manage', 'User');
      break;

    default:
      // Rol desconocido / no reconocido: sin permisos.
      cannot('manage', 'all');
      break;
  }

  return build();
}

module.exports = { defineAbilitiesFor };
