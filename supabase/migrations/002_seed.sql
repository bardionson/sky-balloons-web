-- Initial price (low for testing — raise before exhibition in Supabase dashboard)
INSERT INTO settings (key, value)
VALUES ('mint_price_usd', '1.00')
ON CONFLICT (key) DO NOTHING;
