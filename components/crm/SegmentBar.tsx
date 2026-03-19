'use client';

import { useState } from 'react';
import type { SavedSegment } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { X, Save, Bookmark } from 'lucide-react';

interface SegmentBarProps {
  segments: SavedSegment[];
  activeSegmentId: string | null;
  onSelect: (filters: Record<string, string>) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
  showSave: boolean;
}

export function SegmentBar({
  segments,
  activeSegmentId,
  onSelect,
  onSave,
  onDelete,
  showSave,
}: SegmentBarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleSave = () => {
    const name = prompt('Name for this segment:');
    if (name?.trim()) {
      onSave(name.trim());
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Bookmark className="h-4 w-4 text-gray-500 flex-shrink-0" />

      {segments.map((segment) => (
        <button
          key={segment.id}
          onClick={() => onSelect(segment.filters)}
          onMouseEnter={() => setHoveredId(segment.id)}
          onMouseLeave={() => setHoveredId(null)}
          className={`
            relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm
            transition-colors duration-150 border
            ${
              activeSegmentId === segment.id
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:border-gray-600'
            }
          `}
        >
          <span>{segment.name}</span>
          <span
            className={`
              inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-xs font-medium
              ${
                activeSegmentId === segment.id
                  ? 'bg-blue-500/30 text-blue-200'
                  : 'bg-gray-700 text-gray-400'
              }
            `}
          >
            {segment.count}
          </span>

          {hoveredId === segment.id && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(segment.id);
              }}
              className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-red-500/30 hover:text-red-300 text-gray-500 transition-colors"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </button>
      ))}

      {showSave && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleSave}
          className="h-8 border-dashed border-gray-600 text-gray-400 hover:text-white hover:border-gray-500 hover:bg-gray-800"
        >
          <Save className="h-3.5 w-3.5 mr-1.5" />
          Save filters
        </Button>
      )}

      {segments.length === 0 && !showSave && (
        <span className="text-sm text-gray-600">No saved segments</span>
      )}
    </div>
  );
}
