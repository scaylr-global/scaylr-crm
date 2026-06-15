import bcrypt from 'bcryptjs';
import db, { today } from './index.js';

// Idempotent seed: only runs if there are no users yet.
export function seedIfEmpty() {
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (userCount > 0) return false;

  console.log('[seed] Empty database — seeding default data...');

  const insertUser = db.prepare(
    `INSERT INTO users (name, email, password_hash, role, avatar_initials, avatar_color)
     VALUES (@name, @email, @password_hash, @role, @avatar_initials, @avatar_color)`
  );

  const admin = insertUser.run({
    name: 'Admin User',
    email: 'admin@scaylr.com',
    password_hash: bcrypt.hashSync('admin123', 10),
    role: 'admin',
    avatar_initials: 'AU',
    avatar_color: '#14b8a6',
  });

  const manager = insertUser.run({
    name: 'Maya Manager',
    email: 'maya@scaylr.com',
    password_hash: bcrypt.hashSync('manager123', 10),
    role: 'manager',
    avatar_initials: 'MM',
    avatar_color: '#8b5cf6',
  });

  const emp = insertUser.run({
    name: 'Evan Employee',
    email: 'evan@scaylr.com',
    password_hash: bcrypt.hashSync('employee123', 10),
    role: 'employee',
    avatar_initials: 'EE',
    avatar_color: '#f59e0b',
  });

  const adminId = admin.lastInsertRowid;
  const managerId = manager.lastInsertRowid;
  const empId = emp.lastInsertRowid;

  const insertLead = db.prepare(
    `INSERT INTO leads (name, role_title, company, phone1, phone2, email, industry, status, assigned_to, last_contact_at, notes)
     VALUES (@name, @role_title, @company, @phone1, @phone2, @email, @industry, @status, @assigned_to, @last_contact_at, @notes)`
  );

  const leads = [
    {
      name: 'Sarah Chen',
      role_title: 'Operations Manager',
      company: 'FreshFleet Logistics',
      phone1: '+1 415 555 0102',
      phone2: '+1 415 555 0199',
      email: 'sarah@freshfleet.com',
      industry: 'Vehicle',
      status: 'Contacted',
      assigned_to: empId,
      last_contact_at: "datetime('now','-2 days')",
      notes: 'Interested in fleet tracking. Asked for pricing.',
    },
    {
      name: 'Marcus Webb',
      role_title: 'Owner',
      company: 'The Daily Grind Cafe',
      phone1: '+1 312 555 0144',
      phone2: null,
      email: 'marcus@dailygrind.com',
      industry: 'Food',
      status: 'New',
      assigned_to: managerId,
      last_contact_at: null,
      notes: '',
    },
    {
      name: 'Priya Nair',
      role_title: 'CTO',
      company: 'Nimbus Software',
      phone1: '+44 20 7946 0321',
      phone2: '+44 20 7946 0999',
      email: 'priya@nimbus.io',
      industry: 'Technology',
      status: 'Qualified',
      assigned_to: empId,
      last_contact_at: "datetime('now','-1 day')",
      notes: 'Ready to demo. Budget approved.',
    },
  ];

  const insertLeadTxn = db.transaction((rows) => {
    for (const r of rows) {
      // handle datetime expressions for last_contact_at
      const last = r.last_contact_at;
      const lastVal = last && last.startsWith('datetime')
        ? db.prepare(`SELECT ${last} AS v`).get().v
        : last;
      insertLead.run({ ...r, last_contact_at: lastVal });
    }
  });
  insertLeadTxn(leads);

  // Seed call targets for today
  const insTarget = db.prepare(
    `INSERT INTO call_targets (user_id, daily_target, date) VALUES (?, ?, ?)`
  );
  insTarget.run(managerId, 20, today());
  insTarget.run(empId, 30, today());

  // A couple of sample call logs on the first lead
  const firstLead = db.prepare('SELECT id FROM leads ORDER BY id LIMIT 1').get();
  const insCall = db.prepare(
    `INSERT INTO call_logs (lead_id, logged_by, outcome, duration_seconds, notes)
     VALUES (?, ?, ?, ?, ?)`
  );
  insCall.run(firstLead.id, empId, 'Interested', 245, 'Spoke with Sarah, wants a follow-up next week.');
  insCall.run(firstLead.id, empId, 'Callback', 60, 'Asked to call back after their team meeting.');

  // Seed an overdue follow-up
  const insFollow = db.prepare(
    `INSERT INTO follow_ups (lead_id, assigned_to, scheduled_at, note, status)
     VALUES (?, ?, ?, ?, 'pending')`
  );
  const overdue = db.prepare(`SELECT datetime('now','-1 day') AS v`).get().v;
  insFollow.run(firstLead.id, empId, overdue, 'Send the pricing deck and confirm demo time.');

  db.prepare(
    `INSERT INTO activity_log (user_id, action_type, description, lead_id)
     VALUES (?, 'seed', 'System seeded with sample data', NULL)`
  ).run(adminId);

  console.log('[seed] Done. Login: admin@scaylr.com / admin123');
  return true;
}

// Allow running directly: `npm run seed`
if (import.meta.url === `file://${process.argv[1]}`) {
  seedIfEmpty();
  process.exit(0);
}
