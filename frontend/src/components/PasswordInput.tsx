import React, { InputHTMLAttributes, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const PasswordInput: React.FC<PasswordInputProps> = ({ className = '', ...props }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`w-full h-12 pl-4 pr-11 bg-white border border-[#E3DCCF] rounded-xl text-[#172B45] text-sm placeholder:text-[#687386]/60 focus:outline-none focus:border-[#D6A84F] focus:ring-2 focus:ring-[#D6A84F]/25 transition ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center rounded-lg text-[#687386] hover:text-[#172B45] focus:outline-none focus:ring-2 focus:ring-[#D6A84F]/40 transition"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
};
