// 🔧 REFACTOR: Utilidades centralizadas para saber si un registro (orden, vale, etc.)
// "pertenece" al usuario actual. ANTES esto se hacía comparando texto (nombres), lo que
// se rompía cada vez que alguien editaba su nombre completo en "Mi Perfil" o en la gestión
// de usuarios. AHORA se compara por el `id` (uuid) del usuario, que nunca cambia.
//
// Para no perder compatibilidad con filas viejas que todavía no tienen el *_id relleno
// (antes de correr la migración, o si el backfill no encontró match), cada función cae
// de vuelta a comparar por nombre como último recurso.

/**
 * ¿El usuario actual es uno de los "dueños" de un campo que puede tener varios
 * (ej. ordenes.vendedor, un string separado por comas con varios nombres)?
 *
 * @param {string[]|null} idsField   ej. order.vendedor_ids (uuid[])
 * @param {string|null} namesField   ej. order.vendedor ("Juan, Pedro")
 * @param {{id?: string, name?: string}} user
 */
export function isUserInList(idsField, namesField, user) {
  if (!user) return false;

  // 1. Comparación robusta por ID (preferida)
  if (Array.isArray(idsField) && idsField.length > 0 && user.id) {
    if (idsField.includes(user.id)) return true;
    // Si hay ids pero ninguno matchea, y el arreglo NO está vacío, confiamos en el id
    // (ya migrado) y no caemos a nombre para evitar falsos positivos por nombres parecidos.
    return false;
  }

  // 2. Respaldo por nombre (solo si el registro todavía no tiene ids, ej. no migrado)
  if (namesField && user.name) {
    return namesField.includes(user.name);
  }

  return false;
}

/**
 * ¿El usuario actual es el "dueño" de un campo simple (uno solo, no lista)?
 * ej. vales_caja.vendedor_id / vales_caja.vendedor
 *
 * @param {string|null} idField     ej. vale.vendedor_id
 * @param {string|null} nameField   ej. vale.vendedor
 * @param {{id?: string, name?: string}} user
 */
export function isUserMatch(idField, nameField, user) {
  if (!user) return false;

  if (idField) {
    return user.id ? idField === user.id : false;
  }

  if (nameField && user.name) {
    return nameField === user.name;
  }

  return false;
}

/**
 * Convierte el estado local del formulario (lista de vendedores seleccionados,
 * guardados hoy como nombres separados por comas) en los dos campos que hay
 * que guardar: el string de nombres (para mostrar) y el arreglo de ids (para filtrar).
 *
 * @param {string[]} selectedUserIds  ids de los usuarios seleccionados en el form
 * @param {{id: string, full_name: string}[]} staffUsers  lista completa de usuarios/perfiles
 */
export function buildVendedorFields(selectedUserIds, staffUsers) {
  const selected = staffUsers.filter(u => selectedUserIds.includes(u.id));
  return {
    vendedor: selected.map(u => u.full_name).join(', '),
    vendedor_ids: selected.map(u => u.id),
  };
}
