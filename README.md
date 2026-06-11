[![Open in Visual Studio Code](https://classroom.github.com/assets/open-in-vscode-2e0aaae1b6195c2367325f4f02e2d04e9abb55f0b24a779b69b11b9e10269abc.svg)](https://classroom.github.com/online_ide?assignment_repo_id=23464570&assignment_repo_type=AssignmentRepo)
# Proyecto de Fundamentos de Ciberseguridad 2026-10
# Enunciado General

## Introducción

Una mañana de lunes, el Hospital San Rafael comenzó como cualquier otro día: consultas agendadas, cirugías programadas, pacientes esperando en urgencias. El flujo clínico dependía, como siempre, de la información.

A las 09:17, una médica intentó revisar los antecedentes de alergias de un paciente que sería intervenido esa misma mañana. El sistema respondió con un mensaje ambiguo: “Registro no disponible”.

Minutos después, en otro servicio, una enfermera detectó que el historial farmacológico de un paciente no coincidía con lo que había sido indicado el día anterior. En administración, alguien descubrió que ciertos usuarios tenían accesos que no parecían corresponder a su función.

No hubo explosiones digitales ni pantallas con mensajes dramáticos. Hubo algo más inquietante: incertidumbre.

El comité directivo del hospital se reunió esa misma tarde.

—No podemos seguir operando con sistemas improvisados —dijo la directora médica—. La ficha clínica no es un archivo cualquiera. Es la memoria médica de una persona.

El director de tecnologías respondió con sobriedad:

—Necesitamos un sistema web moderno. Centralizado. Accesible. Pero, sobre todo, seguro.

Tras algunas discusiones presupuestarias y estratégicas, surgió una propuesta poco convencional:

Un grupo de equipos de estudiantes de ingeniería desarrollará el nuevo sistema de ficha clínica electrónica del hospital. Cada equipo diseñará su propia versión. Luego, los sistemas serán sometidos a evaluación técnica intensiva.

El sistema que demuestre mayor solidez, coherencia y resiliencia será el que sobreviva.

El proyecto ha comenzado.

## Las Fichas Clínicas: Lo que Está en Juego

Una ficha clínica no es simplemente un conjunto de datos. Es la historia médica de una persona.

Contiene, entre otros elementos:

* Diagnósticos pasados y actuales.
* Tratamientos farmacológicos.
* Resultados de exámenes.
* Informes de procedimientos.
* Antecedentes familiares y personales.
* Observaciones médicas confidenciales.

Una alteración inadvertida puede conducir a decisiones clínicas erróneas.
Un acceso indebido puede vulnerar la privacidad más íntima de un paciente.
Una pérdida de disponibilidad puede retrasar una atención crítica.

Los sistemas de salud manejan información considerada altamente sensible en prácticamente todas las legislaciones modernas. La responsabilidad profesional, ética y legal asociada a su resguardo es significativa.

Por esta razón, el Hospital San Rafael ha decidido encargar el desarrollo de MedVault, su nuevo sistema web de ficha clínica electrónica.

Cada equipo recibirá:

* 📄 Un conjunto de registros clínicos simulados (pacientes, atenciones, profesionales).
* 👥 Un listado de usuarios iniciales que deberán existir en el sistema.
* 🗂 Estructuras de datos que representan fichas clínicas, evoluciones médicas y documentos adjuntos.
* 🔐 Credenciales y configuraciones necesarias para operar en el entorno asignado.

El sistema deberá centralizar la información clínica y permitir su consulta y gestión por distintos tipos de usuarios.

El hospital no busca una interfaz sofisticada ni un diseño espectacular.

Busca confianza.

## Requisitos específicos por entrega de proyecto

En la carpeta `docs` de este repositorio podrás encontrar los enunciados por entrega. Para actualizar los enunciados disponibles en el futuro, puedes configurar como origen remoto de git [este repositorio](https://github.com/ICC4104-202610-Ciberseguridad/project-base), y con `pull` en la rama `main` podrás actualizar el contenido de `docs`.

```sh
git remote add 
```

También publicaremos los enunciados en el sitio web del curso.
