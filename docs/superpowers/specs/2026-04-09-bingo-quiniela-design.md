# Bingo Quiniela — Diseño del Sistema

**Fecha:** 2026-04-09  
**Stack:** Next.js 14 + Supabase + Vercel  
**Estado:** Aprobado

---

## Resumen

Plataforma web donde los usuarios compran cartones de bingo que se validan semanalmente usando los resultados de la quiniela nocturna argentina. El dueño retiene el 20% de cada venta; el 80% restante va al pozo de premios. El ganador se lleva el pozo acumulado; si hay múltiples ganadores, reparten en partes iguales.

---

## Mecánica del juego

### El cartón
- Estilo italiano: 3 filas × 9 columnas, 15 números distribuidos aleatoriamente
- Números del 1 al 90
- Cada fila tiene 5 números y 4 casillas vacías
- Diseño visual: fondo beige (`#f5f0e8`), números en marrón (`#5c4a2a`), marcados en marrón oscuro (`#8b7355`)

### Validación con quiniela
- Se toman los **últimos 2 dígitos** de cada número ganador del sorteo
- Se filtran: solo cuentan números entre **1 y 90**
- Se descartan: `00` y del `91` al `99`
- Fuente: **quiniela nocturna únicamente** (un sorteo por día)

### Calendario semanal
| Día | Fuente del sorteo |
|---|---|
| Lunes | Quiniela Nacional Nocturna + Provincial Nocturna |
| Martes | Quiniela Nacional Nocturna + Provincial Nocturna |
| Miércoles | Solo Quiniela Nacional Nocturna |
| Jueves | Solo Quiniela Nacional Nocturna |
| Viernes | Solo Quiniela Nacional Nocturna |
| Sábado | Cierre — sin sorteo |

### Premios
- **Línea** (primera fila completa): 10% del pozo total. El juego continúa.
- **Bingo completo** (cartón lleno): 90% del pozo total. El juego cierra.
- Si hay múltiples ganadores del mismo premio: reparto igualitario.
- Si nadie completa el cartón al finalizar la semana: el pozo acumula al siguiente juego (rollover).
- El premio de línea también acumula si nadie gana línea esa semana.

### Precio y comisión
- Precio por cartón: configurable (valor inicial $2.000)
- Comisión del admin: **20% de cada venta** se retiene antes de ingresar al pozo
- El pozo recibe el **80% de cada cartón vendido**
- Sin límite de cartones por usuario por semana

---

## Arquitectura

### Stack tecnológico
- **Frontend + API:** Next.js 14 (App Router) — un solo repositorio
- **Base de datos + Auth + Realtime:** Supabase (PostgreSQL)
- **Pagos:** Mercado Pago SDK (webhook automático) + transferencia bancaria (confirmación manual)
- **Emails:** Resend — envío de cartón, confirmación de compra, notificación de ganadores
- **Cron jobs:** Vercel Cron — scraping nocturno automático (~22hs)
- **Deploy:** Vercel

### Autenticación
- Google OAuth
- Email + contraseña
- Sesión persistente (Supabase Auth)

---

## Modelo de datos

```sql
users
  id, email, name, avatar_url, created_at

games
  id, week_start (date), week_end (date),
  status (active | line_won | closed | paying),
  jackpot_amount (numeric),   -- pozo acumulado del cartón lleno
  line_amount (numeric),      -- pozo acumulado para línea
  card_price (numeric),
  commission_pct (numeric)    -- porcentaje del admin (20)

cards
  id, game_id, user_id,
  numbers (int[15]),          -- 15 números generados aleatoriamente
  paid (bool), payment_method (mercadopago | transfer),
  payment_ref (text),         -- MP payment_id o referencia manual
  created_at

payments
  id, card_id, method, status (pending | approved | rejected),
  mp_payment_id, transfer_img_url, approved_at, approved_by

drawn_numbers
  id, game_id, number (int),
  source (nacional | provincial),
  draw_date (date), created_at

card_marks
  id, card_id, number        -- números tachados en ese cartón

winners
  id, card_id, game_id,
  prize_type (line | full),
  amount (numeric),           -- monto que le corresponde
  paid_out (bool), paid_at
```

**Lógica clave:**
- El pozo se calcula como `SUM(card price * 0.80)` sobre todos los cartones pagados del juego
- Cuando un cron inserta en `drawn_numbers`, se actualizan `card_marks` para todos los cartones del juego
- Supabase Realtime notifica a todos los navegadores conectados al instante
- La detección de ganadores corre después de cada actualización de `card_marks`

---

## Flujos principales

### Compra de cartón
1. Usuario elige cantidad de cartones
2. Elige método de pago: Mercado Pago o transferencia bancaria
3. **MP:** redirige al checkout de MP → webhook confirma automáticamente
4. **Transferencia:** usuario sube comprobante → admin lo aprueba manualmente en el panel
5. Sistema genera cartones con números aleatorios (sin repetición, respetando la distribución por columna del bingo italiano)
6. Envía cartones por email (Resend) y los muestra en el perfil del usuario

### Scraping nocturno (~22hs, Vercel Cron)
1. Cron llama a `/api/cron/draw`
2. Scrapea los resultados de la quiniela nocturna (nacional y/o provincial según el día)
3. Extrae últimos 2 dígitos, filtra 1–90
4. Inserta en `drawn_numbers`
5. Actualiza `card_marks` en bulk para todos los cartones activos
6. Detecta si algún cartón completó una línea o el cartón completo
7. Si hay ganadores: inserta en `winners`, actualiza `games.status`, envía emails
8. Supabase Realtime propaga cambios a todos los clientes conectados

### Fallback manual
- Si el scraper falla, el admin carga los números desde el panel
- Se ejecuta el mismo proceso de validación

---

## Panel de administración

**Juego activo:**
- Pozo actual, cartones vendidos, recaudación total, ganancia del admin

**Pagos:**
- Lista de transferencias pendientes con imagen del comprobante
- Aprobar / rechazar con un click
- Historial de pagos MP (estados del webhook)

**Ganadores:**
- Lista de ganadores detectados (línea y bingo)
- Marcar como pagado una vez transferido el premio

**Carga manual de resultados:**
- Formulario para ingresar números si el scraper falla
- Campo: fuente (nacional/provincial), fecha, números

**Configuración:**
- Precio del cartón
- Porcentaje de comisión
- CBU / alias para transferencias bancarias
- Credenciales de Mercado Pago (Access Token)

---

## Scraping de quiniela

**Fuente primaria:** scraping de sitio público de resultados de quiniela argentina  
**Fuente de respaldo:** carga manual por el admin  
**Horario:** cron job a las 22:00hs (después del cierre del sorteo nocturno)  
**Reintentos:** 3 intentos con backoff de 5 minutos si falla  
**Alerta:** email al admin si los 3 intentos fallan

---

## Consideraciones legales y de seguridad

- Los pagos nunca se almacenan en el sistema propio — se delega a Mercado Pago
- Las imágenes de comprobantes de transferencia se guardan en Supabase Storage (acceso privado)
- Row Level Security (RLS) en Supabase: cada usuario solo ve sus propios cartones
- El panel de admin requiere rol `admin` verificado en Supabase Auth
- Webhooks de MP verificados con firma HMAC
- Los cartones se generan server-side — el usuario nunca puede elegir ni manipular sus números

---

## Lo que está fuera del alcance (v1)

- App móvil nativa
- Múltiples juegos simultáneos
- Chat entre jugadores
- Estadísticas avanzadas de jugadores
- Integración con otras loterías
