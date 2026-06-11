# Proyecto de Fundamentos de Ciberseguridad 2026-10
# Enunciado de la Entrega 1

## 1. Objetivos de la primera entrega

En la primera entrega, el foco está en contar con una aplicación MedVault operativa que implemente la funcionalidad básica de un sistema web de ficha clínica electrónica.

El objetivo es desarrollar la mayor cantidad de funcionalidades posibles, en el orden requerido y dentro del plazo establecido.

En esta etapa del curso el énfasis está en lograr que el sistema funcione.
La evaluación considerará exclusivamente el cumplimiento de los requisitos funcionales definidos a continuación.

La Entrega 1 se divide en dos partes:

* Entrega 1.1: Desarrollo funcional acelerado.
* Entrega 1.2: Despliegue en ambiente de producción.

## 2. Requisitos y su evaluación

Existen seis ámbitos de requisitos que se listan a continuación.
Se deben implementar en el orden indicado.

La entrega 1.1 corresponde al 9/4 a las 23:59 hrs.
La entrega 1.2 corresponde al 20/4 a las 23:59 hrs.

Se distribuyen 100 puntos de acuerdo a los siguientes requisitos:

1️⃣ Gestión de Usuarios del Sistema (Entrega 1.1; 20 puntos)

1. Todos los usuarios definidos en el archivo de inicialización (grupoXX_users.csv) deben existir en la base de datos del sistema.
2. Cada usuario debe contar con:
 * Nombre completo.
 * Email.
 * Rol (profesional de salud, administrativo o administrador).
 * Contraseña.
3. La contraseña inicial puede ser definida libremente por el equipo.
4. El sistema debe permitir:
 * Inicio de sesión.
 * Cierre de sesión.
 * Redirección a una página de inicio posterior al login.

2️⃣ Gestión de Pacientes (Entrega 1.1; 20 puntos)

1. El sistema debe permitir registrar nuevos pacientes.
2. Debe permitir listar todos los pacientes existentes.
3. Debe permitir visualizar el detalle de un paciente.
4. Cada paciente debe incluir al menos:
 * Nombre.
 * RUT o identificador único.
 * Fecha de nacimiento.
 * Información de contacto básica.

3️⃣ Gestión de Ficha Clínica (Entrega 1.1; 20 puntos)

1. Cada paciente debe tener una ficha clínica asociada.
2. El sistema debe permitir registrar nuevas atenciones clínicas.
3. Cada atención debe incluir al menos:
 * Fecha.
 * Profesional responsable.
 * Diagnóstico.
 * Observaciones.
4. El sistema debe permitir visualizar el historial completo de atenciones de un paciente en orden cronológico.

4️⃣ Documentos Clínicos Adjuntos (Entrega 1.2; 20 puntos)

1. El sistema debe permitir asociar documentos a una ficha clínica.
2. Los documentos pueden ser subidos al servidor.
3. Los documentos deben poder visualizarse o descargarse desde la aplicación.
4. Los documentos deben quedar asociados a un paciente específico.

5️⃣ Cuenta de Administrador (Entrega 1.2; 20 puntos)

1. Debe existir un usuario administrador del sistema.
2. El administrador debe poder:
 * Crear usuarios.
 * Eliminar usuarios.
3. Consultar el listado completo de usuarios registrados.

6️⃣ Instalación de la aplicación en ambiente de producción (Entrega 1.2; Obligatorio)

A más tardar en la fecha correspondiente a la Entrega 1.2, la aplicación debe estar operativa en el ambiente de producción definido por el curso.

Esto implica:

1. La aplicación debe estar desplegada en el servidor asignado.
2. Debe ser accesible públicamente mediante la URL del grupo.
3. Debe encontrarse completamente funcional.

Es obligatorio que la aplicación esté en producción para obtener nota en la Entrega 1.

Si la aplicación no está desplegada correctamente en producción, el grupo obtiene nota 1,0 en la Entrega 1.

La nota en la Entrega 1 se calcula de la siguiente forma:

NE1 = (P1_1 + P1_2) * 0.06 + 1

En donde P1_1 es el puntaje acumulado en la entrega 1.1, y P1_2 es el puntaje acumulado en la entrega 1.2.

## 3. Ambiente de desarrollo

Se debe contar con un ambiente de desarrollo POSIX-compatible: Linux, MacOS, Windows con WSL2 y Ubuntu o Debian, o una máquina virtual con Linux.

Además, se necesita contar con Docker Engine.

El editor preferido para desarrollar es VSCode.

Los requisitos de memoria de la aplicación son bajos. Un PC o Mac con 8GB o más RAM será suficiente para ejecutar todo.

Para comenzar a desarrollar requieres lo siguiente:

1. Que tu grupo tenga asignado un número.
2. Que hayas recibido un par clave pública - clave privada para acceder a los archivos protegidos que deberás mantener con tu aplicación en ambiente de producción.
3. Que hayas recibido una clave (`AUTH_KEY`) para acceder a la red privada Tailscale.
4. Que hayas recibido las credenciales de base de datos para tu aplicación en ambiente de producción.

## 4. Arquitectura de MedVault

La arquitectura de MedVault es la de una aplicación web convencional, con renderizado en el lado del servidor. Está basada en el micro-framework de aplicación web Express para Javascript (ES6+), y ejecuta con Node.js. 

La aplicación utiliza una base de datos PostgreSQL, y utiliza el módulo estándar `pg` para su conectividad a la base de datos y ejecución de consultas.

El script principal de la aplicación web es `server.js`, el cual se encuentra en la raíz del presente repositorio. En `server.js` es posible observar lo siguiente:

1. La inclusión de las dependencias de la aplicación. Algunas dependencias relevantes son `multer`, el cual es un _middleware_ utilizado con Express para facilitar la subida de archivos. Mantiene el archivo subido en memoria, y así es posible luego guardarlo en disco. Por otro lado, `express-ejs-layouts` es un módulo que permite el uso de _layouts_ en las vistas de la aplicación. Los módulos `express-session` y `session-file-store` permiten mantener sesiones y persistir la información de sesiones en el sistema de archivos.
2. La implementación de rutas y _endpoints_ de API de la aplicación. Hay varios endpoints de API que se encuentran pre-implementados, a modo de ejemplo sobre cómo usar Express: 
  * `POST /upload`, el cual permite subir archivos. Multer permite que el archivo sea accesible desde memoria mediante `req.file` (más abajo explicamos sobre los objetos `req` y `res`).
  * `GET /download/:filename`, el cual permite descargar un archivo por su nombre. Se puede ver aquí un ejemplo de cómo procesar subidas de archivo.
  * `GET /files` permite listar los archivos disponibles en MedVault. Ejemplifica cómo interactuar con el sistema de archivos para listar un directorio.
  * `POST /login`, el cual implementa una autenticación básica de ejemplo que no toca la sesión. Se puede ver aquí el ejemplo de cómo realizar una consulta a la base de datos usando `pg`.
  * `GET /login`, el cual renderiza y envía al cliente la página de login.
  * `GET /home`, el cual renderiza y envía al cliente la página de inicio.
  * `GET /`, el cual redirige el cliente a `/login`.

Es importante notar que en Express los controladores se implementan mediante funciones del siguiente estilo:

```es6
app.post("/login", async (req, res) => { 

});
```

El objeto `app` corresponde a la aplicación Express. Este objeto permite añadir _controladores_ que implementan la lógica de un _endpoint_. En el ejemplo, la función `async (req, res) => { }` implementa el controlador para la ruta `POST /login`, y esto se infiere a partir del método `post` que es invocado sobre `app`, y el primer argumento que indica la ruta. Express permite que un controlador pueda acceder a un objeto con la petición (request) `req`, y a otro objeto para formar la respuesta `res` al cliente. La sesión queda accesible en `req.session`. Puedes ver más detalles en la [documentación de Express](https://expressjs.com/en/starter/basic-routing.html). Existen [varios ejemplos](https://expressjs.com/en/starter/examples.html) para casos de uso comunes.

Las vistas de la aplicación están en el directorio `/views`. Es posible encontrar allí el layout de la aplicación (`layout.ejs`), y plantillas para las páginas de `login` y `home`. El layout está configurado para usar Bootstrap 5, cargado desde una CDN, y carga también una biblioteca llamada lit-html para programación en las vistas con ES6+. Las llamadas a la API en `server.js` se hacen a través de [Axios](https://axios-http.com/docs/api_intro), aunque también se podría usar [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) directamente.

Finalmente, respecto a las dependencias de la aplicación, éstas se encuentran listadas en el archivo `package.json` en la raíz de este repositorio. Si bien se ha utilizado npm para crear este proyecto, se puede usar npm o Yarn para gestionar las dependencias.

Para agregar un módulo al proyecto, se puede ejecutar en la ruta raíz de este repositorio:

```sh
npm install nombre_del_modulo --save # queda agregado a package.json
```

## 5. Archivos Base

Cada grupo dispone de un conjunto de archivos básicos para cargar en su aplicación MedVault, con toda la información de usuarios, pacientes, documentos médicos, etc. Es importante tener en consideración que toda esta información es confidencial. 

A cada grupo se le entregará por correo electrónico a sus miembros una clave ssh en formato ed25519 y acceso al servidor dbfs-server en la red Tailscale del curso. En dicho servidor cada grupo podrá encontrar los archivos antes mencionados en una carpeta privada. Las descripciones detalladas de los archivos se encuentran en [este documento](formato-de-fixtures.md) (formato-de-fixtures.md). Cada grupo deberá descargar cuanto menos cuatro archivos CSV que se encuentran en la carpeta privada para generar una base de datos para usar la aplicación. El contenido en los archivos CSV puede ser transformado por los grupos a JSON u otros formatos que pudieran ser convenientes.

Además, en cada carpeta privada existe una carpeta `documents` en donde se mantienen los documentos privados. En la aplicación MedVault en ambiente de producción (entrega 1.2), los documentos estarán disponibles en forma automática en `/files/documents`, por lo que no es necesario copiarlos ni moverlos. Téngase presente que los documentos médicos no deben duplicarse ni transformarse a otros formatos; es decir, la aplicación medvault siempre los debe leer desde el sistema de archivos (directorio `/files`). Para el ambiente de desarrollo, está permitido copiar los documentos al directorio `files/documents` local, o generar otros archivos ficticios en su reemplazo. 

## 6. Inicialización de la base de datos

Tanto para el ambiente de producción como para el ambiente de desarrollo, la base de datos es creada mediante la ejecución de sentencias que se encuentran en el archivo `init.sql` en la raíz del repositorio. En este archivo se pueden agregar todas las sentencias `CREATE` que requieran, junto con `INSERT` para poblar tablas con datos iniciales.

## 7. Implementación de vistas

Las vistas deben implementarse en HTML5, y los archivos se deben guardar en `/views`. En `server.js` hay ejemplos (ver `GET /login` y `GET /home`) sobre cómo se renderizan las vistas en el lado del servidor.

Es posible implementar vistas estáticas que son completamente renderizadas en el lado del servidor, y vistas dinámicas que tienen un ciclo de vida en el lado del cliente. Los desarrolladores pueden decidir si implementan todo usando vistas estáticas, o si prefieren usar vistas dinámicas; totalmente a su conveniencia.

### 7.1 Vistas estáticas (básico)

Las vistas estáticas se escriben en HTML y se puede incorporar en ellas código Javascript que es procesado en el lado del servidor, en forma equivalente a cómo se usa Embedded Ruby en Ruby on Rails. Usamos Embedded Javascript ([EJS](https://ejs.co/#docs)) encerrando el código Javascript con marcadores del estilo `<% %>` (ver sección Tags en el enlace anterior). 

El código Javascript es generalmente utilizado para "interpolar" variables en el template, en el lado del servidor antes de enviarlo al cliente. Por ejemplo, si se quisiera desplegar una lista de usuarios, el código EJS en el template sería de la siguiente manera:

```html
<table border="1">
  <thead>
    <tr>
      <th>Nombre</th>
      <th>Email</th>
    </tr>
  </thead>
  <tbody>
    <% users.forEach(function(user) { %>
      <tr>
        <td><%= user.name %></td>
        <td><%= user.email %></td>
      </tr>
    <% }); %>
  </tbody>
</table>
```

Así, `user.name` y `user.email` de cada usuario quedan interpolados en una tabla. Para que esto funcione, el controlador debe renderizar el template pasando el objeto users:

```es6
// Datos de ejemplo
const users = [
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' },
  { name: 'Charlie', email: 'charlie@example.com' }
];

// Ruta que renderiza la vista 'users.ejs'
router.get('/users', (req, res) => {
  res.render('users', { users: users }); // se pasan los usuarios al template
});
```

### 7.2 Vistas dinámicas (avanzado)

Con las vistas dinámicas, las vistas se construyen en el cliente (navegador web) con javascript, manipulando el DOM con una biblioteca llamada lit-html. El uso de esta biblioteca está configurado en el layout de la aplicación `views/layout.ejs`. Está permitido usar otra biblioteca si se prefiere (React, Vue, etc). Se ha preferido usar lit-html porque es liviana y apropiada para aplicaciones pequeñas. Sería posible evitar el uso de vistas dinámicas y utilizar solamente vistas estáticas, pero esto podría requerir modificar controladores en `server.js` para que implementen las interpolaciones de variables necesarias en los templates.

En las vistas de ejemplo que hay en la aplicación (home y login) se está usando [lit-html](https://lit.dev/docs/v1/lit-html/introduction/). En general, al usar lit-html se siguen estos pasos:

1. Definir un elemento html que sirve como contenedor de la vista dinámica. Ejemplo:
```html
<div id="login-container"></div>
```
2. Definir un script en la página que se ejecuta cuando la página ha terminado de cargar:
```es6
<script>
  // Esperamos a que el DOM esté completamente cargado
  document.addEventListener("DOMContentLoaded", () => {
    ...
  }
```
3. Definir en este script un template de HTML usando Javascript _template literal_:
```es6
    const loginTemplate = (message = '') => html`
      <div class="row">
        <div class="col-md-3">
          <form id="login-form" class="mt-4">
            <h2 class="mb-4">Iniciar Sesión</h2>
            <div class="mb-3">
              <label for="username" class="form-label">Usuario:</label>
              <input type="text" id="username" name="username" class="form-control" required />
            </div>
            <div class="mb-3">
              <label for="password" class="form-label">Contraseña:</label>
              <input type="password" id="password" name="password" class="form-control" required />
            </div>
            <button type="submit" class="btn btn-primary">Ingresar</button>
            ${message ? html`<p class="text-danger mt-2">${message}</p>` : null}
          </form>
        </div>
      </div>
    `;
```
4. Inyectar el template literal en el contenedor de la vista dinámica (del paso 1):
```es6
    // window.litHtml es definido en el layout!
    const { html, render } = window.litHtml;

    // Elemento container de la página
    const container = document.getElementById('login-container');

    // Función para renderizar la vista de login
    function renderLogin(message = '') {
      render(loginTemplate(message), container);
    }
```
5. Si la vista requiere llamar endpoints del backend, se usa Axios (o Fetch API):
```es6
  const response = await axios.post('/login', { username, password }, {
    headers: { 'Content-Type': 'application/json' }
  });
  const resultData = response.data;
  if (resultData.result) {
    window.location.href = '/home';
  } else {
    renderLogin('Credenciales incorrectas. Inténtalo nuevamente.');
  }
```

## 8. Despliegue en ambiente de producción

Para el despliegue en ambiente de producción utilizamos GitHub Actions, lo cual permite automatizar el proceso. Con GitHub actions, se especifica la configuración de un _workflow_ que declara los pasos para la puesta en producción. La configuración del _workflow_ para este proyecto está en `.github/workflows/ci.yml` en este repositorio. En general no es necesario modificar esta configuración.

El workflow requiere definir varias variables secretas. Para esto, en su repositorio en GitHub, deben dirigirse a la pestaña Settings, luego en el menú izquierdo ir a _Secrets and variables_ en la sección _Security_, luego elegir _Actions_. Luego, mediante el botón "New repository secret", agregar las siguientes variables:

* `DB_HOST`: dbfs-server (en VPN Tailscale)
* `DB_NAME`: grupoXX (en donde XX es el número del grupo con 0 de relleno; ejs., grupo01, grupo20).
* `DB_PASS`: la contraseña de base de datos que ha sido entregada al grupo.
* `DB_USER`: Usuario de la base de datos, grupoXX.
* `GROUP_ID`: El número del grupo (p.ej., 00, 15).
* `HOST_PORT`: 30XX (p.ej., 3001 para el grupo 1, 3020 para el grupo 20).
* `SESSIONS_SECRET`: Se puede generar con el siguiente comando:
```sh
openssl rand -hex 32
```
* `SSH_HOST`: dbfs-server (en VPN Tailscale)
* `SSH_PRIVATE_KEY_BASE64`: La clave privada que ha recibido el grupo, la cual se encuentra codificada en base64.
* `SSH_USER`: grupoXX

Además, en caso que se requiera volver a crear la base de datos a partir de cero, es posible definir la siguiente variable (cambiar a la pestaña "Variables" en la sección "Action secrets and variables"):

* `INIT_DB`: `true` para forzar la recreación del schema de base de datos según `init.db`, o eliminar la variable o asignarle valor `false` para evitar que la base de datos sea vuelta a crear cuando la aplicación se inicia.

Con las variables anteriores bien configuradas, al hacer `push` al repositorio en la rama `main`, habrá un despliegue automático de la aplicación en http://grupoXX.4104.iccuandes.org. Hay un sitio de pruebas en [http://grupotest.4104.iccuandes.org](http://grupotest.4104.iccuandes.org).

Además, es posible volver a lanzar la aplicación en producción en cualquier momento si se requiere, escogiendo la pestaña "Actions" en la navegación principal en GitHub, luego escogiendo "Deploy Node.js App with SSHFS" (ver navegación al lado izquierdo), seguido de clic en el botón "Run workflow", y finalmente "Run workflow" (botón verde).

