-- Eliminar la tabla si ya existe
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS patients;


-- Crear la tabla users
CREATE TABLE users (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'doctor', 'nurse')),
  two_factor_secret VARCHAR(255)
);

-- Crear la tabla patients
CREATE TABLE patients ( --patient_id, national_id_fake, full_name , sex, birth_date, phone, address , insurance , notes
  patient_id TEXT PRIMARY KEY,
  national_id_fake TEXT NOT NULL,
  full_name TEXT NOT NULL,
  sex CHAR NOT NULL,
  birth_date DATE NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  insurance TEXT NOT NULL,
  notes TEXT
);

-- Crear documentos extras
CREATE TABLE doc_extra (
  doc_extra_id TEXT PRIMARY KEY,
  doc_extra_txt TEXT NOT NULL
);

-- Crear la tabla Ficha Clinica
CREATE TABLE Clinical_File ( -- doc_id, doc_type, doc_date, title, patient_id, filename, sha256
  doc_id TEXT PRIMARY KEY,
  doc_type TEXT NOT NULL,
  doc_date DATE NOT NULL,
  title TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  sha256 TEXT NOT NULL
  -- FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
  -- FOREIGN KEY (filename) REFERENCES doc_extra(doc_extra_id)
);


-- Insertar el usuario admin con la contraseña admin.123
INSERT INTO users (user_id, username, email, full_name, role, password)
VALUES ('U0000', 'admin', 'admin@medvault.test',  'administrador', 'admin', '$2b$12$cgy1CM.41eamT2Ob6Xx3veeX05FHA.7Qc1bUDkasqedG/ZRpPLxG6');

-- Insertar al resto de usarios predeterminados
INSERT INTO users (user_id, username, email, full_name, role, password) VALUES
('U0001', 'U0001-augusto', 'augusto-amaro-elguetasob.12.01@medvault.test', 'Augusto Amaro Elgueta-Sobarzo González', 'admin', '$2b$12$oiyo4xI2TNcyVr8tyniS7emkYOhnpsY.z70MaI8IMxgk788G72W2u'),
('U0002', 'U0002-paulina', 'paulina-laura-aguilera-m.12.02@medvault.test', 'Paulina Laura Aguilera Monsalve', 'staff', '$2b$12$cAAJ8QR7pxFwXxKHSp8FIO1UeYWlIfmZMBII3yg1lmF3VPYdyCFlm'),
('U0003', 'U0003-andres', 'andrés-javier-cubillos-s.12.03@medvault.test', 'Andrés Javier Cubillos Salazar', 'staff', '$2b$12$cAAJ8QR7pxFwXxKHSp8FIO1UeYWlIfmZMBII3yg1lmF3VPYdyCFlm'),
('U0004', 'U0004-julio', 'julio-pedro-molina-pérez.12.04@medvault.test', 'Julio Pedro Molina Pérez', 'doctor', '$2b$12$5PjuPqS/1OkwVx/xDw.jHOY6JHY5SMZ0k/a8RtMPLbLictlCeueJu'),
('U0005', 'U0005-sonia', 'sonia-maría-núñez-toledo.12.05@medvault.test', 'Sonia María Núñez Toledo', 'nurse', '$2b$12$5PjuPqS/1OkwVx/xDw.jHOY6JHY5SMZ0k/a8RtMPLbLictlCeueJu'),
('U0006', 'U0006-luisa', 'luisa-emily-ruiz-díaz.12.06@medvault.test', 'Luisa Emily Ruiz Díaz', 'staff', '$2b$12$TdDX70q4QCxzAFiYBlsZ1ugklgwPm98hmDJk/hvOGj/ZzYMQWkiau'),
('U0007', 'U0007-valentina', 'valentina-jessica-jorque.12.07@medvault.test', 'Valentina Jessica Jorquera Cofré', 'staff', '$2b$12$5PjuPqS/1OkwVx/xDw.jHOY6JHY5SMZ0k/a8RtMPLbLictlCeueJu'),
('U0008', 'U0008-marco', 'marco-marín-pereira.12.08@medvault.test', 'Marco Marín Pereira', 'nurse', '$2b$12$oiyo4xI2TNcyVr8tyniS7emkYOhnpsY.z70MaI8IMxgk788G72W2u'),
('U0009', 'U0009-maria', 'maría-adriana-valenzuela.12.09@medvault.test', 'María Adriana Valenzuela Pizarro', 'staff', '$2b$12$5PjuPqS/1OkwVx/xDw.jHOY6JHY5SMZ0k/a8RtMPLbLictlCeueJu'),
('U0010', 'U0010-karla', 'karla-tamara-navarro-gon.12.10@medvault.test', 'Karla Tamara Navarro González', 'doctor', 'grupo12'),
('U0011', 'U0011-maria', 'maría-martinez.12.11@medvault.test', 'María Martinez', 'nurse', '$2b$12$5PjuPqS/1OkwVx/xDw.jHOY6JHY5SMZ0k/a8RtMPLbLictlCeueJu'),
('U0012', 'U0012-jose', 'josé-astudillo.12.12@medvault.test', 'José Astudillo', 'nurse', 'grupo12'),
('U0013', 'U0013-jessica', 'jessica-ojeda-navarro.12.13@medvault.test', 'Jessica Ojeda Navarro', 'doctor', '$2b$12$oiyo4xI2TNcyVr8tyniS7emkYOhnpsY.z70MaI8IMxgk788G72W2u'),
('U0014', 'U0014-juan', 'juan-kevin-espinoza-leal.12.14@medvault.test', 'Juan Kevin Espinoza Leal', 'doctor', 'grupo12'),
('U0015', 'U0015-rosa', 'rosa-díaz.12.15@medvault.test', 'Rosa Díaz', 'nurse', '$2b$12$cAAJ8QR7pxFwXxKHSp8FIO1UeYWlIfmZMBII3yg1lmF3VPYdyCFlm'),
('U0016', 'U0016-heriberto', 'heriberto-castillo-muñoz.12.16@medvault.test', 'Heriberto Castillo Muñoz', 'staff', '$2b$12$cAAJ8QR7pxFwXxKHSp8FIO1UeYWlIfmZMBII3yg1lmF3VPYdyCFlm'),
('U0017', 'U0017-jaime', 'jaime-carlos-vega-campos.12.17@medvault.test', 'Jaime Carlos Vega Campos', 'nurse', '$2b$12$5PjuPqS/1OkwVx/xDw.jHOY6JHY5SMZ0k/a8RtMPLbLictlCeueJu');

