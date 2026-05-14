import React from 'react';

export const Section: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => (
  <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-2xl p-5 space-y-4">
    <div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {subtitle && <p className="text-xs text-[#737373] mt-0.5">{subtitle}</p>}
    </div>
    {children}
  </div>
);

export const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({
  label,
  children,
  className,
}) => (
  <div className={className}>
    <label className="block text-[10px] uppercase tracking-wider text-[#737373] mb-1">
      {label}
    </label>
    {children}
  </div>
);
