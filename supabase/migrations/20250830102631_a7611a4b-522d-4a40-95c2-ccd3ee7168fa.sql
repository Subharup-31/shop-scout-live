-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create product_sources table for different e-commerce platforms
CREATE TABLE public.product_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  source_name TEXT NOT NULL, -- Amazon, Flipkart, etc.
  source_url TEXT NOT NULL,
  current_price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'INR' NOT NULL,
  availability BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create price_history table for tracking price changes
CREATE TABLE public.price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_source_id UUID REFERENCES public.product_sources(id) ON DELETE CASCADE NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'INR' NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Products are viewable by everyone" 
ON public.products 
FOR SELECT 
USING (true);

CREATE POLICY "Product sources are viewable by everyone" 
ON public.product_sources 
FOR SELECT 
USING (true);

CREATE POLICY "Price history is viewable by everyone" 
ON public.price_history 
FOR SELECT 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_sources_updated_at
    BEFORE UPDATE ON public.product_sources
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_products_name ON public.products(name);
CREATE INDEX idx_product_sources_product_id ON public.product_sources(product_id);
CREATE INDEX idx_product_sources_price ON public.product_sources(current_price);
CREATE INDEX idx_price_history_product_source_id ON public.price_history(product_source_id);
CREATE INDEX idx_price_history_recorded_at ON public.price_history(recorded_at);

-- Insert sample data
INSERT INTO public.products (name, category, image_url) VALUES
('iPhone 15 Pro', 'Electronics', 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400'),
('Samsung Galaxy S24', 'Electronics', 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400'),
('MacBook Air M3', 'Electronics', 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400'),
('Sony WH-1000XM4', 'Electronics', 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400');

-- Insert sample product sources
INSERT INTO public.product_sources (product_id, source_name, source_url, current_price) 
SELECT 
  p.id,
  'Amazon',
  'https://amazon.in/product/' || p.id,
  CASE 
    WHEN p.name LIKE '%iPhone%' THEN 99999.00
    WHEN p.name LIKE '%Samsung%' THEN 89999.00
    WHEN p.name LIKE '%MacBook%' THEN 119999.00
    WHEN p.name LIKE '%Sony%' THEN 25999.00
  END
FROM public.products p;

INSERT INTO public.product_sources (product_id, source_name, source_url, current_price) 
SELECT 
  p.id,
  'Flipkart',
  'https://flipkart.com/product/' || p.id,
  CASE 
    WHEN p.name LIKE '%iPhone%' THEN 98999.00
    WHEN p.name LIKE '%Samsung%' THEN 88999.00
    WHEN p.name LIKE '%MacBook%' THEN 118999.00
    WHEN p.name LIKE '%Sony%' THEN 24999.00
  END
FROM public.products p;

-- Enable realtime for price updates
ALTER TABLE public.product_sources REPLICA IDENTITY FULL;
ALTER publication supabase_realtime ADD TABLE public.product_sources;