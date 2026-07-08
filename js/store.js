/**
 * Central app state. Replaces the scattered top-level `let`s from the
 * original single-file build. Modules read via store.get() and write via
 * store.set(); store.on(event, fn) lets a module react to changes made by
 * another module without reaching into its internals.
 */

const state = {
  token: null,
  user: '',
  role: 'Receptionist',       // Receptionist | Doctor | Administrator
  appts: [],
  onlineRecords: [],
  online: navigator.onLine,
  loading: false,

  // booking form transient state
  editingId: null,
  apptTouched: false,
  selectedSlot: '',
  bookingType: 'Offline',

  // appointment list UI state
  listTab: 'scheduled',       // scheduled | completed
  scheduledSub: 'upcoming',   // upcoming | today | pending
  completedSub: 'completed',  // completed | cancelled | noshow

  // dashboard
  range: 'month',

  pendingDeleteId: null,
  lastFocus: null,
  lastDeleted: null           // {record, index} for undo
};

const listeners = {};

export const store = {
  get(key){ return key ? state[key] : state; },
  set(patch){
    Object.assign(state, patch);
    Object.keys(patch).forEach(k => emit(k, state[k]));
    emit('*', state);
  },
  on(event, fn){
    (listeners[event] || (listeners[event] = [])).push(fn);
    return () => { listeners[event] = listeners[event].filter(f => f !== fn); };
  }
};

function emit(event, value){
  (listeners[event] || []).forEach(fn => fn(value, state));
}

/** Role helpers — Administrator always has full access; unassigned/legacy
 *  users default to Administrator too, so existing logins never lock out. */
export const ROLES = { RECEPTION: 'Receptionist', DOCTOR: 'Doctor', ADMIN: 'Administrator' };
export function can(action){
  const role = state.role;
  if(role === ROLES.ADMIN) return true;
  const perms = {
    Receptionist: ['book','edit','cancel','search','print','call','whatsapp','viewTimeline'],
    Doctor: ['consult','complete','diagnosis','notes','viewTimeline','search']
  };
  return (perms[role] || []).indexOf(action) >= 0;
}
