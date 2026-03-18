'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface TagManagerProps {
  tags: string[];
  allTags?: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}

export function TagManager({ tags, onAdd, onRemove }: TagManagerProps) {
  const [input, setInput] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      onAdd(input.trim().toLowerCase());
      setInput('');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30"
        >
          {tag}
          <button
            onClick={() => onRemove(tag)}
            className="hover:text-blue-100 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add tag..."
        className="w-24 h-6 text-xs bg-transparent border-gray-700 px-2"
      />
    </div>
  );
}
