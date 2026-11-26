import React from 'react'

export const ROLES = ['Founder', 'Operator', 'Investor'] as const
export type Role = (typeof ROLES)[number]

/** One tap to say who is asking, so requests can be sorted. Square, like the rest of Stoa. */
export function RoleChoice({
  value,
  onChange,
  tone = 'light',
}: {
  value: Role | null
  onChange: (role: Role) => void
  tone?: 'light' | 'dark'
}) {
  const dark = tone === 'dark'
  return (
    <fieldset className="mt-6">
      <legend className={`text-xs ${dark ? 'text-paper/50' : 'text-muted'}`}>I'm a</legend>
      <div className={`mt-2 grid grid-cols-3 border ${dark ? 'border-paper/20' : 'border-rule'}`}>
        {ROLES.map((role, i) => {
          const on = value === role
          return (
            <button
              key={role}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(role)}
              className={[
                'whitespace-nowrap py-2 text-sm transition-[background-color,color] duration-150 ease-soft',
                i > 0 ? (dark ? 'border-l border-paper/20' : 'border-l border-rule') : '',
                on
                  ? dark
                    ? 'bg-paper text-ink'
                    : 'bg-ink text-paper'
                  : dark
                    ? 'text-paper/70 hover:bg-paper/10 hover:text-paper'
                    : 'text-ink/70 hover:bg-ink/5 hover:text-ink',
              ].join(' ')}
            >
              {role}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
