// يختار قاعدة البيانات: Supabase (مجانية على الإنترنت) إذا وُجدت SUPABASE_URL و SUPABASE_KEY، وإلا SQLite محلية.
module.exports = process.env.SUPABASE_URL && process.env.SUPABASE_KEY ? require('./db-supabase') : require('./db-sqlite');
