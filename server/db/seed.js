import bcrypt from 'bcryptjs';
import { q, q1, run, today } from './index.js';

// Idempotent seed: only runs if there are no users yet.
export async function seedIfEmpty() {
  const { c } = await q1('SELECT COUNT(*)::int AS c FROM users');
  if (c > 0) return false;

  console.log('[seed] Empty database — seeding default data...');

  async function insertUser(name, email, password, role, initials, color) {
    const row = await q1(
      `INSERT INTO users (name, email, password_hash, role, avatar_initials, avatar_color)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [name, email, bcrypt.hashSync(password, 10), role, initials, color]
    );
    return row.id;
  }

  const adminId = await insertUser('Admin User', 'admin@scaylr.com', 'admin123', 'admin', 'AU', '#14b8a6');
  const managerId = await insertUser('Maya Manager', 'maya@scaylr.com', 'manager123', 'manager', 'MM', '#8b5cf6');
  const empId = await insertUser('Evan Employee', 'evan@scaylr.com', 'employee123', 'employee', 'EE', '#f59e0b');

  const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();
  const DAY = 86400000;

  const leads = [
    {
      name: 'Sarah Chen', role_title: 'Operations Manager', company: 'FreshFleet Logistics',
      phone1: '+1 415 555 0102', phone2: '+1 415 555 0199', email: 'sarah@freshfleet.com',
      industry: 'Vehicle', status: 'Contacted', assigned_to: empId, last_contact_at: iso(2 * DAY),
      notes: 'Interested in fleet tracking. Asked for pricing.',
    },
    {
      name: 'Marcus Webb', role_title: 'Owner', company: 'The Daily Grind Cafe',
      phone1: '+1 312 555 0144', phone2: null, email: 'marcus@dailygrind.com',
      industry: 'Food', status: 'New', assigned_to: managerId, last_contact_at: null, notes: '',
    },
    {
      name: 'Priya Nair', role_title: 'CTO', company: 'Nimbus Software',
      phone1: '+44 20 7946 0321', phone2: '+44 20 7946 0999', email: 'priya@nimbus.io',
      industry: 'Technology', status: 'Qualified', assigned_to: empId, last_contact_at: iso(1 * DAY),
      notes: 'Ready to demo. Budget approved.',
    },
  ];

  let firstLeadId = null;
  for (const l of leads) {
    const row = await q1(
      `INSERT INTO leads (name, role_title, company, phone1, phone2, email, industry, status, assigned_to, last_contact_at, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [l.name, l.role_title, l.company, l.phone1, l.phone2, l.email, l.industry, l.status, l.assigned_to, l.last_contact_at, l.notes]
    );
    if (firstLeadId === null) firstLeadId = row.id;
  }

  // Daily call targets for today
  await run('INSERT INTO call_targets (user_id, daily_target, date) VALUES ($1, $2, $3::date)', [managerId, 20, today()]);
  await run('INSERT INTO call_targets (user_id, daily_target, date) VALUES ($1, $2, $3::date)', [empId, 30, today()]);

  // Sample call logs on the first lead
  await run(
    `INSERT INTO call_logs (lead_id, logged_by, outcome, duration_seconds, notes) VALUES ($1,$2,$3,$4,$5)`,
    [firstLeadId, empId, 'Interested', 245, 'Spoke with Sarah, wants a follow-up next week.']
  );
  await run(
    `INSERT INTO call_logs (lead_id, logged_by, outcome, duration_seconds, notes) VALUES ($1,$2,$3,$4,$5)`,
    [firstLeadId, empId, 'Callback', 60, 'Asked to call back after their team meeting.']
  );

  // An overdue follow-up
  await run(
    `INSERT INTO follow_ups (lead_id, assigned_to, scheduled_at, note, status) VALUES ($1,$2,$3,$4,'pending')`,
    [firstLeadId, empId, iso(1 * DAY), 'Send the pricing deck and confirm demo time.']
  );

  await run(
    `INSERT INTO activity_log (user_id, action_type, description, lead_id) VALUES ($1,'seed','System seeded with sample data',NULL)`,
    [adminId]
  );

  console.log('[seed] Done. Login: admin@scaylr.com / admin123');
  return true;
}

// Allow running directly: `npm run seed`
if (import.meta.url === `file://${process.argv[1]}`) {
  await seedIfEmpty();
  process.exit(0);
}
