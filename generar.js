const bcrypt = require('bcrypt');

// Estas son las contraseñas que pusiste en tu init.sql
const passwords = [
  'admin.123', 
  'MedVault2026', 
  'Password123', 
  '12345678', 
  'grupo12'
];

async function generar() {
  console.log("Generando hashes...\n");
  for (let pass of passwords) {
    // Usamos 12 salt rounds, igual que en tu endpoint de crear usuarios
    const hash = await bcrypt.hash(pass, 12); 
    console.log(`Contraseña: ${pass}`);
    console.log(`Hash: '${hash}'\n`);
  }
}

generar();