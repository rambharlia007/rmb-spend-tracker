const ICONS = ['🍽️','🛒','🚗','🏠','💡','🛍️','🎬','⚕️','📚','✈️','📦','☕','🎮','💳','💰','🎁','🍔','🍕','🚕','⛽','🚌','🏥','💊','👕','🧾','📱','💻','🎵','🎨','📺','🏋️','🎂','🍺','🥗','🧸','🌸','🔧','📖','🎓','🎯'];
const COLORS = ['#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#ec4899','#f97316','#14b8a6','#6366f1','#0ea5e9','#64748b','#a855f7','#22c55e','#eab308','#06b6d4'];

export function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto p-2 border rounded-md">
      {ICONS.map((i) => (
        <button
          type="button"
          key={i}
          onClick={() => onChange(i)}
          className={`h-8 w-8 flex items-center justify-center rounded hover:bg-accent text-lg ${value === i ? 'bg-accent ring-2 ring-ring' : ''}`}
        >
          {i}
        </button>
      ))}
    </div>
  );
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 p-2 border rounded-md">
      {COLORS.map((c) => (
        <button
          type="button"
          key={c}
          onClick={() => onChange(c)}
          style={{ backgroundColor: c }}
          className={`h-7 w-7 rounded-full border-2 ${value === c ? 'ring-2 ring-ring border-white' : 'border-transparent'}`}
          aria-label={c}
        />
      ))}
    </div>
  );
}
