# Guía de Tests E2E para TurnosApp

Esta guía describe cómo escribir, ejecutar y mantener los tests end-to-end (E2E) usando Playwright.

## Tabla de Contenidos

1. [Configuración](#configuración)
2. [Estructura de Archivos](#estructura-de-archivos)
3. [Fixtures y Aislamiento](#fixtures-y-aislamiento)
4. [Escribir Nuevos Tests](#escribir-nuevos-tests)
5. [Ejecutar Tests](#ejecutar-tests)
6. [Debugging](#debugging)
7. [Buenas Prácticas](#buenas-prácticas)

---

## Configuración

Los tests E2E corren contra la instancia local de la app. Antes de ejecutar:

```bash
# Asegurar que la DB de test está configurada
yarn test:setup

# Resetear DB de test si es necesario
yarn test:reset-db

# Ejecutar tests E2E
yarn e2e
```

### Configuración de Workers

- **Local**: 2 workers en paralelo
- **CI**: 4 workers en paralelo

Esto se configura en `playwright.config.ts`.

---

## Estructura de Archivos

```
e2e/
├── fixtures/                    # Fixtures compartidos
│   ├── index.ts                 # Re-exporta fixtures básicos
│   ├── auth.fixture.ts          # testUser, authenticatedPage
│   ├── business.fixture.ts      # testBusiness
│   └── booking.fixture.ts       # bookableSetup
├── helpers/                     # Helpers utilitarios
│   ├── auth.helper.ts           # signupUser, loginUser (legacy)
│   ├── business.helper.ts       # createBusiness (legacy)
│   └── unique-id.helper.ts      # generateUniqueId, generateUniqueName
└── *.spec.ts                    # Archivos de test
```

---

## Fixtures y Aislamiento

### Principio Clave

Cada test crea su **propio usuario, negocio y datos**, garantizando aislamiento total y permitiendo ejecución paralela sin conflictos.

### Fixtures Disponibles

#### `testUser` (de `auth.fixture.ts`)

```typescript
// Provee email y password únicos
test('ejemplo', async ({ testUser }) => {
    const { email, password } = testUser
    // email: "e2e-abc123...@test.turnosapp.local"
})
```

#### `authenticatedPage` (de `auth.fixture.ts`)

```typescript
// Página ya logueada con testUser
test('ejemplo', async ({ authenticatedPage }) => {
    const page = authenticatedPage
    // Ya está en /dashboard, usuario logueado
})
```

#### `testBusiness` (de `business.fixture.ts`)

```typescript
// Incluye authenticatedPage + negocio creado
test('ejemplo', async ({ authenticatedPage, testBusiness }) => {
    const { businessId, businessName, slug } = testBusiness
    await authenticatedPage.goto(`/b/${slug}`)
})
```

#### `bookableSetup` (de `booking.fixture.ts`)

```typescript
// Setup completo: negocio + recurso + servicio + disponibilidad
test('ejemplo', async ({ authenticatedPage, bookableSetup }) => {
    const { slug, serviceName, resourceName, serviceId, resourceId } = bookableSetup
    // Listo para probar flujos de reserva
})
```

### Cómo Elegir el Fixture Correcto

| Necesitas                 | Usa                                            |
| ------------------------- | ---------------------------------------------- |
| Solo página logueada      | `authenticatedPage` de `fixtures/auth.fixture` |
| Negocio creado            | `testBusiness` de `fixtures/business.fixture`  |
| Flujo de reserva completo | `bookableSetup` de `fixtures/booking.fixture`  |
| Setup muy específico      | `testBusiness` + código manual                 |

---

## Escribir Nuevos Tests

### Template Básico

```typescript
import { test, expect } from './fixtures/business.fixture'
import { generateUniqueName } from './helpers/unique-id.helper'

test.describe('Mi Feature', () => {
    test('debería hacer X', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const { slug } = testBusiness

        // Navegar
        await page.goto(`/dashboard/${slug}/mi-pagina`)

        // Crear datos únicos si es necesario
        const nombre = generateUniqueName('mi-entidad')

        // Interactuar
        await page.getByLabel(/nombre/i).fill(nombre)
        await page.getByRole('button', { name: /guardar/i }).click()

        // Verificar
        await expect(page.getByText(nombre)).toBeVisible()
    })
})
```

### Para Tests de Booking

```typescript
import { test, expect } from './fixtures/booking.fixture'

test.describe('Booking Feature', () => {
    test('flujo de reserva', async ({ authenticatedPage, bookableSetup }) => {
        const page = authenticatedPage
        const { slug, serviceName } = bookableSetup

        await page.goto(`/b/${slug}`)
        await page.getByText(serviceName).click()
        // ...
    })
})
```

### Tests que Necesitan Múltiples Usuarios

Para tests de multi-tenant o aislamiento, crea contextos adicionales:

```typescript
test('user B no ve datos de user A', async ({ authenticatedPage, testBusiness, browser }) => {
    // User A ya está configurado via fixture
    const businessIdA = testBusiness.businessId

    // Crear User B en contexto separado
    const contextB = await browser.newContext()
    const pageB = await contextB.newPage()

    await signupUser(pageB, generateTestEmail(), 'Password123!')
    // ...

    await contextB.close()
})
```

---

## Ejecutar Tests

### Comandos Principales

```bash
# Todos los E2E
yarn e2e

# Un archivo específico
yarn e2e -- e2e/booking-confirmation.spec.ts

# Un test específico por nombre
yarn e2e -- -g "flujo completo"

# Con UI de Playwright
yarn e2e -- --ui

# Con headed browser (ver el browser)
yarn e2e -- --headed

# Debug mode
yarn e2e -- --debug
```

### Batería Completa (antes de commit)

```bash
yarn test:setup && yarn test && yarn test:reset-db && yarn e2e && yarn lint
```

---

## Debugging

### Ver Qué Está Pasando

```bash
# Modo debug interactivo
yarn e2e -- --debug

# Con browser visible
yarn e2e -- --headed

# Pausar en punto específico (agregar en código)
await page.pause();
```

### Traces y Screenshots

Los traces se guardan automáticamente cuando un test falla. Encontrarlos en:

```
playwright-report/
test-results/
```

Para ver un trace:

```bash
npx playwright show-trace test-results/mi-test/trace.zip
```

### Problemas Comunes

1. **Test flaky (falla intermitente)**
    - Agregar `await page.waitForLoadState('networkidle')`
    - Usar timeouts explícitos: `{ timeout: 10000 }`
    - Verificar que usás datos únicos (UUID)

2. **Elemento no encontrado**
    - Verificar selector con `--headed --debug`
    - Usar selectores más específicos o data-testid

3. **Timeout**
    - Revisar si el server está corriendo
    - Aumentar timeout del test si es necesario

---

## Buenas Prácticas

### DO ✅

- **Usar fixtures** para setup repetitivo
- **Generar IDs únicos** con `generateUniqueName()` o `generateUniqueId()`
- **Importar test/expect** desde fixtures, no desde `@playwright/test`
- **Nombres descriptivos** para tests
- **Selectores accesibles**: `getByRole`, `getByLabel`, `getByText`
- **Esperar estados**: `waitForLoadState`, `waitForURL`

### DON'T ❌

- **No usar** `Date.now()` para IDs (colisiones en paralelo)
- **No hardcodear** emails o nombres de negocio
- **No depender** del orden de ejecución de tests
- **No compartir** estado entre tests
- **No usar** `page.waitForTimeout()` excepto como último recurso

### Ejemplo de Selectores Buenos vs Malos

```typescript
// ✅ BIEN - Accesibles y estables
await page.getByRole('button', { name: /guardar/i }).click()
await page.getByLabel(/nombre/i).fill('Valor')
await page.getByTestId('whatsapp-settings').click()

// ❌ MAL - Frágiles
await page.click('.btn-primary')
await page.locator('#submit-btn').click()
await page.locator('div > div > button').click()
```

---

## Referencia Rápida

### Helpers de UUID

```typescript
import {
    generateUniqueId, // UUID completo
    generateUniqueName, // "prefix-abc123"
    generateTestEmail // "e2e-uuid@test.turnosapp.local"
} from './helpers/unique-id.helper'
```

### Timeouts Configurados

- Global: 60s
- Action: 10s
- Navigation: 15s
- Expect: 5s

### Retries

- Local: 1 retry
- CI: 2 retries
