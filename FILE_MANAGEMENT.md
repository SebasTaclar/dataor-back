# Gestión de Archivos - Guía de Implementación

## Tipos de Datos

```typescript
// Input: lo que llega del frontend
type UploadFile = {
  buffer: Buffer;    // Contenido del archivo
  name: string;      // Nombre original (ej: "documento.pdf")
  type: string;      // MIME type (ej: "application/pdf")
};

// Output: lo que se guarda en BD
type StoredFile = {
  name: string;      // Nombre original
  type: string;      // MIME type
  key: string;       // Ruta en R2 (ej: "clients/42-a1b2c3.pdf")
  url: string;       // URL pública completa
};
```

---

## Flujo: Crear Cliente con Archivos

```
1. Frontend envía POST /clients (multipart/form-data)
   - Campos: name, email, phone, country, files[]

2. Backend parsea multipart con Busboy
   - Extrae campos de texto → ClientRequest
   - Extrae archivos → UploadFile[]

3. ClientService.createClient(data, files)
   - Crea cliente en BD → obtiene client.id
   - Por cada archivo:
     a. FileStorageService.upload('clients', client.id, file)
        - Genera key: "clients/{entityId}-{uuid}.{ext}"
        - Sube a Cloudflare R2
        - Retorna StoredFile { name, type, key, url }
   - Guarda StoredFile[] en campo JSON "files" del cliente
```

---

## Flujo: Agregar/Eliminar Archivos (Endpoints Genéricos)

### Agregar archivo
```
POST /v1/files/clients/{entityId}
Body: multipart/form-data con campo "files"

→ ClientService.addFilesToClient(clientId, files)
  - Obtiene archivos actuales del cliente
  - Sube nuevos archivos a R2
  - Agrega al array existente
  - Actualiza BD
  - Retorna cliente actualizado
```

### Eliminar archivo
```
DELETE /v1/files/clients/{entityId}/{fileKey}
Authorization: Bearer {token}

→ ClientService.removeFileFromClient(clientId, fileKey)
  - Busca archivo por key en el array
  - Elimina de Cloudflare R2
  - Elimina del array
  - Actualiza BD
  - Retorna cliente actualizado
```

**Nota:** La ruta usa `{*fileKey}` para capturar slashes en la key (ej: `clients/42-abc123.pdf`).

---

## Variables de Entorno

```env
R2_ACCOUNT_ID=tu_account_id          # ID de cuenta Cloudflare
R2_ACCESS_KEY_ID=tu_access_key       # API access key
R2_SECRET_ACCESS_KEY=tu_secret_key   # API secret key
R2_BUCKET_NAME=tu_bucket             # Nombre del bucket
R2_PUBLIC_URL=https://pub-xxx.r2.dev # URL pública del bucket
```

---

## Dependencias npm

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner busboy uuid
```

| Paquete | Propósito |
|---------|-----------|
| `@aws-sdk/client-s3` | Cliente S3-compatible para R2 |
| `@aws-sdk/s3-request-presigner` | URLs presignadas (opcional) |
| `busboy` | Parseo de multipart/form-data |
| `uuid` | Generación de keys únicos |

---

## Archivos a Copiar

Para implementar en otro proyecto, copiar estos archivos:

```
src/
├── domain/
│   ├── entities/
│   │   └── StoredFile.ts              # Tipos UploadFile y StoredFile
│   └── interfaces/
│       ├── IFileStorageDataSource.ts   # Interface de storage
│       └── IR2DataSource.ts           # Interface de R2
├── infrastructure/
│   └── services/
│       ├── FileStorageService.ts       # Lógica de upload/delete
│       └── CloudflareR2Service.ts     # Integración con R2
```

---

## Adaptar a Otra Entidad (ej: Product)

### 1. Agregar campo JSON en el modelo Prisma

```prisma
model Product {
  id          Int      @id @default(autoincrement())
  name        String
  // ... otros campos
  files       Json?    # Agregar este campo
}
```

### 2. Crear métodos en el servicio

```typescript
// ProductService.ts
async addFilesToProduct(productId: number, files: UploadFile[]): Promise<ProductResponse> {
  const product = await this.productDataSource.getById(productId);
  if (!product) throw new NotFoundError('Product not found');

  const currentFiles = (product.files as StoredFile[]) || [];
  const uploadedFiles: StoredFile[] = [];

  for (const file of files) {
    const storedFile = await this.fileStorage.upload('products', productId, file);
    uploadedFiles.push(storedFile);
  }

  const updatedFiles = [...currentFiles, ...uploadedFiles];
  await this.productDataSource.updateFiles(productId, updatedFiles);
  return this.getProductById(productId);
}

async removeFileFromProduct(productId: number, fileKey: string): Promise<ProductResponse> {
  const product = await this.productDataSource.getById(productId);
  if (!product) throw new NotFoundError('Product not found');

  const currentFiles = (product.files as StoredFile[]) || [];
  const fileToRemove = currentFiles.find(f => f.key === fileKey);
  if (!fileToRemove) throw new NotFoundError('File not found');

  await this.fileStorage.deleteMany([fileToRemove]);
  const updatedFiles = currentFiles.filter(f => f.key !== fileKey);
  await this.productDataSource.updateFiles(productId, updatedFiles);
  return this.getProductById(productId);
}
```

### 3. Crear endpoint funcProductsFiles (o agregar a funcProducts)

```typescript
// POST /v1/files/products/{entityId} → addFilesToProduct
// DELETE /v1/files/products/{entityId}/{fileKey} → removeFileFromProduct
```

---

## Arquitectura

```
Frontend (multipart)
    │
    ▼
Azure Function (parsea con Busboy)
    │
    ▼
Service (addFiles/removeFile)
    │
    ▼
FileStorageService
    ├── upload() → genera key → sube a R2 → retorna StoredFile
    └── deleteMany() → elimina de R2
    │
    ▼
CloudflareR2Service
    └── S3Client (AWS SDK v3, compatible S3)
    │
    ▼
Cloudflare R2 Bucket → URL pública
```

---

## Respuesta del Backend

Al subir/eliminar archivos, el backend retorna el cliente/producto actualizado con su array `files`:

```json
{
  "success": true,
  "data": {
    "id": 16,
    "name": "Juan García",
    "files": [
      {
        "name": "documento.pdf",
        "type": "application/pdf",
        "key": "clients/16-a1b2c3d4.pdf",
        "url": "https://pub-xxx.r2.dev/clients/16-a1b2c3d4.pdf"
      }
    ]
  }
}
```

Para eliminar un archivo, usar el campo `key` completo como parte de la URL:
```
DELETE /v1/files/clients/16/clients/16-a1b2c3d4.pdf
```

---

## Ejemplos para Frontend (Postman/cURL)

### Crear cliente con archivos

**Postman:**
- Method: `POST`
- URL: `{{url}}/api/clients`
- Body → form-data:
  - Key: `name` | Type: Text | Value: `Juan García`
  - Key: `email` | Type: Text | Value: `juan@test.com`
  - Key: `phone` | Type: Text | Value: `+57 300 123 4567`
  - Key: `country` | Type: Text | Value: `Colombia`
  - Key: `files` | Type: File | Value: `(seleccionar documento.pdf)`
  - Key: `files` | Type: File | Value: `(seleccionar foto.jpg)`

**cURL:**
```bash
curl -X POST {{url}}/api/clients \
  -F "name=Juan García" \
  -F "email=juan@test.com" \
  -F "phone=+57 300 123 4567" \
  -F "country=Colombia" \
  -F "files=@./documento.pdf" \
  -F "files=@./foto.jpg"
```

---

### Obtener cliente con sus archivos

**Postman:**
- Method: `GET`
- URL: `{{url}}/api/clients/16`
- Authorization: Bearer {{token}}

**cURL:**
```bash
curl -X GET {{url}}/api/clients/16 \
  -H "Authorization: Bearer {{token}}"
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": 16,
    "name": "Juan García",
    "files": [
      {
        "name": "documento.pdf",
        "type": "application/pdf",
        "key": "clients/16-a1b2c3d4-e5f6.pdf",
        "url": "https://pub-xxx.r2.dev/clients/16-a1b2c3d4-e5f6.pdf"
      },
      {
        "name": "foto.jpg",
        "type": "image/jpeg",
        "key": "clients/16-b2c3d4e5-f6a7.jpg",
        "url": "https://pub-xxx.r2.dev/clients/16-b2c3d4e5-f6a7.jpg"
      }
    ]
  }
}
```

---

### Agregar archivo a cliente existente

**Postman:**
- Method: `POST`
- URL: `{{url}}/api/v1/files/clients/16`
- Authorization: Bearer {{token}}
- Body → form-data:
  - Key: `files` | Type: File | Value: `(seleccionar nuevo-documento.pdf)`

**cURL:**
```bash
curl -X POST {{url}}/api/v1/files/clients/16 \
  -H "Authorization: Bearer {{token}}" \
  -F "files=@./nuevo-documento.pdf"
```

**Respuesta:** Retorna el cliente actualizado con el array `files` incluyendo el nuevo archivo.

---

### Eliminar archivo de cliente

**Postman:**
- Method: `DELETE`
- URL: `{{url}}/api/v1/files/clients/16/clients/16-a1b2c3d4-e5f6.pdf`
- Authorization: Bearer {{token}}

**cURL:**
```bash
curl -X DELETE {{url}}/api/v1/files/clients/16/clients/16-a1b2c3d4-e5f6.pdf \
  -H "Authorization: Bearer {{token}}"
```

**Respuesta:** Retorna el cliente actualizado sin el archivo eliminado.

---

### Actualizar datos del cliente (sin archivos)

**Postman:**
- Method: `PATCH`
- URL: `{{url}}/api/clients/16`
- Authorization: Bearer {{token}}
- Body → raw → JSON:
```json
{
  "name": "Juan García Updated",
  "phone": "+57 300 999 8888",
  "monthlyAmount": 75000
}
```

**cURL:**
```bash
curl -X PATCH {{url}}/api/clients/16 \
  -H "Authorization: Bearer {{token}}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Juan García Updated", "phone": "+57 300 999 8888"}'
```

---

### Eliminar cliente (elimina archivos automáticamente)

**Postman:**
- Method: `DELETE`
- URL: `{{url}}/api/clients/16`
- Authorization: Bearer {{token}}

**cURL:**
```bash
curl -X DELETE {{url}}/api/clients/16 \
  -H "Authorization: Bearer {{token}}"
```

---

## Notas para Frontend

1. **Crear cliente**: Solo acepta `multipart/form-data`. Los archivos van como campo `files` tipo File.

2. **Agregar archivos**: Requiere JWT. Solo acepta `multipart/form-data`. Retorna cliente actualizado.

3. **Eliminar archivo**: Requiere JWT. El `fileKey` completo va en la URL (incluye el folder, ej: `clients/16-uuid.pdf`).

4. **Actualizar datos**: Solo acepta `application/json`. No maneja archivos (usar endpoints dedicados).

5. **Listar clientes sin paginación**: `GET /clients` sin parámetros devuelve todos los clientes.

6. **Paginación**: `GET /clients?page=1&limit=10` devuelve con info de paginación.

7. **Los archivos se almacenan como JSON** en el campo `files` del cliente, no en una tabla separada.
