'use client';

import { useMemo } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import type { CrmLead } from '@/lib/api';
import { STATUS_COLORS, formatStatus } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';

const COLUMNS = [
  'CALLED',
  'INFO_COLLECTED',
  'LINK_SENT',
  'PAID',
  'MATCHED',
  'FAILED',
] as const;

interface KanbanBoardProps {
  leads: CrmLead[];
  onStatusChange: (leadId: string, newStatus: string) => void;
}

export function KanbanBoard({ leads, onStatusChange }: KanbanBoardProps) {
  const columnData = useMemo(() => {
    const grouped: Record<string, CrmLead[]> = {};
    for (const col of COLUMNS) {
      grouped[col] = [];
    }
    for (const lead of leads) {
      if (grouped[lead.status]) {
        grouped[lead.status].push(lead);
      }
    }
    return grouped;
  }, [leads]);

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;
    onStatusChange(draggableId, destination.droppableId);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((status) => (
          <div
            key={status}
            className="flex-shrink-0 w-64 bg-black border border-white/[0.15] rounded-lg flex flex-col"
          >
            {/* Column Header */}
            <div className="p-3 border-b border-white/[0.08] flex items-center justify-between">
              <span className="text-sm font-semibold text-white/80">
                {formatStatus(status)}
              </span>
              <Badge
                variant="outline"
                className={`text-xs uppercase tracking-wider font-semibold ${STATUS_COLORS[status] || ''}`}
              >
                <span className="mono-num">{columnData[status].length}</span>
              </Badge>
            </div>

            {/* Droppable Column */}
            <Droppable droppableId={status}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex-1 p-2 space-y-2 min-h-[120px] transition-colors ${
                    snapshot.isDraggingOver ? 'bg-white/[0.04]' : ''
                  }`}
                >
                  {columnData[status].map((lead, index) => (
                    <Draggable
                      key={lead.id}
                      draggableId={lead.id}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`bg-white/[0.04] border border-white/[0.12] rounded p-3 space-y-1.5 transition-shadow ${
                            snapshot.isDragging
                              ? 'shadow-lg shadow-black/50 ring-1 ring-blue-500/40'
                              : 'hover:border-white/[0.20]'
                          }`}
                        >
                          <div className="text-sm font-medium text-white truncate">
                            {lead.name || 'Unknown'}
                          </div>
                          <div className="text-xs text-white/40 font-mono">
                            {lead.phone}
                          </div>
                          {lead.tags && lead.tags.length > 0 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-white/[0.04] text-white/60 border-white/[0.12] uppercase tracking-wider font-semibold"
                            >
                              {lead.tags[0]}
                            </Badge>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}
