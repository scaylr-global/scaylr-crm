import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { Building2, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { toDate } from '../lib/utils';
import { api, Lead } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { PIPELINE_ORDER, STATUS_STYLES } from '../lib/constants';
import { Avatar, Pill, DaysBadge } from '../components/ui';

export default function Pipeline() {
  const toast = useToast();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function load() {
    api.get<Lead[]>('/leads').then(setLeads);
  }
  useEffect(load, []);

  const byStatus: Record<string, Lead[]> = {};
  PIPELINE_ORDER.forEach((s) => (byStatus[s] = []));
  leads.forEach((l) => {
    (byStatus[l.status] = byStatus[l.status] || []).push(l);
  });

  const active = leads.find((l) => l.id === activeId);

  function onStart(e: DragStartEvent) {
    setActiveId(Number(e.active.id));
  }

  async function onEnd(e: DragEndEvent) {
    setActiveId(null);
    const leadId = Number(e.active.id);
    const newStatus = e.over?.id as string | undefined;
    if (!newStatus) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === newStatus) return;

    const prev = lead.status;
    setLeads((ls) => ls.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l)));
    try {
      await api.patch(`/leads/${leadId}/status`, { status: newStatus });
      toast(`Moved ${lead.name} to ${newStatus}`);
    } catch (err: any) {
      setLeads((ls) => ls.map((l) => (l.id === leadId ? { ...l, status: prev } : l)));
      toast(err.message, 'error');
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold flex items-center gap-2">
        Pipeline
        <span className="text-sm bg-white/10 text-muted px-2 py-0.5 rounded-full">{leads.length}</span>
      </h1>
      <p className="text-muted text-sm mb-5">Drag cards between columns to update status</p>

      <DndContext sensors={sensors} onDragStart={onStart} onDragEnd={onEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {PIPELINE_ORDER.map((status) => (
            <Column key={status} status={status} leads={byStatus[status] || []} navigate={navigate} />
          ))}
        </div>
        <DragOverlay>{active ? <Card lead={active} dragging /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({ status, leads, navigate }: { status: string; leads: Lead[]; navigate: (p: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const s = STATUS_STYLES[status];
  return (
    <div className="w-72 shrink-0 flex flex-col">
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.dot }} />
          {status}
        </div>
        <span className="text-xs bg-white/10 text-muted px-2 py-0.5 rounded-full">{leads.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[200px] max-h-[calc(100vh-220px)] overflow-y-auto rounded-xl p-2 space-y-2 border transition-colors ${
          isOver ? 'border-teal/50 bg-teal/5' : 'border-border bg-card'
        }`}
      >
        {leads.map((l) => (
          <DraggableCard key={l.id} lead={l} navigate={navigate} />
        ))}
        {leads.length === 0 && <div className="text-center text-xs text-muted py-6">Drop here</div>}
      </div>
    </div>
  );
}

function DraggableCard({ lead, navigate }: { lead: Lead; navigate: (p: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => navigate(`/leads/${lead.id}`)}
      className={isDragging ? 'opacity-30' : ''}
    >
      <Card lead={lead} />
    </div>
  );
}

function Card({ lead, dragging }: { lead: Lead; dragging?: boolean }) {
  return (
    <div
      className={`bg-[#15151f] border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing ${
        dragging ? 'shadow-2xl rotate-2' : 'lift-hover hover:border-teal/40'
      }`}
    >
      <div className="font-medium text-sm">{lead.name}</div>
      {lead.company && (
        <div className="flex items-center gap-1.5 text-xs text-muted mt-1">
          <Building2 size={12} /> {lead.company}
        </div>
      )}
      {lead.phone1 && (
        <div className="flex items-center gap-1.5 text-xs text-muted mt-0.5">
          <Phone size={12} /> {lead.phone1}
        </div>
      )}
      <div className="flex items-center justify-between mt-2.5 flex-wrap gap-1">
        <div className="flex items-center gap-1">
          <Pill>{lead.industry}</Pill>
          {(lead.days_silent ?? 0) >= 7 && <DaysBadge days={lead.days_silent!} />}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          {lead.assignee && <Avatar initials={lead.assignee.avatar_initials} color={lead.assignee.avatar_color} size={18} />}
          {format(toDate(lead.created_at), 'MMM d')}
        </div>
      </div>
    </div>
  );
}
