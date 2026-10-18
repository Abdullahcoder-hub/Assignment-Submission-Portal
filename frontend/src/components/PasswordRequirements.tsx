import React from 'react';
import { getPasswordRequirementStatus } from '../utils/passwordRequirements';

interface PasswordRequirementsProps {
  password: string;
}

export const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({ password }) => {
  const requirements = getPasswordRequirementStatus(password);

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
      <p className="mb-1.5 font-bold text-slate-700">Password Security Requirements:</p>
      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {requirements.map(({ label, isMet }) => (
          <li key={label} className={isMet ? 'font-semibold text-emerald-800' : 'text-slate-500'}>
            {isMet ? '✓' : '•'} {label}
          </li>
        ))}
      </ul>
    </div>
  );
};
