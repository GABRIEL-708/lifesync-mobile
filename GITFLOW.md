# GitFlow — LifeSync Mobile

Este documento define la estrategia de ramas, convención de commits y reglas de integración para el proyecto LifeSync Mobile.

---

## 🌿 Estrategia de Ramas

```
main
 └── develop
      ├── feature/sprint1-auth
      ├── feature/sprint2-habits
      ├── hotfix/fix-login-crash
      └── release/v1.0.0
```

| Rama             | Propósito                                                  | Regla de merge           |
|------------------|------------------------------------------------------------|--------------------------|
| `main`           | Código en producción, siempre estable                      | Solo desde `release/*` o `hotfix/*` via PR |
| `develop`        | Rama de integración; refleja el estado del próximo release | Solo via PR aprobado     |
| `feature/*`      | Desarrollo de nuevas funcionalidades                       | PR → `develop`           |
| `hotfix/*`       | Correcciones urgentes en producción                        | PR → `main` **y** `develop` |
| `release/*`      | Preparación de release (versionado, QA final)              | PR → `main` y `develop`  |

---

## 🔀 Reglas de Pull Request

1. **Todo merge a `develop` o `main` requiere un PR aprobado** — no se admiten pushes directos.
2. El PR debe pasar los checks de CI (lint, tests) antes de poder ser mergeado.
3. Al menos **1 aprobación** de un miembro del equipo es obligatoria.
4. El título del PR debe seguir la convención de commits (ver abajo).
5. Squash merge en PRs de `feature/*`; merge commit en `release/*` y `hotfix/*`.

---

## ✍️ Convención de Commits

Seguimos [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipo>(<alcance opcional>): <descripción breve en imperativo>

[cuerpo opcional]

[footer opcional, e.g. BREAKING CHANGE o referencias a issues]
```

### Tipos permitidos

| Tipo       | Cuándo usarlo                                               |
|------------|-------------------------------------------------------------|
| `feat`     | Nueva funcionalidad para el usuario                         |
| `fix`      | Corrección de un bug                                        |
| `docs`     | Cambios solo en documentación                               |
| `chore`    | Tareas de mantenimiento, dependencias, configuración        |
| `test`     | Agregar o corregir tests                                    |
| `refactor` | Refactorización sin cambio de comportamiento                |
| `style`    | Cambios de formato/estilo (no afectan la lógica)            |
| `perf`     | Mejoras de rendimiento                                      |
| `ci`       | Cambios en pipelines de CI/CD                               |

### Ejemplos

```bash
feat(auth): agregar endpoint POST /api/auth/register
fix(login): corregir validación de contraseña vacía
docs(readme): actualizar instrucciones de instalación
chore(deps): actualizar bcryptjs a 2.4.3
test(auth): agregar tests de integración para login
```

---

## 🔄 Flujo de Trabajo para un Feature

A continuación se muestra el flujo completo para desarrollar un feature nuevo desde `develop`:

```bash
# 1. Asegúrate de estar en develop y tenerla actualizada
git checkout develop
git pull origin develop

# 2. Crea una rama de feature con nombre descriptivo
git checkout -b feature/sprint2-habits

# 3. Desarrolla tu funcionalidad en commits atómicos
git add src/models/Habit.js
git commit -m "feat(habits): agregar modelo Habit con campos nombre y frecuencia"

git add src/routes/habitRoutes.js
git commit -m "feat(habits): agregar rutas CRUD para hábitos"

# 4. Mantén tu rama actualizada con develop (rebase preferido)
git fetch origin
git rebase origin/develop

# 5. Sube tu rama al remoto
git push origin feature/sprint2-habits

# 6. Abre un Pull Request en GitHub/GitLab
#    - Base: develop
#    - Compare: feature/sprint2-habits
#    - Título: "feat(habits): módulo CRUD de hábitos - Sprint 2"
#    - Descripción: lista los cambios y referencia el issue

# 7. Tras aprobación y merge, borra la rama
git branch -d feature/sprint2-habits
git push origin --delete feature/sprint2-habits
```

---

## 🚑 Flujo de Hotfix

```bash
# 1. Crear hotfix desde main
git checkout main
git pull origin main
git checkout -b hotfix/fix-token-expiry

# 2. Corregir y commitear
git commit -m "fix(auth): corregir tiempo de expiración de JWT"

# 3. PR → main   (merge commit)
# 4. PR → develop (para que el fix llegue al flujo normal)

# 5. Tag en main tras merge
git tag -a v1.0.1 -m "hotfix: corregir expiración de JWT"
git push origin v1.0.1
```

---

## 🏷️ Versionado

Se sigue [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`

- `MAJOR`: cambios incompatibles con versiones anteriores
- `MINOR`: nuevas funcionalidades compatibles hacia atrás (un Sprint completo)
- `PATCH`: correcciones de bugs (hotfixes)
