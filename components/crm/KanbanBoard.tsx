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
            className="flex-shrink-0 w-64 bg-gray-900 border border-gray-800 rounded-lg flex flex-col"
          >
            {/* Column Header */}
            <div className="p-3 border-b border-gray-800 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-200">
                {formatStatus(status)}
              </span>
              <Badge
                variant="outline"
                className={`text-xs ${STATUS_COLORS[status] || ''}`}
              >
                {columnData[status].length}
              </Badge>
            </div>

            {/* Droppable Column */}
            <Droppable droppableId={status}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex-1 p-2 space-y-2 min-h-[120px] transition-colors ${
                    snapshot.isDraggingOver ? 'bg-gray-800/50' : ''
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
                          className={`bg-gray-800 border border-gray-700 rounded p-3 space-y-1.5 transition-shadow ${
                            snapshot.isDragging
                              ? 'shadow-lg shadow-black/50 ring-1 ring-blue-500/40'
                              : 'hover:border-gray-600'
                          }`}
                        >
                          <div className="text-sm font-medium text-white truncate">
                            {lead.name || 'Unknown'}
                          </div>
                          <div className="text-xs text-gray-400 font-mono">
                            {lead.phone}
                          </div>
                          {lead.tags && lead.tags.length > 0 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-gray-700/50 text-gray-300 border-gray-600"
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
