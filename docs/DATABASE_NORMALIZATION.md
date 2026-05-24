# Database Normalization: Rent Table Refactoring

## Resumen del Cambio

Se ha normalizado la tabla `rents` para usar foreign keys (`clientId`, `productId`) en lugar de campos duplicados (`clientName`, `clientRut`, `productName`). Esto mejora la integridad referencial y elimina duplicación de datos.

## Cambios Realizados

### 1. Schema de Prisma Actualizado

**Antes:**

```prisma
model Rent {
  id               Int      @id @default(autoincrement())
  code             String
  productName      String   @map("product_name")  // ❌ Campo eliminado
  clientRut        String   @map("client_rut")    // ❌ Campo eliminado
  clientName       String   @map("client_name")   // ❌ Campo eliminado
  // ... otros campos
}
```

**Después:**

```prisma
model Rent {
  id               Int      @id @default(autoincrement())
  code             String
  clientId         Int      @map("client_id")     // ✅ Foreign Key
  productId        Int      @map("product_id")    // ✅ Foreign Key

  // Relaciones
  client           Client   @relation(fields: [clientId], references: [id], onDelete: Restrict)
  product          Product  @relation(fields: [productId], references: [id], onDelete: Restrict)
  // ... otros campos
}
```

### 2. Entidad Rent Actualizada

La entidad mantiene compatibilidad con el frontend incluyendo ambos tipos de campos:

```typescript
export type Rent = {
  id: string;
  code: string;
  // Campos para compatibilidad frontend (poblados via joins)
  productName: string;
  clientRut: string;
  clientName: string;
  // Campos core
  quantity: number;
  totalValuePerDay: number;
  // ... otros campos
  // IDs internos para operaciones de BD
  clientId: number;
  productId: number;
};
```

### 3. Adapters Actualizados

- **RentPrismaAdapter**: Ahora usa `include` para hacer joins automáticos
- **RentMongoDbAdapter**: Mantiene compatibilidad temporal
- **Azure Functions**: Buscan clientId/productId por RUT/nombre del frontend

## Flujo de Datos

### Creación de Renta (funcCreateRent)

1. **Frontend envía:** `{ clientRut: "12345678-9", productName: "Taladro", ... }`
2. **Función busca:**
   - Client por RUT → obtiene `clientId`
   - Product por name → obtiene `productId`
3. **Base de datos almacena:** Solo `clientId` y `productId`
4. **Response al frontend:** Datos completos via joins

### Consulta de Rentas (funcGetRents)

1. **Query con joins:**
   ```sql
   SELECT r.*, c.name as client_name, c.rut, p.name as product_name
   FROM rents r
   JOIN clients c ON r.client_id = c.id
   JOIN products p ON r.product_id = p.id
   ```
2. **Frontend recibe:** Estructura original sin cambios

## Migración de Datos

### Automática (Prisma)

```bash
npx prisma migrate dev --name normalize_rent_relations
```

### Manual (TypeScript)

```bash
npm run ts-node scripts/migrateRentData.ts
```

### SQL Directo

```bash
psql -d dataor_db -f scripts/migrate_existing_rents.sql
```

## Beneficios

### ✅ Integridad Referencial

- No se pueden crear rentas con clientes/productos inexistentes
- Actualizaciones en clients/products se reflejan automáticamente

### ✅ Reducción de Duplicación

- Nombres de clientes/productos se almacenan una sola vez
- Cambios en datos maestros no requieren actualizar rentas

### ✅ Mejor Rendimiento

- Queries más eficientes con joins indexados
- Menor tamaño de tabla `rents`

### ✅ Mantenimiento de Compatibilidad

- Frontend no requiere cambios
- APIs mantienen la misma estructura de respuesta

## Filtros Actualizados

Los filtros ahora funcionan a través de joins:

```typescript
// Antes: Búsqueda directa en rent
{
  clientName: {
    contains: 'García';
  }
}

// Después: Búsqueda con join
{
  client: {
    name: {
      contains: 'García';
    }
  }
}
```

## Validación Post-Migración

### Verificar Completitud

```sql
-- Rentas sin cliente asignado
SELECT COUNT(*) FROM rents WHERE client_id IS NULL;

-- Rentas sin producto asignado
SELECT COUNT(*) FROM rents WHERE product_id IS NULL;
```

### Verificar Integridad

```sql
-- Verificar foreign keys válidos
SELECT r.id FROM rents r
LEFT JOIN clients c ON r.client_id = c.id
WHERE c.id IS NULL;
```

### Verificar Rendimiento

```sql
-- Debe usar índices en joins
EXPLAIN ANALYZE
SELECT r.*, c.name, p.name
FROM rents r
JOIN clients c ON r.client_id = c.id
JOIN products p ON r.product_id = p.id;
```

## Rollback (Si es necesario)

⚠️ **Solo como último recurso:**

```sql
-- Restaurar campos denormalizados
ALTER TABLE rents ADD COLUMN client_name VARCHAR;
ALTER TABLE rents ADD COLUMN client_rut VARCHAR;
ALTER TABLE rents ADD COLUMN product_name VARCHAR;

-- Poblar desde joins
UPDATE rents SET
  client_name = c.name,
  client_rut = c.rut,
  product_name = p.name
FROM clients c, products p
WHERE rents.client_id = c.id
  AND rents.product_id = p.id;
```

## Próximos Pasos

1. ✅ **Completado:** Schema y código actualizado
2. ✅ **Completado:** Migración de datos existentes
3. 🔄 **Pendiente:** Testing exhaustivo con datos reales
4. 🔄 **Pendiente:** Monitoreo de rendimiento en producción
5. 📅 **Futuro:** Eliminar campos legacy después de validación completa

## Testing Recomendado

### Casos de Prueba

- [x] Creación de renta con cliente/producto existente
- [x] Creación de renta con cliente/producto inexistente (debe fallar)
- [x] Actualización de renta cambiando cliente
- [x] Filtros de búsqueda por nombre de cliente/producto
- [x] Paginación con filtros en rentas finalizadas
- [x] Respuesta API mantiene formato original

### Datos de Prueba

```javascript
// Test data que debe funcionar
const testRent = {
  code: 'TEST-001',
  clientRut: '12345678-9', // Debe existir en clients
  productName: 'Taladro Bosch', // Debe existir en products
  clientName: 'Juan Pérez', // Será ignorado (viene del join)
  quantity: 1,
  totalValuePerDay: 5000,
};
```
