import { useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { FormField } from './create/FormField'
import { useAuth } from '../../../hooks/useAuth'
import { uploadImage, type UploadFolder } from '../../../services/upload.service'
import { ApiError } from '../../../utils/http'

type ImageUploadFieldProps = {
  label: string
  imageUrl: string | null
  folder: UploadFolder
  disabled?: boolean
  onChange: (url: string | null) => void
}

/** Input de imagen con preview inmediata: sube a Cloudinary al elegir el archivo y guarda solo la URL resultante. */
export function ImageUploadField({
  label,
  imageUrl,
  folder,
  disabled,
  onChange,
}: ImageUploadFieldProps) {
  const { token } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  async function uploadFile(file: File) {
    if (!token) return
    setUploading(true)
    setError(null)
    setProgress(0)
    try {
      const result = await uploadImage(token, file, folder, setProgress)
      onChange(result.url)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo subir la imagen.')
    } finally {
      setUploading(false)
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await uploadFile(file)
  }

  // Arrastrar y soltar, además del click de siempre (issue #234).
  const canDrop = !disabled && !uploading

  function handleDragOver(event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    if (canDrop) setIsDraggingOver(true)
  }

  function handleDragLeave(event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    setIsDraggingOver(false)
  }

  function handleDrop(event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    setIsDraggingOver(false)
    if (!canDrop) return
    const file = event.dataTransfer.files?.[0]
    if (file) void uploadFile(file)
  }

  // Sin "(opcional)" en la etiqueta, la imagen es obligatoria: se marca si falta.
  const isRequired = !/opcional/i.test(label)
  const isMissing = isRequired && !imageUrl && !uploading

  return (
    <FormField label={label}>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        disabled={disabled || uploading}
        onChange={handleFileChange}
      />

      {imageUrl ? (
        <div className="nx-image-preview relative h-24 w-full overflow-hidden rounded-lg border border-border">
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          {!disabled && (
            <button
              type="button"
              className="nx-image-remove absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
              onClick={() => onChange(null)}
              aria-label="Quitar imagen"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          data-nx-image-missing={isMissing ? 'true' : undefined}
          className={`nx-drop relative flex h-24 w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-dashed text-text disabled:cursor-not-allowed disabled:opacity-60 ${
            isDraggingOver ? 'border-accent bg-accent/5' : isMissing ? 'border-danger/60 bg-danger/5' : 'border-border'
          }`}
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-accent" strokeWidth={2} />
          ) : (
            <ImagePlus className="h-5 w-5" strokeWidth={1.75} />
          )}
          <span className="text-[12px]">
            {uploading
              ? progress > 0
                ? `Subiendo… ${progress}%`
                : 'Subiendo…'
              : isDraggingOver
                ? 'Suelta la imagen aquí'
                : isMissing
                  ? 'Falta imagen · agrégala o arrástrala'
                  : 'Agregar imagen o arrástrala aquí'}
          </span>
          {uploading && (
            <span
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label="Progreso de subida"
              className="absolute inset-x-0 bottom-0 h-1 bg-border"
            >
              <span
                className="block h-full w-full origin-left bg-accent transition-transform"
                style={{ transform: `scaleX(${progress / 100})` }}
              />
            </span>
          )}
        </button>
      )}

      {error && (
        <p className="text-[12px] text-danger" role="alert">
          {error}
        </p>
      )}
    </FormField>
  )
}
