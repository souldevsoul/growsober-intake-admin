'use client';

import { useEffect, useState } from 'react';
import { getCitySettings, createCitySettings, updateCitySettings, deleteCitySettings } from '@/lib/api';
import type { CitySettings } from '@/lib/api';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function CitySettingsPage() {
  const [settings, setSettings] = useState<CitySettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Create form state
  const [newCity, setNewCity] = useState('');
  const [newMinConfirmed, setNewMinConfirmed] = useState(4);
  const [newLocation, setNewLocation] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Edit form state
  const [editMinConfirmed, setEditMinConfirmed] = useState(4);
  const [editLocation, setEditLocation] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await getCitySettings();
      setSettings(data);
    } catch (err) {
      console.error('Failed to fetch city settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleCreate = async () => {
    if (!newCity.trim()) return;
    try {
      await createCitySettings({
        city: newCity.trim(),
        minConfirmed: newMinConfirmed,
        defaultLocation: newLocation.trim() || undefined,
        defaultNotes: newNotes.trim() || undefined,
      });
      setNewCity('');
      setNewMinConfirmed(4);
      setNewLocation('');
      setNewNotes('');
      setShowCreate(false);
      fetchSettings();
    } catch (err) {
      console.error('Failed to create city settings:', err);
    }
  };

  const handleStartEdit = (s: CitySettings) => {
    setEditingId(s.id);
    setEditMinConfirmed(s.minConfirmed);
    setEditLocation(s.defaultLocation || '');
    setEditNotes(s.defaultNotes || '');
    setEditIsActive(s.isActive);
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await updateCitySettings(id, {
        minConfirmed: editMinConfirmed,
        defaultLocation: editLocation.trim() || undefined,
        defaultNotes: editNotes.trim() || undefined,
        isActive: editIsActive,
      });
      setEditingId(null);
      fetchSettings();
    } catch (err) {
      console.error('Failed to update city settings:', err);
    }
  };

  const handleToggleActive = async (s: CitySettings) => {
    try {
      await updateCitySettings(s.id, { isActive: !s.isActive });
      fetchSettings();
    } catch (err) {
      console.error('Failed to toggle city settings:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this city setting? This cannot be undone.')) return;
    try {
      await deleteCitySettings(id);
      fetchSettings();
    } catch (err) {
      console.error('Failed to delete city settings:', err);
    }
  };

  return (
    <div className="min-h-screen bg-black neon-grid-bg text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">City Settings</h1>
          <Button onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Cancel' : 'Add City'}
          </Button>
        </div>

        {/* Create Form */}
        {showCreate && (
          <Card className="neon-card">
            <CardHeader>
              <CardTitle className="text-lg">New City Setting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-white/40 mb-1 block">City Name</label>
                  <Input
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    placeholder="e.g. London"
                    className="bg-white/[0.04] border-white/[0.12] text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-white/40 mb-1 block">Min Confirmed</label>
                  <Input
                    type="number"
                    min={1}
                    value={newMinConfirmed}
                    onChange={(e) => setNewMinConfirmed(Number(e.target.value))}
                    className="bg-white/[0.04] border-white/[0.12] text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-white/40 mb-1 block">Default Location</label>
                  <Input
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="e.g. WeWork Moorgate"
                    className="bg-white/[0.04] border-white/[0.12] text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-white/40 mb-1 block">Default Notes</label>
                  <Input
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="e.g. Bring your own journal"
                    className="bg-white/[0.04] border-white/[0.12] text-white"
                  />
                </div>
              </div>
              <Button onClick={handleCreate} disabled={!newCity.trim()}>
                Create
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Settings Table */}
        {loading ? (
          <p className="text-white/30 text-center py-8">Loading...</p>
        ) : settings.length === 0 ? (
          <p className="text-white/30 text-center py-8">No city settings yet. Add one to get started.</p>
        ) : (
          <Card className="neon-card">
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    <th className="text-left text-sm text-white/40 font-medium px-4 py-3">City</th>
                    <th className="text-left text-sm text-white/40 font-medium px-4 py-3">Min Confirmed</th>
                    <th className="text-left text-sm text-white/40 font-medium px-4 py-3">Default Location</th>
                    <th className="text-left text-sm text-white/40 font-medium px-4 py-3">Default Notes</th>
                    <th className="text-right text-sm text-white/40 font-medium px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {settings.map((s) => (
                    <tr key={s.id} className="border-b border-white/[0.04] last:border-0">
                      {editingId === s.id ? (
                        /* Edit Mode */
                        <>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-white">{s.city}</span>
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              type="number"
                              min={1}
                              value={editMinConfirmed}
                              onChange={(e) => setEditMinConfirmed(Number(e.target.value))}
                              className="bg-white/[0.04] border-white/[0.12] text-white w-24"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              value={editLocation}
                              onChange={(e) => setEditLocation(e.target.value)}
                              className="bg-white/[0.04] border-white/[0.12] text-white"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              className="bg-white/[0.04] border-white/[0.12] text-white"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button size="sm" onClick={() => handleSaveEdit(s.id)}>Save</Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-transparent border-white/[0.12] text-white/60 hover:bg-white/[0.06] hover:text-white"
                                onClick={() => setEditingId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </td>
                        </>
                      ) : (
                        /* View Mode */
                        <>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">{s.city}</span>
                              <Badge
                                variant="outline"
                                className={`text-xs font-semibold uppercase tracking-wider ${
                                  s.isActive
                                    ? 'bg-green-500/20 text-green-300 border-green-500/30'
                                    : 'bg-white/[0.04] text-white/40 border-white/[0.12]'
                                }`}
                              >
                                {s.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-white/60 mono-num">{s.minConfirmed}</td>
                          <td className="px-4 py-3 text-white/60">{s.defaultLocation || '\u2014'}</td>
                          <td className="px-4 py-3 text-white/60">{s.defaultNotes || '\u2014'}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleToggleActive(s)}
                                className={`px-2 py-1 rounded text-xs font-medium uppercase tracking-wider transition-colors ${
                                  s.isActive
                                    ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                                    : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.06]'
                                }`}
                              >
                                {s.isActive ? 'Active' : 'Inactive'}
                              </button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-transparent border-white/[0.12] text-white/60 hover:bg-white/[0.06] hover:text-white"
                                onClick={() => handleStartEdit(s)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-transparent border-red-800 text-red-400 hover:bg-red-900/30 hover:text-red-300"
                                onClick={() => handleDelete(s.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
