# Alfasoft Project

Este es el repositorio oficial para el proyecto Alfasoft, desarrollado con [Next.js](https://nextjs.org).

## 🚀 Comenzando

Estas instrucciones te permitirán obtener una copia del proyecto en funcionamiento en tu máquina local para propósitos de desarrollo y pruebas.

### 📋 Prerrequisitos

Necesitas tener instalado lo siguiente:
*   [Node.js](https://nodejs.org/) (Versión 18 o superior recomendada)
*   [Git](https://git-scm.com/)

### 🔧 Instalación

1.  **Clonar el repositorio**:
    ```bash
    git clone https://github.com/rtipiani/alfasoft.git
    cd alfasoft
    ```

2.  **Instalar dependencias**:
    ```bash
    npm install
    ```

3.  **Configurar variables de entorno**:
    Crea un archivo `.env.local` en la raíz del proyecto (puedes copiar el `.env.example` si existe) y añade las claves necesarias.

### ⚙️ Ejecutar localmente

Para iniciar el servidor de desarrollo:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver la aplicación.

## 🤝 Colaboración

Para trabajar en equipo de manera ordenada, seguimos este flujo:

1.  **Actualizar tu rama local**:
    Siempre antes de empezar, descarga los últimos cambios:
    ```bash
    git pull origin main
    ```

2.  **Crear una nueva rama (Branch)**:
    Nunca trabajes directo en `main`. Crea una rama con un nombre descriptivo para tu tarea:
    ```bash
    git checkout -b funcionalidad-nueva
    # o
    git checkout -b correccion-error-login
    ```

3.  **Guardar cambios**:
    ```bash
    git add .
    git commit -m "Descripción clara de lo que hiciste"
    ```

4.  **Subir cambios**:
    ```bash
    git push origin nombre-de-tu-rama
    ```

5.  **Solicitar integración (Pull Request)**:
    Ve a GitHub y crea un "Pull Request" comparando tu rama con `main` para que el administrador revise y acepte los cambios.

## 📦 Construcción para Producción

Para crear la versión optimizada para producción:

```bash
npm run build
```

---
Desarrollado por [rtipiani](https://github.com/rtipiani)
