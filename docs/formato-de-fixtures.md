# MedVault -- Especificación de Fixtures (Entrega 1)

Este documento describe la estructura exacta de los archivos de datos
(fixtures) entregados a cada grupo del curso de Fundamentos de
Ciberseguridad.

Todos los datos contenidos en estos archivos son **100% sintéticos y
generados artificialmente para fines académicos**.

------------------------------------------------------------------------

# Estructura por grupo

Cada grupo recibe una carpeta en el servidor de archivos (dbfs-server en Tailnet) con la siguiente estructura:

    fs/
      grupoXX_users.csv
      grupoXX_patients.csv
      grupoXX_documents.csv
      grupoXX_manifest_patient_docs.csv
      documents/
        DOC000001.txt
        DOC000002.txt
        ...

Donde `XX` corresponde al número de grupo con dos dígitos (por ejemplo:
`grupo01`, `grupo02`, etc.).

------------------------------------------------------------------------

# 1. Archivo: grupoXX_users.csv

## Headers (exactos, en este orden)

    user_id,email,full_name,role,password_plain,is_active

## Descripción de columnas

-   **user_id**: Identificador único del usuario. Formato
    `U0001..U0030`.
-   **email**: Correo electrónico único con dominio `@medvault.test`.
-   **full_name**: Nombre completo sintético.
-   **role**: Rol del usuario. Valores posibles:
    -   `admin`
    -   `doctor`
    -   `nurse`
    -   `staff`
-   **password_plain**: Contraseña en texto plano (puede ser débil con
    fines pedagógicos).
-   **is_active**: Estado del usuario (`1` activo, `0` inactivo).

------------------------------------------------------------------------

# 2. Archivo: grupoXX_patients.csv

## Headers (exactos, en este orden)

    patient_id,national_id_fake,full_name,sex,birth_date,phone,address,insurance,notes

## Descripción de columnas

-   **patient_id**: Identificador único del paciente. Formato
    `P000001..P000100`.
-   **national_id_fake**: Identificador sintético (formato ejemplo:
    `CL-FAKE-XXXXXXXX-X`).
-   **full_name**: Nombre completo sintético.
-   **sex**: Sexo biológico declarado. Valores posibles:
    -   `F`
    -   `M`
    -   `X`
-   **birth_date**: Fecha de nacimiento en formato `YYYY-MM-DD`.
-   **phone**: Teléfono sintético (formato recomendado
    `+56 9 XXXX XXXX`).
-   **address**: Dirección sintética en una línea.
-   **insurance**: Tipo de previsión. Valores posibles:
    -   `FONASA`
    -   `ISAPRE`
    -   `PARTICULAR`
-   **notes**: Observaciones breves (puede estar vacío).

------------------------------------------------------------------------

# 3. Archivo: grupoXX_documents.csv

Este archivo contiene metadata de los documentos clínicos.

## Headers (exactos, en este orden)

    doc_id,doc_type,doc_date,title,patient_id,filename,sha256

## Descripción de columnas

-   **doc_id**: Identificador único del documento. Formato
    `DOC000001..DOC000150`.
-   **doc_type**: Tipo de documento. Valores posibles:
    -   `lab`
    -   `imaging`
    -   `prescription`
    -   `discharge`
    -   `referral`
-   **doc_date**: Fecha del documento en formato `YYYY-MM-DD`.
-   **title**: Título descriptivo del documento.
-   **patient_id**: Identificador del paciente al que pertenece el
    documento.
-   **filename**: Nombre del archivo dentro de la carpeta `documents/`.
-   **sha256**: Hash SHA-256 (hexadecimal) del contenido del archivo,
    para verificación de integridad.

------------------------------------------------------------------------

# 4. Archivo: grupoXX_manifest_patient_docs.csv

Este archivo define explícitamente la relación paciente-documento.

## Headers (exactos, en este orden)

    patient_id,doc_id

## Reglas de integridad garantizadas

-   Cada paciente tiene **al menos un documento clínico asociado**.
-   Cada documento clínico pertenece a **exactamente un paciente**.
-   No existen documentos duplicados entre pacientes.
-   El número total de documentos por grupo es mayor que el número de
    pacientes.

------------------------------------------------------------------------

# Reglas generales del dataset

-   Todos los datos son completamente ficticios.
-   No se utilizan datos reales de personas ni instituciones.
-   Cada grupo recibe un dataset independiente.
-   Los hashes SHA-256 permiten validar que los documentos no han sido
    modificados.

------------------------------------------------------------------------

Fin del documento.
