-- Remove all placeholder/seed providers from the database
DELETE FROM providers WHERE wallet LIKE 'PROVIDER_%';
