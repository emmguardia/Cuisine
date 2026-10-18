/**
 * Matériel du club et contrôles d'inventaire.
 *
 *  - Créer une fiche, modifier ses informations (nom, état, photo…) : direct.
 *  - Changer une quantité hors inventaire ou sortir une fiche : demande à
 *    double validation (handlers « equipment.adjust » / « equipment.retire »).
 *  - Contrôle d'inventaire : on compte, les écarts ressortent, on décide pour
 *    chacun (perdu, cassé, retrouvé, à recompter) ; la validation applique les
 *    mouvements correspondants.
 */
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { getPool } from '../config/database.js';
import { audit } from '../lib/audit.js';
import { HttpError } from '../lib/errors.js';
import { sniffMime } from './compta.js';

export const CATEGORIES = {
  ustensiles:     'Ustensiles',
  couteaux:       'Couteaux',
  cuisson:        'Casseroles et poêles',
  electromenager: 'Électroménager',
  vaisselle:      'Vaisselle',
  contenants:     'Contenants et rangement',
  autre:          'Autre',
};
export const CONDITIONS = { neuf: 'Neuf', bon: 'Bon état', use: 'Usé', hs: 'Hors service' };
export const MOVE_KINDS = {
  ajout: 'Ajout', achat: 'Achat', don: 'Don', perte: 'Perte', casse: 'Casse', rebut: 'Mise au rebut',
  retrouve: 'Retrouvé', correction: 'Correction', sortie: 'Sortie de l\'inventaire',
};
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

const blankToNull = (v) => (typeof v === 'string' && !v.trim() ? null : v);
const optText = (max) => z.preprocess(blankToNull, z.string().trim().max(max).nullish());
const optCents = z.preprocess(blankToNull, z.number().int().min(0).max(10_000_000).nullish());

export const EquipmentInput = z.object({
  name:            z.string().trim().min(2, 'Nom trop court').max(150),
  category:        z.enum(Object.keys(CATEGORIES)),
  item_condition:  z.enum(Object.keys(CONDITIONS)).default('bon'),
  provenance:      z.enum(['achat', 'don']).default('achat'),
  purchase_date:   z.preprocess(blankToNull, z.iso.date().nullish()),
  unit_price:      optCents,
  donor:           optText(150),
  donated_value:   optCents,
  entry_origin_id: z.preprocess(blankToNull, z.uuid().nullish()),
  notes:           optText(2000),
}).strict();

export const NewEquipmentInput = EquipmentInput.extend({
  quantity: z.number().int().min(1, 'Au moins 1').max(10_000),
}).strict();

const dateOnly = (d) => (d == null ? null : d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

/* ── Lecture ───────────────────────────────────────────────────────── */
export async function listEquipment({ status = 'actif', category, q } = {}) {
  const where = [];
  const params = [];
  if (status !== 'all') { where.push('e.status = ?'); params.push(status); }
  if (category) { where.push('e.category = ?'); params.push(category); }
  if (q) { where.push('(e.name LIKE ? OR e.notes LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  const [rows] = await getPool().execute(
    `SELECT e.id, e.name, e.category, e.expected_qty, e.item_condition, e.provenance, e.status, e.exit_reason,
            e.updated_at, (p.equipment_id IS NOT NULL) AS has_photo
       FROM equipment e LEFT JOIN equipment_photo p ON p.equipment_id = e.id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY e.category, e.name`, params
  );
  return rows.map(r => ({ ...r, has_photo: !!r.has_photo }));
}

export async function equipmentSummary() {
  const pool = getPool();
  const [[counts]] = await pool.execute(
    `SELECT COUNT(*) AS fiches, COALESCE(SUM(expected_qty), 0) AS objets,
            SUM(item_condition = 'hs') AS hors_service
       FROM equipment WHERE status = 'actif'`
  );
  const [[last]] = await pool.execute(
    `SELECT id, check_date, validated_at FROM inventory_check WHERE status = 'valide' ORDER BY validated_at DESC LIMIT 1`
  );
  let manquants = 0;
  if (last) {
    const [[m]] = await pool.execute(
      `SELECT COALESCE(-SUM(qty_delta), 0) AS n FROM equipment_movement WHERE check_id = ? AND qty_delta < 0`, [last.id]
    );
    manquants = Number(m.n);
  }
  const [[open]] = await pool.execute(`SELECT id FROM inventory_check WHERE status = 'en_cours' LIMIT 1`);
  return {
    fiches: Number(counts.fiches), objets: Number(counts.objets), hors_service: Number(counts.hors_service || 0),
    dernier_controle: last ? dateOnly(last.check_date) : null, manquants_dernier_controle: manquants,
    controle_en_cours: open?.id ?? null,
  };
}

export async function getEquipment(id) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT e.*, (p.equipment_id IS NOT NULL) AS has_photo, en.number AS entry_number, en.label AS entry_label,
            (SELECT x.id FROM entry x WHERE x.origin_id = e.entry_origin_id AND x.status = 'active' LIMIT 1) AS entry_id
       FROM equipment e
       LEFT JOIN equipment_photo p ON p.equipment_id = e.id
       LEFT JOIN entry en ON en.id = e.entry_origin_id
      WHERE e.id = ?`, [id]
  );
  if (!rows.length) throw new HttpError(404, 'Matériel introuvable');
  const [moves] = await pool.execute(
    `SELECT id, kind, qty_delta, reason, check_id, created_by_name, created_at
       FROM equipment_movement WHERE equipment_id = ? ORDER BY created_at DESC, id DESC`, [id]
  );
  const [pending] = await pool.execute(
    `SELECT id, type, requested_by_name FROM change_request WHERE pending_key = ?`, [`equipment:${id}`]
  );
  const r = rows[0];
  return {
    ...r, has_photo: !!r.has_photo, purchase_date: dateOnly(r.purchase_date), exit_date: dateOnly(r.exit_date),
    movements: moves.map(m => ({ ...m, id: Number(m.id) })), pending_request: pending[0] ?? null,
  };
}

/* ── Écriture ──────────────────────────────────────────────────────── */
async function assertEntry(conn, originId) {
  if (!originId) return;
  const [rows] = await conn.execute('SELECT id FROM entry WHERE origin_id = ? LIMIT 1', [originId]);
  if (!rows.length) throw new HttpError(400, 'Dépense liée introuvable');
}

/** Ajoute un mouvement et met à jour la quantité attendue (même transaction). */
export async function applyMovement(conn, id, kind, delta, reason, actor, { checkId = null, requestId = null } = {}) {
  const [rows] = await conn.execute('SELECT name, expected_qty, status FROM equipment WHERE id = ? FOR UPDATE', [id]);
  if (!rows.length) throw new HttpError(404, 'Matériel introuvable');
  const next = Number(rows[0].expected_qty) + delta;
  if (next < 0) throw new HttpError(400, `La quantité de « ${rows[0].name} » deviendrait négative`);
  await conn.execute(
    `INSERT INTO equipment_movement (equipment_id, kind, qty_delta, reason, check_id, request_id, created_by, created_by_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
    [id, kind, delta, reason ?? null, checkId, requestId, actor.id ?? null, actor.name ?? null]
  );
  await conn.execute('UPDATE equipment SET expected_qty = ?, updated_at = NOW(3) WHERE id = ?', [next, id]);
  return next;
}

export async function createEquipment(conn, input, actor, req) {
  await assertEntry(conn, input.entry_origin_id);
  const id = randomUUID();
  await conn.execute(
    `INSERT INTO equipment (id, name, category, expected_qty, item_condition, provenance, purchase_date, unit_price,
                            donor, donated_value, entry_origin_id, notes, created_by, created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
    [id, input.name, input.category, input.item_condition, input.provenance, input.purchase_date ?? null,
      input.unit_price ?? null, input.donor ?? null, input.donated_value ?? null, input.entry_origin_id ?? null,
      input.notes ?? null, actor.id]
  );
  await applyMovement(conn, id, input.provenance === 'don' ? 'don' : 'ajout', input.quantity, 'Création de la fiche', actor);
  await audit(conn, req, 'equipment.create', {
    targetType: 'equipment', targetId: id, actor, details: { name: input.name, quantity: input.quantity },
  });
  return id;
}

export async function updateEquipment(conn, id, input, actor, req) {
  await assertEntry(conn, input.entry_origin_id);
  const [r] = await conn.execute(
    `UPDATE equipment SET name = ?, category = ?, item_condition = ?, provenance = ?, purchase_date = ?, unit_price = ?,
                          donor = ?, donated_value = ?, entry_origin_id = ?, notes = ?, updated_at = NOW(3)
      WHERE id = ? AND status = 'actif'`,
    [input.name, input.category, input.item_condition, input.provenance, input.purchase_date ?? null,
      input.unit_price ?? null, input.donor ?? null, input.donated_value ?? null, input.entry_origin_id ?? null,
      input.notes ?? null, id]
  );
  if (!r.affectedRows) throw new HttpError(404, 'Matériel introuvable ou sorti de l\'inventaire');
  await audit(conn, req, 'equipment.update', { targetType: 'equipment', targetId: id, actor, details: { name: input.name } });
}

export async function setPhoto(conn, id, buffer, declaredMime, actor, req) {
  if (!(buffer instanceof Buffer)) throw new HttpError(415, 'Photo invalide');
  const [rows] = await conn.execute('SELECT name FROM equipment WHERE id = ?', [id]);
  if (!rows.length) throw new HttpError(404, 'Matériel introuvable');
  if (buffer.length === 0) throw new HttpError(400, 'Photo vide');
  if (buffer.length > MAX_PHOTO_BYTES) throw new HttpError(413, 'Photo trop lourde (3 Mo maximum)');
  const mime = sniffMime(buffer);
  if (!mime || mime === 'application/pdf') throw new HttpError(415, 'Photo JPEG, PNG ou WebP uniquement');
  if (declaredMime && declaredMime !== mime) throw new HttpError(415, 'Le contenu du fichier ne correspond pas à son type');
  await conn.execute(
    `INSERT INTO equipment_photo (equipment_id, mime, size, data, updated_at) VALUES (?, ?, ?, ?, NOW(3))
     ON DUPLICATE KEY UPDATE mime = VALUES(mime), size = VALUES(size), data = VALUES(data), updated_at = NOW(3)`,
    [id, mime, buffer.length, buffer]
  );
  await audit(conn, req, 'equipment.photo', { targetType: 'equipment', targetId: id, actor, details: { name: rows[0].name } });
}

export async function getPhoto(id) {
  const [rows] = await getPool().execute('SELECT mime, data FROM equipment_photo WHERE equipment_id = ?', [id]);
  if (!rows.length) throw new HttpError(404, 'Pas de photo');
  return rows[0];
}

/* ── Contrôles d'inventaire ────────────────────────────────────────── */
export async function listChecks() {
  const [rows] = await getPool().execute(
    `SELECT c.id, c.check_date, c.status, c.created_by_name, c.validated_by_name, c.validated_at,
            (SELECT COUNT(*) FROM inventory_check_line l WHERE l.check_id = c.id) AS lignes,
            (SELECT COUNT(*) FROM inventory_check_line l WHERE l.check_id = c.id AND l.counted_qty IS NOT NULL) AS comptees,
            (SELECT COALESCE(-SUM(m.qty_delta), 0) FROM equipment_movement m WHERE m.check_id = c.id AND m.qty_delta < 0) AS manquants
       FROM inventory_check c WHERE c.status <> 'abandonne' ORDER BY c.created_at DESC`
  );
  return rows.map(r => ({ ...r, check_date: dateOnly(r.check_date), lignes: Number(r.lignes),
    comptees: Number(r.comptees), manquants: Number(r.manquants) }));
}

export async function startCheck(conn, date, actor, req) {
  const [open] = await conn.execute(`SELECT id FROM inventory_check WHERE status = 'en_cours' FOR UPDATE`);
  if (open.length) throw new HttpError(409, 'Un contrôle est déjà en cours : terminez-le ou abandonnez-le', undefined, 'CHECK_OPEN');
  const id = randomUUID();
  await conn.execute(
    `INSERT INTO inventory_check (id, check_date, created_by, created_by_name, created_at) VALUES (?, ?, ?, ?, NOW(3))`,
    [id, date, actor.id, actor.name ?? null]
  );
  const [r] = await conn.execute(
    `INSERT INTO inventory_check_line (check_id, equipment_id, expected_qty)
     SELECT ?, id, expected_qty FROM equipment WHERE status = 'actif'`, [id]
  );
  if (!r.affectedRows) throw new HttpError(400, 'Aucun matériel à contrôler');
  await audit(conn, req, 'inventory.start', { targetType: 'inventory', targetId: id, actor, details: { date, lignes: r.affectedRows } });
  return id;
}

export async function getCheck(id) {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT * FROM inventory_check WHERE id = ?', [id]);
  if (!rows.length) throw new HttpError(404, 'Contrôle introuvable');
  const [lines] = await pool.execute(
    `SELECT l.equipment_id, l.expected_qty AS expected_at_start, e.expected_qty, l.counted_qty, l.resolution,
            l.counted_by, e.name, e.category, e.item_condition, (p.equipment_id IS NOT NULL) AS has_photo
       FROM inventory_check_line l
       JOIN equipment e ON e.id = l.equipment_id
       LEFT JOIN equipment_photo p ON p.equipment_id = e.id
      WHERE l.check_id = ? ORDER BY e.category, e.name`, [id]
  );
  return {
    ...rows[0], check_date: dateOnly(rows[0].check_date),
    // Contrôle en cours : on compare à la quantité actuelle. Contrôle terminé :
    // à celle du moment du comptage (sinon les écarts appliqués disparaîtraient).
    lines: lines.map(l => {
      const expected = rows[0].status === 'en_cours' ? Number(l.expected_qty) : Number(l.expected_at_start);
      return { ...l, expected_qty: expected, has_photo: !!l.has_photo,
        ecart: l.counted_qty == null ? null : Number(l.counted_qty) - expected };
    }),
  };
}

export async function setCheckLine(conn, checkId, equipmentId, { counted_qty, resolution = null }, actor) {
  const [c] = await conn.execute(`SELECT status FROM inventory_check WHERE id = ? FOR UPDATE`, [checkId]);
  if (!c.length) throw new HttpError(404, 'Contrôle introuvable');
  if (c[0].status !== 'en_cours') throw new HttpError(409, 'Ce contrôle est terminé');
  const [r] = await conn.execute(
    `UPDATE inventory_check_line SET counted_qty = ?, resolution = ?, counted_by = ?, counted_at = NOW(3)
      WHERE check_id = ? AND equipment_id = ?`,
    [counted_qty, resolution, actor.name ?? null, checkId, equipmentId]
  );
  if (!r.affectedRows) throw new HttpError(404, 'Ligne introuvable');
}

const RESOLUTION_KIND = { perdu: 'perte', casse: 'casse', retrouve: 'retrouve' };

/** Valide le contrôle : chaque écart doit avoir une décision ; les mouvements sont appliqués. */
export async function validateCheck(conn, checkId, actor, req) {
  const [c] = await conn.execute(`SELECT status, check_date FROM inventory_check WHERE id = ? FOR UPDATE`, [checkId]);
  if (!c.length) throw new HttpError(404, 'Contrôle introuvable');
  if (c[0].status !== 'en_cours') throw new HttpError(409, 'Ce contrôle est déjà terminé');
  const [lines] = await conn.execute(
    `SELECT l.equipment_id, l.counted_qty, l.resolution, e.expected_qty, e.name
       FROM inventory_check_line l JOIN equipment e ON e.id = l.equipment_id
      WHERE l.check_id = ? FOR UPDATE`, [checkId]
  );
  const missing = lines.filter(l => l.counted_qty == null);
  if (missing.length) {
    throw new HttpError(400, `${missing.length} objet(s) pas encore compté(s) : ${missing.slice(0, 5).map(l => l.name).join(', ')}`);
  }
  const problems = [];
  for (const l of lines) {
    const ecart = Number(l.counted_qty) - Number(l.expected_qty);
    if (ecart === 0 || l.resolution === 'a_recompter') continue;
    if (ecart < 0 && !['perdu', 'casse'].includes(l.resolution)) problems.push(`${l.name} : perdu ou cassé ?`);
    if (ecart > 0 && l.resolution !== 'retrouve') problems.push(`${l.name} : à confirmer comme retrouvé`);
  }
  if (problems.length) throw new HttpError(400, `Décision manquante pour : ${problems.slice(0, 5).join(' ; ')}`);

  let changes = 0;
  for (const l of lines) {
    const ecart = Number(l.counted_qty) - Number(l.expected_qty);
    if (ecart === 0 || l.resolution === 'a_recompter') continue;
    await applyMovement(conn, l.equipment_id, RESOLUTION_KIND[l.resolution], ecart,
      `Contrôle d'inventaire du ${dateOnly(c[0].check_date).split('-').reverse().join('/')}`, actor, { checkId });
    changes++;
  }
  await conn.execute(
    `UPDATE inventory_check SET status = 'valide', validated_by = ?, validated_by_name = ?, validated_at = NOW(3) WHERE id = ?`,
    [actor.id, actor.name ?? null, checkId]
  );
  await audit(conn, req, 'inventory.validate', { targetType: 'inventory', targetId: checkId, actor, details: { ecarts: changes } });
  return changes;
}

export async function abandonCheck(conn, checkId, actor, req) {
  const [r] = await conn.execute(
    `UPDATE inventory_check SET status = 'abandonne' WHERE id = ? AND status = 'en_cours'`, [checkId]
  );
  if (!r.affectedRows) throw new HttpError(409, 'Ce contrôle n\'est pas en cours');
  await audit(conn, req, 'inventory.abandon', { targetType: 'inventory', targetId: checkId, actor });
}
