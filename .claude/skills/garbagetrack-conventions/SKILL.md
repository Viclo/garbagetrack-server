---
name: garbagetrack-conventions
description: |
  Convenciones de arquitectura y código escalable de los dos proyectos de
  Ivan: el backend "garbagetrack-server" (NestJS + TypeORM + PostgreSQL,
  multi-tenant) y el frontend "garbagetrack-admin" (Next.js 15 App Router +
  TypeScript + Tailwind). Usar esta skill SIEMPRE que se escriba o revise
  código dentro de cualquiera de estos dos repos: al crear un módulo nuevo,
  un endpoint, un DTO, una entity, un componente, un hook, un servicio, o al
  tocar autenticación, multi-tenancy, formularios o el cliente HTTP. También
  usarla cuando Ivan pida "seguir el mismo patrón que ya tenemos", "cómo
  estructuro esto", "agregá un CRUD de X", o pida revisar si algo está
  escrito de forma consistente con el resto del proyecto — incluso si no
  menciona la skill por nombre. No aplica a otros proyectos de Ivan que no
  sean estos dos.
---

# Convenciones de GarbageTrack (server + admin)

Estas son las convenciones que Ivan ya sigue en sus dos proyectos reales.
El objetivo de esta skill no es imponer reglas nuevas, sino que el código
que Claude genere sea indistinguible del que Ivan ya escribió — mismo
nivel de estructura, mismos nombres, mismas decisiones de seguridad.

Antes de escribir código en cualquiera de los dos repos, identificá en cuál
de los dos estás (por el `package.json`, la presencia de `@nestjs/*` vs
`next`, o porque Ivan lo dice) y aplicá la sección correspondiente.

---

## Backend — garbagetrack-server (NestJS)

### Estructura de un módulo

Cada feature es un módulo NestJS con esta forma fija. Un módulo nuevo (por
ejemplo "invoices") debería verse así:

```
modules/invoices/
├── invoices.module.ts
├── controllers/invoices.controller.ts
├── services/invoices.service.ts
├── entities/invoice.entity.ts
├── interfaces/invoice.interface.ts
└── dtos/
    ├── inputs/create-invoice.input.ts
    ├── inputs/update-invoice.input.ts
    └── outputs/invoice.output.ts
```

- **`entities/`**: la clase TypeORM (`@Entity`). Es lo único que conoce la
  forma real de la tabla.
- **`interfaces/`**: el tipo plano que el servicio expone hacia afuera
  (`IInvoice`), con prefijo `I`. No es la entity — es una proyección segura
  de ella (ver la regla de seguridad más abajo).
- **`dtos/inputs/`**: una clase por operación de escritura
  (`CreateInvoiceInput`, `UpdateInvoiceInput`), decorada con `class-validator`
  (`@IsString`, `@IsOptional`, `@MinLength`, `@IsDateString`, etc.) y con
  `@nestjs/swagger` (`@ApiProperty` / `@ApiPropertyOptional`, con `example`
  cuando ayuda a entender el formato). Si un campo permite `null` explícito
  además de estar ausente, usá `@ValidateIf((_, v) => v !== null)` antes del
  validador de tipo — así se puede distinguir "no lo toques" de "bórralo".
- **`dtos/outputs/`**: la forma exacta que Swagger documenta como respuesta.
- **`controllers/`**: fino. Solo mapea rutas HTTP a llamadas del service, con
  decorators de auth/rol y `@ApiOperation({ summary: ... })` en cada método.
- **`services/`**: toda la lógica de negocio y el acceso a datos vive acá.

### Regla de seguridad: nunca devolver la entity cruda

Un service nunca retorna la entity de TypeORM directamente — siempre pasa
por un método privado `toInterface()` que arma la `IInvoice` explícitamente
campo por campo. Esto no es una formalidad: en este proyecto ya evitó un bug
real donde `GET /drivers` devolvía el `passwordHash` de cada conductor
porque el tipo de retorno decía `IDriver` pero TypeScript no puede borrar
campos de más en tiempo de ejecución — solo el mapeo explícito lo hace.

Cuando crees un service nuevo, escribí el `toInterface()` aunque hoy la
entity no tenga ningún campo sensible: es la red de seguridad para el día
que alguien le agregue uno.

### Regla de seguridad: scoping multi-tenant

El proyecto es multi-tenant: casi todas las tablas tienen `tenant_id`, y
casi toda query a un repository debe ir filtrada por
`this.tenantContext.tenantId` (inyectando `TenantContextService`). Esto es
lo que evita que el admin del Tenant A vea o edite datos del Tenant B.

Si escribís un método que necesita ser unscoped (por ejemplo, buscar un
usuario por username antes de saber a qué tenant pertenece, para el login),
es una excepción real pero peligrosa — documentala igual que el resto del
código ya lo hace: un comentario JSDoc explicando por qué no lleva scope, y
una advertencia de que ese método nunca debe exponerse directo a través de
un controller. Si estás agregando una query nueva a un módulo existente y
no es obvio si debería llevar `tenantId`, la respuesta por defecto es que sí.

### Entities

`@Column({ name: 'snake_case_en_la_db' })` con la property en camelCase del
lado TypeScript. Cuando el tipo de una columna no es la elección obvia (por
ejemplo `type: 'date'` en vez de timestamp para algo que vence en un día
calendario, no en un instante), dejá un comentario corto explicando el
motivo — no hace falta para columnas obvias como `name` o `isActive`.

### Respuesta HTTP uniforme

No se arma la respuesta a mano en cada endpoint. Un `ResponseInterceptor`
global envuelve toda respuesta exitosa como
`{ success: true, data, timestamp, path }`, y un `HttpExceptionFilter`
global envuelve todo error como
`{ success: false, error: { statusCode, message, error }, timestamp, path }`.
Los tipos viven en `common/interfaces/api-response.interface.ts`. Un
controller nuevo simplemente retorna el dato — nunca arma el sobre a mano.

### Auth y guards reutilizables

- `@Public()` sobre un endpoint lo exceptúa del `JwtAuthGuard` global.
- `@Roles(UserRole.ADMIN)` + `RolesGuard` para autorización por rol.
- `@CurrentUser()` como param decorator para leer el JWT del request.

Reusá estos tres antes de inventar un mecanismo de auth nuevo para un
endpoint.

### Migraciones

`synchronize: false` siempre — el schema se gestiona por migraciones, que
corren automáticamente al boot (`migrationsRun: true`), así que un deploy
de código despliega también el schema. Después de tocar una entity, el paso
es generar la migración (`npm run migration:generate`), no editar el schema
a mano.

### Testing (gap a tener en cuenta)

El proyecto tiene Jest completamente configurado (incluidos los alias de
paths `@common`, `@config`, `@modules`) pero hoy no existe ningún archivo
`*.spec.ts` — cero tests automatizados. No es una convención a replicar: si
estás tocando lógica de negocio no trivial (cálculos, reglas de scoping,
validaciones con ramas), vale la pena proponerle a Ivan agregar un test
junto con el cambio, aprovechando que la infraestructura ya está lista.

---

## Frontend — garbagetrack-admin (Next.js 15 App Router)

### Estructura de un módulo

`app/` solo contiene rutas: cada `page.tsx` es un wrapper delgado agrupado
por route group (`(admin)`, `(auth)`, `(driver)`, `(resident)`) que renderiza
un componente de `modules/`. Toda la lógica real vive en
`src/modules/<feature>/`, con esta forma (las subcarpetas que no hagan
falta para esa feature se omiten):

```
modules/invoices/
├── components/InvoicesView.tsx
├── components/InvoiceForm.tsx
├── interfaces/invoice.interface.ts
├── services/invoices.service.ts
├── hooks/useInvoiceSomething.ts   (si hace falta estado/efecto reusable)
└── utils/                          (si hace falta lógica pura del dominio)
```

### Interfaces y su relación con el backend

Igual que en el server, las interfaces llevan prefijo `I`
(`IInvoice`, `ICreateInvoiceInput`). Hoy no hay un paquete de tipos
compartido entre frontend y backend — cada lado define su propia interface
a mano, espejando la forma del DTO/output del server correspondiente. Al
agregar un campo nuevo en el backend, acordate de reflejarlo también acá;
es la parte manual de este approach y vale la pena chequearla dos veces.

### Servicios

Son funciones async simples (no clases), una por operación, que llaman al
cliente `api` (wrapper de axios en `common/utils/api.ts`) y lo desenvuelven
con `unwrap()`, que extrae `.data` del sobre `IApiResponse`. El manejo de
sesión expirada (401) está centralizado en el interceptor de axios, no se
repite en cada servicio.

```ts
export async function fetchInvoices(): Promise<IInvoice[]> {
  return unwrap(await api.get<IApiResponse<IInvoice[]>>('/invoices'));
}
```

### Formularios

`react-hook-form` + `zod` + `@hookform/resolvers`. Cuando el schema de
creación y el de edición difieren (por ejemplo, password opcional al
editar), se derivan uno del otro con `.omit()` / `.extend()` de zod en vez
de duplicar todo el schema:

```ts
const createSchema = z.object({ password: z.string().min(8), /* ... */ });
const editSchema = createSchema
  .omit({ password: true })
  .extend({ password: z.string().min(8).optional().or(z.literal('')) });
```

### Design system

Los componentes de UI genéricos (`Button`, `Input`, `Modal`, `Card`,
`Table`, etc.) viven en `common/components/ui/` con variantes tipadas
(`type ButtonVariant = 'primary' | 'secondary' | ...`) en vez de props
booleanas sueltas. Cuando una decisión de estilo no es obvia a simple
vista (por qué un botón "Cancelar" es gris y no del color de marca, por
ejemplo), se deja un comentario corto explicándola — la próxima persona que
toque ese componente no debería tener que adivinar ni "corregirlo" de vuelta
a lo obvio.

### Rutas y aliases

Path aliases `@common/*` y `@modules/*` — nunca imports relativos largos
tipo `../../../common/utils/api`. El `middleware.ts` centraliza auth y
ruteo por rol; si agregás una ruta nueva bajo un prefijo existente
(`/invoices` bajo el mismo paraguas que `/drivers`), no hace falta tocar el
middleware. Si agregás un prefijo nuevo, el matching es por segmento de
path completo, no por `startsWith` ingenuo — así `/driver` no captura
`/drivers` por accidente.

### Testing (gap a tener en cuenta)

No hay ningún framework de testing configurado en este proyecto (sin Jest,
sin Vitest, sin Testing Library). Mismo criterio que en el backend: no es
bloqueante, pero si estás agregando lógica no trivial (un hook con estado
complejo, un cálculo, una validación con varias ramas), es razonable
mencionárselo a Ivan como algo a considerar, no algo a imponer en silencio.

---

## Regla transversal: comentarios que explican el porqué

En ambos proyectos, los comentarios existen para explicar una decisión que
no sería obvia leyendo solo el código — nunca para describir lo que el
código ya dice por sí mismo. Ejemplos reales: por qué un campo es `date` y
no `timestamp`, por qué un método no lleva scope de tenant, por qué un botón
secundario es gris. Al escribir código nuevo, aplicá el mismo criterio: si
alguien podría preguntar "¿por qué se hizo así y no de la otra forma obvia?",
dejá una o dos líneas contestando esa pregunta. Si el código se explica solo,
no hace falta comentario.
