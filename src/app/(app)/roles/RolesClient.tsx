'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Shield, Check, X, Trash2, Users } from 'lucide-react'

export default function RolesClient({ roles, permissions, modules, users }: {
  roles: any[]
  permissions: any[]
  modules: { key: string; label: string }[]
  users: any[]
}) {
  const router = useRouter()
  const [activeRole, setActiveRole] = useState<string | null>(roles[0]?.id ?? null)
  const [activeTab, setActiveTab] = useState<'permisos' | 'usuarios'>('permisos')
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')
  const [showNewRole, setShowNewRole] = useState(false)
  const [loading, setLoading] = useState(false)

  const role = roles.find(r => r.id === activeRole)
  const rolePerms = permissions.filter(p => p.role_id === activeRole)
  const roleUsers = users.filter(u => u.custom_role_id === activeRole)

  function getPerm(module: string) {
    return rolePerms.find(p => p.module === module)
  }

  async function togglePerm(module: string, field: 'can_read' | 'can_write') {
    if (role?.is_system) return
    const sb = createClient()
    const existing = getPerm(module)
    if (existing) {
      const newVal = !existing[field]
      const updates: any = { [field]: newVal }
      if (field === 'can_write' && newVal) updates.can_read = true
      if (field === 'can_read' && !newVal) updates.can_write = false
      await sb.from('role_permissions').update(updates).eq('id', existing.id)
    } else {
      const data: any = { role_id: activeRole, module, can_read: false, can_write: false }
      data[field] = true
      if (field === 'can_write') data.can_read = true
      await sb.from('role_permissions').insert(data)
    }
    router.refresh()
  }

  async function createRole() {
    if (!newRoleName.trim()) return
    setLoading(true)
    await createClient().from('roles').insert({ name: newRoleName.trim(), description: newRoleDesc.trim() || null })
    setNewRoleName(''); setNewRoleDesc(''); setShowNewRole(false)
    router.refresh()
    setLoading(false)
  }

  async function deleteRole(id: string) {
    if (!confirm('Eliminar este rol?')) return
    await createClient().from('roles').delete().eq('id', id)
    setActiveRole(roles.find(r => r.id !== id)?.id ?? null)
    router.refresh()
  }

  async function assignRole(userId: string, roleId: string | null) {
    await createClient().from('users').update({ custom_role_id: roleId }).eq('id', userId)
    router.refresh()
  }

  const PermIcon = ({ active }: { active: boolean }) => active
    ? <Check size={13} className="text-[#1B9BF0]"/>
    : <X size={13} className="text-gray-300"/>

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Shield size={18} className="text-[#1B9BF0]"/> Roles y permisos
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Controlá qué puede ver y hacer cada rol</p>
        </div>
        <button onClick={() => setShowNewRole(true)}
          className="flex items-center gap-2 bg-[#1B9BF0] hover:bg-[#0F7ACC] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
          <Plus size={15}/> Nuevo rol
        </button>
      </div>

      <div className="flex gap-4">
        {/* Lista de roles */}
        <div className="w-48 shrink-0">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 px-1">Roles</p>
          <div className="space-y-1">
            {roles.map(r => (
              <button key={r.id} onClick={() => setActiveRole(r.id)}
                className={'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all text-left ' + (activeRole === r.id ? 'bg-[#E8F4FE] text-[#1B9BF0] font-medium' : 'text-gray-600 hover:bg-gray-100')}>
                <span className="truncate">{r.name}</span>
                {r.is_system && <span className="text-xs text-gray-300 shrink-0 ml-1">sys</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Detalle del rol */}
        {role && (
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">{role.name}</p>
                {role.description && <p className="text-xs text-gray-400 mt-0.5">{role.description}</p>}
                {role.is_system && <span className="text-xs text-amber-500">Rol del sistema — permisos no editables</span>}
              </div>
              {!role.is_system && (
                <button onClick={() => deleteRole(role.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all">
                  <Trash2 size={14}/>
                </button>
              )}
            </div>

            <div className="flex border-b border-gray-50">
              {[{ key: 'permisos', label: 'Permisos' }, { key: 'usuarios', label: 'Usuarios asignados' }].map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key as any)}
                  className={'px-5 py-3 text-sm font-medium transition-all border-b-2 ' + (activeTab === t.key ? 'text-[#1B9BF0] border-[#1B9BF0]' : 'text-gray-500 border-transparent hover:text-gray-700')}>
                  {t.label}
                </button>
              ))}
            </div>

            {activeTab === 'permisos' && (
              <div>
                <div className="grid grid-cols-3 px-5 py-2.5 text-xs font-medium text-gray-400 border-b border-gray-50 bg-gray-50">
                  <span>Módulo</span><span className="text-center">Lectura</span><span className="text-center">Escritura</span>
                </div>
                {modules.map(m => {
                  const perm = getPerm(m.key)
                  const canRead = perm?.can_read ?? false
                  const canWrite = perm?.can_write ?? false
                  return (
                    <div key={m.key} className="grid grid-cols-3 px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 items-center">
                      <span className="text-sm text-gray-700">{m.label}</span>
                      <div className="flex justify-center">
                        <button onClick={() => togglePerm(m.key, 'can_read')} disabled={role.is_system}
                          className={'w-8 h-8 rounded-lg flex items-center justify-center transition-all ' + (canRead ? 'bg-blue-50' : 'bg-gray-50') + (role.is_system ? ' cursor-default' : ' hover:bg-blue-100 cursor-pointer')}>
                          <PermIcon active={canRead}/>
                        </button>
                      </div>
                      <div className="flex justify-center">
                        <button onClick={() => togglePerm(m.key, 'can_write')} disabled={role.is_system}
                          className={'w-8 h-8 rounded-lg flex items-center justify-center transition-all ' + (canWrite ? 'bg-blue-50' : 'bg-gray-50') + (role.is_system ? ' cursor-default' : ' hover:bg-blue-100 cursor-pointer')}>
                          <PermIcon active={canWrite}/>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {activeTab === 'usuarios' && (
              <div>
                <div className="px-5 py-4">
                  <p className="text-sm text-gray-500 mb-3">Usuarios con este rol personalizado:</p>
                  {!roleUsers.length ? (
                    <p className="text-sm text-gray-400">Ningún usuario asignado a este rol</p>
                  ) : (
                    <div className="space-y-2">
                      {roleUsers.map(u => (
                        <div key={u.id} className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-[#E8F4FE] flex items-center justify-center text-xs font-semibold text-[#1B9BF0]">
                              {u.full_name[0].toUpperCase()}
                            </div>
                            <span className="text-sm text-gray-700">{u.full_name}</span>
                          </div>
                          <button onClick={() => assignRole(u.id, null)}
                            className="text-xs text-red-400 hover:text-red-600">Quitar</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="px-5 pb-4 border-t border-gray-50 pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">Asignar usuario a este rol:</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {users.filter(u => u.custom_role_id !== activeRole).map(u => (
                      <div key={u.id} className="flex items-center justify-between py-1.5">
                        <span className="text-sm text-gray-600">{u.full_name}</span>
                        <button onClick={() => assignRole(u.id, activeRole)}
                          className="text-xs text-[#1B9BF0] hover:underline">Asignar</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal nuevo rol */}
      {showNewRole && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <p className="font-semibold text-gray-900 mb-4">Nuevo rol</p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Nombre *</label>
                <input type="text" value={newRoleName} onChange={e => setNewRoleName(e.target.value)}
                  placeholder="Ej: Diseñador" autoFocus
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Descripción</label>
                <input type="text" value={newRoleDesc} onChange={e => setNewRoleDesc(e.target.value)}
                  placeholder="Descripción opcional"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B9BF0]"/>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowNewRole(false); setNewRoleName(''); setNewRoleDesc('') }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={createRole} disabled={!newRoleName.trim() || loading}
                className="flex-1 py-2.5 bg-[#1B9BF0] text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-[#0F7ACC]">
                {loading ? 'Creando...' : 'Crear rol'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
