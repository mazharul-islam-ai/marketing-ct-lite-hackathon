import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { SEOInputType } from '../types';

interface SEOInputFormProps {
  type: SEOInputType;
  defaultValue?: string;
  placeholder?: string;
  label?: string;
  isLoading?: boolean;
  disabled?: boolean;
  onSubmit: (value: string) => void;
}

const TYPE_CONFIG: Record<SEOInputType, { label: string; placeholder: string }> = {
  url: { label: 'Page URL', placeholder: 'https://example.com/page' },
  keyword: { label: 'Seed Keyword', placeholder: 'Enter a keyword to research...' },
  domain: { label: 'Domain', placeholder: 'example.com' },
  domains: { label: 'Competitor Domains', placeholder: 'competitor1.com, competitor2.com (one per line)' },
};

function validateInput(type: SEOInputType, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'This field is required.';

  if (type === 'url') {
    try {
      new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    } catch {
      return 'Enter a valid URL.';
    }
  }

  if (type === 'domain') {
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
    const clean = trimmed.replace(/^https?:\/\//, '').split('/')[0];
    if (!domainRegex.test(clean)) return 'Enter a valid domain.';
  }

  if (type === 'domains') {
    const domains = trimmed.split(/[\n,]/).map((d) => d.trim()).filter(Boolean);
    if (domains.length === 0) return 'Enter at least one competitor domain.';
  }

  return null;
}

export function SEOInputForm({
  type,
  defaultValue = '',
  placeholder,
  label,
  isLoading = false,
  disabled = false,
  onSubmit,
}: SEOInputFormProps) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  const config = TYPE_CONFIG[type];
  const displayLabel = label ?? config.label;
  const displayPlaceholder = placeholder ?? config.placeholder;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateInput(type, value);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onSubmit(value.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Label htmlFor={`seo-input-${type}`}>{displayLabel}</Label>
      {type === 'domains' ? (
        <Textarea
          id={`seo-input-${type}`}
          rows={3}
          placeholder={displayPlaceholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled || isLoading}
        />
      ) : (
        <Input
          id={`seo-input-${type}`}
          placeholder={displayPlaceholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled || isLoading}
        />
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={disabled || isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Analyze
      </Button>
    </form>
  );
}
