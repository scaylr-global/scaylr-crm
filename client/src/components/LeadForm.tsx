import { useState } from 'react';
import { Lead, User } from '../lib/api';
import { Field } from './ui';
import { INDUSTRIES, ALL_STATUSES } from '../lib/constants';

export interface LeadFormValues {
  name: string;
  role_title: string;
  company: string;
  phone1: string;
  phone2: string;
  email: string;
  industry: string;
  status: string;
  assigned_to: number | null;
  value: string;
}

export default function LeadForm({
  initial,
  users,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
}: {
  initial?: Partial<Lead>;
  users: User[];
  onSubmit: (v: LeadFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}) {
  const [v, setV] = useState<LeadFormValues>({
    name: initial?.name || '',
    role_title: initial?.role_title || '',
    company: initial?.company || '',
    phone1: initial?.phone1 || '',
    phone2: initial?.phone2 || '',
    email: initial?.email || '',
    industry: initial?.industry || 'Other',
    status: initial?.status || 'New',
    assigned_to: initial?.assigned_to ?? null,
    value: initial?.value != null ? String(initial.value) : '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function set<K extends keyof LeadFormValues>(k: K, val: LeadFormValues[K]) {
    setV((x) => ({ ...x, [k]: val }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!v.name.trim()) err.name = 'Name is required';
    if (!v.phone1.trim()) err.phone1 = 'Phone 1 is required';
    if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) err.email = 'Invalid email';
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    try {
      await onSubmit(v);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Name *" error={errors.name}>
          <input value={v.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </Field>
        <Field label="Role / Title">
          <input value={v.role_title} onChange={(e) => set('role_title', e.target.value)} />
        </Field>
        <Field label="Company">
          <input value={v.company} onChange={(e) => set('company', e.target.value)} />
        </Field>
        <Field label="Email" error={errors.email}>
          <input value={v.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Phone 1 *" error={errors.phone1}>
          <input value={v.phone1} onChange={(e) => set('phone1', e.target.value)} />
        </Field>
        <Field label="Phone 2">
          <input value={v.phone2} onChange={(e) => set('phone2', e.target.value)} />
        </Field>
        <Field label="Industry">
          <select value={v.industry} onChange={(e) => set('industry', e.target.value)}>
            {INDUSTRIES.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select value={v.status} onChange={(e) => set('status', e.target.value)}>
            {ALL_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Deal Value (LKR)">
          <input
            type="number"
            min={0}
            step={1000}
            placeholder="e.g. 150000"
            value={v.value}
            onChange={(e) => set('value', e.target.value)}
          />
        </Field>
        <div className="col-span-2">
          <Field label="Assign to">
            <select
              value={v.assigned_to ?? ''}
              onChange={(e) => set('assigned_to', e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— Unassigned —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" onClick={onCancel} className="btn btn-ghost">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="btn btn-teal disabled:opacity-60">
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
