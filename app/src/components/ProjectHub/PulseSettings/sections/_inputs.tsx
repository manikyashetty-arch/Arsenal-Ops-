import React from 'react';
import { Input } from '@/components/ui/input';

export const NumberInput = React.memo<{ value: number; onChange: (n: number) => void }>(
  ({ value, onChange }) => (
    <Input
      type="number"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] text-white"
    />
  ),
);
NumberInput.displayName = 'NumberInput';

export const TextInput = React.memo<{
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
}>(({ value, onChange, placeholder }) => (
  <Input
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className="bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.07)] text-white"
  />
));
TextInput.displayName = 'TextInput';
