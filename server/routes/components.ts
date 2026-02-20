/** Component routes — systems, components, deficiencies. */
import { Hono } from "hono";
import db from "../db.js";

const app = new Hono();

// GET /systems
app.get("/systems", (c) => {
  const rows = db.prepare(`
    SELECT s.id, s.name, s.color,
           (SELECT COUNT(*) FROM components c WHERE c.system_id = s.id) as component_count
    FROM systems s
    ORDER BY s.sort_order
  `).all();

  return c.json({ data: rows });
});

// GET /components — optionally filtered by system
app.get("/components", (c) => {
  const system = c.req.query("system");

  let rows;
  if (system) {
    rows = db.prepare(`
      SELECT c.id, c.mesh_name, c.display_name, c.description,
             c.system_id, s.name as system_name, s.color as system_color
      FROM components c
      JOIN systems s ON s.id = c.system_id
      WHERE c.system_id = ?
      ORDER BY c.sort_order
    `).all(system);
  } else {
    rows = db.prepare(`
      SELECT c.id, c.mesh_name, c.display_name, c.description,
             c.system_id, s.name as system_name, s.color as system_color
      FROM components c
      JOIN systems s ON s.id = c.system_id
      ORDER BY s.sort_order, c.sort_order
    `).all();
  }

  return c.json({ data: rows });
});

// GET /components/:idOrMesh — single component with documents + deficiencies
app.get("/components/:idOrMesh", (c) => {
  const param = c.req.param("idOrMesh");

  // Try numeric id first, then mesh_name
  let component;
  if (/^\d+$/.test(param)) {
    component = db.prepare(`
      SELECT c.id, c.mesh_name, c.display_name, c.description, c.inspection_notes,
             c.system_id, s.name as system_name, s.color as system_color
      FROM components c
      JOIN systems s ON s.id = c.system_id
      WHERE c.id = ?
    `).get(parseInt(param));
  } else {
    component = db.prepare(`
      SELECT c.id, c.mesh_name, c.display_name, c.description, c.inspection_notes,
             c.system_id, s.name as system_name, s.color as system_color
      FROM components c
      JOIN systems s ON s.id = c.system_id
      WHERE c.mesh_name = ?
    `).get(param);
  }

  if (!component) {
    return c.json({ error: "Component not found" }, 404);
  }

  const comp = component as { id: number; [key: string]: unknown };

  // Get linked documents
  const documents = db.prepare(`
    SELECT d.id, d.document_id, d.title, d.collection_id, d.year,
           cd.relevance, cd.cfr_reference
    FROM component_documents cd
    JOIN documents d ON d.id = cd.document_id
    WHERE cd.component_id = ?
    ORDER BY
      CASE cd.relevance WHEN 'primary' THEN 1 WHEN 'secondary' THEN 2 ELSE 3 END,
      d.title
  `).all(comp.id);

  // Get deficiencies
  const deficiencies = db.prepare(`
    SELECT id, code, title, description, severity, cfr_reference, remediation
    FROM component_deficiencies
    WHERE component_id = ?
    ORDER BY
      CASE severity WHEN 'critical' THEN 1 WHEN 'serious' THEN 2 WHEN 'moderate' THEN 3 ELSE 4 END
  `).all(comp.id);

  return c.json({
    data: {
      ...component,
      documents,
      deficiencies,
    },
  });
});

// GET /components/:id/documents
app.get("/components/:id/documents", (c) => {
  const id = parseInt(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "Invalid ID" }, 400);

  const rows = db.prepare(`
    SELECT d.id, d.document_id, d.title, d.collection_id, d.year,
           cd.relevance, cd.cfr_reference
    FROM component_documents cd
    JOIN documents d ON d.id = cd.document_id
    WHERE cd.component_id = ?
    ORDER BY cd.relevance, d.title
  `).all(id);

  return c.json({ data: rows });
});

// GET /components/:id/deficiencies
app.get("/components/:id/deficiencies", (c) => {
  const id = parseInt(c.req.param("id"));
  if (!Number.isFinite(id)) return c.json({ error: "Invalid ID" }, 400);

  const rows = db.prepare(`
    SELECT id, code, title, description, severity, cfr_reference, remediation
    FROM component_deficiencies
    WHERE component_id = ?
    ORDER BY
      CASE severity WHEN 'critical' THEN 1 WHEN 'serious' THEN 2 WHEN 'moderate' THEN 3 ELSE 4 END
  `).all(id);

  return c.json({ data: rows });
});

// GET /deficiencies — all deficiencies, optionally filtered by system
app.get("/deficiencies", (c) => {
  const system = c.req.query("system");

  let where = "";
  const params: unknown[] = [];

  if (system) {
    where = "WHERE c.system_id = ?";
    params.push(system);
  }

  const rows = db.prepare(`
    SELECT cd.id, cd.code, cd.title, cd.description, cd.severity,
           cd.cfr_reference, cd.remediation,
           c.display_name as component_name, c.mesh_name,
           s.name as system_name, s.color as system_color
    FROM component_deficiencies cd
    JOIN components c ON c.id = cd.component_id
    JOIN systems s ON s.id = c.system_id
    ${where}
    ORDER BY s.sort_order, c.sort_order,
      CASE cd.severity WHEN 'critical' THEN 1 WHEN 'serious' THEN 2 WHEN 'moderate' THEN 3 ELSE 4 END
  `).all(...params);

  return c.json({ data: rows });
});

export default app;
