import { FoodCatalogError } from '../../domain/errors/FoodCatalogError'

/**
 * Konvertiert FoodCatalogError in benutzerfreundliche UI-Nachrichten
 * 
 * Unterscheidet zwischen:
 * - "Keine Ergebnisse" (normaler Fall, kein Fehler)
 * - "Service nicht erreichbar" (network, edge, rate_limit - retry möglich)
 * - "Ungültige Anfrage" (invalid_payload - kein retry)
 */
export function getCatalogErrorMessage(error: unknown): {
  message: string
  isServiceDown: boolean
  canRetry: boolean
} {
  // Wenn kein FoodCatalogError, behandle als unbekannten Service-Fehler
  if (!(error instanceof FoodCatalogError)) {
    return {
      message: 'Ein unerwarteter Fehler ist aufgetreten',
      isServiceDown: true,
      canRetry: true,
    }
  }

  switch (error.kind) {
    case 'network':
      return {
        message: 'Netzwerkfehler - bitte überprüfe deine Internetverbindung',
        isServiceDown: true,
        canRetry: true,
      }

    case 'edge':
      return {
        message: 'Food-Datenbank vorübergehend nicht erreichbar',
        isServiceDown: true,
        canRetry: true,
      }

    case 'rate_limit':
      return {
        message: 'Zu viele Anfragen - bitte warte einen Moment',
        isServiceDown: true,
        canRetry: true,
      }

    case 'invalid_payload':
      return {
        message: 'Ungültige Suchanfrage - bitte versuche eine andere Eingabe',
        isServiceDown: false,
        canRetry: false,
      }

    case 'unknown':
    default:
      return {
        message: 'Food-Suche fehlgeschlagen - bitte versuche es später erneut',
        isServiceDown: true,
        canRetry: true,
      }
  }
}

/**
 * Bestimmt, ob ein Fehler einen "No Results" Fall darstellt (null result)
 * oder einen echten Service-Fehler (exception)
 */
export function isNoResultsCase(result: unknown, error: unknown): boolean {
  // Wenn ein Fehler vorliegt, ist es kein "No Results" Fall
  if (error) {
    return false
  }

  // Wenn result null ist, haben wir "No Results"
  return result === null
}
