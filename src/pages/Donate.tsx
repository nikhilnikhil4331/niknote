import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';

const plans = [
  { code: 'weekly', price: 49, title: 'Weekly support', note: '₹49 — thank you for a week of NikNote' },
  { code: 'monthly', price: 99, title: 'Monthly support', note: '₹99 — helps keep NikNote free for everyone' },
];

export default function Donate() {
  const navigate = useNavigate();
  return (
    <main className="min-h-screen bg-background px-4 py-6 pb-28">
      <div className="mx-auto max-w-md space-y-6">
        <Link to="/" className="inline-flex min-h-[44px] items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={17} /> Home</Link>
        <header className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Heart /></div>
          <h1 className="text-2xl font-semibold text-foreground">Support NikNote</h1>
          <p className="text-sm text-muted-foreground">Every feature is free for everyone right now. If NikNote helps you, you can donate using one of these plans.</p>
        </header>
        <div className="space-y-3">
          {plans.map(p => (
            <section key={p.code} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-4">
              <div className="flex-1"><h2 className="font-semibold text-foreground">{p.title}</h2><p className="text-sm text-muted-foreground">{p.note}</p></div>
              <Button className="min-h-[44px]" onClick={() => navigate(`/payment?plan=${p.code}`)}>Donate ₹{p.price}</Button>
            </section>
          ))}
        </div>
        <p className="text-xs text-center text-muted-foreground">Payments are secure. Donating is optional — nothing gets locked if you don't.</p>
      </div>
    </main>
  );
}
