# Guía de Desarrollo de Plugins para DocentOS (Open Source LMS)

Bienvenido a la guía oficial de desarrollo de plugins de **DocentOS**. Este documento detalla cómo crear, registrar y suscribirte a eventos del ciclo de vida dentro de la arquitectura modular de la plataforma.

---

## 🚀 1. Estructura de un Plugin (`AcademiaPlugin`)

Un plugin en DocentOS es un objeto TypeScript que implementa la interfaz `AcademiaPlugin`:

```typescript
export interface AcademiaPlugin {
  id: string; // Identificador único en minúsculas (ej. 'custom-gamification')
  name: string; // Nombre visible en la tienda/administrador de plugins
  description: string; // Descripción corta del propósito del plugin
  version: string; // Versión SemVer (ej. '1.0.0')
  enabled: boolean; // Estado por defecto (true | false)
  category: 'certificates' | 'quizzes' | 'integrations' | 'analytics' | 'custom';
  icon: string; // Nombre del icono de Lucide React (ej. 'Award', 'Sparkles')
  config: Record<string, any>; // Configuración personalizada por el usuario
}
```

---

## 🛠️ 2. Crear un Nuevo Plugin

Crea un archivo en `src/plugins/myCustomPlugin.ts`:

```typescript
import { AcademiaPlugin } from '../types';

export const myCustomPlugin: AcademiaPlugin = {
  id: 'my-custom-plugin',
  name: 'Mi Plugin Personalizado',
  description: 'Extiende DocentOS enviando alertas y registrando eventos personalizados.',
  version: '1.0.0',
  enabled: true,
  category: 'custom',
  icon: 'Sparkles',
  config: {
    customEndpoint: 'https://api.miempresa.com/v1/events',
    alertOnLesson: true,
  },
};
```

---

## ⚡ 3. Ganchos del Ciclo de Vida (Lifecycle Hooks)

El `PluginManager` expone varios métodos para responder a eventos del usuario en tiempo real:

| Nombre del Hook | Argumentos | Momento de Ejecución |
| :--- | :--- | :--- |
| `onLessonComplete(user, video)` | `(User, VideoDriveLink)` | Al estudiante marcar una lección/video como completado. |
| `onCourseComplete(user, course)` | `(User, Course)` | Cuando el estudiante alcanza el 100% del programa. |
| `onCommentSubmit(user, commentData)` | `(User, { videoTitle, content })` | Al enviar una duda en el panel de mentoría. |
| `onRenderCourseViewer(course)` | `(Course)` | Al renderizar la pantalla principal de clases. |

### Ejemplo: Suscripción en `PluginManagerEngine`

```typescript
public async onLessonComplete(user: User, video: VideoDriveLink): Promise<void> {
  if (this.isEnabled('my-custom-plugin')) {
    const config = this.getPlugin('my-custom-plugin')?.config;
    console.log(`[Plugin Event] ${user.name} completó ${video.title}`);
  }
}
```

---

## 📡 4. Registro Dinámico de Plugins

Para registrar tu plugin dinámicamente en el arranque de la aplicación:

```typescript
import { pluginManager } from './plugins/PluginManager';
import { myCustomPlugin } from './plugins/myCustomPlugin';

// Registrar plugin en tiempo de ejecución
pluginManager.registerPlugin(myCustomPlugin);
```

---

## 📜 5. Licencia y Buenas Prácticas
* **Sin Dependencias Pesadas:** Procura que los plugins sean livianos y no bloqueen la interfaz.
* **Manejo de Errores:** Encapsula las llamadas asíncronas con `try/catch`.
* **Seguridad:** No expongas claves privadas en el cliente.
