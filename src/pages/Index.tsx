import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type ProductSource = {
  id: string;
  source_name: string;
  source_url: string;
  current_price: number;
  currency: string;
  availability: boolean;
  updated_at: string | null;
};

type Product = {
  id: string;
  name: string;
  category: string | null;
  image_url: string | null;
  product_sources: ProductSource[];
};

const fetchProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase
    .from("products")
    .select("id,name,category,image_url,product_sources(id,source_name,source_url,current_price,currency,availability,updated_at)")
    .order("name");
  if (error) throw error;
  return (data as unknown as Product[]) || [];
};

const currency = (n: number, code = "INR") =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: code }).format(n);

const Index = () => {
  const { data: products = [], isLoading, error } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
  });

  const [search, setSearch] = useState("");
  const [sessionUser, setSessionUser] = useState<string | null>(null);

  // Track price state and history
  const [priceState, setPriceState] = useState<Record<string, { prev: number; curr: number }>>({});
  const historyRef = useRef<Record<string, number[]>>({});
  const bestPriceRef = useRef<Record<string, number | undefined>>({});

  // Auth state for header actions
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUser(session?.user?.id ?? null);
    });
    supabase.auth.getSession().then(({ data }) => setSessionUser(data.session?.user?.id ?? null));
    return () => subscription.unsubscribe();
  }, []);

  // Initialize price state from query data
  useEffect(() => {
    const next: Record<string, { prev: number; curr: number }> = {};
    products.forEach((p) => {
      p.product_sources?.forEach((s) => {
        next[s.id] = { prev: s.current_price, curr: s.current_price };
        historyRef.current[s.id] = [s.current_price];
      });
      const min = Math.min(...(p.product_sources?.map((s) => s.current_price) || [Infinity]));
      bestPriceRef.current[p.id] = Number.isFinite(min) ? min : undefined;
    });
    setPriceState(next);
  }, [products]);

  // Supabase realtime subscription (if backend updates occur)
  useEffect(() => {
    const channel = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "product_sources" },
        (payload) => {
          const row = payload.new as ProductSource & { current_price: number };
          setPriceState((ps) => {
            const prev = ps[row.id]?.curr ?? row.current_price;
            const curr = row.current_price;
            const next = { ...ps, [row.id]: { prev, curr } };
            historyRef.current[row.id] = [...(historyRef.current[row.id] || []), curr].slice(-20);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Simulate real-time updates on client for demo
  useEffect(() => {
    const timer = setInterval(() => {
      setPriceState((ps) => {
        const next: typeof ps = { ...ps };
        Object.keys(next).forEach((id) => {
          const { curr } = next[id];
          // Random delta within +/- 2.5%
          const deltaPct = (Math.random() - 0.5) * 0.05;
          const newPrice = Math.max(100, +(curr * (1 + deltaPct)).toFixed(2));
          next[id] = { prev: curr, curr: newPrice };
          historyRef.current[id] = [...(historyRef.current[id] || []), newPrice].slice(-30);
        });
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // AI-style notifications based on changes
  useEffect(() => {
    // For each product, detect new lowest price
    products.forEach((p) => {
      const sources = p.product_sources || [];
      if (!sources.length) return;
      const currentMin = Math.min(...sources.map((s) => priceState[s.id]?.curr ?? s.current_price));
      const prevMin = bestPriceRef.current[p.id];
      if (prevMin !== undefined && currentMin < prevMin) {
        toast.success(`Lowest price found for ${p.name}: ${currency(currentMin)} (was ${currency(prevMin)})`);
      }
      bestPriceRef.current[p.id] = currentMin;
    });
  }, [priceState, products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) return toast.error(error.message);
    toast("Signed out");
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-semibold text-foreground">
            PricePulse
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">
              {sessionUser ? "Account" : "Login"}
            </Link>
            {sessionUser && (
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Sign out
              </Button>
            )}
          </div>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-foreground">
          Real-Time Product Comparison
        </h1>
        <p className="mb-6 text-muted-foreground">
          Search products and compare live prices across stores. Prices update every few seconds.
        </p>

        <div className="mb-8 flex items-center gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products (e.g., iPhone, MacBook)"
            aria-label="Search products"
          />
        </div>

        {isLoading && <p className="text-muted-foreground">Loading products…</p>}
        {error && <p className="text-[hsl(var(--destructive))]">Failed to load products</p>}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const sources = p.product_sources || [];
            const lowest = sources.reduce<{ price: number; source?: ProductSource }>((acc, s) => {
              const curr = priceState[s.id]?.curr ?? s.current_price;
              if (acc.price === 0 || curr < acc.price) return { price: curr, source: s };
              return acc;
            }, { price: 0 });

            return (
              <article key={p.id} className="overflow-hidden rounded-lg border bg-card shadow-sm">
                {p.image_url && (
                  <img
                    src={p.image_url}
                    alt={`Product photo of ${p.name}`}
                    loading="lazy"
                    className="h-44 w-full object-cover"
                  />
                )}
                <div className="space-y-3 p-5">
                  <h2 className="text-lg font-semibold text-foreground">{p.name}</h2>
                  {lowest.source && (
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm text-muted-foreground">Best:</span>
                      <span className="text-xl font-bold">{currency(lowest.price, lowest.source.currency)}</span>
                      <a
                        href={lowest.source.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary underline-offset-4 hover:underline"
                        aria-label={`Buy ${p.name} on ${lowest.source.source_name}`}
                      >
                        {lowest.source.source_name}
                      </a>
                    </div>
                  )}

                  <ul className="divide-y rounded-md border">
                    {sources.map((s) => {
                      const prev = priceState[s.id]?.prev ?? s.current_price;
                      const curr = priceState[s.id]?.curr ?? s.current_price;
                      const diff = +(curr - prev).toFixed(2);
                      const wentDown = curr < prev;
                      const wentUp = curr > prev;
                      const color = wentDown
                        ? "text-[hsl(var(--success))]"
                        : wentUp
                        ? "text-[hsl(var(--destructive))]"
                        : "text-foreground";

                      // Announce notable drop
                      if (wentDown && Math.abs(diff) / prev > 0.02) {
                        toast(`Price dropped from ${currency(prev)} to ${currency(curr)} for ${p.name} @ ${s.source_name}`);
                      }

                      return (
                        <li key={s.id} className="flex items-center justify-between px-3 py-2">
                          <div className="min-w-0 pr-3">
                            <p className="truncate text-sm text-foreground">{s.source_name}</p>
                            <p className="truncate text-xs text-muted-foreground">{new URL(s.source_url).hostname}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className={cn("text-sm font-medium tabular-nums", color)}>
                              {currency(curr, s.currency)}
                              {diff !== 0 && (
                                <span className="ml-2 text-xs">
                                  {wentDown ? "-" : "+"}
                                  {currency(Math.abs(diff), s.currency)}
                                </span>
                              )}
                            </div>
                            <Button asChild variant="secondary" size="sm">
                              <a href={s.source_url} target="_blank" rel="noopener noreferrer">
                                Buy
                              </a>
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>

        {filtered.length === 0 && !isLoading && (
          <p className="mt-10 text-center text-muted-foreground">No products match your search.</p>
        )}
      </section>

      <aside className="mx-auto max-w-6xl px-4 pb-12">
        <h2 className="mb-2 text-lg font-semibold">Live agent updates</h2>
        <p className="text-sm text-muted-foreground">
          You will see price alerts and lowest-price announcements here and as toasts.
        </p>
      </aside>
    </main>
  );
};

export default Index;
