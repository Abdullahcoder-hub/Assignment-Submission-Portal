import React from 'react';
import { getPasswordRequirementStatus } from '../utils/passwordRequirements';

interface PasswordRequirementsProps {
  password: string;
}

export const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({ password }) => {
  const requirements = getPasswordRequirementStatus(password);

  return (
    <div className="mt-2 rounded-xl border border-[#E3DCCF] bg-[#F5F0E6]/60 p-3 text-xs">
      <p className="mb-1.5 font-semibold text-[#172B45]">Password Requirements:</p>
      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {requirements.map(({ label, isMet }) => (
          <li
            key={label}
            className={`flex items-center gap-1.5 text-[11px] leading-tight transition-colors ${
              isMet ? 'font-medium text-emerald-700' : 'text-[#687386]'
            }`}
          >
            <span className={`inline-block text-xs ${isMet ? 'text-emerald-600 font-bold' : 'text-[#687386]/60'}`}>
              {isMet ? '✓' : '•'}
            </span>
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
