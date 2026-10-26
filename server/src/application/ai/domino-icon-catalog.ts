/**
 * Claves de ícono que el cliente de Dominexo sabe pintar (DOMINO_ICONS en el front).
 * Es un subconjunto temático para que la IA elija un ícono acorde al concepto;
 * una clave fuera de esta lista se reemplaza por "star".
 */
export const DOMINO_ICON_CATALOG: readonly string[] = [
  'star', 'heart', 'lightbulb', 'key', 'lock', 'target', 'compass', 'mapPin', 'trophy', 'medal',
  'sun', 'moon', 'leaf', 'sprout', 'tree', 'flower', 'mountain', 'waves', 'droplets', 'wind',
  'cloud', 'cloudRain', 'thermometer', 'recycle', 'zap', 'batteryCharging', 'fuel', 'fish', 'bird',
  'cat', 'dog', 'building', 'home', 'car', 'bus', 'bike', 'train', 'plane', 'ship', 'rocket',
  'factory', 'trash', 'cpu', 'laptop', 'database', 'heartPulse', 'pill', 'brain', 'apple',
  'carrot', 'wheat', 'book', 'bookOpen', 'graduationCap', 'pencil', 'ruler', 'calculator',
  'microscope', 'testTube', 'flaskConical', 'atom', 'dna', 'hammer', 'wrench', 'shieldCheck',
  'smile', 'pawPrint', 'bone', 'building2', 'anchor', 'tent', 'umbrella', 'smartphone', 'wifi', 'monitor',
  'syringe', 'bandage', 'stethoscope', 'egg', 'milk', 'coffee', 'pizza', 'iceCream', 'palette', 'music',
  'camera', 'mic', 'guitar', 'penTool', 'dumbbell', 'scissors',
];

/** Íconos genéricos: solo se aceptan si una palabra clave del concepto los respalda (ej. "amor" -> heart). */
export const DOMINO_GENERIC_ICONS: readonly string[] = ['star', 'heart', 'smile'];

/** Reserva neutra (sin star ni heart) para conceptos sin palabra clave; se elige de forma determinista por nombre. */
export const DOMINO_RESERVE_ICONS: readonly string[] = [
  'lightbulb', 'compass', 'target', 'key', 'book', 'graduationCap', 'pencil', 'shieldCheck', 'medal', 'trophy',
  'brain', 'mapPin', 'palette', 'building', 'hammer', 'wrench',
];
